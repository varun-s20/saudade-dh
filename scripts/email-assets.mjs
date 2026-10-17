/**
 * Draws the three images the HTML emails use (lib/email/html.ts) into public/email/:
 *   logo.png      the stamp-and-heart mark with "Saudade" in Nanum Pen Script (as components/ui/Logo)
 *   postmark.png  a navy circular cancellation, "SAUDADE · POST"
 *   airmail.png   the red-and-navy airmail stripe (--texture-airmail)
 * Email apps don't render SVG or web fonts reliably, so these are PNGs at 2× for sharp screens.
 * Re-run after a rebrand (colours from styles/tokens.css):  node scripts/email-assets.mjs
 * Needs the internet (Google Fonts) and the Playwright Chromium used by scripts/e2e.mjs.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "email");
const C = { red: "#b5432a", navy: "#213a63", ink: "#2f231b", paper: "#fbf5eb", raised: "#fffbf4" };

const perforations = () =>
  [
    ...[3, 8, 13, 18, 23].flatMap((x) => [`<circle cx="${x}" cy="0" r="1.45"/>`, `<circle cx="${x}" cy="30" r="1.45"/>`]),
    ...[3, 7.8, 12.6, 17.4, 22.2, 27].flatMap((y) => [`<circle cx="0" cy="${y}" r="1.45"/>`, `<circle cx="26" cy="${y}" r="1.45"/>`]),
  ].join("");

const ASSETS = {
  "logo.png": `
    <div id="a" style="display:inline-flex;align-items:center;gap:10px;padding:6px 10px 6px 6px">
      <svg viewBox="0 0 26 30" width="44" height="51" style="transform:rotate(-6deg)">
        <defs><mask id="m"><rect width="26" height="30" fill="#fff"/><g fill="#000">${perforations()}</g></mask></defs>
        <rect width="26" height="30" rx="0.8" fill="${C.red}" mask="url(#m)"/>
        <rect x="3.2" y="3.2" width="19.6" height="23.6" fill="none" stroke="${C.paper}" stroke-width="0.8" opacity="0.55"/>
        <path d="M13 22.2s-6-3.7-7.5-7.4C4.4 12 6.1 9 9 9c1.6 0 2.8.9 4 2.4 1.2-1.5 2.4-2.4 4-2.4 2.9 0 4.6 3 3.5 5.8-1.5 3.7-7.5 7.4-7.5 7.4z" fill="${C.raised}"/>
      </svg>
      <span style="font:400 64px/1 'Nanum Pen Script',cursive;color:${C.ink};letter-spacing:0.01em">Saudade</span>
    </div>`,
  "postmark.png": `
    <div id="a" style="width:132px;height:132px;display:flex;align-items:center;justify-content:center">
    <svg viewBox="0 0 120 120" width="120" height="120" style="display:block;transform:rotate(-12deg)">
      <defs><path id="top" d="M 23 60 A 37 37 0 0 1 97 60"/><path id="bot" d="M 19 60 A 41 41 0 0 0 101 60"/></defs>
      <g fill="none" stroke="${C.navy}" opacity="0.85">
        <circle cx="60" cy="60" r="56" stroke-width="3"/>
        <circle cx="60" cy="60" r="49" stroke-width="1.4"/>
      </g>
      <g fill="${C.navy}" opacity="0.85" font-family="Karla, Arial, sans-serif" font-weight="700" letter-spacing="2.2">
        <text font-size="10.5"><textPath href="#top" startOffset="50%" text-anchor="middle">SAUDADE · POST</textPath></text>
        <text font-size="9.5"><textPath href="#bot" startOffset="50%" text-anchor="middle">WITH LOVE</textPath></text>
        <path d="M60 74s-9-5.5-11.2-11C47.2 58.8 49.7 54 54 54c2.4 0 4.2 1.3 6 3.6 1.8-2.3 3.6-3.6 6-3.6 4.3 0 6.8 4.8 5.2 9-2.2 5.5-11.2 11-11.2 11z"/>
      </g>
    </svg></div>`,
  "airmail.png": `
    <div id="a" style="width:560px;height:8px;background:${C.raised} repeating-linear-gradient(-45deg, ${C.red} 0 12px, transparent 12px 20px, ${C.navy} 20px 32px, transparent 32px 40px)"></div>`,
};

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const [file, body] of Object.entries(ASSETS)) {
  await page.setContent(
    `<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla:wght@700&family=Nanum+Pen+Script&display=block"></head>
     <body style="margin:0;background:transparent">${body}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.locator("#a").screenshot({ path: path.join(OUT, file), omitBackground: file !== "airmail.png" });
  console.log(`✓ public/email/${file}`);
}
await browser.close();
