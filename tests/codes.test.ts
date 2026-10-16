import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { checkCode, codeBody, formatCode, generateCode, generateSlug, generateToken, normaliseCode, randomString } from "@/lib/parsing/codes";
import { ndefBytes, NTAG213_BYTES } from "@/lib/parsing/ndef";

// The default build: 4-character codes (NEXT_PUBLIC_CODE_LENGTH unset).
describe("activation codes", () => {
  it("uses the agreed format by default", () => {
    expect(site.codes.length).toBe(4);
    expect(generateCode()).toMatch(/^SAUD-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  });

  it("accepts any case, spacing and dashes, with or without the prefix", () => {
    for (const input of ["SAUD-3K7M", "saud3k7m", "3k7m", " saud 3k7m ", "SAUD_3K7M", "s a u d - 3 k 7 m"]) {
      expect(normaliseCode(input)).toBe("SAUD-3K7M");
    }
  });

  it("explains ambiguous characters instead of guessing", () => {
    expect(checkCode("SAUD-0000")).toMatchObject({ status: "ambiguous", char: "0" });
    expect(checkCode("SAUD-3K7L")).toMatchObject({ status: "ambiguous", char: "L" });
    expect(checkCode("SAUD-3K7")).toMatchObject({ status: "incomplete" });
    expect(checkCode("SAUD-3K7M9")).toMatchObject({ status: "invalid_char" });
    expect(checkCode("")).toEqual({ status: "empty" });
  });

  it("formats 8-character bodies in two groups", () => {
    expect(formatCode("3K7MQ2XF")).toBe("SAUD-3K7M-Q2XF");
    expect(codeBody("saud-3k7m-q2xf")).toBe("3K7MQ2XF");
  });

  it("never generates a body that starts with the prefix", () => {
    for (let i = 0; i < 2000; i++) expect(codeBody(generateCode())).not.toMatch(/^SAUD/);
  });
});

describe("random identifiers", () => {
  it("draws only from the alphabet, with every symbol reachable", () => {
    const s = randomString("abc", 3000);
    expect(s).toMatch(/^[abc]+$/);
    for (const ch of "abc") expect(s.split(ch).length - 1).toBeGreaterThan(800);
  });

  it("makes 12-character slugs (60 bits) and 32-character tokens (160 bits)", () => {
    expect(generateSlug()).toMatch(/^[a-z2-7]{12}$/);
    expect(generateToken()).toMatch(/^[a-z2-7]{32}$/);
  });
});

describe("NFC budget", () => {
  it("costs the domain plus 23 bytes on an NTAG213", () => {
    const url = "https://saudade.gift/t/h4kqzm2xv7pt";
    expect(ndefBytes(url)).toBe("saudade.gift".length + 23);
    expect(ndefBytes(`https://${"a".repeat(41)}.com/t/h4kqzm2xv7pt`)).toBeLessThan(NTAG213_BYTES);
  });
});
