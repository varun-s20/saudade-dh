# Stand-ups

Short written stand-up per working day: done / next / blocked. Newest first.

## 2026-10-10 · Day 3: every screen size (D-079)

**Done**
- Hover jitter gone (hit areas never move). The year scene fits every screen (sized from its own room).
  "Four small worlds" scrolls up over "How it works".
- A responsive audit script (`scripts/responsive.mjs`, 13 sizes) and four visual reviews; every finding fixed
  or recorded as accepted (D-079). Monitors now scale up past 1600px.

**Next:** placeholder stamps after Zeya's reference sheet (D-076), then the approval message.

**Blocked:** WebKit test runs (the local Playwright WebKit build lost its executables; `npx playwright install webkit`).

## 2026-10-09 · Day 2 (late): design pass on the home page (D-078)

**Done**
- Buttons are now tickets with a clipped corner (the footer button's shape and motion), in their own colours,
  everywhere. Tags are airmail labels.
- The footer is in the site's language (navy linen, Bowlby, Grand Hotel, Karla, Courier Prime); its two
  private fonts are gone.
- New biplane and banner, in the hero and on the year timeline (which now has a flight lane, a stop per month
  and room under the envelope). The rack turns on its own every 3 seconds, with a pause button.
- Nav centred on the page; the logo scrolls to the top. No em dashes left in visible copy.

**Next:** placeholder stamps after Zeya's reference sheet (D-076), then the approval message.

## 2026-10-09 · Day 2 (evening): the real backend, on Supabase

**Done**
- Read the original proposal (DH-SAUDADE-20260927-R1) and the full client thread. The $1,000 offer
  supersedes the proposal's plans; the proposal's "staging link to claim and fill a test unit" is what this
  enables.
- **Backend:** 25 API routes on Supabase Postgres + Storage behind the existing contract, with a migration,
  a one-command setup (`npm run db:setup`) and a demo dataset (D-075, D-077). The screens are unchanged.
- **Verified on PostgreSQL 15:** RLS locks the public API out; API smoke 41/41; browser journey 17/17
  in Chromium and WebKit; the mock prototype still passes 64/64.
- **Design:** Zeya's stamp reference sheet received and recorded (D-076), with its design implications.

**Next:** Supabase keys into `.env.local` → `npm run db:setup` → run the Storage checks → stage it → the
design-approval message to Zeya.

**Update (later):** Supabase project created (Sydney). `db:setup` ran; API smoke 51/51 and the browser journey
21/21 (Chromium) / 20/20 (WebKit) passed against it, including Storage. Reset to a clean demo. `.env.local` now
uses `api`.

**Blocked:** nothing for the demo. The domain (O2) is still needed for real email. Rotate the service-role key and
the database password (both were shared in chat).

## 2026-10-09 · Day 2 (latest): hero clearance + section order

**Done**
- "MISSES YOU" restored to its original size.
- The peeking postcards ("for Theo") can no longer reach the buttons; the hero is taller.
- Home sections re-ordered as a story with alternating colour bands (D-074).
- **Regression:** 64/64, 0 axe violations.

## 2026-10-09 · Day 2 (late): the later.com sequence

**Done**
- **Hero:** fits every screen without touching the buttons (checked at 8 sizes).
- **Smooth scrolling:** Lenis on the public pages; native on touch; off for reduced motion and on
  the recipient's route.
- **later.com "hype is real" sequence:** stat cards on a sunset field that collapses into the
  first-tap photograph (D-071).
- **Good to know:** rebuilt as a bento of postcard scenes plus quick answers (D-072).
- **Year timeline:** now a strip of postmarked stamps (D-073).
- **Regression:** e2e 64/64, 0 axe violations, recipient JS 259.6 KB.

**Next:** client walk-through on a phone.

## 2026-10-09 · Day 2 (night): scroll stories

**Done**
- **Header:** transparent over the hero until you scroll.
- **Hero:** content higher; the photo letters are no longer cut.
- **Example envelope:** now "A year in one envelope", a pinned scroll story (D-067).
- **Good to know:** now a split-flap departures board (D-068).
- **Scroll patterns:** studied six sites (later.com, linktr.ee, planoly, pitch.com, mailchimp,
  headspace). Added an expanding sunset band, a word-by-word fill and hero depth (D-069).
- **Regression:** e2e 64/64, 0 axe violations, recipient LCP 3.84 s.

**Next:** client walk-through on a phone, using the demo codes in the README.

## 2026-10-09 · Day 2 (evening): design revamp 4, "Wish You Were Here"

**Done**
- **Fresh direction F** (D-060 to D-066): a 1940s linen "large-letter" postcard, drawn from the
  client's own brief rather than revised from E.
  - **Type:** Bowlby One capitals with a Grand Hotel script word, Karla for reading.
  - **Colour:** a new palette: linen cream, sepia, navy, post-box red, sky / sea / sunset bands.
  - **Footer:** kept exactly.
- **Every surface redone:**
  - **Home:** nine postcard scenes.
  - **Interior pages:** sky / sunset / sea mastheads with the work done on a postcard back (the claim
    ticket types your code as you enter it).
  - **404:** "return to sender".
  - **Sender:** pill tab rail, inked-on titles, postcard title cards, a sea desk.
  - **Recipient:** script prompt and a pill to tap.
  - **Admin and design system:** tidied to match; Direction F added to the directions board.
- **Motion by Emil Kowalski's rules:**
  - letters land and lean towards the cursor on a spring;
  - postcards turn over;
  - a souvenir rack spins on a flick;
  - stamps stick; postmarks thunk;
  - clip-path reveals and tabs;
  - a luggage tag fills the screen;
  - drum counters;
  - the hard-shadow lift.
- **QA fixes:** a dropped-keystroke race in the code boxes (WebKit), clip-path reveals that never
  fired at tablet widths, and a focusable clothesline.
- **Regression:** e2e **64/64** (Chromium + WebKit), **0** axe violations, clean lint, typecheck and
  build. Recipient fonts **95.9 KB** (from 154.7), LCP 4.07 s.

**Next:** client review of F on a real phone; Gate 1 device checks. The optional draft reply to
Zeya is still on offer.

## 2026-10-09 · Day 2 (later): every section from all three references

**Done**
- Footer kept exactly. Everything else rebalanced so each section draws on later.com, gumroad.com
  and oatly.com, including each site's own signature motion. The motion was found from recordings
  and their live CSS (D-057).
  - **Later:** label roll, stretching arrows, word-by-word rise, jelly wobble, orbit.
  - **Gumroad:** hard-shadow lift, cursor parallax and scroll drift, swinging pill marquee, looping
    illustrations.
  - **Oatly:** big-button double shadow, drum counters, bouncing bars, card-fills-the-screen page
    transition.
- New: hand-printed label face (Patrick Hand SC, scoped off the recipient route), shared motion
  components (`components/motion/*`), looping SVG illustrations, `scripts/motion-check.mjs`.
- Regression: e2e **64/64** (Chromium + WebKit), **0** axe violations (all tabs opened), clean
  lint, typecheck and build. Recipient fonts down to 118 KB.

**Next:** client review of the motion on a real phone; Gate 1 device checks.

## 2026-10-09 · Day 2: design revamp 2 (Correio)

**Done**
- **New design language, Direction E "Correio"** (D-052 to D-056), built from the product owner's
  references: later.com (structure), gumroad.com (play), oatly.com (imperfection). All patterns,
  nothing copied.
  - **Type and colour:** Epilogue 900/800 + Inter Tight (+ Courier Prime, Nanum Pen); cream, warm
    black, post-box vermilion, azulejo cobalt, an airmail dusk gradient.
  - **New components:** notched poster tickets with arrows and hover lift, folder tabs, a story tab
    list, extruded stat cards, chamfered crops, framed caption cards, tags, speech bubbles, a sticky
    note, a pill cloud, graph paper, postmark-wave bands, a sticky header with a mobile menu, a black
    footer with a giant wordmark.
  - **Screens:**
    - a nine-section home page
    - claim / success / recover / help / legal / 404 rebuilt
    - sender tabs and title cards
    - the reveal tap ticket
    - admin restyled
    - design-system pages updated, with Direction E added
- Regression: e2e **64/64** (Chromium + WebKit), **0** axe violations (including all tab panels), clean
  lint, typecheck and build. Recipient LCP 3.8 s (was 4.3 s).

**Next:** client review of E vs D (D-053 flags the "not clean / corporate" tension); real-device Gate 1.

## 2026-10-08 · Day 1 (evening): design revamp

**Done**
- **New design language, Direction D "Lisbon Post"** (D-049), replacing the beige Gate 0 look across
  every screen.
  - **Type and colour:** new type system (Instrument Serif / Bricolage / Courier Prime / Nanum Pen) and
    a palette of navy ink on cream with azulejo cobalt.
  - **New components:** inked-tag buttons, boxed fields, code tiles, arch and tile motifs, and an
    airmail edge.
  - **Responsive layouts at 390 / 820 / 1440:**
    - a new seven-section home page
    - two-column claim, success, recover, help and legal pages
    - a sender portal with stamp tabs, a sticky envelope beside a checklist, and world-coloured editor
      headers
    - the reveal on a cobalt stage, larger on desktop
    - an admin with a split login
- Regression: e2e **64/64** (Chromium + WebKit), **0** axe violations, clean lint, typecheck and build.
  Recipient fonts cut to 118 KB.

**Next:** client showcase on the new design; real-device Gate 1 (fonts on a real iPhone, 60 fps on Android).

## 2026-10-08 · Day 1 (end of day)

**Done**
- **Phase 0 (Gate 0 passed):** PRD, research, three directions, decisions, open questions.
- **Phase 1:** design system with tokens, primitives and original placeholder stamps; `/design-system`, `/design-system/directions`, `/design-system/motion`; `MOTION_SPEC.md`.
- **Phase 2:** all 24 screens + Demo Panel built. Integration QA:
  - e2e **64/64** (Chromium + WebKit, production build)
  - **0** axe violations across the journey and 14 routes
  - lint, typecheck and build clean
- **Phase 3 blueprint:** `ARCHITECTURE.md`, `db/schema.sql`, Phase 3 API clients, live `/api/song/resolve`.
- **Integration fixes:**
  - WebKit photo upload (D-041)
  - WCAG 2.5.3 stamp labels (D-042)
  - font payload −60% (D-043)
  - hydration warning on `/`
  - toasts over the Save bar
  - 44px logo target
  - lazy-loaded demo seed

**Next**
- Gate 1 on real hardware: iPhone (Safari, silent switch, VoiceOver) + mid-range Android (60 fps trace, TalkBack).
- Screen recording of the full flow on a phone.
- Deploy the client preview (needs the client-owned Vercel account, O2/AQ4).
- Phase 3 performance plan (QA_CHECKLIST §4).

**Blocked / risks**
- ⏱ Client answers by **Fri 16 Oct**: O2 (domain), O3 (encoding date), O9 (code length), AQ1 (card ↔ ceramic packing), AQ2 (printer). Backend estimate is 25.5 dev-days against 25 working days to launch: add a second engineer for ~6 days, or defer four items past launch (ARCHITECTURE §15).
- Performance budget not met yet (D-044).

## 2026-10-08 · Day 1 (morning)

**Done**
- PM: read `CLIENT_GUIDE.md` twice; `PRD.md` (requirements traceability R-01…R-87, screen inventory S1–S24, user stories + acceptance criteria); `DECISIONS.md` D-001…D-019; `OPEN_QUESTIONS.md` (O1–O15, SQ1–SQ7).
- PM/Lead engineer: foundation in place, with typecheck, lint and production build clean:
  - Next 16.4 scaffold
  - design tokens + Tailwind v4 mapping
  - fonts
  - service contracts + full mock service layer (claim, rate limit, content, media/IndexedDB, reveal, admin, batch CSV, email outbox)
  - seed data (hero code `SAUD-3K7M`, `SAUD-9PXR`, 38 background units)
  - Mira→Theo sample envelope
  - Demo actions
  - recipient-mode logic
  - stamp asset map
  - engineering rules (README)
  - screenshot QA helper (`scripts/shot.py`)
- UX Researcher: `RESEARCH.md` (competitor teardown, platform constraints with sources, journeys, 15 patterns, 10 anti-patterns, SQ1–SQ7).
- Asset producer: 6 Unsplash-licensed photos, verified Spotify + Apple Music links (both CORS-enabled), generated placeholder voice clip + waveform, `ASSETS.md`.

**In progress (wave 1)**
- Visual Designer: placeholder stamp set, primitives, `/design-system`, `/design-system/directions`, `DIRECTIONS.md`.
- Motion Designer: envelope, first-tap reveal, sheet, vinyl, voice object, `/design-system/motion`, `MOTION_SPEC.md`.
- Architect: `ARCHITECTURE.md`, `db/schema.sql`, real `/api/song/resolve`, Phase 3 API clients.

**Next (wave 2):** recipient experience + stamp worlds + sender preview; sender portal + editors + seal; public pages + admin + Demo Panel. Then integration QA, `QA_CHECKLIST.md`, `SHOWCASE_SCRIPT.md`.

**Blocked / risks**
- ⏱ O2 domain and O3 encoding date are needed from the client this week (ceramics critical path).
- O9 (4- vs 8-character codes) must be decided before code cards are printed.
- Real-device QA (Gate 1) needs a physical iPhone + Android; the prototype is verified in Playwright WebKit/Chromium at 375×812 until then.
