/**
 * One-command backend setup for a Supabase project (docs/BACKEND.md).
 *
 *   npm run db:setup                    # secrets → migrations → storage bucket → admin → demo data
 *   npm run db:setup -- --no-demo       # everything except the demo envelopes
 *   npm run db:setup -- --reset --yes   # DROP every Saudade table and start again (staging only!)
 *   … --env-file path/to/.env.test       # use another env file (local testing)
 *   … --no-storage                       # skip the Storage bucket (database-only testing)
 *
 * Reads .env.local. Generates CODE_PEPPER_V1, IP_HASH_KEY and ADMIN_PASSWORD there if missing
 * (never overwrites a value). Safe to re-run: migrations are tracked, the bucket and admin are
 * upserted, and the demo is only seeded once.
 *
 * The hashing here must match lib/server/crypto.ts exactly (the API smoke test proves it by
 * claiming a seeded code): HMAC-SHA-256(pepper, "saudade/code/v1:" + body) for codes,
 * SHA-256 for tokens, scrypt PHC strings for the admin password.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const args = new Set(argv);
const ENV_FILE = argv.includes("--env-file") ? path.resolve(argv[argv.indexOf("--env-file") + 1]) : path.join(ROOT, ".env.local");

// ─── 1. Environment and secrets ──────────────────────────────────────────────

if (!fs.existsSync(ENV_FILE)) {
  console.error(`✗ ${path.basename(ENV_FILE)} not found. Copy .env.example to .env.local and fill in the Supabase values first.`);
  process.exit(1);
}
process.loadEnvFile(ENV_FILE);

const added = [];
function ensureSecret(name, make) {
  if (process.env[name]?.trim()) return;
  const value = make();
  // Fill an empty `NAME=` line (as copied from .env.example) in place; otherwise append.
  const text = fs.readFileSync(ENV_FILE, "utf8");
  const empty = new RegExp(`^${name}=[ \\t]*(?=\\r?$)`, "m");
  fs.writeFileSync(
    ENV_FILE,
    empty.test(text) ? text.replace(empty, `${name}=${value}`) : `${text}${text.endsWith("\n") ? "" : "\n"}${name}=${value}\n`,
  );
  process.env[name] = value;
  added.push(name);
}
ensureSecret("CODE_PEPPER_V1", () => randomBytes(32).toString("hex"));
ensureSecret("IP_HASH_KEY", () => randomBytes(32).toString("hex"));
ensureSecret("ADMIN_PASSWORD", () => randomBytes(12).toString("base64url"));
if (added.length) console.log(`• Generated and saved to ${path.basename(ENV_FILE)}: ${added.join(", ")}`);

for (const name of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]?.trim()) {
    console.error(`✗ ${name} is missing from .env.local (see .env.example).`);
    process.exit(1);
  }
}

const pepper = Buffer.from(process.env.CODE_PEPPER_V1.trim(), "hex");
const BUCKET = process.env.SUPABASE_MEDIA_BUCKET?.trim() || "media";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL?.trim() || "zeya@saudade.example").toLowerCase();

const dbUrl = process.env.DATABASE_URL.trim();
const sql = postgres(dbUrl, { prepare: false, max: 1, onnotice: () => {}, ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? false : "require" });
const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Helpers mirroring lib/parsing/codes.ts and lib/server/crypto.ts ────────

const B32 = "abcdefghijklmnopqrstuvwxyz234567";
function randomString(chars, len) {
  const limit = 256 - (256 % chars.length);
  let out = "";
  while (out.length < len) for (const b of randomBytes(len * 2)) if (b < limit && out.length < len) out += chars[b % chars.length];
  return out;
}
/** Same as lib/parsing/codes.ts codeBody with site.codes = { prefix: "SAUD", length: 4 }. */
function codeBody(input) {
  let s = input.toUpperCase().replace(/[\s\-_.]/g, "");
  if (s.startsWith("SAUD") && s.length > 4) s = s.slice(4);
  return s;
}
const codeHash = (code) => createHmac("sha256", pepper).update(`saudade/code/v1:${codeBody(code)}`).digest();
const sha256 = (v) => createHash("sha256").update(v).digest();
const mediaId = () => `med_${randomString(B32, 26)}`;
const newToken = () => randomString(B32, 32);
function hashPassword(password) {
  const ln = 15, r = 8, p = 1;
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, 32, { N: 2 ** ln, r, p, maxmem: 256 * 2 ** ln * r });
  return `$scrypt$ln=${ln},r=${r},p=${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

// ─── 2. Reset (staging only) ─────────────────────────────────────────────────

if (args.has("--reset")) {
  if (!args.has("--yes")) {
    console.error("✗ --reset drops every Saudade table and its data. Re-run with --reset --yes to confirm.");
    process.exit(1);
  }
  console.log("• Dropping every Saudade table, view, type and function…");
  await sql.unsafe(`
    drop view if exists unit_overview, current_contents cascade;
    drop table if exists content_media, media_variants, contents, media, reveal_events, audit_log, email_log,
      sender_tokens, units, batches, admin_sessions, admin_users, song_catalog, jobs, rate_limit_buckets,
      idempotency_keys, schema_migrations cascade;
    drop type if exists unit_status, delivery_path, stamp_kind, media_kind, media_state, actor_kind, batch_status,
      reveal_outcome, token_origin, email_template, email_status, job_state cascade;
    drop function if exists touch_updated_at(), forbid_mutation() cascade;
  `);
  const { data: files } = await supabase.storage.from(BUCKET).list("incoming", { limit: 1000 });
  for (const dir of files ?? []) {
    const { data: objs } = await supabase.storage.from(BUCKET).list(`incoming/${dir.name}`, { limit: 1000 });
    if (objs?.length) await supabase.storage.from(BUCKET).remove(objs.map((o) => `incoming/${dir.name}/${o.name}`));
  }
}

// ─── 3. Migrations ───────────────────────────────────────────────────────────

await sql`create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())`;
await sql`alter table schema_migrations enable row level security`;
const applied = new Set((await sql`select version from schema_migrations`).map((r) => r.version));
const migDir = path.join(ROOT, "supabase", "migrations");
for (const file of fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  console.log(`• Applying ${file}…`);
  await sql.begin(async (t) => {
    await t.unsafe(fs.readFileSync(path.join(migDir, file), "utf8"));
    await t`insert into schema_migrations (version) values (${file})`;
  });
}
console.log("✓ Database schema up to date");

// ─── 4. Storage bucket (private) ─────────────────────────────────────────────

if (args.has("--no-storage")) {
  console.log("• Skipping the Storage bucket (--no-storage)");
} else {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "30MB" });
    if (error) throw new Error(`Could not create the storage bucket "${BUCKET}": ${error.message}`);
    console.log(`✓ Created private storage bucket "${BUCKET}"`);
  } else {
    if (data.public) console.warn(`! Storage bucket "${BUCKET}" is PUBLIC. Make it private in Supabase → Storage.`);
    console.log(`✓ Storage bucket "${BUCKET}" exists`);
  }
}

// ─── 5. Admin ────────────────────────────────────────────────────────────────

await sql`
  insert into admin_users (email, display_name, password_hash)
  values (${ADMIN_EMAIL}, ${"Admin"}, ${hashPassword(process.env.ADMIN_PASSWORD.trim())})
  on conflict (email) do update set password_hash = excluded.password_hash, failed_sign_ins = 0, locked_until = null, disabled_at = null`;
console.log(`✓ Admin sign-in: ${ADMIN_EMAIL} (password: ADMIN_PASSWORD in ${path.basename(ENV_FILE)})`);

// ─── 6. Demo data ────────────────────────────────────────────────────────────

const DEMO_LABEL = "Demo run · showcase";
const [existing] = await sql`select id from batches where label = ${DEMO_LABEL}`;
if (args.has("--no-demo") || args.has("--no-storage")) {
  console.log("• Skipping demo data (--no-demo)");
} else if (process.env.NEXT_PUBLIC_CODE_LENGTH?.trim() === "8") {
  // The demo codes (SAUD-3K7M…) are 4 characters; an 8-character build could never claim them.
  console.log("• Skipping demo data: this env uses 8-character codes (NEXT_PUBLIC_CODE_LENGTH=8); the demo codes are 4");
} else if (existing) {
  console.log("✓ Demo data already present (use --reset --yes to start over)");
} else {
  console.log("• Seeding the demo envelopes…");
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, "public", "demo", p), "utf8"));
  const manifest = read("photos/manifest.json");
  const wave = read("voice/waveform.json");
  const song = read("song.json");
  const chipDomain = "saudade.example";
  const [batch] = await sql`
    insert into batches (label, unit_count, code_length, chip_domain) values (${DEMO_LABEL}, ${12}, ${4}, ${chipDomain}) returning id`;

  const addUnit = async (code, slug, extra = {}) => {
    const [u] = await sql`
      insert into units ${sql({ batch_id: batch.id, slug, code_hash: codeHash(code), ...extra })}
      returning id, unit_no`;
    return u;
  };

  // The hero unit used in every walkthrough: unclaimed, same code and chip link as the prototype.
  await addUnit("SAUD-3K7M", "h4kqzm2xv7pt");

  // The sample envelope: Mira → Theo, sealed and ready for its first tap.
  const sample = await addUnit("SAUD-M7RA", "miratotheo23", {
    status: "sealed", delivery_path: "A", code_redeemed_at: new Date(), claimed_at: new Date(), sealed_at: new Date(), content_updated_at: new Date(),
  });
  const sampleToken = newToken();
  await sql`insert into sender_tokens (unit_id, token_hash, origin) values (${sample.id}, ${sha256(sampleToken)}, 'claim')`;

  const upload = async (unitId, file, mime, kind, extra = {}) => {
    const id = mediaId();
    const key = `incoming/${unitId}/${id}`;
    const bytes = fs.readFileSync(path.join(ROOT, "public", "demo", file));
    const { error } = await supabase.storage.from(BUCKET).upload(key, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(`upload ${file}: ${error.message}`);
    await sql`insert into media ${sql({
      id, unit_id: unitId, kind, state: "ready", declared_mime: mime, declared_bytes: bytes.length, detected_mime: mime,
      original_key: key, original_bytes: bytes.length, uploaded_at: new Date(), ready_at: new Date(), ...extra,
    })}`;
    return id;
  };

  const photoItems = [];
  for (const p of manifest) {
    const id = await upload(sample.id, `photos/${p.file}`, "image/jpeg", "photo", { width: p.width, height: p.height });
    photoItems.push({ id: `p_${randomString(B32, 10)}`, mediaId: id, width: p.width, height: p.height, caption: p.caption, alt: p.alt });
  }
  const voiceId = await upload(sample.id, "voice/mira-voice.m4a", "audio/mp4", "voice", { duration_ms: Math.round(wave.durationSec * 1000) });

  const letter = {
    kind: "letter",
    to: "Theo",
    body: [
      "It's raining here the way it used to on Thursdays, when we'd give up on the bus and walk the long way home instead. I keep catching myself saving things to tell you: a dog in a yellow raincoat, the bakery finally fixing its sign, a song in the corner shop that made me stand still in the cereal aisle.",
      "I know the time difference makes everything feel like a postcard that arrives late. So this is me sending one anyway.",
      "I've tucked in a few photos from the summer you visited. Look at the one on the pier. You're mid-sentence, as always. I recorded a little voice note too, because writing never quite sounds like me.",
      "Nothing's wrong. Nothing needs answering. I just missed you today, and I wanted it to be somewhere you could keep.",
      "Put this on your desk. Tap it when the flat feels too quiet.",
    ].join("\n\n"),
    signoff: "Always a short walk away, in the ways that count,",
    from: "Mira",
  };
  const contents = [
    { kind: "photos", items: photoItems },
    letter,
    { kind: "voice", mediaId: voiceId, durationSec: wave.durationSec, mime: "audio/mp4", peaks: wave.peaks, source: "recorded" },
    {
      kind: "song", provider: "spotify", url: song.spotify.url, trackId: song.spotify.trackId, title: song.spotify.title, artist: song.spotify.artist,
      artworkUrl: song.spotify.thumbnail, embedUrl: `https://open.spotify.com/embed/track/${song.spotify.trackId}?utm_source=saudade&theme=0`,
    },
  ];
  for (const c of contents) {
    const [row] = await sql`insert into contents (unit_id, kind, version, payload) values (${sample.id}, ${c.kind}, 1, ${sql.json(c)}) returning id`;
    const ids = c.kind === "photos" ? c.items.map((x) => x.mediaId) : c.kind === "voice" ? [c.mediaId] : [];
    for (const id of ids) await sql`insert into content_media (content_id, media_id) values (${row.id}, ${id})`;
    await sql`insert into audit_log (unit_id, action, actor, detail) values (${sample.id}, 'content.saved', 'sender', ${sql.json({ text: `${c.kind} v1` })})`;
  }
  await sql`insert into audit_log (unit_id, action, actor) values (${sample.id}, 'unit.claimed', 'sender'), (${sample.id}, 'unit.sealed', 'sender')`;

  // Already claimed by someone else (shows the "already found its envelope" message).
  const other = await addUnit("SAUD-9PXR", "p2nw7xk5rq3m", { status: "filled", delivery_path: "A", code_redeemed_at: new Date(), claimed_at: new Date(), content_updated_at: new Date() });
  await sql`insert into sender_tokens (unit_id, token_hash, origin) values (${other.id}, ${sha256(newToken())}, 'claim')`;
  await sql`insert into contents (unit_id, kind, version, payload) values (${other.id}, 'letter', 1, ${sql.json({
    kind: "letter", to: "Abuela", body: "The lemon tree you planted is taller than me now. I water it every Sunday and tell it about you.", signoff: "Con cariño,", from: "Jo",
  })})`;

  // Spare unclaimed codes for testing (also listed in the README).
  const spare = ["SAUD-QCJZ", "SAUD-HNXD", "SAUD-Y7H8", "SAUD-9KHV", "SAUD-ERXV", "SAUD-FHV3", "SAUD-WUCW", "SAUD-EWUN", "SAUD-5HVD"];
  for (const code of spare) await addUnit(code, randomString(B32, 12));
  await sql`insert into audit_log (action, actor, detail) values ('batch.generated', 'system', ${sql.json({ text: `${DEMO_LABEL}: 12 units` })})`;

  const out = {
    sampleSenderToken: sampleToken,
    note: "Local only. The private sender link of the seeded sample envelope (Mira → Theo). Not committed.",
  };
  fs.writeFileSync(path.join(ROOT, ".demo-links.local.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log("✓ Demo seeded:");
  console.log("    Claim codes   SAUD-3K7M (hero) and spares " + spare.slice(0, 4).join(", ") + " …; SAUD-9PXR is already claimed");
  console.log("    Sample tap    /t/miratotheo23   (Mira → Theo, sealed: the first tap plays the reveal)");
  console.log(`    Sample sender /s/${sampleToken}   (also saved in .demo-links.local.json)`);
}

await sql.end();
console.log("✓ Done");
