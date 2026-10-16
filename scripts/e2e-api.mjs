/**
 * Browser journey against the REAL backend (a build with NEXT_PUBLIC_DATA_SOURCE=api):
 * claim → photos + voice uploads (to Supabase Storage) → letter → seal → the recipient's first
 * tap on a separate "phone" → stamp worlds → repeat visit → admin sign-in → recover form.
 * The mock-data journey (Demo Panel, IndexedDB) stays in scripts/e2e.mjs.
 *
 *   npm run api:e2e -- --base http://localhost:3200 [--engine webkit] [--skip-media] [--out dir]
 *
 * With DATABASE_URL in the env file it uses two throwaway admins: one for the Node-side API calls,
 * one that signs in through the browser. Both are disabled at the end. Any
 * Content-Security-Policy violation in any page fails the run.
 */
import { chromium, webkit } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { connect, tempAdmin } from "./lib/ops-common.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const BASE = opt("base", "http://localhost:3200").replace(/\/+$/, "");
const ENGINE = opt("engine", "chromium");
const OUT = path.resolve(opt("out", ".e2e-api"));
const SKIP_MEDIA = args.includes("--skip-media");
const envFile = opt("env-file", path.join(process.cwd(), ".env.local"));
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const db = process.env.DATABASE_URL ? connect() : null;
const apiAdmin = db ? await tempAdmin(db, "e2e-api") : null;
const uiAdmin = db ? await tempAdmin(db, "e2e-ui") : null;
const ADMIN = apiAdmin ?? { email: (process.env.ADMIN_EMAIL || "zeya@saudade.example").toLowerCase(), password: process.env.ADMIN_PASSWORD };
const BROWSER_ADMIN = uiAdmin ?? ADMIN;
fs.mkdirSync(OUT, { recursive: true });

let passed = 0;
let failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) passed++;
  else failed++;
  console.log(`${cond ? "PASS" : "FAIL"} [${ENGINE}] ${name}${extra ? `  (${extra})` : ""}`);
};

// Admin API session (Node side) to make a fresh unit and to read the server's truth.
let cookie = "";
async function admin(method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { accept: "application/json", ...(cookie ? { cookie } : {}), ...(method !== "GET" ? { "x-saudade-csrf": "1" } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return { status: res.status, data: await res.json().catch(() => null) };
}

/** Wait for something to appear (isVisible() doesn't wait). */
const seen = (locator, timeout = 15000) => locator.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);

const browserType = ENGINE === "webkit" ? webkit : chromium;
const browser = await browserType.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: ENGINE !== "webkit", hasTouch: true };
const errors = [];
/**
 * WebKit reports every request cancelled by a navigation (Next's own ?_rsc prefetches included) as
 * "… due to access control checks." That is the test navigating away mid-load, not an app error;
 * Chromium reports nothing for the same journey.
 */
/** Every page, so a crash can be photographed for diagnosis. */
const open = [];
const real = (msg) => !/due to access control checks/.test(msg);
/** Every page reports CSP violations: the policy in next.config.ts must allow everything the app uses. */
const watchCsp = (page, who) =>
  page.on("console", (m) => m.type() === "error" && /Content Security Policy|Refused to (load|execute|connect|frame|apply)/i.test(m.text()) && errors.push(`${who} CSP: ${m.text().slice(0, 200)}`));

try {
  const signin = await admin("POST", "/api/admin/session", ADMIN);
  check("admin api: sign in", signin.status === 200);
  const batch = await admin("POST", "/api/admin/batches", { count: 1, label: `Journey ${ENGINE} ${new Date().toISOString().slice(0, 16)}` });
  const code = batch.data?.rows?.[0]?.code;
  check("admin api: fresh unit for this run", Boolean(code), code ?? `status ${batch.status}`);

  // ── The sender's phone ───────────────────────────────────────────────────
  const senderCtx = await browser.newContext(phone);
  const s = await senderCtx.newPage();
  open.push(["sender", s]);
  s.on("pageerror", (e) => real(e.message) && errors.push(`sender: ${e.message}`));
  watchCsp(s, "sender");
  if (args.includes("--trace")) {
    s.on("requestfailed", (q) => console.log("  trace REQFAILED", q.method(), q.url().replace(/token=[^&]+/, "token=…").slice(0, 100), q.failure()?.errorText));
    s.on("response", (q) => /\/api\/|supabase/.test(q.url()) && console.log("  trace", q.request().method(), q.status(), q.url().replace(/token=[^&]+/, "token=…").slice(0, 100)));
    s.on("console", (m) => m.type() === "error" && console.log("  trace console", m.text().slice(0, 160)));
  }
  await s.goto(`${BASE}/claim`, { waitUntil: "networkidle" });
  await s.locator("#code-input").click();
  await s.keyboard.type(code.replace(/^SAUD-/, ""), { delay: 60 });
  await s.keyboard.press("Enter");
  await s.waitForURL(/\/claim\/success\?t=/, { timeout: 20000 });
  const token = new URL(s.url()).searchParams.get("t");
  check("claim: code accepted, private link issued", /^[a-z2-7]{32}$/.test(token ?? ""));
  check("claim: 'Your envelope is yours.'", await seen(s.getByText(/Your envelope is/i), 10000));
  await s.screenshot({ path: path.join(OUT, `${ENGINE}-01-claimed.png`) });

  const saveAndToast = async () => {
    const save = s.getByRole("button", { name: /^Save/ }).last();
    // Poll the live button (React may re-render it while uploads finish); uploads to the
    // project's region can take a while on a slow link.
    for (let t = 0; t < 180 && !(await save.isEnabled().catch(() => false)); t++) await s.waitForTimeout(500);
    await save.click();
    return seen(s.getByText(/Sealed with care/i), 45000);
  };

  if (!SKIP_MEDIA) {
    await s.goto(`${BASE}/s/${token}/photos`, { waitUntil: "networkidle" });
    await s.locator('input[type="file"][accept="image/*"]').setInputFiles(["public/demo/photos/01.jpg", "public/demo/photos/05.jpg"]);
    check("photos: compressed + uploaded to Storage, saved", await saveAndToast());
    await s.screenshot({ path: path.join(OUT, `${ENGINE}-02-photos.png`) });

    if (ENGINE === "webkit") {
      // Playwright's Windows WebKit can't play audio from blob: URLs (MEDIA_ERR_SRC_NOT_SUPPORTED,
      // even MP3), so the editor can't measure the file. Real Safari can; voice is covered by the
      // Chromium run, api-smoke, and the real-iPhone check (Gate 1).
      console.log(`SKIP [${ENGINE}] voice upload (test WebKit can't play blob: audio)`);
    } else {
      await s.goto(`${BASE}/s/${token}/voice`, { waitUntil: "networkidle" });
      await s.locator('input[type="file"][accept="audio/*"]').setInputFiles("public/demo/voice/mira-voice.m4a");
      check("voice: uploaded + verified, saved", await saveAndToast());
    }
  }

  await s.goto(`${BASE}/s/${token}/letter`, { waitUntil: "networkidle" });
  await s.getByLabel(/^Your letter/i).fill("It's raining here the way it used to on Thursdays.\n\nThis is me sending a postcard anyway.");
  check("letter: saved", await saveAndToast());

  await s.goto(`${BASE}/s/${token}/seal`, { waitUntil: "networkidle" });
  await s.getByRole("button", { name: /Seal it now/i }).click();
  check("seal: sealed", await seen(s.getByText(/It.s sealed/i), 20000));
  await s.waitForTimeout(1500);

  const env = await (await fetch(`${BASE}/api/sender/envelope`, { headers: { authorization: `Bearer ${token}` } })).json();
  const slug = env.unit.slug;
  check("server: envelope sealed", env.unit.status === "sealed", env.unit.status);

  // ── The recipient's phone (a different device: no sender link on it) ─────
  const recCtx = await browser.newContext(phone);
  const r = await recCtx.newPage();
  open.push(["recipient", r]);
  r.on("pageerror", (e) => real(e.message) && errors.push(`recipient: ${e.message}`));
  watchCsp(r, "recipient");
  await r.goto(`${BASE}/t/${slug}`, { waitUntil: "networkidle" });
  await r.waitForTimeout(2600);
  check("first tap: prompt shown", await r.getByText(/Someone who misses you sent this/i).first().isVisible().catch(() => false));
  await r.reload({ waitUntil: "networkidle" });
  await r.waitForTimeout(2000);
  check("first tap: loading the page records nothing", (await (await fetch(`${BASE}/api/t/${slug}`)).json()).revealedAt === null);
  await r.screenshot({ path: path.join(OUT, `${ENGINE}-03-threshold.png`) });
  await r.getByRole("button", { name: /Tap to open/i }).first().click();
  await r.waitForTimeout(9500);
  await r.screenshot({ path: path.join(OUT, `${ENGINE}-04-settled.png`) });
  const after = await (await fetch(`${BASE}/api/t/${slug}`)).json();
  check("first tap: reveal recorded on the server after the ceremony", after.status === "revealed" && Boolean(after.revealedAt));

  for (const [kind, re] of [["letter", /Open letter/i], ...(SKIP_MEDIA ? [] : [["photos", /Open photos/i]])]) {
    const btn = r.getByRole("button", { name: re }).first();
    if (!(await btn.isVisible().catch(() => false))) {
      check(`world: ${kind} stamp visible`, false);
      continue;
    }
    await btn.click();
    await r.waitForTimeout(1800);
    check(`world: ${kind} opens`, await r.getByRole("dialog").first().isVisible().catch(() => false));
    if (kind === "photos") {
      // Full-size originals from the project's storage region: allow up to 15 s on a slow link.
      let loaded = false;
      for (let t = 0; t < 30 && !loaded; t++) {
        loaded = await r.evaluate(() => [...document.querySelectorAll('[role="dialog"] img')].some((i) => i.naturalWidth > 0));
        if (!loaded) await r.waitForTimeout(500);
      }
      check("world: photos load from signed Storage URLs", loaded);
    }
    await r.screenshot({ path: path.join(OUT, `${ENGINE}-05-world-${kind}.png`) });
    await r.keyboard.press("Escape");
    await r.waitForTimeout(800);
  }

  await r.reload({ waitUntil: "networkidle" });
  await r.waitForTimeout(2200);
  check("repeat visit: calm, no ceremony", !(await r.getByRole("button", { name: /Tap to open/i }).first().isVisible().catch(() => false)));

  // ── Admin in the browser ─────────────────────────────────────────────────
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await adminCtx.newPage();
  open.push(["admin", a]);
  a.on("pageerror", (e) => real(e.message) && errors.push(`admin: ${e.message}`));
  watchCsp(a, "admin");
  await a.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check("admin: no demo credentials shown on the real backend", !(await a.getByText(/demo sign-in/i).first().isVisible().catch(() => false)));
  await a.getByLabel(/^Email/i).fill(BROWSER_ADMIN.email);
  await a.getByLabel(/^Password/i).fill(BROWSER_ADMIN.password);
  await a.keyboard.press("Enter");
  await a.waitForURL(/\/admin\/dashboard/, { timeout: 20000 }).catch(() => {});
  check("admin: signed in to the dashboard", /\/admin\/dashboard/.test(a.url()));
  check("admin: the launch checklist is on the dashboard", await seen(a.getByRole("heading", { name: /Launch checklist/i })));
  await a.waitForLoadState("networkidle"); // WebKit reports fetches cancelled by navigating away as page errors
  await a.screenshot({ path: path.join(OUT, `${ENGINE}-06b-dashboard.png`), fullPage: true });

  // A second letter from the sender, so there is an earlier version to restore.
  await fetch(`${BASE}/api/sender/contents/letter`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ kind: "letter", to: "", body: "A second draft that replaced the first.", signoff: "", from: "" }),
  });
  const found = await admin("GET", `/api/admin/units?search=${encodeURIComponent(slug.slice(0, 8))}`);
  await a.goto(`${BASE}/admin/units/${found.data.items[0].id}`, { waitUntil: "networkidle" });
  check("admin: unit detail shows the opened envelope", await seen(a.getByText(/Opened|Revealed/i), 10000));
  check("admin: history lists the earlier letter", await seen(a.getByText(/Letter v1/)));
  await a.getByRole("button", { name: /Restore…/ }).first().click();
  await a.getByRole("button", { name: /^Restore$/ }).click();
  check("admin: restore → toast", await seen(a.getByText(/Letter restored/i)));
  const restored = await (await fetch(`${BASE}/api/t/${slug}`)).json();
  check("admin: …the recipient sees the first letter again", /raining here/.test(restored.contents?.letter?.content?.body ?? ""));
  await a.screenshot({ path: path.join(OUT, `${ENGINE}-06-admin-unit.png`), fullPage: true });

  await a.goto(`${BASE}/admin/batch`, { waitUntil: "networkidle" });
  const row = a.locator("li", { hasText: `Journey ${ENGINE}` }).first();
  await row.getByRole("button", { name: /Mark encoded/i }).click();
  await a.getByRole("button", { name: /^Mark encoded$/ }).click();
  check("batches: marked encoded, no void button any more", (await seen(row.getByText(/^Encoded$/))) && !(await row.getByRole("button", { name: /Void/ }).isVisible().catch(() => false)));
  await a.screenshot({ path: path.join(OUT, `${ENGINE}-07-batches.png`), fullPage: true });

  // ── Lost link ────────────────────────────────────────────────────────────
  await s.goto(`${BASE}/recover`, { waitUntil: "networkidle" });
  // A fresh address each run: the same one is limited to 3 requests an hour (by design).
  await s.getByLabel(/Your email/i).fill(`someone+${Date.now()}@example.com`);
  await s.getByRole("button", { name: /Send me my link/i }).click();
  const sent = await seen(s.getByText(/link is on its way|Too many requests/i), 15000);
  if (sent && (await s.getByText(/Too many requests/i).first().isVisible().catch(() => false))) {
    console.log(`SKIP [${ENGINE}] recover: this IP has used today's 10 link requests (the limiter working as designed)`);
  } else check("recover: same confirmation for any email", sent);

  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  failed++;
  console.log(`FAIL [${ENGINE}] crashed: ${e instanceof Error ? e.message : e}`);
  for (const [who, pg] of open) await pg.screenshot({ path: path.join(OUT, `${ENGINE}-crash-${who}.png`) }).catch(() => {});
}

await browser.close();
if (db) {
  for (const t of [apiAdmin, uiAdmin]) await t?.disable();
  await db.end();
}
console.log(`\n${passed}/${passed + failed} checks passed. Screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
