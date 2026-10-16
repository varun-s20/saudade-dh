/**
 * End-to-end check of the real backend (NEXT_PUBLIC_DATA_SOURCE=api) through its HTTP API.
 *
 *   npm run build && npx next start -p 3200      (in another terminal, with .env.local set)
 *   npm run api:smoke -- --base http://localhost:3200
 *   … --env-file <file>  read ADMIN_*, DATABASE_URL, CRON_SECRET… from another env file
 *   … --skip-media       database-only run (no Supabase Storage): skips uploads and signed URLs
 *   … --breaker          also trip the claim breaker (300 failed claims) and pass the Turnstile
 *                        check. Local/CI databases only: it blocks plain claims for 6 hours.
 *
 * Creates its own small batches (so the demo codes are never used up), then walks the whole life
 * of an envelope: claim → upload to Storage → normalised photos and voice → four stamps → seal →
 * recipient open → reveal (once) → admin tools, history and restore, batch lifecycle, the launch
 * checklist and the scheduled jobs. Every step is a PASS/FAIL line; exits non-zero on any failure.
 *
 * Admin sign-in: with DATABASE_URL available the script creates a throwaway admin for the run and
 * disables it at the end; otherwise it signs in as ADMIN_EMAIL / ADMIN_PASSWORD.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { connect, tempAdmin as makeTempAdmin } from "./lib/ops-common.mjs";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3200").replace(/\/+$/, "");
const envFile = opt("env-file", path.join(process.cwd(), ".env.local"));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const SKIP_MEDIA = args.includes("--skip-media");
const BREAKER = args.includes("--breaker");
const CRON = process.env.CRON_SECRET?.trim();

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? `  (${extra})` : ""}`);
  return cond;
}

let cookie = "";
async function call(method, p, { body, token, admin, raw, headers = {} } = {}) {
  const h = { accept: "application/json", ...headers };
  if (body !== undefined) h["content-type"] = "application/json";
  if (token) h.authorization = `Bearer ${token}`;
  if (admin) {
    if (cookie) h.cookie = cookie;
    if (method !== "GET") h["x-saudade-csrf"] = "1";
  }
  const res = await fetch(BASE + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const sc = res.headers.get("set-cookie");
  if (sc && admin) cookie = sc.split(";")[0];
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function uploadBytes(token, bytes, meta) {
  const t = await call("POST", "/api/sender/media/uploads", { token, body: { ...meta, bytes: bytes.length } });
  if (t.status !== 201) return { ticket: t };
  const put = await fetch(t.data.upload.url, { method: "PUT", headers: t.data.upload.headers, body: bytes });
  const done = await call("POST", `/api/sender/media/${t.data.mediaId}/complete`, { token });
  return { ticket: t, put, done, mediaId: t.data.mediaId };
}
const upload = (token, file, meta) => uploadBytes(token, fs.readFileSync(file), meta);

// ─── Audio fixtures (made with the bundled ffmpeg) ───────────────────────────

function makeAudio(name, ffArgs) {
  const out = path.join(os.tmpdir(), `saudade-smoke-${process.pid}-${name}`);
  execFileSync(require("ffmpeg-static"), ["-hide_banner", "-loglevel", "error", "-y", ...ffArgs, out]);
  return out;
}

// ─── A throwaway admin (when the database is reachable) ──────────────────────

let db = null;
let tempAdmin = null;
async function adminCredentials() {
  if (!process.env.DATABASE_URL) return { email: (process.env.ADMIN_EMAIL || "zeya@saudade.example").toLowerCase(), password: process.env.ADMIN_PASSWORD };
  db = connect();
  tempAdmin = await makeTempAdmin(db, "smoke");
  return { email: tempAdmin.email, password: tempAdmin.password };
}

try {
  const health = await call("GET", "/api/health");
  check("health: database reachable, version reported", health.status === 200 && health.data?.db === true && typeof health.data?.version === "string", JSON.stringify(health.data));

  // ── Admin: sign in ───────────────────────────────────────────────────────
  const ADMIN = await adminCredentials();
  check(
    "admin: wrong password refused",
    (await call("POST", "/api/admin/session", { admin: true, body: { email: ADMIN.email, password: "definitely-wrong" } })).status === 401,
  );
  const signin = await call("POST", "/api/admin/session", { admin: true, body: ADMIN });
  check("admin: sign in", signin.status === 200 && signin.data?.email === ADMIN.email, `status ${signin.status}`);

  check("admin: session cookie opens the panel", (await call("GET", "/api/admin/stats", { admin: true })).status === 200);

  check(
    "admin: CSRF header required",
    (await fetch(`${BASE}/api/admin/batches`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" })).status === 403,
  );
  const batch = await call("POST", "/api/admin/batches", { admin: true, body: { count: 3, label: `Smoke ${new Date().toISOString().slice(0, 16)}` } });
  check("admin: generate batch of 3 (codes returned once)", batch.status === 201 && batch.data?.rows?.length === 3, `status ${batch.status}`);
  check(
    "admin: the batch records its chip domain, with 4-character codes",
    batch.data?.batch?.status === "generated" && typeof batch.data.batch.chipDomain === "string" && batch.data.rows?.every((r) => /^SAUD-[A-Z2-9]{4}$/.test(r.code)),
  );
  const [r1, r2, r3] = batch.data.rows;

  // ── Claim ─────────────────────────────────────────────────────────────────
  check("claim: unknown code → 422 invalid_code", (await call("POST", "/api/claim", { body: { code: "SAUD-ZZZZ" } })).data?.code === "invalid_code");
  const claim = await call("POST", "/api/claim", { body: { code: r1.code.toLowerCase().replaceAll("-", " ") } });
  check("claim: fresh code (any case/spacing) → token", claim.status === 200 && /^[a-z2-7]{32}$/.test(claim.data?.token ?? ""), `status ${claim.status}`);
  const token = claim.data.token;
  check("claim: same code again → 409 already_claimed", (await call("POST", "/api/claim", { body: { code: r1.code } })).data?.code === "already_claimed");

  let env = await call("GET", "/api/sender/envelope", { token });
  check("sender: envelope loads, status claimed", env.status === 200 && env.data?.unit?.status === "claimed");
  check("sender: unknown token → 404", (await call("GET", "/api/sender/envelope", { token: "a".repeat(32) })).status === 404);

  // ── Media: straight to Storage, verified and normalised on complete ──────
  const STAMPS = SKIP_MEDIA ? 2 : 4;
  let photo = {};
  let voice = {};
  if (!SKIP_MEDIA) {
    photo = await upload(token, "public/demo/photos/01.jpg", { kind: "photo", mime: "image/jpeg", width: 1600, height: 1067 });
    check("media: photo upload ticket", photo.ticket.status === 201);
    check("media: PUT to Storage", photo.put?.ok === true, `status ${photo.put?.status}`);
    check("media: photo verified and normalised → ready", photo.done?.status === 200 && photo.done.data?.kind === "photo" && photo.done.data?.width > 0);

    const webm = makeAudio("voice.webm", ["-f", "lavfi", "-i", "sine=frequency=330:duration=4", "-c:a", "libopus", "-b:a", "32k"]);
    voice = await upload(token, webm, { kind: "voice", mime: "audio/webm;codecs=opus", durationSec: 99 });
    check("media: Android-style WebM/Opus voice note → ready", voice.done?.status === 200 && voice.done.data?.kind === "voice");
    check("media: …its duration is measured by the server, not taken from the browser", Math.abs((voice.done?.data?.durationSec ?? 0) - 4) < 0.6, `${voice.done?.data?.durationSec}s`);

    const long = makeAudio("long.webm", ["-f", "lavfi", "-i", "anullsrc=r=8000:cl=mono", "-t", "186", "-c:a", "libopus", "-b:a", "6k"]);
    const tooLong = await upload(token, long, { kind: "voice", mime: "audio/webm", durationSec: 30 });
    check("media: a voice note over 3:00 is refused even if the browser says 30 s", tooLong.done?.status === 422 && tooLong.done.data?.code === "too_long");
    for (const f of [webm, long]) fs.rmSync(f, { force: true });

    const fake = await uploadBytes(token, Buffer.from("<html>not a photo</html>"), { kind: "photo", mime: "image/jpeg", width: 10, height: 10 });
    check("media: a non-image disguised as JPEG is rejected", fake.done?.status === 422 && fake.done.data?.code === "upload_failed");
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(4000)]);
    const corrupt = await uploadBytes(token, broken, { kind: "photo", mime: "image/jpeg", width: 10, height: 10 });
    check("media: a JPEG header on garbage is rejected by the decoder", corrupt.done?.status === 422 && corrupt.done.data?.code === "upload_failed");
  }
  check(
    "media: too large refused before upload",
    (await call("POST", "/api/sender/media/uploads", { token, body: { kind: "photo", mime: "image/jpeg", bytes: 99 * 1048576 } })).status === 413,
  );

  // ── The four stamps ──────────────────────────────────────────────────────
  if (!SKIP_MEDIA) {
    const photos = await call("PUT", "/api/sender/contents/photos", {
      token,
      body: { kind: "photos", items: [{ id: "p1", mediaId: photo.mediaId, width: 1600, height: 1067, caption: "The pier" }] },
    });
    check("save: photos v1, status → filled", photos.status === 200 && photos.data?.version === 1);
    check(
      "save: someone else's / unknown media → 422",
      (
        await call("PUT", "/api/sender/contents/photos", {
          token,
          body: { kind: "photos", items: [{ id: "p1", mediaId: `med_${"a".repeat(26)}`, width: 10, height: 10 }] },
        })
      ).status === 422,
    );
  }
  const letter = await call("PUT", "/api/sender/contents/letter", {
    token,
    body: { kind: "letter", to: "Theo", body: "Hello from the smoke test.", signoff: "Always,", from: "Mira" },
  });
  check("save: letter", letter.status === 200);
  const letter2 = await call("PUT", "/api/sender/contents/letter", {
    token,
    body: { kind: "letter", to: "Theo", body: "Second draft.", signoff: "Always,", from: "Mira" },
  });
  check("save: letter again → version 2 (history kept)", letter2.data?.version === 2);
  if (!SKIP_MEDIA)
    check(
      "save: voice",
      (
        await call("PUT", "/api/sender/contents/voice", {
          token,
          body: { kind: "voice", mediaId: voice.mediaId, durationSec: 4, mime: "audio/webm", peaks: [0.2, 0.5, 0.9], source: "recorded" },
        })
      ).status === 200,
    );
  const song = await call("PUT", "/api/sender/contents/song", {
    token,
    body: {
      kind: "song",
      provider: "spotify",
      url: "https://evil.example/",
      trackId: "6dGnYIeXmHdcikdzNNDMm2",
      title: "Here Comes The Sun",
      artist: "The Beatles",
      embedUrl: "https://evil.example/embed",
    },
  });
  check(
    "save: song links re-derived server-side (client URLs ignored)",
    song.status === 200 && song.data?.content?.embedUrl?.startsWith("https://open.spotify.com/embed/track/6dGnYIeXmHdcikdzNNDMm2"),
  );

  // ── Seal, then the recipient ─────────────────────────────────────────────
  const sealed = await call("POST", "/api/sender/seal", { token });
  check("seal: status → sealed", sealed.status === 200 && sealed.data?.unit?.status === "sealed");
  const slug = sealed.data.unit.slug;
  let rec = await call("GET", `/api/t/${slug}`);
  check(
    `recipient: envelope with ${STAMPS} stamps, not yet opened`,
    rec.status === 200 && Object.keys(rec.data?.contents ?? {}).length === STAMPS && rec.data?.revealedAt === null,
  );
  if (!SKIP_MEDIA) {
    const main = rec.data?.mediaUrls?.[photo.mediaId]?.url;
    const img = main ? await fetch(main) : null;
    check("recipient: photo served as the normalised display JPEG", img?.ok === true && img.headers.get("content-type") === "image/jpeg" && main.includes("/media/"));
    const thumbUrl = rec.data?.mediaUrls?.[`${photo.mediaId}:thumb`]?.url;
    const thumb = thumbUrl ? await fetch(thumbUrl) : null;
    check("recipient: a WebP thumbnail is signed alongside it", thumb?.ok === true && thumb.headers.get("content-type") === "image/webp");
    check("recipient: the voice note is reported and served as AAC/m4a", rec.data?.contents?.voice?.content?.mime === "audio/mp4");
    const audioUrl = rec.data?.mediaUrls?.[voice.mediaId]?.url;
    const audio = audioUrl ? await fetch(audioUrl) : null;
    check("recipient: …and the file is audio/mp4", audio?.ok === true && audio.headers.get("content-type") === "audio/mp4");
  }
  check("recipient: GET has no side effects", (await call("GET", `/api/t/${slug}`)).data?.revealedAt === null);
  check("recipient: unknown slug → 404", (await call("GET", "/api/t/zzzzzzzzzzzz")).status === 404);

  const rv = (tok, extra = {}) =>
    call("POST", `/api/t/${slug}/reveal`, { token: tok, body: { skipped: false, reducedMotion: false }, headers: { "idempotency-key": crypto.randomUUID() }, ...extra });
  check("reveal: from the sender's own device → 204", (await rv(token)).status === 204);
  check("reveal: …and the first open is NOT used up", (await call("GET", `/api/t/${slug}`)).data?.revealedAt === null);
  check("reveal: an admin's packing-check tap → 204", (await rv(undefined, { admin: true })).status === 204);
  check("reveal: …and the first open is still NOT used up", (await call("GET", `/api/t/${slug}`)).data?.revealedAt === null);
  check("reveal: recipient → 204", (await rv(undefined)).status === 204);
  rec = await call("GET", `/api/t/${slug}`);
  check("reveal: recorded once (status revealed)", rec.data?.status === "revealed" && rec.data?.revealedAt !== null);
  check(
    "reveal: a second tap is a no-op duplicate",
    (await rv(undefined)).status === 204 && (await call("GET", `/api/t/${slug}`)).data?.revealedAt === rec.data.revealedAt,
  );
  if (!SKIP_MEDIA) {
    const redirect = await call("GET", `/api/media/${photo.mediaId}`, { raw: true });
    check("media: /api/media/{id} → 302 to the display file", redirect.status === 302 && (redirect.headers.get("location") ?? "").includes("display.jpg"));
    const thumbRedirect = await call("GET", `/api/media/${photo.mediaId}?v=thumb`, { raw: true });
    check("media: /api/media/{id}?v=thumb → 302 to the thumbnail", thumbRedirect.status === 302 && (thumbRedirect.headers.get("location") ?? "").includes("thumb.webp"));
  }

  // ── Song health (needs the database to simulate the provider dropping the track) ──
  if (db) {
    await db`update song_catalog set available = false, unavailable_since = now() where provider = 'spotify' and track_id = '6dGnYIeXmHdcikdzNNDMm2'`;
    check("song: a track the provider dropped shows as unavailable", (await call("GET", `/api/t/${slug}`)).data?.contents?.song?.content?.unavailable === true);
    await db`update song_catalog set available = true, unavailable_since = null where provider = 'spotify' and track_id = '6dGnYIeXmHdcikdzNNDMm2'`;
    check("song: …and plays again when it comes back", !(await call("GET", `/api/t/${slug}`)).data?.contents?.song?.content?.unavailable);
  }

  // ── Admin tools ──────────────────────────────────────────────────────────
  const stats = await call("GET", "/api/admin/stats", { admin: true });
  check("admin: stats", stats.status === 200 && stats.data?.total >= 3);
  const found = await call("GET", `/api/admin/units?search=${encodeURIComponent(r1.code)}`, { admin: true });
  check("admin: search by full code (HMAC match), code masked", found.data?.total === 1 && found.data.items[0].code.includes("····"));
  const unitId = found.data.items[0].id;
  const detail = await call("GET", `/api/admin/units/${unitId}`, { admin: true });
  check("admin: unit detail (1 reveal, audit trail)", detail.status === 200 && detail.data?.reveals?.length === 1 && detail.data?.audit?.length >= 6);
  const letters = (detail.data?.history ?? []).filter((v) => v.kind === "letter");
  check("admin: history lists both letter versions, the newest current", letters.length === 2 && letters[0].version === 2 && letters[0].current && !letters[1].current && letters[1].restorable);
  check(
    "admin: restore letter v1",
    (await call("POST", `/api/admin/units/${unitId}/contents/letter/restore`, { admin: true, body: { version: 1 } })).status === 204,
  );
  rec = await call("GET", `/api/t/${slug}`);
  check("admin: …the recipient sees v1's words again, saved as v3", rec.data?.contents?.letter?.content?.body === "Hello from the smoke test." && rec.data.contents.letter.version === 3);
  check(
    "admin: restoring the current version is refused",
    (await call("POST", `/api/admin/units/${unitId}/contents/letter/restore`, { admin: true, body: { version: 3 } })).status === 400,
  );
  check("admin: reset reveal", (await call("POST", `/api/admin/units/${unitId}/reset-reveal`, { admin: true })).status === 204);
  rec = await call("GET", `/api/t/${slug}`);
  check("admin: …the next tap plays the first-tap again", rec.data?.status === "sealed" && rec.data?.revealedAt === null);
  const reset = await call("POST", `/api/admin/units/${unitId}/reset-code`, { admin: true });
  check("admin: reset code → new code", reset.status === 200 && /^SAUD-/.test(reset.data?.code ?? ""));
  check("admin: …old private link stops working", (await call("GET", "/api/sender/envelope", { token })).status === 404);
  const reclaim = await call("POST", "/api/claim", { body: { code: reset.data.code } });
  const env2 = await call("GET", "/api/sender/envelope", { token: reclaim.data?.token });
  check("admin: …new code re-claims the same envelope, contents kept", env2.status === 200 && Object.keys(env2.data?.contents ?? {}).length === STAMPS);

  const r2Id = (await call("GET", `/api/admin/units?search=${encodeURIComponent(r2.code)}`, { admin: true })).data.items[0].id;
  const mail = await call("POST", `/api/admin/units/${r2Id}/email-code`, { admin: true, body: { to: "buyer@example.com" } });
  check("admin: email code (Path B) mints a fresh code", mail.status === 200 && mail.data?.code && mail.data.code !== r2.code);
  check("admin: …the original card code no longer works", (await call("POST", "/api/claim", { body: { code: r2.code } })).data?.code === "invalid_code");
  check("admin: …the emailed code claims", (await call("POST", "/api/claim", { body: { code: mail.data.code } })).status === 200);

  const csv = await call("GET", `/api/admin/batches/${batch.data.batch.id}/export.csv`, { admin: true, raw: true });
  const csvText = await csv.text();
  check("admin: factory CSV (no codes in it)", csv.status === 200 && csvText.startsWith("unit_no,slug,url,ndef_bytes") && !csvText.includes(r3.code));
  check("admin: …URLs on the batch's own chip domain", csvText.includes(`https://${batch.data.batch.chipDomain}/t/`));
  check("admin: remove a stamp (support)", (await call("DELETE", `/api/admin/units/${unitId}/contents/song`, { admin: true })).status === 204);

  // ── Batch lifecycle ──────────────────────────────────────────────────────
  check(
    "batch: a batch with claimed codes can't be voided",
    (await call("POST", `/api/admin/batches/${batch.data.batch.id}/void`, { admin: true })).status === 409,
  );
  const spare = await call("POST", "/api/admin/batches", { admin: true, body: { count: 2, label: "Smoke spare" } });
  const voided = await call("POST", `/api/admin/batches/${spare.data.batch.id}/void`, { admin: true });
  check("batch: an unclaimed batch is voided", voided.status === 200 && voided.data?.status === "void");
  check("batch: …and its codes no longer claim", (await call("POST", "/api/claim", { body: { code: spare.data.rows[0].code } })).data?.code === "invalid_code");
  check("batch: a void batch can't be marked encoded", (await call("POST", `/api/admin/batches/${spare.data.batch.id}/encoded`, { admin: true })).status === 409);
  const encoded = await call("POST", `/api/admin/batches/${batch.data.batch.id}/encoded`, { admin: true });
  check("batch: mark encoded", encoded.status === 200 && encoded.data?.status === "encoded" && encoded.data.encodedAt);
  check("batch: an encoded batch can never be voided", (await call("POST", `/api/admin/batches/${batch.data.batch.id}/void`, { admin: true })).status === 409);
  const list = await call("GET", "/api/admin/batches", { admin: true });
  check("batch: list shows status and claim counts", list.data?.find((b) => b.id === batch.data.batch.id)?.claimedCount === 2);

  // ── Scheduled jobs and the launch checklist ──────────────────────────────
  check("cron: refused without the secret", (await call("GET", "/api/cron/daily")).status === 401);
  if (CRON) {
    const auth = { authorization: `Bearer ${CRON}` };
    const daily = await call("GET", "/api/cron/daily", { headers: auth });
    check("cron: nightly run completes", daily.status === 200 && daily.data?.ok === true, JSON.stringify(daily.data?.errors ?? daily.data));
    check("cron: jobs sweep", (await call("GET", "/api/cron/jobs", { headers: auth })).status === 200);
    check(
      "cron: the backup workflow can report in",
      (await call("POST", "/api/cron/backup-report", { headers: auth, body: { ok: true, summary: { units: 3, dbBytes: 1234 } } })).status === 204,
    );
  }
  const ready = await call("GET", "/api/admin/readiness", { admin: true });
  const byId = Object.fromEntries((ready.data?.checks ?? []).map((c) => [c.id, c]));
  check("readiness: the launch checklist answers", ready.status === 200 && ready.data?.checks?.length >= 10);
  check("readiness: chip domain and email are checked", Boolean(byId.chip_domain && byId.email));
  if (CRON) check("readiness: …nightly jobs and backups show as done", byId.cron?.status === "ok" && byId.backup?.status === "ok");

  // ── Recovery ─────────────────────────────────────────────────────────────
  check(
    "sender: save email for recovery",
    (await call("PUT", "/api/sender/email", { token: reclaim.data.token, body: { email: "mira@example.com" } })).status === 204,
  );
  check("recover: always 202 (known email)", (await call("POST", "/api/recover", { body: { email: "mira@example.com" } })).status === 202);
  check("recover: always 202 (unknown email: no enumeration)", (await call("POST", "/api/recover", { body: { email: "nobody@example.com" } })).status === 202);

  // ── The claim breaker (opt-in: needs Turnstile's test keys on the server) ─
  if (BREAKER) {
    for (let i = 0; i < 301; i++) {
      await call("POST", "/api/claim", { body: { code: "SAUD-ZZZZ" }, headers: { "x-forwarded-for": `198.51.100.${i % 250}, 10.0.0.${Math.floor(i / 250)}` } });
    }
    const blocked = await call("POST", "/api/claim", { body: { code: r3.code }, headers: { "x-forwarded-for": "203.0.113.9" } });
    check("breaker: after 300 failures every claim needs the bot check", blocked.status === 403 && blocked.data?.code === "challenge_required");
    const passedCheck = await call("POST", "/api/claim", { body: { code: r3.code, turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" }, headers: { "x-forwarded-for": "203.0.113.9" } });
    check("breaker: …and a passed check claims", passedCheck.status === 200);
  }

  check("admin: sign out", (await call("DELETE", "/api/admin/session", { admin: true })).status === 204);
  check("admin: …session gone", (await call("GET", "/api/admin/session", { admin: true })).status === 401);

  // Lock-out, on the throwaway admin only (it would lock a real account), from its own test address so repeated
  // runs never reach the 20-a-day limit per address.
  if (tempAdmin) {
    const headers = { "x-forwarded-for": `198.18.${randomBytes(1)[0]}.${randomBytes(1)[0]}` };
    for (let i = 0; i < 5; i++) await call("POST", "/api/admin/session", { admin: true, body: { email: ADMIN.email, password: "definitely-wrong" }, headers });
    const locked = await call("POST", "/api/admin/session", { admin: true, body: ADMIN, headers });
    check("admin: 5 wrong passwords lock the account (the right one is refused too)", locked.status === 401 && locked.data?.detail === "locked");
  }
} catch (e) {
  failed++;
  console.log(`FAIL crashed: ${e instanceof Error ? e.stack : e}`);
} finally {
  if (db) {
    if (tempAdmin) await tempAdmin.disable();
    await db.end();
  }
}

console.log(`\n${passed}/${passed + failed} checks passed.`);
process.exit(failed ? 1 : 0);
