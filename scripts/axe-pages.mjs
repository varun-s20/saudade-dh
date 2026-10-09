/**
 * Extra axe pass (WCAG 2.2 AA tags): pages and states outside the e2e journey, at phone and
 * desktop widths, with the tap-help Android tab opened. Exits non-zero on serious/critical issues.
 *   node scripts/axe-pages.mjs --base http://localhost:3200
 */
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
const AXE = fs.readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");
const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://localhost:3200";
const ROUTES = ["/", "/claim", "/recover", "/help/tap", "/privacy", "/terms", "/nowhere", "/design-system", "/design-system/directions", "/design-system/motion", "/admin"];
const b = await chromium.launch();
let total = 0;
for (const w of [390, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(1600);
    if (r === "/help/tap") {
      // the other tab too
      await page.getByRole("tab", { name: "Android" }).click();
      await page.waitForTimeout(400);
    }
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((n) => n.target.join(" ")) }));
    });
    const bad = res.filter((v) => v.impact === "serious" || v.impact === "critical");
    total += bad.length;
    console.log(`${w} ${r}: ${res.length ? res.map((v) => `${v.impact} ${v.id}(${v.n}) ${v.t.join(", ")}`).join(" | ") : "clean"}`);
  }
  await ctx.close();
}
console.log(`serious/critical: ${total}`);
await b.close();
if (total) process.exit(1);
