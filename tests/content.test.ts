import { describe, expect, it } from "vitest";
import { summarise } from "@/lib/content-summary";
import { privacyPolicy, wordingSupplied, type LegalDoc } from "@/content/legal";

describe("legal wording", () => {
  it("is incomplete until approved, dated, and every section has text", () => {
    expect(wordingSupplied(privacyPolicy)).toBe(false);
    const filled: LegalDoc = { ...privacyPolicy, draft: false, updated: "1 November 2026", sections: privacyPolicy.sections.map((s) => ({ ...s, paragraphs: ["Text."] })) };
    expect(wordingSupplied(filled)).toBe(true);
    expect(wordingSupplied({ ...filled, draft: true })).toBe(false);
    expect(wordingSupplied({ ...filled, updated: null })).toBe(false);
    expect(wordingSupplied({ ...filled, sections: [...filled.sections, { title: "Extra", paragraphs: ["  "] }] })).toBe(false);
  });
});

describe("history summaries", () => {
  it("describes each stamp in one plain line", () => {
    expect(summarise({ kind: "photos", items: [{ id: "a", mediaId: "m", width: 1, height: 1 }] })).toBe("1 photo");
    expect(summarise({ kind: "letter", to: "Theo", body: "x".repeat(1234), signoff: "", from: "" })).toBe("Letter to Theo, 1,234 characters");
    expect(summarise({ kind: "voice", mediaId: "m", durationSec: 72.4, mime: "audio/mp4", peaks: [], source: "recorded" })).toBe("Voice note, 1:12");
    expect(summarise({ kind: "song", provider: "spotify", url: "", trackId: "t", title: "Here Comes The Sun", artist: "The Beatles", embedUrl: "" })).toBe(
      "Song: Here Comes The Sun · The Beatles",
    );
  });
});
