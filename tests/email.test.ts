import { describe, expect, it } from "vitest";
import { giftCodeEmail, recoverLinkEmail, senderLinkEmail, withoutHtml } from "@/lib/email/templates";

const SITE = "https://saudade-dh.vercel.app";

describe("emails", () => {
  it("send HTML in the site's look, with the images and links on the site that sent them", () => {
    const d = senderLinkEmail({ to: " Someone@Example.com ", link: `${SITE}/s/abc123` });
    expect(d.to).toBe("someone@example.com");
    expect(d.html).toContain(`src="${SITE}/email/logo.png"`);
    expect(d.html).toContain(`src="${SITE}/email/postmark.png"`);
    expect(d.html).toContain(`href="${SITE}/s/abc123"`);
    expect(d.html).toContain("Open your envelope");
    expect(d.html).not.toMatch(/localhost|<script/i);
    // The plain-text alternative carries the same words and the link.
    expect(d.text).toContain(`${SITE}/s/abc123`);
    expect(d.text).toContain("keep it somewhere safe");
  });

  it("show the gift code and point at the claim page", () => {
    const d = giftCodeEmail({ to: "buyer@example.com", code: "SAUD-3K7M", origin: SITE });
    expect(d.html).toContain("SAUD-3K7M");
    expect(d.html).toContain(`href="${SITE}/claim"`);
    expect(d.text).toContain(`Your code: SAUD-3K7M`);
  });

  it("give one button per envelope when an address has several", () => {
    const d = recoverLinkEmail({ to: "a@example.com", links: [`${SITE}/s/one`, `${SITE}/s/two`] });
    expect(d.html).toContain("Open envelope 1");
    expect(d.html).toContain("Open envelope 2");
    expect(d.text).toContain(`${SITE}/s/two`);
  });

  it("escape anything that could break out of the HTML", () => {
    const d = senderLinkEmail({ to: "a@example.com", link: `${SITE}/s/x"><script>alert(1)</script>` });
    expect(d.html).not.toContain("<script>");
    expect(d.html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("never store the HTML body (it carries the private link)", () => {
    const stored = withoutHtml(senderLinkEmail({ to: "a@example.com", link: `${SITE}/s/abc` }));
    expect(stored).not.toHaveProperty("html");
    expect(stored.text).toContain("/s/abc");
  });
});
