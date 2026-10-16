/**
 * Activation codes, NFC slugs, and sender tokens. Pure functions; safe on server and client.
 *
 * Code format: SAUD-XXXX, or SAUD-XXXX-XXXX when site.codes.length is 8 (OPEN_QUESTIONS O9).
 * Case-insensitive, dashes optional, alphabet excludes 0/O and 1/I/L.
 */
import { site } from "@/config/site";

const { prefix, alphabet, length, ambiguous } = site.codes;

export type CodeCheck =
  | { status: "empty" }
  | { status: "incomplete"; body: string }
  | { status: "ambiguous"; body: string; char: string }
  | { status: "invalid_char"; body: string; char: string }
  | { status: "complete"; body: string; code: string };

/** Strip whitespace/dashes, uppercase, and drop a leading "SAUD" prefix if present. */
export function codeBody(input: string): string {
  let s = input.toUpperCase().replace(/[\s\-_.]/g, "");
  if (s.startsWith(prefix) && s.length > length) s = s.slice(prefix.length);
  return s;
}

/** Validate what the sender typed or pasted. Never throws. */
export function checkCode(input: string): CodeCheck {
  const body = codeBody(input);
  if (!body) return { status: "empty" };
  for (const char of body) {
    if (ambiguous.includes(char)) return { status: "ambiguous", body, char };
    if (!alphabet.includes(char)) return { status: "invalid_char", body, char };
  }
  if (body.length < length) return { status: "incomplete", body };
  if (body.length > length) return { status: "invalid_char", body, char: body[length] };
  return { status: "complete", body, code: formatCode(body) };
}

/** "3K7M" → "SAUD-3K7M"; "3K7MQ2XF" → "SAUD-3K7M-Q2XF" (groups of 4). */
export function formatCode(body: string): string {
  return `${prefix}-${(body.match(/.{1,4}/g) ?? [body]).join("-")}`;
}

/** Normalise to canonical SAUD-XXXX (or SAUD-XXXX-XXXX), or null if not a well-formed code. */
export function normaliseCode(input: string): string | null {
  const c = checkCode(input);
  return c.status === "complete" ? c.code : null;
}

/** Whether a single typed character can ever appear in a code body. */
export function isCodeChar(char: string): boolean {
  return alphabet.includes(char.toUpperCase());
}

export function isAmbiguousChar(char: string): boolean {
  return ambiguous.includes(char.toUpperCase());
}

// ─── Random identifiers (crypto-strength, unbiased) ────────────────────────

function cryptoObj(): Crypto {
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Web Crypto is not available");
  }
  return globalThis.crypto;
}

/** Uniformly random string over `chars` using rejection sampling (no modulo bias). */
export function randomString(chars: string, len: number): string {
  const n = chars.length;
  const limit = 256 - (256 % n);
  const out: string[] = [];
  const buf = new Uint8Array(len * 2);
  while (out.length < len) {
    cryptoObj().getRandomValues(buf);
    for (const b of buf) {
      if (b < limit) out.push(chars[b % n]);
      if (out.length === len) break;
    }
  }
  return out.join("");
}

/**
 * A fresh random code. Bodies that begin with the prefix itself ("SAUD…", 1 in ~923,000) are
 * redrawn, so someone typing "SAUD" into the boxes is always a mistake the input can point out.
 */
export function generateCode(): string {
  let body: string;
  do body = randomString(alphabet, length);
  while (body.startsWith(prefix.slice(0, length)));
  return formatCode(body);
}

export function generateSlug(): string {
  return randomString(site.ids.slugAlphabet, site.ids.slugLength);
}

export function generateToken(): string {
  return randomString(site.ids.slugAlphabet, site.ids.tokenLength);
}

export function generateId(prefixLabel: string): string {
  return `${prefixLabel}_${randomString(site.ids.slugAlphabet, 10)}`;
}

/** Bits of entropy for a random string of `len` over `alphabetSize` symbols. */
export function entropyBits(alphabetSize: number, len: number): number {
  return Math.round(len * Math.log2(alphabetSize) * 10) / 10;
}
