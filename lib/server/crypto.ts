/**
 * Hashing and secrets (ARCHITECTURE.md §3, §9). Nothing secret is ever stored in clear:
 *   - activation codes → HMAC-SHA-256 with the server pepper (looked up by index, unbrute-forceable from a dump)
 *   - sender tokens and admin session ids → SHA-256 (they are 160/256-bit random already)
 *   - admin passwords → scrypt (Node built-in), stored as a PHC-style string
 *   - IP addresses → HMAC, only ever used as rate-limit / correlation keys
 */
import "server-only";
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { site } from "@/config/site";
import { codeBody, randomString } from "@/lib/parsing/codes";
import { env } from "./env";

export const sha256 = (v: string | Buffer): Buffer => createHash("sha256").update(v).digest();

/** HMAC of the normalised code body ("3K7M"), domain-separated and versioned. */
export function codeHash(code: string): Buffer {
  return createHmac("sha256", env.codePepper()).update(`saudade/code/v1:${codeBody(code)}`).digest();
}

export function ipHash(ip: string): Buffer {
  return createHmac("sha256", env.ipHashKey()).update(`saudade/ip/v1:${ip}`).digest();
}

/** Short, stable key for rate-limit buckets (hex of the first 12 bytes of the IP HMAC). */
export const ipKey = (ip: string): string => ipHash(ip).subarray(0, 12).toString("hex");

/** Capability id for an uploaded file: "med_" + 26 base32 characters (130 bits). */
export const newMediaId = (): string => `med_${randomString(site.ids.slugAlphabet, 26)}`;

/** 256-bit admin session id, base64url, for the cookie. Only its SHA-256 is stored. */
export const newSessionId = (): string => randomBytes(32).toString("base64url");

// ─── Admin passwords (scrypt, PHC-style) ─────────────────────────────────────

const SCRYPT = { ln: 15, r: 8, p: 1, keyLen: 32 } as const;

function scrypt(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password.normalize("NFKC"), salt, keyLen, opts, (e, k) => (e ? reject(e) : resolve(k))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const N = 2 ** SCRYPT.ln;
  const key = await scrypt(password, salt, SCRYPT.keyLen, { N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 256 * N * SCRYPT.r });
  return `$scrypt$ln=${SCRYPT.ln},r=${SCRYPT.r},p=${SCRYPT.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const m = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/.exec(stored);
  if (!m) return false;
  const [ln, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const salt = Buffer.from(m[4], "base64url");
  const expected = Buffer.from(m[5], "base64url");
  const N = 2 ** ln;
  const key = await scrypt(password, salt, expected.length, { N, r, p, maxmem: 256 * N * r });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
