/**
 * Admin two-factor sign-in (ARCHITECTURE.md §9.4, AQ5): RFC 6238 TOTP, 6 digits, 30 s steps,
 * HMAC-SHA-1 (what every authenticator app supports), ±1 step for clock drift, and a code can
 * never be used twice (`admin_users.totp_last_used_step`).
 *
 * - The secret is stored AES-256-GCM encrypted with TOTP_ENC_KEY (env, never the database), bound
 *   to its admin row by the additional data, so a ciphertext copied onto another admin won't open.
 * - Enrolment is stateless until it is proven: the new secret travels to the browser and back as
 *   an encrypted, 10-minute `pending` token; only a correct first code stores it.
 * - Recovery codes: 10 single-use codes (50 bits each), stored as SHA-256 only.
 *
 * Pure functions (no database); the routes in app/api/admin/session and app/api/admin/2fa use them.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const STEP_SEC = 30;
export const DIGITS = 6;
const SECRET_BYTES = 20;
const PENDING_TTL_MS = 10 * 60_000;
export const RECOVERY_CODE_COUNT = 10;

// ─── Base32 (RFC 4648, no padding): the format authenticator apps expect ────

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const s = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ─── HOTP / TOTP ─────────────────────────────────────────────────────────────

export const newSecret = (): Buffer => randomBytes(SECRET_BYTES);

/** RFC 4226 HOTP value for one counter. */
export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const stepAt = (ms: number): number => Math.floor(ms / 1000 / STEP_SEC);

/**
 * The time step a code matches (now, or one step either side), or null. Steps at or before
 * `lastUsedStep` are refused, so a code (or an older one) can't be replayed.
 */
export function verifyTotp(secret: Buffer, code: string, nowMs: number, lastUsedStep: number | null): number | null {
  const c = code.replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${DIGITS}}$`).test(c)) return null;
  const now = stepAt(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUrl(secret: Buffer, account: string, issuer = "Saudade"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret: base32Encode(secret), issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SEC) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

// ─── Encrypted secrets (AES-256-GCM: 12-byte nonce || ciphertext || 16-byte tag) ──

function seal(key: Buffer, plain: Buffer, aad: string): Buffer {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, nonce);
  c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([nonce, body, c.getAuthTag()]);
}

function open(key: Buffer, blob: Buffer, aad: string): Buffer | null {
  if (blob.length < 12 + 16 + 1) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12));
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(blob.subarray(blob.length - 16));
    return Buffer.concat([d.update(blob.subarray(12, blob.length - 16)), d.final()]);
  } catch {
    return null;
  }
}

const storedAad = (adminId: string) => `saudade/totp/v1:${adminId}`;
const pendingAad = (adminId: string) => `saudade/totp-pending/v1:${adminId}`;

/** The column value for admin_users.totp_secret_enc (48 bytes for a 20-byte secret). */
export const sealSecret = (key: Buffer, adminId: string, secret: Buffer): Buffer => seal(key, secret, storedAad(adminId));

export const openSecret = (key: Buffer, adminId: string, blob: Buffer): Buffer | null => open(key, blob, storedAad(adminId));

/** An opaque token carrying a not-yet-confirmed secret back to the confirm step. */
export function pendingToken(key: Buffer, adminId: string, secret: Buffer, nowMs: number): string {
  const expires = Buffer.alloc(8);
  expires.writeBigUInt64BE(BigInt(nowMs + PENDING_TTL_MS));
  return seal(key, Buffer.concat([expires, secret]), pendingAad(adminId)).toString("base64url");
}

/** The secret inside a pending token, or null if it is forged, for another admin, or expired. */
export function readPendingToken(key: Buffer, adminId: string, token: string, nowMs: number): Buffer | null {
  if (!/^[\w-]{40,200}$/.test(token)) return null;
  const plain = open(key, Buffer.from(token, "base64url"), pendingAad(adminId));
  if (!plain || plain.length !== 8 + SECRET_BYTES) return null;
  if (Number(plain.readBigUInt64BE(0)) < nowMs) return null;
  return plain.subarray(8);
}

// ─── Recovery codes ──────────────────────────────────────────────────────────

const RC_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no l/1/o/0: read off paper
const normaliseRecovery = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

/** Ten fresh codes like "k7mq2-xr4ta" (10 characters, 50 bits), shown to the admin once. */
export function newRecoveryCodes(n = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: n }, () => {
    const bytes = randomBytes(10);
    const s = [...bytes].map((b) => RC_ALPHABET[b & 31]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export const recoveryHash = (code: string): Buffer =>
  createHash("sha256").update(`saudade/recovery/v1:${normaliseRecovery(code)}`).digest();

/**
 * The hashes of `codes` as one comma-separated hex string, for SQL to turn into a bytea[]:
 *   array(select decode(h, 'hex') from unnest(string_to_array($1, ',')) h)
 * (A JS array of Buffers isn't sent as bytea[] reliably by the postgres driver.)
 */
export const recoveryHashesHex = (codes: string[]): string => codes.map((c) => recoveryHash(c).toString("hex")).join(",");

/** Whether the input looks like a recovery code (as opposed to a 6-digit authenticator code). */
export const looksLikeRecoveryCode = (s: string): boolean => /^[a-z2-9]{10}$/.test(normaliseRecovery(s));
