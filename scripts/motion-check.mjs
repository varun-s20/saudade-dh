/**
 * Signature-motion check (design review, "Wish You Were Here", D-061): captures frames of each
 * animation in action so they can be inspected as stills, and fails on page errors.
 *   node scripts/motion-check.mjs --base http://localhost:3000 --out <dir>
 * Frames: large letters landing, a pill lifting onto its navy shadow, a postcard turning over,
 * the souvenir rack after a flick, the pinned stats → first-tap sequence, the pinned "year in one
 * envelope", the sunset band expanding, a good-to-know card lifting and filling the screen, the
 * claim ticket typing and the clip-path tabs mid-wipe.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3000");
const OUT = path.resolve(opt("out", ".motion"));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = (name, clip) => page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
const around = async (loc, pad = 30) => {
  const b = await loc.boundingBox();
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 };
};

// 1. Large letters landing (first paint), then leaning towards the cursor on a spring
await page.goto(`${BASE}/`);
await page.waitForSelector(".ll__ch");
await page.waitForTimeout(350);
await shot("1a-letters-landing", { x: 0, y: 72, width: 1440, height: 640 });
await page.waitForLoadState("networkidle");
await page.waitForTimeout(1400);
await page.mouse.move(1380, 160, { steps: 10 });
await page.waitForTimeout(700);
await shot("1b-letters-leaning", { x: 0, y: 72, width: 1440, height: 640 });

// 2. A pill lifting onto its hard navy shadow; the arrow slides out and its twin slides in
const cta = page.locator(".hm-hero__ctas a").first();
const ctaBox = await around(cta);
await shot("2a-pill-rest", ctaBox);
await cta.hover();
await page.waitForTimeout(90);
await shot("2b-pill-arrow-swapping", ctaBox);
await page.waitForTimeout(400);
await shot("2c-pill-lifted", ctaBox);

// 3. A postcard turning over (hover flips for a mouse)
const flip = page.locator(".pf").first();
await flip.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
const cardBox = await around(flip);
await flip.hover();
await page.waitForTimeout(220);
await shot("3a-postcard-turning", cardBox);
await page.waitForTimeout(700);
await shot("3b-postcard-back", cardBox);

// 4. The souvenir rack after a flick (velocity carries it; it settles on a card)
const rack = page.locator(".rk__viewport").first();
await rack.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
const rb = await rack.boundingBox();
await page.mouse.move(rb.x + rb.width * 0.7, rb.y + rb.height / 2);
await page.mouse.down();
await page.mouse.move(rb.x + rb.width * 0.3, rb.y + rb.height / 2, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(160);
await shot("4a-rack-spinning", await around(page.locator(".hm-rack"), 0));
await page.waitForTimeout(1400);
await shot("4b-rack-settled", await around(page.locator(".hm-rack"), 0));

// 5. What fits → the first tap (pinned): stat cards on the colour field, the field collapsing into
//    the photograph's frame, the first-tap scene arrived
const hy = await page.evaluate(() => {
  const el = document.querySelector(".hm-hype");
  return { top: el.getBoundingClientRect().top + scrollY, len: el.offsetHeight - innerHeight };
});
for (const [f, name] of [[0.08, "5a-stats"], [0.4, "5b-collapsing"], [0.85, "5c-first-tap"]]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(hy.top + f * hy.len));
  await page.waitForTimeout(f === 0.08 ? 1600 : 700);
  await shot(name);
}

// 6. A year in one envelope: the pinned scroll story at three points
const yr = await page.evaluate(() => {
  const el = document.querySelector(".hm-yr");
  return { top: el.getBoundingClientRect().top + scrollY, len: el.offsetHeight - innerHeight };
});
for (const [f, name] of [[0.1, "6a-year-oct"], [0.5, "6b-year-feb"], [0.97, "6c-year-full"]]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(yr.top + f * yr.len));
  await page.waitForTimeout(700);
  await shot(name);
}

// 7. The sunset band growing to full width, its words filling in
const wish = await page.evaluate(() => document.querySelector(".hm-wish").getBoundingClientRect().top + scrollY);
await page.evaluate((y) => window.scrollTo(0, y), Math.round(wish - 560));
await page.waitForTimeout(500);
await shot("7a-band-expanding");
await page.evaluate((y) => window.scrollTo(0, y), Math.round(wish - 120));
await page.waitForTimeout(500);
await shot("7b-band-full");

// 8. Good to know: a scene card lifting under the mouse, then filling the screen
const card = page.locator('a.kn-card[href="/recover"]');
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
await card.hover();
await page.waitForTimeout(320);
await shot("8a-card-lifted", await around(card, 24));
await card.click();
await page.waitForTimeout(240);
await shot("8b-card-filling");
await page.waitForURL(/\/recover/, { timeout: 8000 });
await page.waitForTimeout(1300);
await shot("8c-arrived");

// 9. The claim ticket typing each character as it's entered
await page.goto(`${BASE}/claim`, { waitUntil: "networkidle" });
await page.locator("#code-input").click();
await page.keyboard.type("3K", { delay: 80 });
await page.waitForTimeout(60);
await shot("9a-ticket-striking", await around(page.locator(".ix-ticket"), 20));
await page.keyboard.type("7M", { delay: 80 });
await page.waitForTimeout(400);
await shot("9b-ticket-typed", await around(page.locator(".ix-ticket"), 20));

// 10. Clip-path tabs: the navy wipe between iPhone and Android
await page.goto(`${BASE}/help/tap`, { waitUntil: "networkidle" });
const tabs = page.locator(".ix-tabs");
await tabs.scrollIntoViewIfNeeded();
await page.getByRole("tab", { name: "Android" }).click();
await page.waitForTimeout(110);
await shot("10a-tabs-wiping", await around(tabs, 12));
await page.waitForTimeout(400);
await shot("10b-tabs-android", await around(tabs, 12));

await browser.close();
console.log(errors.length ? `PAGE ERRORS: ${errors.slice(0, 3).join(" | ")}` : "no page errors");
console.log("done", OUT);
if (errors.length) process.exit(1);
