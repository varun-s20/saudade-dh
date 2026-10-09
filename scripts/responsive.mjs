/**
 * Responsive audit: every route at phone, tablet, laptop and monitor sizes, checked by rule.
 *
 *   node scripts/responsive.mjs --base http://localhost:3200 [--sizes phones|tablets|desktops|all]
 *                               [--only /,/claim] [--shots <dir>] [--json <file>]
 *
 * Run it against a MOCK build (NEXT_PUBLIC_DATA_SOURCE=mock): it claims the hero code, loads the
 * sample envelope and seals it in each browser, then signs in to the demo admin. It never touches
 * a real database.
 *
 * Per route and screen size it flags:
 *   hscroll    the page scrolls sideways
 *   offscreen  visible text pushed past the left or right edge of the screen
 *   clipped    visible text cut off by a box with overflow hidden/clip (not a scroller)
 *   collide    two pieces of visible text overlapping each other
 *   underhead  text hidden under the sticky header inside a pinned scene (home page only)
 *   target     a control smaller than 44×44 on a touch-sized screen (inline text links excepted)
 *   tiny       text under 12px on a phone
 * Decorative parts (aria-hidden) and screen-reader-only text are skipped. The pinned scenes on the
 * home page are checked at several points of their scroll. Exit code 1 when anything is flagged.
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3200");
const SHOTS = opt("shots", "");
const JSON_OUT = opt("json", "");
const ONLY = opt("only", "")
  .split(",")
  .filter(Boolean);

const SIZES = {
  phones: [
    [320, 568],
    [360, 740],
    [390, 844],
    [430, 932],
  ],
  tablets: [
    [768, 1024],
    [820, 1180],
    [1024, 768],
    [1024, 1366],
  ],
  desktops: [
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [2560, 1440],
  ],
};
const sizeSet = opt("sizes", "all");
const custom = opt("size", "") ? [opt("size").split("x").map(Number)] : null;
const sizes = custom ?? (sizeSet === "all" ? [...SIZES.phones, ...SIZES.tablets, ...SIZES.desktops] : SIZES[sizeSet]);

const HERO = { token: "q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs", slug: "h4kqzm2xv7pt", unit: "unit_hero" };
const S = `/s/${HERO.token}`;
const ROUTES = {
  public: ["/", "/claim", "/recover", "/help/tap", "/privacy", "/terms", "/no-such-page"],
  sender: [S, `${S}/photos`, `${S}/letter`, `${S}/voice`, `${S}/song`, `${S}/preview`, `${S}/seal`],
  recipient: [`/t/${HERO.slug}`],
  admin: ["/admin/dashboard", "/admin/units", `/admin/units/${HERO.unit}`, "/admin/batch"],
};
const want = (r) => !ONLY.length || ONLY.includes(r);

/** The checks, run inside the page. `scope` limits them to one element (a pinned stage). */
function audit({ phone, touch, scope, pinnedHead }) {
  const W = innerWidth;
  const out = [];
  const root = scope ? document.querySelector(scope) : document.body;
  if (!root) return out;
  const name = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}`;
  };
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
      // visually hidden (skip links until focused, sr-only patterns)
      if (cs.clip === "rect(0px, 0px, 0px, 0px)" || cs.clipPath === "inset(50%)") return false;
      const r = e.getBoundingClientRect();
      if (cs.overflow === "hidden" && r.width <= 1 && r.height <= 1) return false;
    }
    // the back of a postcard that hasn't been turned over faces away from the viewer
    const back = el.closest(".pf__back");
    if (back && !back.closest(".pf[data-flipped]")) return false;
    return true;
  };
  const decorative = (el) => el.closest('[aria-hidden="true"], .sr-only, [inert]');
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const text = (el) => el.textContent.trim().replace(/\s+/g, " ").slice(0, 40);

  // leaf text: each element with its own visible text, measured by its own text nodes' rects
  // (not its descendants', which may be screen-reader-only text parked off to the side)
  const leaves = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const byEl = new Map();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || decorative(el)) continue;
    if (!byEl.has(el)) byEl.set(el, []);
    byEl.get(el).push(node);
  }
  for (const [el, nodes] of byEl) {
    if (!shown(el)) continue;
    const range = document.createRange();
    const raw = nodes.flatMap((n) => {
      range.selectNode(n);
      return [...range.getClientRects()];
    });
    // each line's box, trimmed to the middle 60% of its height (the glyphs' core): tightly leaded
    // lines touch at their edges by design, and that isn't a collision
    const rects = raw
      .filter((r) => r.width > 1 && r.height > 1)
      .map((r) => ({ left: r.left, right: r.right, top: r.top + r.height * 0.2, bottom: r.bottom - r.height * 0.2, width: r.width, height: r.height * 0.6 }));
    if (!rects.length) continue;
    // text scrolled or clipped out of view inside a box isn't on screen to collide with anything
    let clipBox = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
        clipBox = p.getBoundingClientRect();
        break;
      }
    }
    const visibleRects = clipBox
      ? rects
          .map((r) => ({ left: Math.max(r.left, clipBox.left), right: Math.min(r.right, clipBox.right), top: Math.max(r.top, clipBox.top), bottom: Math.min(r.bottom, clipBox.bottom) }))
          .filter((r) => r.right > r.left && r.bottom > r.top)
          .map((r) => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }))
      : rects;
    const box = rects.reduce((a, r) => ({ left: Math.min(a.left, r.left), right: Math.max(a.right, r.right), top: Math.min(a.top, r.top), bottom: Math.max(a.bottom, r.bottom) }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    leaves.push({ el, box, rects: visibleRects });
  }

  for (const { el, box } of leaves) {
    // off the sides of the screen
    if ((box.left < -1 || box.right > W + 1) && !inScroller(el)) out.push({ kind: "offscreen", el: name(el), text: text(el), detail: `x ${Math.round(box.left)}..${Math.round(box.right)} of ${W}` });
    // cut off by a box that hides its overflow (scrollers are fine: that's what they're for)
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const ox = cs.overflowX, oy = cs.overflowY;
      if ([ox, oy].some((o) => o === "auto" || o === "scroll")) break;
      if ([ox, oy].some((o) => o === "hidden" || o === "clip")) {
        const r = p.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) break;
        const cutX = (ox === "hidden" || ox === "clip") && (box.left < r.left - 1 || box.right > r.right + 1);
        const cutY = (oy === "hidden" || oy === "clip") && (box.top < r.top - 1 || box.bottom > r.bottom + 1);
        const ellipsis = getComputedStyle(el).textOverflow === "ellipsis";
        if ((cutX || cutY) && !ellipsis) out.push({ kind: "clipped", el: name(el), text: text(el), detail: `by ${name(p)} (${cutX ? "x" : ""}${cutY ? "y" : ""})` });
        break;
      }
    }
    // under the header inside a pinned scene
    if (pinnedHead && box.top < pinnedHead - 1 && box.bottom > 0) out.push({ kind: "underhead", el: name(el), text: text(el), detail: `top ${Math.round(box.top)} < header ${Math.round(pinnedHead)}` });
    // tiny text on phones
    if (phone) {
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 12) out.push({ kind: "tiny", el: name(el), text: text(el), detail: `${fs}px` });
    }
  }

  // text running into other text (not nested, overlapping by over a quarter of the smaller).
  // Bars pinned to the screen (fixed or sticky: the header, the save dock) pass over the page by
  // design, so they're left out; whether content can scroll clear of them is a separate question.
  const pinned = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const pos = getComputedStyle(e).position;
      // a bar, not a full-screen pinned scene (those are checked like any other content)
      if (pos === "fixed" || (pos === "sticky" && e.getBoundingClientRect().height < innerHeight * 0.4)) return true;
    }
    return false;
  };
  const vis = leaves.filter(({ el, box, rects }) => rects.length && box.bottom > 0 && box.top < innerHeight * 6 && !pinned(el));
  for (let i = 0; i < vis.length; i++) {
    for (let j = i + 1; j < vis.length; j++) {
      const a = vis[i], b = vis[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      let overlap = 0;
      for (const ra of a.rects) for (const rb of b.rects) overlap += Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)) * Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
      const area = (x) => x.rects.reduce((s, r) => s + r.width * r.height, 0);
      if (overlap > 0.25 * Math.min(area(a), area(b))) out.push({ kind: "collide", el: `${name(a.el)} × ${name(b.el)}`, text: `${text(a.el)} × ${text(b.el)}`, detail: `${Math.round(overlap)}px²` });
    }
  }

  // touch targets
  if (touch) {
    for (const el of root.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"]')) {
      if (decorative(el) || !shown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // inline links inside running text are exempt (WCAG 2.5.8)
      const inline = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 10;
      if (inline) continue;
      // a visually hidden input whose label is the target
      if (el.matches("input") && (r.width <= 2 || getComputedStyle(el).opacity === "0")) continue;
      if (r.width < 43.5 || r.height < 43.5) out.push({ kind: "target", el: name(el), text: (el.getAttribute("aria-label") || text(el) || el.getAttribute("title") || "").slice(0, 40), detail: `${Math.round(r.width)}×${Math.round(r.height)}` });
    }
  }
  if (!scope && document.documentElement.scrollWidth > W + 1) out.unshift({ kind: "hscroll", el: "html", text: "", detail: `scrollWidth ${document.documentElement.scrollWidth} > ${W}` });
  return out;
}

/** Go to a page and let it settle: a bounded wait for the network, so a busy server can't stall the run. */
async function open(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

async function settle(page) {
  // scroll through once so in-view reveals fire and lazy images load, then back to the top
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
}

async function pinnedChecks(page, flags) {
  for (const [section, stage] of [
    [".hm-hype", ".hm-hype__stage"],
    [".hm-yr", ".hm-yr__stage"],
  ]) {
    for (const p of [0.08, 0.5, 0.95]) {
      const ok = await page.evaluate(
        ({ section, p }) => {
          const s = document.querySelector(section);
          if (!s || s.offsetHeight <= innerHeight * 1.2) return false; // not pinned (reduced motion)
          window.scrollTo(0, Math.round(s.getBoundingClientRect().top + scrollY + p * (s.offsetHeight - innerHeight)));
          return true;
        },
        { section, p },
      );
      if (!ok) continue;
      await page.waitForTimeout(700);
      const head = await page.evaluate(() => document.querySelector(".pub-head")?.getBoundingClientRect().bottom ?? 0);
      const found = await page.evaluate(audit, { phone: false, touch: false, scope: stage, pinnedHead: head });
      for (const f of found) flags.push({ ...f, at: `${section} @${p}` });
    }
  }
}

const browser = await chromium.launch();
const report = [];
let total = 0;
for (const [w, h] of sizes) {
  const phone = w <= 480;
  const touch = w <= 1024;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: phone, hasTouch: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const run = async (route) => {
    if (!want(route)) return;
    try {
      await check(route);
    } catch (e) {
      total += 1;
      const msg = String(e.message).split("\n")[0];
      report.push({ size: `${w}x${h}`, route, flags: [{ kind: "error", el: "", text: msg.slice(0, 120), detail: "" }] });
      console.log(`${`${w}x${h}`.padEnd(10)} ${route.replace(HERO.token, "<token>").padEnd(22)} ERROR ${msg.slice(0, 90)}`);
    }
  };
  const check = async (route) => {
    errors.length = 0;
    await open(page, BASE + route);
    await page.waitForTimeout(900);
    await settle(page);
    const flags = await page.evaluate(audit, { phone, touch, scope: null, pinnedHead: 0 });
    if (route === "/") await pinnedChecks(page, flags);
    for (const e of errors) flags.push({ kind: "pageerror", el: "", text: e.slice(0, 80), detail: "" });
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const slug = (route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-")).slice(0, 50);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(SHOTS, `${slug}@${w}x${h}.png`), fullPage: route !== "/" });
    }
    total += flags.length;
    report.push({ size: `${w}x${h}`, route, flags });
    const counts = flags.reduce((m, f) => ((m[f.kind] = (m[f.kind] || 0) + 1), m), {});
    console.log(`${`${w}x${h}`.padEnd(10)} ${route.replace(HERO.token, "<token>").padEnd(22)} ${flags.length ? JSON.stringify(counts) : "ok"}`);
  };

  for (const r of ROUTES.public) await run(r);

  // sender: claim the hero code, load the sample envelope
  if (ROUTES.sender.some(want) || ROUTES.recipient.some(want)) {
    await open(page, `${BASE}/claim`);
    await page.locator("#code-input").click();
    await page.keyboard.type("3K7M", { delay: 30 });
    await page.keyboard.press("Enter");
    await page.waitForURL(/claim\/success/, { timeout: 20000 });
    await open(page, `${BASE}/?demo=1`);
    await page.getByRole("button", { name: /Open demo panel/ }).click();
    await page.getByRole("button", { name: /Load sample envelope/i }).first().click();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("saudade-demo-v1") ?? '{"state":{}}');
      Object.assign(s.state, { enabled: false, open: false, fast: true });
      localStorage.setItem("saudade-demo-v1", JSON.stringify(s));
    });
    for (const r of ROUTES.sender) await run(r);
    // recipient: sealed, before the first tap
    await open(page, `${BASE}/?demo=1`);
    await page.getByRole("button", { name: /Open demo panel/ }).click();
    await page.getByRole("button", { name: /^Sealed/ }).first().click();
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("saudade-demo-v1") ?? '{"state":{}}');
      Object.assign(s.state, { enabled: false, open: false, fast: true });
      localStorage.setItem("saudade-demo-v1", JSON.stringify(s));
    });
    for (const r of ROUTES.recipient) await run(r);
  }

  // admin
  if (ROUTES.admin.some(want)) {
    await open(page, `${BASE}/admin`);
    await page.getByLabel(/^Email/i).fill("zeya@saudade.example");
    await page.getByLabel(/^Password/i).fill("postmark");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
    for (const r of ROUTES.admin) await run(r);
  }
  await ctx.close();
}
await browser.close();

if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
console.log(`\n${total} flag(s) across ${report.length} page views.`);
process.exit(total ? 1 : 0);
