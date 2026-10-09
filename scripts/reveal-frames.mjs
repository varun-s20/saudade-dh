/**
 * Capture the first-tap reveal as frames (design review): seals the demo envelope with Mira's
 * sample content, opens /t/<slug>, taps "Tap to open", and screenshots at the given offsets.
 * Then opens a stamp world and repeats as a "repeat visit".
 *
 *   node scripts/reveal-frames.mjs --base http://localhost:3000 --out <dir> --width 390 --frames 0,900,2600,4200,7600
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3000");
const OUT = path.resolve(opt("out", ".frames"));
const W = Number(opt("width", "390"));
const FRAMES = opt("frames", "0,900,2600,4200,7600").split(",").map(Number);
const WORLD = opt("world", "letter");
fs.mkdirSync(OUT, { recursive: true });

const mobile = W < 800;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: mobile ? 844 : 900 }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));

await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Open demo panel/ }).click();
await page.getByRole("button", { name: /^First tap/ }).first().click();
await page.waitForURL(/\/t\//, { timeout: 20000 });
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("saudade-demo-v1") ?? '{"state":{}}');
  s.state.enabled = false;
  s.state.open = false;
  localStorage.setItem("saudade-demo-v1", JSON.stringify(s));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2600);
await page.screenshot({ path: path.join(OUT, `reveal-${W}-0-threshold.png`) });
await page.getByRole("button", { name: /Tap to open/i }).first().click();
let last = 0;
for (const [i, ms] of FRAMES.entries()) {
  if (ms === 0) continue;
  await page.waitForTimeout(ms - last);
  last = ms;
  await page.screenshot({ path: path.join(OUT, `reveal-${W}-${i}-${ms}ms.png`) });
}
const btn = page.getByRole("button", { name: new RegExp(`Open ${WORLD}`, "i") }).first();
if (await btn.isVisible().catch(() => false)) {
  await btn.click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, `reveal-${W}-world-${WORLD}.png`) });
}
console.log("done", OUT);
await browser.close();
