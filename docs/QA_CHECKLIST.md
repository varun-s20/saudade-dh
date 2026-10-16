# QA checklist & device matrix

**Owner:** Accessibility & QA · **Standard:** WCAG 2.2 AA · MASTER_BUILD_PROMPT §8 quality bar
Status key: ✅ pass · ⚠️ pass with notes · ❌ fail · ⏳ not yet run · 📱 needs real hardware

Automated runs use `scripts/shot.py` (Playwright Chromium + WebKit, 375×812 @2x, touch, iPhone UA)
plus `scripts/qa.py` (route sweep: console errors, axe-style checks, timings). Results are recorded
in the **Run log** at the bottom. Real-device rows stay 📱 until tested on physical phones (Gate 1).

## 0. Status at Gate 2 internal review (2026-10-08)

| Area | Result | Evidence |
|---|---|---|
| End-to-end showcase journey (claim → fill → preview → seal → first tap → worlds → repeat → admin) | ✅ **64/64 checks**, Chromium + WebKit, production build | `node scripts/e2e.mjs` |
| First-open integrity (not on load, not on reload, never from preview, exactly once after the ceremony) | ✅ both engines | e2e + recipient engineer's tests |
| WCAG 2.2 AA automated (axe-core 4.14) on every journey state + 14 routes × phone/desktop | ✅ 0 violations | e2e `--a11y`, `scripts/qa.py --desktop` |
| Typecheck / lint / production build | ✅ clean (0 errors, 0 warnings) | `tsc`, `eslint .`, `next build` |
| Performance budget, recipient route | ❌ **not met yet** (see §4) | `scripts/perf.mjs` |
| Real devices (Gate 1), screen recording on a phone | 📱 **not done**: needs physical iPhone + Android | §1 |

## 1. Device matrix (MBP §8)

| Device / browser | Recipient `/t` | Sender `/s` (incl. mic) | Claim / public | Admin | Status |
|---|---|---|---|---|---|
| iPhone, Safari, current iOS (non-Pro model) | | | | n/a | 📱 |
| iPhone, Safari, previous iOS | | | | n/a | 📱 |
| Android mid-range, Chrome | | | | n/a | 📱 |
| Android, Samsung Internet | | | | n/a | 📱 |
| Instagram in-app browser (iOS + Android) | | mic-blocked state | | n/a | 📱 |
| WhatsApp in-app / link preview | preview must not reveal | | | n/a | 📱 |
| Gmail in-app browser | | mic-blocked state | | n/a | 📱 |
| Desktop Chrome | ✅ | ✅ | ✅ | ✅ | Playwright Chromium 1280×900 |
| Desktop Safari | | | | | 📱 (needs a Mac) |
| Desktop Firefox | | | | | ⏳ not run |
| Playwright WebKit 390×844 (proxy for iOS Safari) | ✅ | ✅ (no mic: fake media is Chromium-only) | ✅ | ✅ | ✅ e2e 32/32 (fonts render heavier than intended in this Windows WebKit build; computed styles are correct, so check on a real iPhone) |
| Playwright Chromium 390×844 (proxy for Android Chrome) | ✅ | ✅ (incl. fake-mic recording) | ✅ | ✅ | ✅ e2e 32/32 |

**NFC hardware checks (with the client's sample ceramic):** iPhone XS+ banner appears and opens
`/t/{slug}` · Android opens the URL with NFC on + unlocked · read range through the glaze ·
tag locked after encoding · QR fallback (if O8 approved). 📱

## 2. Functional: every screen and state

### Public
- [ ] S1 `/`: CTAs route correctly; "How it works" 3 steps; footer links.
- [x] S2 `/claim`: `SAUD-3K7M` succeeds with stamp-press → success page.
- [ ] S2 paste variants `saud3k7m`, `SAUD-3K7M`, `3k7m`, ` saud 3k7m ` all fill correctly.
- [x] S2 `0 O 1 I L` refused at keystroke with hint; `SAUD-0000` paste shows hint.
- [x] S2 `SAUD-ZZZZ` → "We can't find that code…"; `SAUD-9PXR` → "already found its envelope" + recover link.
- [ ] S2 5 failed attempts → rate-limited with live countdown; input preserved; recovers after countdown.
- [ ] S3 `/claim/success`: link shown, Copy works, Share (where supported), Email it to me → toast + outbox entry.
- [ ] S4 `/recover`: identical confirmation for known and unknown emails; demo "open the email" → magic link works.
- [ ] S5 `/help/tap`: iPhone, Android, fallback content correct (RESEARCH §4).
- [ ] S6 `/privacy`, `/terms`: placeholder text clearly marked; **no legal text written by us**.
- [ ] Global 404 is on-brand.

### Sender portal
- [ ] S7 home: 4 slots reflect fill state; unit status (draft / sealed / opened) shown; Preview + Seal & send actions.
- [ ] S7 invalid token → gentle message + recover link.
- [ ] S8 photos: pick multiple; real compression with progress stamp; counter n/15; 16th refused with limit state; remove; caption; upload-failed (Demo) shows retry; Save → toast "Sealed with care".
- [ ] S8 HEIC/large JPEG from iPhone compresses (📱).
- [ ] S9 letter: WYSIWYG stationery; Dear/sign-off; counter near 2,000; long letter; emoji + non-Latin text render legibly.
- [ ] S10 voice: mic permission prompt; live waveform; 3:00 countdown auto-stops; playback; re-record; upload file ≤ 3:00 accepted, > 3:00 refused; mic denied (Demo + real) explains fix; in-app browser (Demo + real UA) shows "Open in Safari/Chrome" + upload alternative.
- [ ] S10 Safari records audio/mp4, Chrome records webm/opus, both play back (📱 for iOS).
- [ ] S11 song: Spotify track, intl link, `spotify:` URI, short link, Apple album?i=, Apple /song/ → preview card + vinyl; album/playlist → "single song" message; non-music URL → unsupported; 30-second note shown.
- [ ] S12 unsaved-changes guard on every editor (in-app back + browser back/close).
- [x] S13 preview: framed "Preview — this doesn't count as their first open"; Replay reveal; **admin shows the unit still unrevealed afterwards**.
- [ ] S14 seal: ceremony plays; nothing-to-seal state; after sealing, editing still possible; first tap now plays the reveal.

### Recipient (hero)
- [ ] S15 first tap: nothing animates before the gesture; prompt → Tap to open → seal lift → flap → letter rises → stamps one by one (only filled ones) → hint.
- [x] S15 skip appears after 1.5 s and jumps to settled; the reveal is recorded once (admin timeline).
- [x] S15 reveal **not** recorded on page load, on reload before tapping, or from sender preview.
- [ ] S15 sound only after gesture; mute toggle persists per device.
- [ ] S15 iPhone with the **silent switch on**: reveal works silently, no errors (📱).
- [ ] S15 VoiceOver (iOS) path: prompt announced → Tap to open → settled → each stamp label read with details → world → close returns to the stamp (📱).
- [ ] S15 rotate the phone mid-ceremony: completes as skipped, recorded once (D-037).
- [ ] S15 reduced motion: crossfade, stamps fade in place, no 3D/overshoot.
- [x] S16 repeat visit: calm entrance, no ceremony; "new" postmark on stamps updated since last visit.
- [ ] S17 photos world: swipe, pinch-zoom, captions, alt text.
- [ ] S17 letter world: readable at any length, gentle scroll, readable in sunlight (contrast ≥ 7:1 for body).
- [ ] S17 voice world: play/pause, scrubber, duration, accessible labels; no default browser controls.
- [ ] S17 song world: vinyl spins + tonearm drops on Spotify play (iFrame API), stops on pause; Apple spins on interaction; official embed + "Open in app".
- [ ] S18 empty: "Your letter is still being written ✉" with soft postmark date.
- [ ] S19 not found: gentle, on-brand, help link.
- [ ] Sender edits appear on next recipient load (two tabs stay in sync).

### Admin
- [ ] S20 login: wrong password error; demo hint; redirect when signed out.
- [ ] S21 dashboard: counts by status match table; recent activity; quick search.
- [ ] S22 units: search by code (with/without dash, any case), email, slug; status filter; pagination; phone layout.
- [ ] S23 detail: view/remove each content item; reset code (old code fails, new code claims); reset reveal (next tap replays ceremony); email code with preview → outbox; audit log records every action.
- [ ] S24 batch: generate 300 → unique, non-sequential codes and slugs; preview; CSV `code,slug,url` downloads and opens in Excel/Numbers; URL uses chip domain, never a provider domain.

### Demo Panel (MBP §6.2)
- [ ] `?demo=1` and logo triple-tap open it; hidden otherwise.
- [ ] Unit states unclaimed → claimed/draft → filled → sealed → revealed.
- [ ] First tap · repeat visit · empty envelope · sender preview are distinct.
- [ ] Each error toggle produces its state: invalid code, already claimed, rate limited, upload failed, mic denied, in-app browser, network.
- [ ] Load sample envelope; reset everything; reduced-motion toggle; fast mode; outbox.

## 3. Accessibility (WCAG 2.2 AA)
- [x] Every stamp is a `<button>` with a descriptive label ("Open voice message from Mira, 1 minute 8 seconds").
- [ ] Keyboard-only path through claim → editors → seal; through recipient reveal → each world → close (focus returns to the stamp).
- [ ] Screen reader pass: VoiceOver iOS (📱), TalkBack (📱), NVDA/Chrome desktop.
- [ ] Visible on-brand focus on all interactive elements (2.4.7, 2.4.11 not obscured by sticky UI).
- [ ] Touch targets ≥ 44×44 px (2.5.8 asks for 24; our bar is 44).
- [ ] Contrast: text pairs per `styles/tokens.css` comments (all ≥ 4.5:1 on paper).
- [ ] No information by colour alone (status chips have text).
- [ ] Reduced-motion variant for every animation; no flashing > 3/s.
- [ ] Dialogs/sheets: `aria-modal`, labelled, focus trapped, Esc closes.
- [ ] Async status announced (`aria-live`): claim result, uploads, saves, recording state.
- [ ] Text resizes to 200% without loss; letter reflows.
- [ ] Dragging alternatives (2.5.7): sheet drag-to-close also has a close button; photo swipe also has buttons.

## 4. Performance (recipient route `/t/[slug]`)
| Metric | Budget | Result |
|---|---|---|
| LCP (slow 4G 150 ms / 1.6 Mbps, 4× CPU, cold cache) | < 2.5 s | ❌ **3.8 s** (Correio, 2026-10-09; was 4.2 s) (3.6 s without the prototype's simulated server latency; ≈1.2 s of that is the ceremony's deliberate pacing: envelope at 0.4 s, prompt at 1.2 s). Was 6.8 s before font fixes. |
| CLS | < 0.05 | ✅ 0.001 |
| INP | < 200 ms | ⏳ needs a real device trace |
| Initial JS for the route (gzipped) | ≲ 150 KB | ❌ **251 KB** before the envelope is interactive. Floor today: React DOM 71 KB + Next app router 45 KB + Motion 44 KB. Legacy polyfills (39 KB) are `noModule` and never load on modern phones. |
| Fonts | — | ✅ **118 KB** transferred on the recipient route after the reference rebalance (D-058; was 782 KB at Gate 0, 309 KB after D-043, 118 KB with Lisbon Post, 126–141 KB with Correio): Epilogue 800 + 900, Inter Tight (variable) and Nanum Pen preloaded (latin), Courier Prime on demand; the marker face is never loaded there |
| Stamp world contents lazy-loaded | yes | ✅ worlds load on idle after the envelope settles (20 KB), never before |
| Reveal animation | 60 fps, transform/opacity only | ⏳ (📱 must be measured on a real mid-range Android, e.g. Chrome DevTools remote performance trace) |
| Images | modern formats, responsive sizes | ⚠️ prototype serves pre-sized JPEGs ≤ 190 KB; Phase 3 adds WebP/AVIF + `srcset` (ARCHITECTURE §7) |

**Plan to meet the budget (Phase 3, owner: Frontend + Architect):**
1. Server-render the envelope data in the PPR shell instead of the client fetch the mock layer
   forces (localStorage only exists in the browser). Expected: −0.5 to −0.8 s LCP.
2. Motion `LazyMotion` + `m` components with async `domAnimation` features: about −25 KB.
3. Split the code paths: load the reveal ceremony only for `first_tap`, the calm view only for
   `repeat`. About −15 KB on each path.
4. Re-measure on a real mid-range Android (Chrome remote trace) before deciding whether the
   ceremony's 1.2 s prompt delay should be counted against LCP or the prompt shown sooner.

## 5. Content & compliance
- [x] Deferred items absent: video, drawing, drag-to-reorder, autosave, custom audio skin, checkout, data export.
- [x] No "coming soon" teasers (D-014).
- [x] Placeholder stamps marked `PLACEHOLDER — client artwork pending`.
- [x] `ASSETS.md` lists every font, photo, audio, texture.
- [x] All pages `noindex` (meta + `X-Robots-Tag` + robots.txt).
- [ ] No PII in URLs; no provider domain in chip URLs.

## Run log
| Date | Build | Who | Scope | Result |
|---|---|---|---|---|
| 2026-10-08 | foundation | PM | `tsc`, `eslint`, `next build` | ✅ clean |
| 2026-10-08 | integration #1 (dev) | PM | e2e Chromium | ✅ 30/30 |
| 2026-10-08 | integration #1 (dev) | PM | e2e WebKit | ❌ photos: WebKit private contexts refuse Blobs in IndexedDB. Fixed (bytes + type, D-041), then ✅ 30/30 |
| 2026-10-08 | integration #2 (dev) | PM | axe across the journey | ❌ `label-content-name-mismatch` on stamp buttons/slots. Fixed (D-042), then ✅ 0 |
| 2026-10-08 | prod build | PM | `scripts/perf.mjs` | ❌ LCP 6.8 s, fonts 782 KB. Font fix (D-043) → LCP 4.2 s, fonts 309 KB; JS 251 KB still over budget (see §4) |
| 2026-10-08 | prod build (final) | PM | e2e Chromium + WebKit with axe; `qa.py` 14 routes × 2 viewports; `eslint .`; `next build` | ✅ 64/64, 0 axe violations, 0 lint problems, 27 static pages generated |
| 2026-10-08 | Lisbon Post redesign (D-049) | PM/Design | Visual review at 390 / 820 / 1440 via `scripts/gallery.mjs` + `scripts/reveal-frames.mjs`; e2e Chromium + WebKit with axe; `tsc`; `eslint .`; `next build`; `perf.mjs` | ✅ 64/64, 0 axe violations, clean build; fonts 118 KB; LCP 4.3 s and JS 251 KB unchanged (plan §4) |
| 2026-10-09 | Correio redesign (D-052) | PM/Design | Visual review at 390 / 820 / 1440 (home, public, sender, recipient reveal, admin, design system); e2e Chromium + WebKit with axe; extra axe pass on help / recover / legal / 404 / design system / admin login at 390 + 1440 with every tab panel opened; `tsc`; `eslint .`; `next build`; `perf.mjs` | ❌ axe: cream-at-80% label on the vermilion fan card (4.1:1). Fixed (solid cream, 5.1:1), then ✅ 64/64, 0 axe violations, clean build. Recipient LCP 3.8 s (was 4.3), fonts 126 KB, JS 253 KB (plan §4) |
| 2026-10-09 | Reference rebalance + signature motion (D-057–D-059) | PM/Design | Motion study of later/gumroad/oatly (video + live CSS); visual review at 390 / 1440; `scripts/motion-check.mjs` frames (label roll, double shadow, cursor parallax, drum counters, orbit, page transition); e2e Chromium + WebKit with axe; axe on home / claim / help / recover / legal / 404 / design system / admin at 390 + 1440 with every tab opened; `tsc`; `eslint .`; `next build`; `perf.mjs` | ✅ 64/64, 0 axe violations, clean build. Recipient fonts 118 KB (marker face scoped off the route; loader label off the pen face), LCP 4.0–4.1 s, JS 258 KB (plan §4) |
| 2026-10-09 | "Wish You Were Here" redesign (D-060–D-066) | PM/Design | Visual review at 390 / 820 / 1440 (home, every public page, sender, recipient threshold → settled → world, admin, design system); rewritten `scripts/motion-check.mjs` frames; e2e Chromium + WebKit with axe; extra axe pass on 11 routes at 390 + 1440 (tap-help Android tab opened); `tsc`; `eslint .`; `next build`; `perf.mjs` | ❌ WebKit: claim dropped a keystroke (focus race under slow frames). Fixed in `CodeInput` + ticket store (D-065). ❌ axe: clothesline scroll region not focusable. Fixed. ❌ Visual: "Wish you were here." never revealed at 820 (IntersectionObserver vs clip-path). Fixed in `InView` (D-065). Then ✅ 64/64, 0 axe violations, clean build. Recipient fonts 95.9 KB (was 154.7: footer faces no longer preloaded), LCP 4.07 s, CLS 0, JS 259 KB (plan §4) |
| 2026-10-09 | Scroll stories (D-067–D-069) | PM/Design | Scroll study of 6 sites (Playwright); viewport frames of the pinned year sequence (6 points × 390 / 1440), the expanding band, the board cascade; `motion-check.mjs` updated; e2e Chromium + WebKit with axe; `axe-pages.mjs`; `tsc`; `eslint .`; `next build`; `perf.mjs` | ❌ axe: claim-success buttons caught mid-fade by the postcard entrance. Fixed (transform-only entrance), then ✅ 64/64, 0 axe violations (journey + 22 page/width checks), clean build. Recipient LCP 3.84 s, CLS 0, fonts 95.9 KB, JS 259 KB (plan §4) |
| 2026-10-09 | Hype sequence, bento, stamp timeline, smooth scroll (D-070–D-073) | PM/Design | Hero measured at 8 screen sizes; viewport frames of the pinned sequences at 390 / 1440; Lenis glide measured (wheel 600px eases over ~480ms) and confirmed off on the recipient route; `motion-check.mjs` updated; e2e Chromium + WebKit with axe; `axe-pages.mjs`; `tsc`; `eslint .`; `next build`; `perf.mjs` ×2 | ❌ Lenis joined a shared bundle via the root not-found boundary (recipient JS +5 KB). Fixed (dynamic import, CSS inlined). Then ✅ 64/64, 0 axe violations, clean build. Recipient JS 259.6 KB, fonts 95.9 KB, LCP 3.96–4.05 s, CLS 0 (plan §4) |
| 2026-10-09 | Hero clearance + section order (D-074) | PM/Design | Button-to-postcard gap measured at 8 sizes × 4 scroll positions; section joins captured at 390 / 1440; e2e Chromium + WebKit with axe; `axe-pages.mjs`; `motion-check.mjs`; `tsc`; `eslint .`; `next build`; `perf.mjs` | ✅ gap ≥ 41px everywhere; 64/64, 0 axe violations, no page errors, clean build. Recipient LCP 4.08 s, JS 259.6 KB (plan §4) |
| 2026-10-16 | Launch hardening (D-083–D-088), real API on local PostgreSQL 15 + Storage stand-in | Dev | `npm test` (35 unit tests); `api-smoke.mjs` at 4 and 8 characters, and with `--breaker`; `e2e-api.mjs` (Chromium) at 4 and 8 characters, failing on any CSP violation; `e2e.mjs` Chromium + WebKit with axe (mock build); provisioning and admin CLIs (a CLI-made code claimed through the API); backup → restore drill and its tamper cases; claim input at 320 / 390 / 768 / 1440 with 8 characters; `perf.mjs --slug` on the real API; `tsc`; `eslint .`; `next build` | ❌ CSP blocked Spotify's iFrame API (its code is on `embed-cdn.spotifycdn.com` and needs `'unsafe-eval'`). Fixed with a public and an admin policy (D-085). ❌ `bytea[]` parameters for recovery codes. Fixed (built in SQL). Then ✅ 35/35, 94/94 (96/96), API journey 32/32 Chromium + 31/31 WebKit, prototype journey 32/32 + 32/32, 0 axe violations, no page errors, no sideways scroll at 320 px. Recipient on the real API: ready 4.0 s, LCP 4.1–4.3 s, CLS 0, JS 277 KB (still over budget: `LAUNCH_READINESS.md` §3) |
| 2026-10-16 | Two-factor sign-in removed, codes fixed at 4 characters (D-089) | Dev | `tsc`; `eslint .`; `npm test`; migration 0003 on PostgreSQL 15; `api-smoke.mjs` (with a new lock-out check) and with `--breaker`; `e2e-api.mjs` Chromium + WebKit; `e2e.mjs` Chromium + WebKit with axe; sign-in page and the claim input at 320 px checked by eye; `provision` and `admin` CLIs; `npm ci --dry-run` for Linux | ❌ batch list printed the unit count twice ("1 1 unit"). Fixed. Then ✅ 20/20, 84/84 (86/86), API journey 26/26 Chromium + 25/25 WebKit, prototype journey 64/64, 0 axe violations, 4 code boxes with no sideways scroll at 320 px |
| 2026-10-09 | Supabase backend (D-075) | PM/Eng | Migration on PostgreSQL 15 with Supabase-like `anon`/`authenticated` roles (apply + re-apply); RLS/grant check; `scripts/api-smoke.mjs` (database paths); `scripts/e2e-api.mjs` Chromium + WebKit (database paths); mock `scripts/e2e.mjs` Chromium + WebKit; `tsc`; `eslint .`; `next build` | ❌ stamp payloads double-encoded as JSON strings (caught by the `contents` check constraint). Fixed (driver `json()`). ❌ test harness: `isVisible()` doesn't wait; per-email recover limit hit by repeated runs (limiter correct). Fixed in the tests. Then ✅ 17/17 tables RLS, `anon` refused; API 41/41; browser journey 17/17 ×2 engines; mock journey 64/64. **Pending:** Storage paths (uploads, signed URLs) against the real Supabase project once its keys are in `.env.local` |
| 2026-10-09 | Supabase backend, live project (ap-southeast-2) | PM/Eng | `npm run db:setup` on the real project; `anon`-key probe of every table, view and the bucket; `scripts/api-smoke.mjs` (all paths, incl. Storage); `scripts/e2e-api.mjs` Chromium + WebKit; then `db:setup -- --reset --yes` | ✅ setup, bucket and demo seed; `anon` refused on tables and views, bucket listing empty; API 51/51; browser journey 21/21 Chromium, 20/20 WebKit (voice step skipped: the Windows WebKit build has no AudioContext and can't play `blob:` audio; a test-browser limit, check on a real iPhone). Reset to a clean demo: 12 units, 1 batch, 7 media objects. ❌ setup appended generated secrets after the empty `NAME=` lines copied from `.env.example`, leaving duplicates. Fixed: it now fills them in place |
| 2026-10-10 | Responsive pass (D-079) | PM/Eng | `scripts/responsive.mjs` (new: 19 routes × 13 sizes, 320×568 to 2560×1440, mock build); four visual reviews (home small / home large / public pages / sender, recipient and admin); spot checks of every fix; mock `scripts/e2e.mjs` Chromium | ❌ found: hover jitter on lifting elements; the year fan under the header on short laptops; hero letters breaking onto two lines at 1536px and buttons below the fold on 1280×720; content wider than the screen at 320–360px (rack, occasion sheet, code boxes, voice waveform); the first-tap words over the photo on tablets; header wrapping at 1024px and colliding at 320px; stamps on "for" on a laptop envelope; 40px targets on touch tablets; a lost-looking layout at 2560px. All fixed (D-078, D-079). Then ✅ 247 page views, 16 flags, all accepted exceptions (the letter's 42px ruled lines; 38px code boxes on 320px phones): no sideways scroll, nothing off-screen, clipped, colliding, under the header or under 12px; journey 32/32 with 0 axe violations. WebKit not run: the local Playwright WebKit build is missing its executables |

## Launch checks added 2026-10-16 (automated unless marked 📱)
- [x] Photos served as a converted display JPEG and WebP thumbnail with no EXIF; orientation applied (unit + API tests).
- [x] Android WebM/Opus voice note converted to AAC/m4a; length measured on the server; > 3:00 refused (unit + API tests).
- [ ] 📱 An Android-recorded voice note plays on a real iPhone (Safari), and an iPhone one on Android.
- [x] A song the provider dropped shows as a labelled record; the sender's editor says so (API test).
- [x] Admin sign-in: wrong password refused; 5 wrong passwords lock the account; signed-out calls refused (API + browser).
- [x] Claim breaker: after 300 failures every claim needs Turnstile; a passed check claims (API, Turnstile test keys).
- [x] Admin packing-check tap never uses up the first open (API test).
- [x] Batch encoded / void rules; void codes refused; factory CSV on the batch's own domain (API + browser).
- [x] History and restore (API + browser).
- [x] Nightly job and backup report recorded; launch checklist reflects them (API test).
- [x] CSP: no violation on sender, recipient (incl. the Spotify embed and its iFrame API) and admin pages (both e2e scripts).
- [x] CSP with an Apple Music song: the official `embed.music.apple.com` player loads in a page under the public policy with no violation (one-off browser check, 16 Oct; no automated journey uses an Apple link yet).
- [ ] 📱 Tap encoded sample ceramics (≥ 5, final glaze) on an iPhone and an Android before the encoding run (AQ11).

## Definition of Done: showcase (MASTER_BUILD_PROMPT §11)

| Item | Status |
|---|---|
| Every requirement in CLIENT_GUIDE §5–§6 maps to a screen/state in `PRD.md` | ✅ R-01…R-87 traceability |
| Deferred items absent (no teasers, D-014) | ✅ |
| First tap, repeat visit, empty envelope, sender preview demonstrable and distinct | ✅ Demo Panel scenarios + e2e |
| Real photo compression, real voice recording, real song embed on iPhone **and** Android | ⚠️ Real in Chromium + WebKit proxies (recording verified with a fake mic in Chromium); **📱 needs physical devices** |
| Demo Panel reaches every state and error in §6.2 | ✅ 5 unit states, 4 scenarios, 7 forced errors, sample load, reset, motion, fast mode, outbox |
| Tokens drive all styling; stamps swappable from `/config/stamps.ts` alone | ✅ |
| Reduced-motion and screen-reader passes | ⚠️ Reduced motion verified in Chromium/WebKit; automated a11y clean; **VoiceOver/TalkBack 📱 pending** |
| Performance budget met on the recipient route | ❌ CLS ✅; LCP 4.2 s and JS 251 KB over budget, plan in §4 |
| `SHOWCASE_SCRIPT.md`, screen recording, updated `OPEN_QUESTIONS.md` ready | ⚠️ Script + questions ✅; **screen recording on a real phone pending** |
| No copied assets; `ASSETS.md` lists source + licence of every font, photo, audio, texture | ✅ |
