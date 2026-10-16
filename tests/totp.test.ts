import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  hotp,
  looksLikeRecoveryCode,
  newRecoveryCodes,
  newSecret,
  openSecret,
  otpauthUrl,
  pendingToken,
  readPendingToken,
  recoveryHash,
  recoveryHashesHex,
  sealSecret,
  stepAt,
  verifyTotp,
} from "@/lib/server/totp";

const KEY = Buffer.alloc(32, 7);
const RFC_SECRET = Buffer.from("12345678901234567890"); // RFC 6238 appendix B, SHA-1

describe("TOTP (RFC 6238 test vectors, SHA-1)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("T=%i → %s", (seconds, expected) => {
    expect(hotp(RFC_SECRET, stepAt(seconds * 1000), 8)).toBe(expected);
  });

  it("accepts the current code and one step either side, nothing further", () => {
    const now = 1_800_000_000_000;
    const step = stepAt(now);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), now, null)).toBe(step);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), now, null)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), now, null)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2), now, null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", now, null)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", now, null)).toBeNull();
  });

  it("never accepts a code at or before the last used step (no replay)", () => {
    const now = 1_800_000_000_000;
    const step = stepAt(now);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), now, step - 1)).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step), now, step - 1)).toBe(step);
  });

  it("tolerates spaces in a typed code", () => {
    const now = 1_800_000_000_000;
    const code = hotp(RFC_SECRET, stepAt(now));
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, now, null)).toBe(stepAt(now));
  });
});

describe("base32 and otpauth", () => {
  it("round-trips any secret", () => {
    for (let i = 0; i < 20; i++) {
      const s = newSecret();
      expect(base32Decode(base32Encode(s)).equals(s)).toBe(true);
    }
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
  });

  it("builds an authenticator link", () => {
    const url = otpauthUrl(RFC_SECRET, "zeya@saudade.example");
    expect(url).toMatch(/^otpauth:\/\/totp\/Saudade%3Azeya%40saudade\.example\?/);
    expect(url).toContain(`secret=${base32Encode(RFC_SECRET)}`);
    expect(url).toContain("period=30");
  });
});

describe("encrypted secrets", () => {
  it("opens only for the admin it was sealed for, with the right key", () => {
    const secret = newSecret();
    const sealed = sealSecret(KEY, "admin-a", secret);
    expect(sealed.length).toBe(48); // fits the column's 40–128 byte check
    expect(openSecret(KEY, "admin-a", sealed)?.equals(secret)).toBe(true);
    expect(openSecret(KEY, "admin-b", sealed)).toBeNull();
    expect(openSecret(Buffer.alloc(32, 9), "admin-a", sealed)).toBeNull();
    const tampered = Buffer.from(sealed);
    tampered[20] ^= 1;
    expect(openSecret(KEY, "admin-a", tampered)).toBeNull();
  });

  it("pending enrolment tokens expire and are bound to one admin", () => {
    const secret = newSecret();
    const t0 = 1_800_000_000_000;
    const token = pendingToken(KEY, "admin-a", secret, t0);
    expect(readPendingToken(KEY, "admin-a", token, t0 + 60_000)?.equals(secret)).toBe(true);
    expect(readPendingToken(KEY, "admin-a", token, t0 + 11 * 60_000)).toBeNull();
    expect(readPendingToken(KEY, "admin-b", token, t0)).toBeNull();
    expect(readPendingToken(KEY, "admin-a", `${token.slice(0, -2)}AA`, t0)).toBeNull();
    expect(readPendingToken(KEY, "admin-a", "not a token", t0)).toBeNull();
  });
});

describe("recovery codes", () => {
  it("makes ten distinct, readable codes", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) {
      expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
      expect(c).not.toMatch(/[l1o0]/);
      expect(looksLikeRecoveryCode(c)).toBe(true);
    }
    expect(looksLikeRecoveryCode("123456")).toBe(false);
  });

  it("hashes the same however it is typed", () => {
    expect(recoveryHash("K7MQ2-XR4TA").equals(recoveryHash("k7mq2xr4ta"))).toBe(true);
    expect(recoveryHash(" k7mq2 xr4ta ").equals(recoveryHash("k7mq2-xr4ta"))).toBe(true);
    expect(recoveryHashesHex(["a2345-b6789", "c2345-d6789"]).split(",")).toHaveLength(2);
  });
});
