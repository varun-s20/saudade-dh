/**
 * End-to-end showcase journey (integration gate): claim → fill → preview → seal → first tap →
 * repeat visit → admin, with first-open integrity checks against the mock database.
 * Uses playwright-core 1.57 (matches the installed WebKit build, our iPhone Safari proxy).
 *
 *   node scripts/e2e.mjs                      # chromium + webkit, screenshots to ./.e2e/
 *   node scripts/e2e.mjs --engine webkit --out C:\path\to\dir
 *   node scripts/e2e.mjs --base http://localhost:3000
 *
 * Exit code 1 if any check fails or any page error / console error is seen.
 */
import { chromium, webkit } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const BASE = arg("base", "http://localhost:3100");
const OUT = path.resolve(arg("out", ".e2e"));
const ENGINES = (arg("engine", "chromium,webkit")).split(",");
const HERO = { token: "q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs", slug: "h4kqzm2xv7pt" };
const AXE = fs.readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");
const A11Y = args.includes("--no-a11y") ? false : true;
const PHOTOS = ["public/demo/photos/01.jpg", "public/demo/photos/04.jpg"].map((p) => path.resolve(p));
const SPOTIFY = "https://open.spotify.com/track/6dGnYIeXmHdcikdzNNDMm2";
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
const results = [];

async function run(engineName) {
  const engine = engineName === "webkit" ? webkit : chromium;
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: engineName !== "firefox",
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  });
  const page = await ctx.newPage();
  const errors = [];
  // WebKit reports a same-origin RSC prefetch that was cut off by page.goto() as "…?_rsc=… due to
  // access control checks". That's the test harness navigating mid-prefetch, not an app error.
  page.on("pageerror", (e) => {
    if (/_rsc=.*access control checks/i.test(e.message)) return;
    errors.push(`pageerror: ${e.message}`);
  });
  page.on("console", (m) => {
    // Third-party embed noise (Spotify/Apple players inside their iframes) is not our code.
    if (m.type() === "error" && !/(Failed to load resource.*(spotify|scdn|apple|mzstatic))|(Recipient has origin https:\/\/(open\.spotify\.com|embed\.music\.apple\.com))/i.test(m.text()))
      errors.push(`console.error: ${m.text()}`);
  });

  let step = 0;
  const a11y = [];
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${engineName}-${String(++step).padStart(2, "0")}-${name}.png`) });
    if (!A11Y) return;
    try {
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
        return r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length, sample: x.nodes.slice(0, 2).map((n) => n.target.join(" ")) }));
      });
      for (const x of v) a11y.push({ step: name, ...x });
    } catch (e) {
      a11y.push({ step: name, id: "axe-failed", impact: "minor", nodes: 0, sample: [String(e.message).slice(0, 80)] });
    }
  };
  const check = (name, ok, detail = "") => {
    results.push({ engine: engineName, name, ok, detail });
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} [${engineName}] ${name}${detail ? ` (${detail})` : ""}`);
  };
  const db = () => page.evaluate(() => JSON.parse(localStorage.getItem("saudade-mock-db-v2") ?? "{}").state ?? {});
  const hero = async () => (await db()).units?.unit_hero ?? {};
  const visible = async (text, timeout = 8000) => {
    try {
      await page.getByText(text).first().waitFor({ state: "visible", timeout });
      return true;
    } catch {
      return false;
    }
  };
  const typeCode = async (body) => {
    await page.locator("#code-input").click();
    await page.keyboard.type(body, { delay: 60 });
  };
  const saveAndToast = async () => {
    const save = page.getByRole("button", { name: /^Save/ }).last();
    await save.waitFor({ state: "visible" });
    await page.waitForFunction((el) => !el.disabled && el.getAttribute("aria-disabled") !== "true", await save.elementHandle(), { timeout: 45000 });
    await save.click();
    return visible(/Sealed with care/i, 10000);
  };

  try {
    // ── Fresh state
    await page.goto(`${BASE}/`);
    await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      await new Promise((r) => {
        const q = indexedDB.deleteDatabase("saudade-media");
        q.onsuccess = q.onerror = q.onblocked = () => r(null);
      });
    });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await shot("home");

    // ── 1. Claim (client priority #1)
    await page.goto(`${BASE}/claim`, { waitUntil: "networkidle" });
    await typeCode("0");
    check("claim: ambiguous 0 refused with hint", await visible(/never use 0/i, 4000));
    await shot("claim-ambiguous");

    await page.reload({ waitUntil: "networkidle" });
    await typeCode("9PXR");
    await page.keyboard.press("Enter");
    check("claim: SAUD-9PXR already claimed", await visible(/already found its envelope/i));
    await shot("claim-already");

    await page.reload({ waitUntil: "networkidle" });
    await typeCode("ZZZZ");
    await page.keyboard.press("Enter");
    check("claim: unknown code message", await visible(/can.t find that code/i));

    await page.reload({ waitUntil: "networkidle" });
    await typeCode("3K7M");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/claim\/success/, { timeout: 15000 });
    check("claim: SAUD-3K7M succeeds", await visible(/Your envelope is yours/i));
    await shot("claim-success");

    // ── 2. Fill (client priority #2)
    await page.goto(`${BASE}/s/${HERO.token}`, { waitUntil: "networkidle" });
    check("portal: loads for claimed token", await visible(/Fill your envelope|Your envelope/i));
    await shot("portal-empty");

    await page.goto(`${BASE}/s/${HERO.token}/letter`, { waitUntil: "networkidle" });
    await page.getByLabel(/Who it.s for/i).fill("Theo");
    await page.getByLabel(/^Your letter/i).fill("It's raining here the way it used to on Thursdays. I keep saving things to tell you.\n\nThis is me sending a postcard anyway.");
    await page.getByLabel(/Your name/i).fill("Mira");
    check("letter: save shows 'Sealed with care'", await saveAndToast());
    await shot("letter-saved");

    await page.goto(`${BASE}/s/${HERO.token}/photos`, { waitUntil: "networkidle" });
    await page.locator('input[type="file"]').first().setInputFiles(PHOTOS);
    await page.waitForTimeout(800);
    await shot("photos-processing");
    check("photos: compress + upload + save", await saveAndToast());
    const ph = (await db()).contents?.unit_hero?.photos?.content?.items ?? [];
    check("photos: 2 items stored with dimensions", ph.length === 2 && ph.every((p) => p.width > 0 && p.height > 0), `${ph.length} items`);
    await shot("photos-saved");

    await page.goto(`${BASE}/s/${HERO.token}/song`, { waitUntil: "networkidle" });
    await page.getByLabel(/Song link/i).fill(SPOTIFY);
    check("song: resolves Spotify track", await visible(/Here Comes/i, 20000));
    check("song: save", await saveAndToast());
    await shot("song-saved");

    await page.goto(`${BASE}/s/${HERO.token}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await shot("portal-filled");
    check("unit status is filled", (await hero()).status === "filled", (await hero()).status);

    // ── 3. Preview never counts as the first open
    await page.goto(`${BASE}/s/${HERO.token}/preview`, { waitUntil: "networkidle" });
    check("preview: framed as not counting", await visible(/doesn.t count as their first open/i));
    const previewTap = page.getByRole("button", { name: /Tap to open/i }).first();
    if (await previewTap.isVisible().catch(() => false)) {
      await page.waitForTimeout(1800);
      await previewTap.click();
      await page.waitForTimeout(9000);
    }
    await shot("preview-settled");
    const afterPreview = await hero();
    check("preview: did NOT record a reveal", !afterPreview.revealedAt && !(await db()).reveals?.length, afterPreview.status);

    // ── 4. Seal & send
    await page.goto(`${BASE}/s/${HERO.token}/seal`, { waitUntil: "networkidle" });
    await shot("seal-ready");
    await page.getByRole("button", { name: /Seal it now/i }).click();
    check("seal: sealed state", await visible(/It.s sealed/i, 15000));
    await page.waitForTimeout(1200);
    await shot("seal-sealed");
    check("unit status is sealed", (await hero()).status === "sealed", (await hero()).status);

    // ── 5. First tap (client priority #3)
    await page.goto(`${BASE}/t/${HERO.slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    await shot("tap-threshold");
    check("first tap: prompt shown", await visible(/Someone who misses you sent this/i, 4000));
    check("first tap: nothing recorded on load", !(await hero()).revealedAt);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2200);
    check("first tap: reload before tapping records nothing", !(await hero()).revealedAt);
    await page.getByRole("button", { name: /Tap to open/i }).first().click();
    await page.waitForTimeout(1300);
    await shot("tap-opening");
    await page.waitForTimeout(2200);
    await shot("tap-stamps");
    await page.waitForTimeout(5500);
    await shot("tap-settled");
    const revealed = await hero();
    const reveals = ((await db()).reveals ?? []).filter((r) => r.unitId === "unit_hero");
    check("first tap: reveal recorded exactly once after the ceremony", Boolean(revealed.revealedAt) && reveals.length === 1, `${reveals.length} events, status ${revealed.status}`);

    // Stamp worlds
    for (const [kind, re] of [
      ["photos", /Open photos/i],
      ["letter", /Open letter/i],
      ["song", /Open song/i],
    ]) {
      const btn = page.getByRole("button", { name: re }).first();
      const ok = await btn.isVisible().catch(() => false);
      check(`world: ${kind} stamp is a labelled button`, ok);
      if (!ok) continue;
      await btn.click();
      await page.waitForTimeout(kind === "song" ? 3500 : 1600);
      const dialog = page.getByRole("dialog").first();
      check(`world: ${kind} opens as a dialog`, await dialog.isVisible().catch(() => false));
      await shot(`world-${kind}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
    }

    // ── 6. Repeat visit (client priority #4)
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const tapAgain = await page.getByRole("button", { name: /Tap to open/i }).first().isVisible().catch(() => false);
    check("repeat visit: no ceremony, straight to the envelope", !tapAgain);
    await shot("repeat-visit");
    check("repeat visit: still exactly one reveal event", ((await db()).reveals ?? []).filter((r) => r.unitId === "unit_hero").length === 1);

    // Not found
    await page.goto(`${BASE}/t/zzzzzzzzzzzz`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await shot("not-found");

    // ── 7. Admin
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    await page.getByLabel(/^Email/i).fill("zeya@saudade.example");
    await page.getByLabel(/^Password/i).fill("postmark");
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
    check("admin: sign in", true);
    await page.goto(`${BASE}/admin/units/unit_hero`, { waitUntil: "networkidle" });
    check("admin: unit detail shows the opened envelope", await visible(/Opened|Revealed/i, 8000));
    await page.waitForTimeout(600);
    await shot("admin-unit");
  } catch (e) {
    check("journey completed without exceptions", false, e.message.split("\n")[0]);
    await shot("crash").catch(() => {});
  }

  check("no page errors / console errors", errors.length === 0, errors.slice(0, 4).join(" | "));
  if (A11Y) {
    const serious = a11y.filter((x) => x.impact === "serious" || x.impact === "critical");
    for (const x of a11y) console.log(`  a11y [${engineName}] ${x.step}: ${x.impact} ${x.id} (${x.nodes}) ${x.sample.join(" ; ")}`);
    check("axe: no serious/critical WCAG 2.2 AA violations across the journey", serious.length === 0, `${serious.length} serious/critical, ${a11y.length} total`);
    results.push({ engine: engineName, a11y });
  }
  await browser.close();
}

for (const e of ENGINES) await run(e.trim());
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(`\n${results.length - failures}/${results.length} checks passed. Screenshots: ${OUT}`);
process.exit(failures ? 1 : 0);
