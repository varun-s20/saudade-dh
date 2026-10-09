"""Route sweep for QA: console/page errors, axe-core WCAG 2.2 AA violations, small touch targets,
and basic timings, across Chromium and WebKit at 375x812 (and optionally desktop).

usage:
  python scripts/qa.py                      # default route list, both engines, mobile
  python scripts/qa.py --desktop            # also 1280x900
  python scripts/qa.py /claim /t/h4kqzm2xv7pt --engine webkit
  python scripts/qa.py --setup "hero:sealed"   # put the demo hero unit in a state first (see below)

Setup hooks run in the page before the sweep (needs the app's demo actions exposed on window by
the Demo Panel module, or use --eval to run custom JS). Exit code 1 if any serious/critical axe
violation or page error is found.

Windows: run from PowerShell, or prefix Git Bash commands with MSYS_NO_PATHCONV=1 (Git Bash
rewrites a leading '/' route into a filesystem path).
"""
import argparse
import json
import pathlib
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
AXE = (ROOT / "node_modules" / "axe-core" / "axe.min.js").read_text(encoding="utf-8")

DEFAULT_ROUTES = [
    "/",
    "/claim",
    "/claim/success?t=q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs",
    "/recover",
    "/help/tap",
    "/privacy",
    "/terms",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs/photos",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs/letter",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs/voice",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs/song",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs/preview",
    "/s/q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs/seal",
    "/t/h4kqzm2xv7pt",
    "/t/zzzzzzzzzzzz",
    "/admin",
    "/design-system",
    "/this-page-does-not-exist",
]

SMALL_TARGETS_JS = """
() => {
  const out = [];
  for (const el of document.querySelectorAll('a[href], button, [role=button], input:not([type=hidden]), select, textarea, summary')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('[data-qa-ignore-target]')) continue;
    // Inline text links inside a paragraph are exempt (WCAG 2.5.8 inline exception).
    if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p, li')) continue;
    if (r.width < 44 || r.height < 44) {
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.id || el.tagName).trim().slice(0, 40);
      out.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  return out;
}
"""

p = argparse.ArgumentParser()
p.add_argument("routes", nargs="*")
p.add_argument("--base", default="http://localhost:3100")
p.add_argument("--engine", choices=["chromium", "webkit", "both"], default="both")
p.add_argument("--desktop", action="store_true")
p.add_argument("--wait", type=int, default=1500)
p.add_argument("--eval", action="append", default=[], help="JS to run once on the origin before the sweep")
p.add_argument("--json", help="write full results to this file")
a = p.parse_args()

routes = a.routes or DEFAULT_ROUTES
engines = ["chromium", "webkit"] if a.engine == "both" else [a.engine]
viewports = [(375, 812)] + ([(1280, 900)] if a.desktop else [])
results = []
bad = False

with sync_playwright() as pw:
    for engine in engines:
        browser = getattr(pw, engine).launch()
        for (w, h) in viewports:
            mobile = w < 800
            ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=mobile, has_touch=mobile)
            page = ctx.new_page()
            if a.eval:
                page.goto(a.base + "/", wait_until="networkidle")
                for js in a.eval:
                    page.evaluate(js)
            for route in routes:
                errors = []

                def on_console(m, errors=errors):
                    if m.type == "error":
                        errors.append(f"console.error: {m.text}")

                def on_pageerror(e, errors=errors):
                    errors.append(f"pageerror: {e}")

                page.on("console", on_console)
                page.on("pageerror", on_pageerror)
                status = None
                try:
                    resp = page.goto(a.base + route, wait_until="networkidle", timeout=60000)
                    status = resp.status if resp else None
                    page.wait_for_timeout(a.wait)
                    timing = page.evaluate("() => { const n = performance.getEntriesByType('navigation')[0]; return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } }")
                    page.add_script_tag(content=AXE)
                    axe = page.evaluate("async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes.slice(0,3).map(n => n.target.join(' ')) })) }")
                    small = page.evaluate(SMALL_TARGETS_JS)
                except Exception as e:  # noqa: BLE001
                    errors.append(f"sweep failed: {e}")
                    timing, axe, small = {}, [], []
                page.remove_listener("console", on_console)
                page.remove_listener("pageerror", on_pageerror)
                serious = [v for v in axe if v["impact"] in ("serious", "critical")]
                if errors or serious:
                    bad = True
                tag = f"[{engine} {w}x{h}] {route}  HTTP {status}"
                print(tag)
                for e in errors:
                    print(f"   ✗ {e}")
                for v in axe:
                    print(f"   axe {v['impact']:<8} {v['id']}: {v['help']} ({v['nodes']}) e.g. {v['sample'][:2]}")
                if small:
                    print(f"   small targets ({len(small)}): {small[:6]}")
                if not errors and not axe and not small:
                    print("   ✓ clean")
                results.append({"engine": engine, "viewport": [w, h], "route": route, "status": status, "errors": errors, "axe": axe, "smallTargets": small, "timing": timing})
            ctx.close()
        browser.close()

if a.json:
    pathlib.Path(a.json).write_text(json.dumps(results, indent=2), encoding="utf-8")
sys.exit(1 if bad else 0)
