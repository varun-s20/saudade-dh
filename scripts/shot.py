"""Screenshot a route of the running dev server (team QA helper).

usage:
  python scripts/shot.py /claim out.png
  python scripts/shot.py /t/h4kqzm2xv7pt out.png --engine webkit --wait 4000
  python scripts/shot.py /design-system out.png --width 1280 --height 900 --full
  python scripts/shot.py /claim out.png --type "#code-input=3k7m" --click "button[type=submit]" --wait 1500
  python scripts/shot.py /t/h4kqzm2xv7pt out.png --reduced-motion --frames 0,800,2000

Options:
  --base URL          dev server origin (default http://localhost:3100)
  --engine NAME       chromium (default) | webkit (closest to iPhone Safari)
  --width/--height    viewport (default 375x812, iPhone mini/X class), DPR 2, touch + mobile UA
  --wait MS           wait after load / after actions before the shot (default 1200)
  --full              full-page screenshot
  --reduced-motion    emulate prefers-reduced-motion: reduce
  --click SELECTOR    click (repeatable, in order)
  --type SEL=TEXT     type into an element (repeatable, runs before clicks)
  --eval JS           run JS in the page before the shot (repeatable)
  --frames a,b,c      instead of one shot, capture frames at these ms offsets after actions
                      (writes out-0.png, out-1.png, ...)
Console errors and page errors are printed to stdout, so check them.

Windows: run from PowerShell, or prefix Git Bash commands with MSYS_NO_PATHCONV=1 (Git Bash
rewrites a leading '/' route into a filesystem path).
"""
import argparse
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

p = argparse.ArgumentParser()
p.add_argument("path")
p.add_argument("out")
p.add_argument("--base", default="http://localhost:3100")
p.add_argument("--engine", default="chromium", choices=["chromium", "webkit", "firefox"])
p.add_argument("--width", type=int, default=375)
p.add_argument("--height", type=int, default=812)
p.add_argument("--wait", type=int, default=1200)
p.add_argument("--full", action="store_true")
p.add_argument("--reduced-motion", action="store_true")
p.add_argument("--click", action="append", default=[])
p.add_argument("--type", action="append", default=[])
p.add_argument("--eval", action="append", default=[])
p.add_argument("--frames", default="")
a = p.parse_args()

with sync_playwright() as pw:
    browser = getattr(pw, a.engine).launch()
    mobile = a.width < 800
    ctx = browser.new_context(
        viewport={"width": a.width, "height": a.height},
        device_scale_factor=2,
        is_mobile=mobile and a.engine != "firefox",
        has_touch=mobile,
        reduced_motion="reduce" if a.reduced_motion else "no-preference",
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"
            if mobile
            else None
        ),
    )
    page = ctx.new_page()
    page.on("console", lambda m: print(f"[console.{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: print(f"[pageerror] {e}"))
    page.goto(a.base + a.path, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(600)
    for t in a.type:
        sel, _, text = t.partition("=")
        page.locator(sel).first.click()
        page.keyboard.type(text, delay=40)
    for c in a.click:
        page.locator(c).first.click()
        page.wait_for_timeout(250)
    for js in a.eval:
        page.evaluate(js)
    if a.frames:
        stem = a.out[:-4] if a.out.endswith(".png") else a.out
        last = 0
        for i, ms in enumerate(int(x) for x in a.frames.split(",")):
            page.wait_for_timeout(max(0, ms - last))
            last = ms
            page.screenshot(path=f"{stem}-{i}.png", full_page=a.full)
            print(f"wrote {stem}-{i}.png @ {ms}ms")
    else:
        page.wait_for_timeout(a.wait)
        page.screenshot(path=a.out, full_page=a.full)
        print(f"wrote {a.out}")
    browser.close()
sys.exit(0)
