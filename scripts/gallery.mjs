/**
 * Design review gallery: capture routes at several widths (full page) in one run.
 *
 *   node scripts/gallery.mjs --base http://localhost:3000 --out <dir> --widths 390,820,1440 / /claim /recover
 *   node scripts/gallery.mjs ... --setup claim     # claim SAUD-3K7M first (sender pages resolve)
 *   node scripts/gallery.mjs ... --setup sample    # claim + load Mira's sample envelope (filled)
 *   node scripts/gallery.mjs ... --setup sealed    # sample + sealed (recipient first tap)
 *   node scripts/gallery.mjs ... --viewport        # viewport-only shots instead of full page
 *
 * Writes <dir>/<route-slug>@<width>.png and prints console errors per shot.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3000");
const OUT = path.resolve(opt("out", ".gallery"));
const WIDTHS = opt("widths", "390,1440").split(",").map(Number);
const SETUP = opt("setup", "none");
const WAIT = Number(opt("wait", "1800"));
const FULL = !args.includes("--viewport");
const routes = args.filter((a, i) => a.startsWith("/") && !["--base", "--out", "--widths", "--setup", "--wait"].includes(args[i - 1]));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
for (const w of WIDTHS) {
  const mobile = w < 800;
  const ctx = await browser.newContext({ viewport: { width: w, height: mobile ? 844 : 900 }, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  if (SETUP !== "none") {
    await page.goto(`${BASE}/claim`, { waitUntil: "networkidle" });
    await page.locator("#code-input").click();
    await page.keyboard.type("3K7M", { delay: 40 });
    await page.keyboard.press("Enter");
    await page.waitForURL(/claim\/success/, { timeout: 20000 });
    if (SETUP === "sample" || SETUP === "sealed") {
      await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Open demo panel/ }).click();
      await page.getByRole("button", { name: /Load sample envelope/i }).first().click();
      await page.waitForTimeout(600);
      if (SETUP === "sealed") {
        await page.getByRole("button", { name: /^Sealed/ }).first().click();
        await page.waitForTimeout(600);
      }
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("saudade-demo-v1") ?? '{"state":{}}');
        s.state.enabled = false;
        s.state.open = false;
        s.state.fast = true;
        localStorage.setItem("saudade-demo-v1", JSON.stringify(s));
      });
    }
  }

  for (const r of routes) {
    errors.length = 0;
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(WAIT);
    if (FULL) {
      // Scroll through once so lazy images below the fold load, then return to the top.
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < total; y += 700) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(120);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
    }
    const slug = (r === "/" ? "home" : r.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-")).slice(0, 60);
    const file = path.join(OUT, `${slug}@${w}.png`);
    await page.screenshot({ path: file, fullPage: FULL });
    console.log(`${file}${errors.length ? `  ERRORS: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  }
  await ctx.close();
}
await browser.close();
