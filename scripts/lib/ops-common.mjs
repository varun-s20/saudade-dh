/**
 * Shared helpers for the operator CLIs (scripts/provision.mjs, scripts/admin-user.mjs).
 * The hashing here must match lib/server/crypto.ts exactly; scripts/api-smoke.mjs and the
 * provisioning test prove it by claiming a code made here through the real API.
 */
import { createHmac, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const ROOT = process.cwd();

/** Parse `--name value` / `--flag` arguments. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

/** Load the env file (default .env.local); exits with a clear message if it's missing. */
export function loadEnv(file) {
  const envFile = path.resolve(file || path.join(ROOT, ".env.local"));
  if (!fs.existsSync(envFile)) fail(`${path.basename(envFile)} not found. Pass --env-file <file> with the production values.`);
  process.loadEnvFile(envFile);
  return envFile;
}

export function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export function requireEnv(...names) {
  for (const n of names) if (!process.env[n]?.trim()) fail(`${n} is missing from the env file (see .env.example).`);
}

export function connect() {
  requireEnv("DATABASE_URL");
  const url = process.env.DATABASE_URL.trim();
  return postgres(url, { prepare: false, max: 1, onnotice: () => {}, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require" });
}

// ─── Codes, slugs, passwords (mirror lib/parsing/codes.ts and lib/server/crypto.ts) ──

export const CODE = { prefix: "SAUD", alphabet: "23456789ABCDEFGHJKMNPQRSTUVWXYZ" };
export const B32 = "abcdefghijklmnopqrstuvwxyz234567";

export function randomString(chars, len) {
  const limit = 256 - (256 % chars.length);
  let out = "";
  while (out.length < len) for (const b of randomBytes(len * 2)) if (b < limit && out.length < len) out += chars[b % chars.length];
  return out;
}

/** A fresh body (no prefix) that never starts with "SAUD" (see generateCode). */
export function codeBody(length) {
  let body;
  do body = randomString(CODE.alphabet, length);
  while (body.startsWith(CODE.prefix.slice(0, length)));
  return body;
}

export const formatCode = (body) => `${CODE.prefix}-${body.match(/.{1,4}/g).join("-")}`;

/** HMAC-SHA-256(pepper, "saudade/code/v1:" + body), as lib/server/crypto.ts codeHash. */
export function codeHash(body) {
  requireEnv("CODE_PEPPER_V1");
  return createHmac("sha256", Buffer.from(process.env.CODE_PEPPER_V1.trim(), "hex")).update(`saudade/code/v1:${body}`).digest();
}

export function hashPassword(password) {
  const ln = 15, r = 8, p = 1;
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, 32, { N: 2 ** ln, r, p, maxmem: 256 * 2 ** ln * r });
  return `$scrypt$ln=${ln},r=${r},p=${p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** 18 random bytes as base64url: 24 characters, 144 bits. */
export const newPassword = () => randomBytes(18).toString("base64url");

export const unitNo = (n) => `S-${String(n).padStart(4, "0")}`;
export const ndefBytes = (url) => url.replace(/^https:\/\//, "").length + 8;

// ─── Test helpers (api-smoke, e2e-api) ───────────────────────────────────────

function base32Decode(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of s.toUpperCase().replace(/[\s=]+/g, "")) {
    value = (value << 5) | A.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The RFC 6238 code an authenticator app would show now (+ offsetSteps × 30 s). */
export function totp(secretB32, offsetSteps = 0) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offsetSteps));
  const h = createHmac("sha1", base32Decode(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
}

/** A throwaway admin straight in the database (tests only); disable it with the returned function. */
export async function tempAdmin(sql, tag) {
  const password = newPassword();
  const email = `${tag}+${Date.now()}@example.com`;
  await sql`insert into admin_users (email, display_name, password_hash) values (${email}, ${`Test (${tag})`}, ${hashPassword(password)})`;
  return { email, password, disable: () => sql`update admin_users set disabled_at = now() where email = ${email}` };
}

/** RFC 4180 CSV with a trailing newline. */
export const toCsv = (header, rows) =>
  [header, ...rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(","))].join("\n") + "\n";
