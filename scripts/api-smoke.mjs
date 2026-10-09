/**
 * End-to-end check of the real backend (NEXT_PUBLIC_DATA_SOURCE=api) through its HTTP API.
 *
 *   npm run build && npx next start -p 3200      (in another terminal, with .env.local set)
 *   npm run api:smoke -- --base http://localhost:3200
 *   … --skip-media     database-only run (no Supabase Storage): skips uploads and signed URLs
 *
 * Creates its own small batch (so the demo codes are never used up), then walks the whole life of
 * an envelope: claim → upload to Storage → four stamps → seal → recipient open → reveal (once) →
 * admin tools. Every step is a PASS/FAIL line; exits non-zero on any failure.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3200").replace(/\/+$/, "");
const envFile = opt("env-file", path.join(process.cwd(), ".env.local"));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const SKIP_MEDIA = args.includes("--skip-media");
const ADMIN = { email: (process.env.ADMIN_EMAIL || "zeya@saudade.example").toLowerCase(), password: process.env.ADMIN_PASSWORD };

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

async function upload(token, file, meta) {
  const bytes = fs.readFileSync(file);
  const t = await call("POST", "/api/sender/media/uploads", { token, body: { ...meta, bytes: bytes.length } });
  if (t.status !== 201) return { ticket: t };
  const put = await fetch(t.data.upload.url, { method: "PUT", headers: t.data.upload.headers, body: bytes });
  const done = await call("POST", `/api/sender/media/${t.data.mediaId}/complete`, { token });
  return { ticket: t, put, done, mediaId: t.data.mediaId };
}

try {
  const health = await call("GET", "/api/health");
  check("health: database reachable", health.status === 200 && health.data?.db === true, JSON.stringify(health.data));

  // ── Admin: sign in, make a fresh batch of 3 ──────────────────────────────
  check(
    "admin: wrong password refused",
    (await call("POST", "/api/admin/session", { admin: true, body: { email: ADMIN.email, password: "definitely-wrong" } })).status === 401,
  );
  const signin = await call("POST", "/api/admin/session", { admin: true, body: ADMIN });
  check("admin: sign in", signin.status === 200 && signin.data?.email === ADMIN.email, `status ${signin.status}`);
  check(
    "admin: CSRF header required",
    (await fetch(`${BASE}/api/admin/batches`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" })).status === 403,
  );
  const batch = await call("POST", "/api/admin/batches", { admin: true, body: { count: 3, label: `Smoke ${new Date().toISOString().slice(0, 16)}` } });
  check("admin: generate batch of 3 (codes returned once)", batch.status === 201 && batch.data?.rows?.length === 3, `status ${batch.status}`);
  const [r1, r2, r3] = batch.data.rows;

  // ── Claim ─────────────────────────────────────────────────────────────────
  check("claim: unknown code → 422 invalid_code", (await call("POST", "/api/claim", { body: { code: "SAUD-ZZZZ" } })).data?.code === "invalid_code");
  const claim = await call("POST", "/api/claim", { body: { code: r1.code.toLowerCase().replace("-", " ") } });
  check("claim: fresh code (any case/spacing) → token", claim.status === 200 && /^[a-z2-7]{32}$/.test(claim.data?.token ?? ""), `status ${claim.status}`);
  const token = claim.data.token;
  check("claim: same code again → 409 already_claimed", (await call("POST", "/api/claim", { body: { code: r1.code } })).data?.code === "already_claimed");

  let env = await call("GET", "/api/sender/envelope", { token });
  check("sender: envelope loads, status claimed", env.status === 200 && env.data?.unit?.status === "claimed");
  check("sender: unknown token → 404", (await call("GET", "/api/sender/envelope", { token: "a".repeat(32) })).status === 404);

  // ── Media: straight to Storage, verified on complete ─────────────────────
  const STAMPS = SKIP_MEDIA ? 2 : 4;
  let photo = {};
  let voice = {};
  if (!SKIP_MEDIA) {
    photo = await upload(token, "public/demo/photos/01.jpg", { kind: "photo", mime: "image/jpeg", width: 1600, height: 1067 });
    check("media: photo upload ticket", photo.ticket.status === 201);
    check("media: PUT to Supabase Storage", photo.put?.ok === true, `status ${photo.put?.status}`);
    check("media: photo verified (magic bytes) → ready", photo.done?.status === 200 && photo.done.data?.kind === "photo");
    voice = await upload(token, "public/demo/voice/mira-voice.m4a", { kind: "voice", mime: "audio/mp4", durationSec: 68 });
    check("media: voice verified → ready", voice.done?.status === 200 && voice.done.data?.kind === "voice");
    fs.writeFileSync(path.join(process.cwd(), ".e2e-fake.jpg"), "<html>not a photo</html>");
    const fake = await upload(token, ".e2e-fake.jpg", { kind: "photo", mime: "image/jpeg", width: 10, height: 10 });
    fs.rmSync(path.join(process.cwd(), ".e2e-fake.jpg"));
    check("media: a non-image disguised as JPEG is rejected", fake.done?.status === 422 && fake.done.data?.code === "upload_failed");
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
          body: { kind: "voice", mediaId: voice.mediaId, durationSec: 68, mime: "audio/mp4", peaks: [0.2, 0.5, 0.9], source: "uploaded" },
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
    const signedUrl = rec.data?.mediaUrls?.[photo.mediaId]?.url;
    const img = signedUrl ? await fetch(signedUrl) : null;
    check("recipient: photo loads from a signed Storage URL", img?.ok === true && (img.headers.get("content-type") ?? "").startsWith("image/"));
  }
  check("recipient: GET has no side effects", (await call("GET", `/api/t/${slug}`)).data?.revealedAt === null);
  check("recipient: unknown slug → 404", (await call("GET", "/api/t/zzzzzzzzzzzz")).status === 404);

  const rv = (tok) =>
    call("POST", `/api/t/${slug}/reveal`, { token: tok, body: { skipped: false, reducedMotion: false }, headers: { "idempotency-key": crypto.randomUUID() } });
  check("reveal: from the sender's own device → 204", (await rv(token)).status === 204);
  check("reveal: …and the first open is NOT used up", (await call("GET", `/api/t/${slug}`)).data?.revealedAt === null);
  check("reveal: recipient → 204", (await rv(undefined)).status === 204);
  rec = await call("GET", `/api/t/${slug}`);
  check("reveal: recorded once (status revealed)", rec.data?.status === "revealed" && rec.data?.revealedAt !== null);
  check(
    "reveal: a second tap is a no-op duplicate",
    (await rv(undefined)).status === 204 && (await call("GET", `/api/t/${slug}`)).data?.revealedAt === rec.data.revealedAt,
  );
  if (!SKIP_MEDIA) {
    const redirect = await call("GET", `/api/media/${photo.mediaId}`, { raw: true });
    check("media: /api/media/{id} → 302 signed URL", redirect.status === 302 && (redirect.headers.get("location") ?? "").includes("/storage/v1/object/sign/"));
  }

  // ── Admin tools ──────────────────────────────────────────────────────────
  const stats = await call("GET", "/api/admin/stats", { admin: true });
  check("admin: stats", stats.status === 200 && stats.data?.total >= 3);
  const found = await call("GET", `/api/admin/units?search=${encodeURIComponent(r1.code)}`, { admin: true });
  check("admin: search by full code (HMAC match), code masked", found.data?.total === 1 && found.data.items[0].code.includes("····"));
  const unitId = found.data.items[0].id;
  const detail = await call("GET", `/api/admin/units/${unitId}`, { admin: true });
  check("admin: unit detail (1 reveal, audit trail)", detail.status === 200 && detail.data?.reveals?.length === 1 && detail.data?.audit?.length >= 6);
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
  check("admin: remove a stamp (support)", (await call("DELETE", `/api/admin/units/${unitId}/contents/song`, { admin: true })).status === 204);

  // ── Recovery ─────────────────────────────────────────────────────────────
  check(
    "sender: save email for recovery",
    (await call("PUT", "/api/sender/email", { token: reclaim.data.token, body: { email: "mira@example.com" } })).status === 204,
  );
  check("recover: always 202 (known email)", (await call("POST", "/api/recover", { body: { email: "mira@example.com" } })).status === 202);
  check("recover: always 202 (unknown email: no enumeration)", (await call("POST", "/api/recover", { body: { email: "nobody@example.com" } })).status === 202);

  check("admin: sign out", (await call("DELETE", "/api/admin/session", { admin: true })).status === 204);
  check("admin: …session gone", (await call("GET", "/api/admin/session", { admin: true })).status === 401);
} catch (e) {
  failed++;
  console.log(`FAIL crashed: ${e instanceof Error ? e.stack : e}`);
}

console.log(`\n${passed}/${passed + failed} checks passed.`);
process.exit(failed ? 1 : 0);
