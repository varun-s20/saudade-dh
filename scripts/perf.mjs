/**
 * Recipient-route performance check (MASTER_BUILD_PROMPT §8) against a PRODUCTION server:
 * Lighthouse-like "slow 4G" (150 ms RTT, 1.6 Mbps down, 750 kbps up) + 4× CPU slowdown, cold
 * HTTP cache, Chromium at 390×844. Measures LCP, CLS, JS transferred, and checks that no
 * stamp-world chunk loads before a stamp is opened.
 *
 *   npx next build && npx next start -p 3200      (in another terminal)
 *   node scripts/perf.mjs --base http://localhost:3200 [--state first|repeat|empty]
 */
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const arg = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = arg("base", "http://localhost:3200");
const STATE = arg("state", "first");
const SLUG = "h4kqzm2xv7pt";
const SCENARIO = { first: "First tap", repeat: "Repeat visit", empty: "Empty envelope" }[STATE];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

// 1. Put the hero unit into the requested state through the presenter's Demo Panel.
await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Open demo panel/ }).click();
await page.getByRole("button", { name: new RegExp(`^${SCENARIO}`) }).first().click();
await page.waitForURL(new RegExp(`/t/${SLUG}`), { timeout: 20000 });
await page.waitForTimeout(1500);
// Hide the presenter panel so it isn't part of the measurement.
const FAST = args.includes("--fast");
await page.evaluate((FAST) => {
  const s = JSON.parse(localStorage.getItem("saudade-demo-v1") ?? '{"state":{}}');
  s.state.enabled = false;
  s.state.open = false;
  s.state.fast = FAST; // skip the mock layer's simulated 300–900 ms server latency
  localStorage.setItem("saudade-demo-v1", JSON.stringify(s));
}, FAST);

// 2. Cold cache + throttling, then a fresh load of the recipient URL (what an NFC tap does).
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.clearBrowserCache");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

const transfers = [];
cdp.on("Network.loadingFinished", (e) => transfers.push(e));
const reqs = new Map();
cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type }));

await page.addInitScript(() => {
  window.__lcp = 0;
  window.__cls = 0;
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: "layout-shift", buffered: true });
});
const t0 = Date.now();
await page.goto(`${BASE}/t/${SLUG}`, { waitUntil: "commit", timeout: 120000 });
// "Ready" = the recipient can act: the Tap-to-open prompt (first tap), a stamp (repeat), or the
// still-being-written copy (empty).
const readySel = { first: 'button:has-text("Tap to open")', repeat: "[data-stamp-button]", empty: "text=/still being written/i" }[STATE];
await page.locator(readySel).first().waitFor({ state: "visible", timeout: 120000 });
const readyMs = Date.now() - t0;
const readyCount = transfers.length;
await page.waitForTimeout(6000);
const { lcp, cls } = await page.evaluate(() => ({ lcp: window.__lcp, cls: window.__cls }));

let jsReady = 0;
for (const t of transfers.slice(0, readyCount)) if (reqs.get(t.requestId)?.type === "Script") jsReady += t.encodedDataLength;

let js = 0, css = 0, font = 0, img = 0, doc = 0, other = 0;
const jsFiles = [];
for (const t of transfers) {
  const r = reqs.get(t.requestId);
  if (!r) continue;
  const b = t.encodedDataLength;
  if (r.type === "Script") { js += b; jsFiles.push([r.url.split("/").pop(), b]); }
  else if (r.type === "Stylesheet") css += b;
  else if (r.type === "Font") font += b;
  else if (r.type === "Image") img += b;
  else if (r.type === "Document") doc += b;
  else other += b;
}
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const worldChunks = jsFiles.filter(([f]) => /world/i.test(f));
console.log(`State: ${STATE}${FAST ? " (no simulated server latency)" : ""}  (load took ${((Date.now() - t0) / 1000).toFixed(1)} s wall-clock under throttling)`);
console.log(`Ready to interact after ${readyMs} ms (wall-clock, throttled)`);
console.log(`LCP ${Math.round(lcp)} ms (budget < 2500)   CLS ${cls.toFixed(3)} (budget < 0.05)`);
console.log(`JS before ready: ${kb(jsReady)} (budget ≲ 150 KB)   JS after ready (idle prefetch of stamp worlds etc.): ${kb(js - jsReady)}`);
console.log(`Transferred total: JS ${kb(js)}  CSS ${kb(css)}  fonts ${kb(font)}  images ${kb(img)}  HTML ${kb(doc)}  other ${kb(other)}`);
console.log(`Largest JS: ${jsFiles.sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, b]) => `${f} ${kb(b)}`).join(", ")}`);
console.log(`World chunks loaded before opening a stamp (by name): ${worldChunks.length ? worldChunks.map(([f]) => f).join(", ") : "none detected by filename"}`);
await browser.close();
