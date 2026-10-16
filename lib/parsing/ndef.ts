/**
 * NFC chip budget (ARCHITECTURE.md §3.4). One short NDEF URI record with the `https://` prefix
 * code (0x04) costs the URL without "https://" plus 8 bytes (TLV + record header + type + prefix +
 * terminator). An NTAG213 has 144 bytes of user memory. Pure; server and browser.
 */
export const NTAG213_BYTES = 144;

export const ndefBytes = (url: string): number => url.replace(/^https:\/\//, "").length + 8;
