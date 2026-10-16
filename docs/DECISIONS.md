# Decisions log

**Owner:** Product Manager · Authority order: `CLIENT_GUIDE.md` → `MASTER_BUILD_PROMPT.md` → this log.
Every entry is our judgement where the first two are silent. Anything that needs the client is
cross-referenced to `OPEN_QUESTIONS.md`. Newest entries at the bottom of each section.

## Gate 0: direction & scope

### D-001 · Design direction: A "Sun-Bleached Postcard" with B "Desk Drawer Ephemera" accents
- **Decision:** Primary direction A (faded terracotta + cream, soft grain, airy, warm). B's richer
  ephemera (postmarks, tape, photo corners, layered paper) is used **inside** the stamp worlds and
  objects, not on every surface. C "Quiet Letterpress" is shown to the client as the restrained alternative.
- **Why:** The brief asks for "vintage postcards, hand-stamped typography, warm and imperfect textures"
  and a sun-bleached palette, and explicitly *not* clean/corporate. A matches that most directly and
  stays legible on a phone in sunlight. B on its own risks clutter on a 375px screen and fights the
  client's own stamp artwork. C drifts toward "clean". The blend gives "four small, different worlds"
  (B inside each stamp) "on one page" (A as the calm envelope).
- **Recommendation to client:** present A as primary, B and C as alternatives (`/design-system/directions`).
- **Gate 0 sign-off (2026-10-08): PASSED.** PM ✔ · Visual Designer ✔ (boards at `/design-system/directions`, `DIRECTIONS.md`) · Architect ✔ (no technical constraint on any direction).

### D-002 · Repository = the workspace root
The Next.js app lives at the repo root beside `/docs`, matching MASTER_BUILD_PROMPT §9.

### D-003 · Stack versions (Oct 2026)
Next.js 16.4 (App Router, Turbopack, `cacheComponents` + `partialPrefetching` enabled as Next now
recommends), React 19.3, TypeScript strict, Tailwind CSS 4.3 (CSS-first config mapped to CSS-variable
tokens), Motion 14 (`motion/react`), Zustand 5, idb-keyval 6, browser-image-compression 2.
Engineering rules that follow from Cache Components are in `README.md`.

### D-004 · Mock service layer = persisted Zustand "database" + IndexedDB blobs
All data access goes through `lib/services/types.ts` interfaces. The Phase 2 mock persists to
localStorage (records) and IndexedDB (photos, audio), adds 300–900 ms latency, and reads injectable
errors from the Demo Panel. Phase 3 flips `NEXT_PUBLIC_DATA_SOURCE=api`. Consequence: the demo
state lives in **one browser**, so the presenter runs sender and recipient in the same browser
(or two tabs, which stay in sync).

### D-005 · Reveal is armed by "Seal & send" (pending O7)
`config/site.ts → requireSealBeforeReveal = true`. Before sealing, a recipient tap shows
"Your letter is still being written", and the first-tap moment is preserved. If the client declines O7,
set it to `false`: `filled` units reveal on first tap. Risk: a sender who never seals leaves the recipient waiting. Mitigation: the
portal prompts to seal once anything is filled, and the admin can see sealed vs filled.

### D-006 · Activation code alphabet and format
Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31 symbols, no 0/O/1/I/L). Prototype format
`SAUD-XXXX` (agreed example). Production length is open question **O9** (recommend 8).

### D-007 · `SAUD-0000` demonstrates "invalid"
`0` is never in the alphabet, so the code input refuses it at the keystroke with a friendly
explanation ("Codes never use 0, O, 1, I or L…"). A well-formed but unknown code (e.g. `SAUD-ZZZZ`)
shows the server-side "We can't find that code" message. The Demo Panel can force either.

### D-008 · Identifiers
NFC slug = 12 chars lowercase base32 (~60 bits). Sender token = 32 chars (~160 bits). All generated
with Web Crypto using rejection sampling (no modulo bias). Seed data uses a seeded PRNG only so
every presenter sees the same admin table; it is never used for real identifiers.

### D-009 · Placeholder typography
Fraunces (display), Caveat (letter handwriting, 26px, because Caveat runs small and 26px ≈ 18–19px optical),
Special Elite (postal accents only), DM Sans (UI/admin). All via `next/font/google`; licences in
`ASSETS.md`. Non-Latin letters fall back to the display serif rather than an unreadable script.

### D-010 · No dark theme
The product is paper; the recipient experience is a letter. A dark variant would undermine the
metaphor and double QA. `color-scheme: light` everywhere. Revisit with the rebrand if the client asks.

### D-011 · Demo assets
Six Unsplash-licensed photos (via Lorem Picsum IDs, authors verified against Unsplash's API), a
68-second **generated** placeholder voice clip (no speech, no samples, generator in `scripts/`),
and "Here Comes the Sun" (The Beatles) linked via the official Spotify / Apple Music embeds only.
Presenters should record a real voice note live in the voice editor during the showcase.

### D-012 · Songs: single tracks only (SQ4)
Spotify `track` links, `spotify:track:` URIs, `spotify.link`/`spoti.fi` short links, Apple Music
`album/…?i=` and `song/…` links. Albums, playlists, artists and podcasts get a friendly
"share a single song" message. Short links are resolved server-side (`/api/song/resolve`), because
Spotify's short-link redirect depends on the User-Agent.

### D-013 · Apple Music vinyl spins unsynced (SQ3)
Apple's embed exposes no playback events. Spotify links sync the vinyl via the iFrame API
(`playback_update.isPaused`); Apple links spin when the recipient interacts with the player.

### D-014 · No "coming soon" teasers in the showcase
Golden rule 1 allows PM-approved teasers for deferred items. **Not approved.** Showing video or
drawing teasers invites scope discussion in the meeting and implies commitments. The deferred list
is covered verbally in `SHOWCASE_SCRIPT.md` instead.

### D-015 · Checkout not built (O1)
Per golden rules and §12. The admin's manual "Email code" covers Path B for the first 300 units.

### D-016 · Sign-in-free recipient; link previews see nothing
`/t/{slug}` serves a neutral Open Graph card ("Something is waiting for you."). GET never records
a reveal; the reveal is recorded client-side after the choreography (RESEARCH §4: Apple's link
previews fetch from users' own phones and identify as `facebookexternalhit`/`Twitterbot`).

### D-017 · Recipient "new" marks are device-local
There are no recipient accounts, so "last visit" is remembered per device (localStorage now, the
same in production). A recipient on a new phone sees no "new" marks, which is acceptable.

### D-018 · Sender name comes from the letter signature
Accessible labels ("Open voice message from Mira, 1 minute 8 seconds") use the letter's `from`
field. No separate "your name" field is added (no new client requirement invented). Without a
letter, labels say "Open voice message".

## Architecture review (2026-10-08)

### D-020 · File versioning is done by the app, not the bucket
The client was promised file versioning (CLIENT_GUIDE §8), but Cloudflare R2 does not implement S3
object versioning. Production therefore never overwrites a media object (new key per version),
keeps removed media for 90 days (AQ10), puts a bucket lock on the R2 bucket against deletion, and
copies nightly to a versioned Backblaze B2 bucket (AQ6). The promise holds; the mechanism changed.
`ARCHITECTURE.md` §5.1, §10.

### D-021 · Codes are stored only as HMAC hashes
Production keeps `HMAC-SHA-256(code, server pepper)`, never the plaintext. Consequences: the card
CSV exists **once**, at the generation ceremony; emailing a Path B code mints a fresh one; admin
search by code needs the full code. Losing the pepper invalidates every unclaimed printed card, so
it is stored in two places. The prototype keeps plaintext so the demo can show codes.

### D-022 · Units carry a printed unit number (`S-0042`)
Added `unitNo` to every unit, the batch CSV (`unit_no,code,slug,url`), and admin search, so packers
can match card ↔ ceramic (AQ1).

### D-023 · "Reset code" keeps the envelope
Reset issues a fresh unredeemed code and revokes the old private link; status, content, seal and
reveal are untouched. "Already claimed" is now decided by `codeRedeemedAt`, not by status. (Fixes a
prototype bug where a reset sent a filled envelope back to `assigned`.) Client confirmation: AQ9.

### D-024 · Song links resolved server-side, with a browser fallback
`/api/song/resolve` follows short links against a host allowlist (SSRF-safe), reads Spotify oEmbed
plus the track page's `music:musician_description` for the artist, and the iTunes Lookup API for Apple.
Rate limited (30/min/IP). If the route is unreachable, the client falls back to the CORS-enabled
oEmbed / Lookup endpoints directly.

### D-025 · Running-cost figure to restate (300 units)
Realistic floor is ~$27–41/month, not $10 (hosting's free tier is non-commercial). PM restates it at
the showcase; 3,000-unit range unchanged. `OPEN_QUESTIONS.md` → "Correction to communicate".

## Design system (Phase 1, 2026-10-08)

### D-031 · Component CSS convention
Prefixed global CSS inside `@layer components` (not CSS Modules: the Tailwind Turbopack rule breaks
them). Layered CSS lets callers' Tailwind utilities override (README rule 15).

### D-032 · Button language
Primary = terracotta-ink "ticket" (cream text 5.8:1, notched ends, rubber-stamp speckle, sinks 2px
into a plate on press). Secondary = cream card with an ink edge. Quiet = underlined text, still 44px.

### D-033 · Stamps & postmarks
Whole-stamp rotation (the postmark stays on its corner); default cancellation is the wavy style;
"NEW" is a small red mark bottom-left. Placeholder art prints "PLACEHOLDER · CLIENT ART PENDING"; the
heart art is pressed into the wax as a tone-on-tone relief (works with any client heart art).

### D-034 · Code input
One box per character; typing "SAUD" into the boxes gets a friendly "that part's already there"
note; success presses a red "RECEIVED" postmark over the code.

### D-035 · WebKit-safe gradients
Gradients never fade to `transparent` (WebKit greys them); opaque stops or alpha masks only.

## Motion & the first-tap reveal (2026-10-08)

### D-036 · The letter is folded in thirds and becomes the envelope face
After the flap opens, a letter folded in thirds is drawn out, unfolds (top third, then bottom), and
becomes the interactive envelope face that the stamps land on (it keeps faint fold creases). Stamps
start at +2.5 s instead of the brief's +1.4 s; total ≈ 6–7 s after the tap, inside the 6–9 s brief.
Reduced motion: ≈ 2.2 s crossfade, stamps fade in place. Full timeline: `MOTION_SPEC.md`.

### D-037 · Skip and interruptions
Skip appears once the ceremony is running and never before 1.5 s; Esc also skips. A skipped or
interrupted ceremony (resize/rotation, route hidden) completes as **skipped** and is recorded as
the first open, because the recipient did see the envelope open. Revisit if the client prefers otherwise.

### D-038 · Postmarks on the settled envelope
Each stamp gets an undated ring with its own wording (SNAPSHOTS, BY HAND, ON THE AIR, NOW PLAYING)
and one dated cancellation sits by the address. NEW marks are drawn opposite each cancellation.

### D-039 · Names on the envelope
"for {to}" is handwritten on the envelope back; the folded letter carries a small ink heart rather
than repeating the name. Sender name "from {from}" on the face. Both come from the letter (D-018).

### D-040 · Sound on by default, after the gesture
Synthesised in the browser (paper rustle, wax crack, soft stamp thuds; no audio files), only after
"Tap to open", visible mute toggle remembered per device. `site.revealSound` (O13).

## Design revamp: Direction D "Lisbon Post" (2026-10-08, evening)

### D-049 · The design language was rebuilt
- **Why:** Internal design review judged the Gate 0 build (direction A) not appealing enough. It was
  all-over beige with brown ink on cream, four overlapping fonts (Fraunces, Caveat, Special Elite,
  DM Sans), a kitschy speckled "ticket" button, and a single phone column on every screen, so desktop
  looked unfinished.
- **What:** A new direction, **D · Lisbon Post**, evolved from A and still inside the client's brief.
  The brief asked for vintage postcards, hand-stamped type, warm imperfect texture, and a sun-bleached
  terracotta / cream / dusty blue / green / pink / red palette, not corporate.
  - **Palette.** Borrowed from where the word *saudade* comes from: navy postal ink on warm white, azulejo
    cobalt colour fields, tile blue, terracotta roofs, sea glass, façade pink, tram yellow and post-box red.
    Every text pair is ≥ 4.5:1, ink on paper 14:1.
  - **Type.** Instrument Serif (editorial display, real italic), Bricolage Grotesque (warm UI),
    Courier Prime (crisp postal labels and codes), and Nanum Pen Script (a real-pen hand for everything the
    sender writes). Chosen from a rendered specimen of 10 display, 7 sans, 6 label and 18 handwriting
    candidates.
  - **Motifs.** Arched Lisbon windows, an original azulejo tile pattern, riso speckle on colour fields,
    an airmail edge on every page, and print-offset shadows on buttons and cards. Perforations,
    postmarks and the wax heart stay.
  - **Layouts.** Fully responsive editorial grids at phone, tablet and desktop:
    - a seven-section home page
    - two-column claim / success / recover / help / legal pages
    - a sender portal with stamp tabs, a sticky envelope beside a stamp checklist, and world-coloured
      editor headers
    - the reveal on a cobalt azulejo stage, larger on desktop
    - an admin with a split login
- **Studied, never copied:**
  - Lisbon azulejos and façades (palette, tile motif, arches)
  - Kinfolk / Cereal (editorial grids, big serif with italic accents)
  - Partiful / Gumroad (tactile print-offset shadows)
  - Paperless Post / Greenvelope (envelope ceremony)
  - Rifle Paper Co. (colour confidence)
  - Slowly (stamps as collectables)
  - risograph prints (grain on flat colour)
- **Kept:**
  - every token *name* (the reskin was done through `styles/tokens.css`, `app/fonts.ts` and component CSS)
  - all flows, services and copy
  - the reveal choreography
  - the client's stamp-art swap path
- **Client impact:** none on scope. The client's own rebrand (~Dec) still swaps tokens and fonts the
  same way.

### D-050 · Terracotta is decorative
Cream text on terracotta is 3.3:1, so terracotta carries fills and large italic accents only; small
text uses `--accent-terracotta-ink` (5.7:1).

### D-051 · The pen face covers Latin + Korean
Letters in other scripts (Cyrillic, Greek, Arabic, CJK ideographs…) render in a readable face rather than a
mismatched cursive (LetterWorld script detection updated). Since D-054 the fallback is the UI face
(`--ff-hand-fallback: var(--ff-ui)`), not the display face.

## Design revamp 2: Direction E "Correio" (2026-10-09)

### D-052 · The design language was rebuilt again, from three named references
- **Why:** The product owner asked for the site to follow **later.com** ("the font, the colors, the
  layouts, how they are so well managed... the same but for our use case"), then added
  **gumroad.com** and **oatly.com** as further references.
- **What each reference contributes (patterns only, nothing copied):**
  - **later.com: structure.**
    - a heavy grotesque display over a tight UI sans
    - a warm cream ground, warm black text, one hot accent and one deep secondary
    - square buttons with a clipped bottom-right corner and a trailing arrow
    - folder tabs on a cream card, and a big-title vertical story list on black
    - extruded "3D block" stat cards on a gradient band
    - 45° chamfered photo crops, a full-bleed photo with an angled translucent panel
    - fanned cards, and a black footer with a giant wordmark
  - **gumroad.com: play.**
    - black-outlined cards and hard shadows that lift on hover
    - floating tilted objects (our stamps and wax seal), speech-bubble captions
    - a drifting pill cloud (our "occasions"), and one huge number
  - **oatly.com: imperfection.**
    - graph paper behind forms and help
    - framed cards with a postal caption strip and a coloured tag
    - circular badges (our postmarks), a taped sticky note, handwritten asides with doodle arrows
    - chatty copy
- **Kept the use case's identity:**
  - perforated stamps, postmarks and the wax heart
  - the envelope and the sender's handwriting
  - the cobalt reveal stage and the airmail edge (on the preview frame and stamp-world sheets)
  - postmark wave lines, which replace Later's moiré as the background pattern
- **Kept everything else:**
  - every token *name* (reskinned through `styles/tokens.css`, `app/fonts.ts` and component CSS)
  - all flows, services and copy, apart from new home-page sections
  - the reveal choreography and the client's stamp-art swap path
- **Home page:** rebuilt as nine sections:
  - hero
  - occasions pill cloud
  - how it works (story tabs)
  - the four stamps (folder tabs)
  - statement
  - numbers on the dusk band
  - the first tap (full-bleed photo + angled panel)
  - fanned example postcards
  - "good to know" framed cards

  Plus a sticky header with a full-height call-to-action block, a mobile menu, and a black footer
  with a giant extruded wordmark.
- **Other pages:**
  - Claim, recover, help, legal and 404 use graph-paper headers, framed form cards and cobalt or dusk
    panels.
  - The sender gets square segmented tabs and framed world-colour title cards on a cobalt envelope
    stage.
  - Admin is square and 2px-lined, kept calmer.

### D-053 · The tension with the brief, and how it is handled
CLIENT_GUIDE asks for vintage, hand-stamped and warm, and explicitly "not clean / corporate /
tech-forward". later.com is a clean SaaS site. We take its *organisation* (hierarchy, colour
discipline, section rhythm), not its tech polish. Warmth comes from:
- the client's palette (vermilion, cobalt, pinks, sage, ochre, cream)
- paper grain and riso speckle, graph paper and postmark waves
- stamps and postmarks, handwriting, the wax seal and Oatly-style imperfection

If the client finds E too bold, D (Lisbon Post) is one token file away. **Flag for the client
review.**

### D-054 · Fonts: Epilogue 800/900 + Inter Tight
Later's display face ("Super X sans") is proprietary, so it is not used. Twelve heavy OFL grotesques
were rendered as a specimen:
- Epilogue, Archivo (100 and 112 width), Inter Tight, Gabarito, Bricolage Grotesque
- Outfit, Figtree, Red Hat Display, Schibsted Grotesk, Hanken Grotesk, Funnel Display

**Epilogue** has the weight and slight width of a poster face but warmer joins. It is loaded at two
static weights only (900 for headlines via the `display` utility, 800 for everything else that asks
for the display face), so nothing is faux-bolded. **Inter Tight** is the UI face later.com itself
uses (OFL). Courier Prime (postal labels, which Oatly also uses) and Nanum Pen Script (the sender's
hand) stay.

Instrument Serif and Bricolage Grotesque are retired. Accent words inside headlines are no longer
italic: an `<em>` inside display text prints upright in the airmail gradient (red → cobalt; ochre →
pink → lilac on dark bands). Every stop is ≥ 4.6:1.

### D-055 · Colour roles in Correio
- **Post-box vermilion** `--accent-red` #C8370F is the only call-to-action colour (cream text 5.1:1).
- **Bright vermilion** #F2552B and **dusk lilac** #C7B3F2 are decorative only (gradient, wordmark).
- **Azulejo cobalt** #2535A3 carries full-bleed bands and the reveal stage.
- **Warm black** #15120F is text, the story band and the footer (16.6:1 on cream).
- Stamp worlds keep their pastels.
- Radii are 0 except paper (2px) and true circles.

### D-056 · Tooling notes from this pass
- **Class prefix collision:** component classes must not start with a Tailwind utility prefix. `pb-404`
  compiled as padding-bottom 404 × 0.25rem. Public shared classes now use `pub-`.
- **OneDrive watcher:** the dev server's watcher can miss a write in this OneDrive folder. Utilities
  that look missing in dev come back after touching `styles/globals.css`. Production builds are
  unaffected.
- **`scripts/gallery.mjs`** now scrolls each page before a full-page capture, so lazy images load.

## Design revamp 3: every section from all three references (2026-10-09, later)

### D-057 · Rebalanced: each section takes from later.com, gumroad.com and oatly.com, with their own motion
- **Why:** Product owner feedback on E: "keep the footer; the rest is too inspired by later.com. Each
  of the pages or sections need to be referenced from all these websites with their animations…
  that are really unique to those websites. We don't want generic animations."
- **How we found each site's real animations:**
  - recorded each site in motion (Playwright video, load + hovers + slow scroll);
  - pulled its keyframes, hover rules and scroll timelines from the live CSS.
  Patterns only; nothing copied.
- **later.com motion:**
  - button labels that roll out up and back in from below (scaleY 1.25 + 25% shift, 0.3 s + 0.3 s);
  - arrow stems that stretch as the head pushes on;
  - headlines that rise word by word out of masks (0.82 s, cubic-bezier(0.22, 1, 0.36, 1));
  - a skew "jelly" wobble on touched objects;
  - objects orbiting a statement, passing in front of and behind the words.
- **gumroad.com motion:**
  - a lift up-left onto a hard shadow of the same size (0.15 s), which landing on press removes;
  - floating objects that follow the cursor (`data-parallax-intensity`) and drift on scroll
    (`animation-timeline: view()`);
  - a pill marquee that swings back and forth (0 → −50% → 0) and pauses on hover;
  - looping character illustrations (their Lottie);
  - pill outlines on nav hover.
- **oatly.com motion:**
  - the "big button" lift onto a cream gap plus a coloured shadow;
  - drum counters that roll to a number and give a 3D "maxed" wobble;
  - bar charts that bounce on their baseline;
  - the "ci-bounce";
  - image zoom inside framed cards;
  - the page transition where the clicked card grows to fill the screen while the page dims,
    then folds away on arrival.
- **The site, section by section:**
  - **Header:** hand-printed (Oatly) nav with pill-outline hover (Gumroad); the "Claim your code"
    block rolls its label (Later).
  - **Hero:** Gumroad's centred stage, with stamps, seal and postmark floating, following the cursor
    and drifting on scroll. Big regular-weight headline with the accent in the sender's handwriting;
    Later word rise. Oatly-framed cards peek up from the fold.
  - **Occasions:** Gumroad's swinging pill marquee with lift on each pill; Oatly label; Later rise.
  - **How it works:**
    - Gumroad comic panels with speech bubbles and looping illustrations (texts piling up; a letter
      lifting out of its envelope).
    - The "Saudade way" loop, with an envelope travelling round it.
    - Oatly framed step cards.
  - **Four stamps:** Later folder tabs in Oatly capitals. Each world has an Oatly drum counter, and
    a Gumroad-style loop (shuffling prints, a letter writing itself, bouncing voice bars (Oatly),
    a spinning record), plus a wobbling stamp.
  - **Statement:** Later orbit around the words, Gumroad bubbles, and an Oatly-style rubber-stamped
    "kept."
  - **Numbers:** Gumroad's one giant number (a drum counter); Later extruded cards; Oatly drums and
    bouncing bars.
  - **First tap:** Later angled panel over a photo that drifts on scroll (Gumroad); an Oatly sticky
    note bounces in; the CTA uses the Oatly page transition.
  - **Kept:** Later fan, opened by scroll (Gumroad view timeline); Oatly framed cards with zoom and
    lift.
  - **Good to know:** Oatly grid with page transitions; Gumroad lift; Later arrows.
  - **Footer:** unchanged, as asked.
- **Other pages:**
  - Claim: floating stamps, word rise, code boxes that roll in like drum digits.
  - Success: word rise and a sticky note.
  - Recover: an envelope looping along a dashed route.
  - Tap help: the illustration animates (phone glides in, rings pulse, banner drops, fingertip taps).
  - Legal: pill-hover contents.
  - 404: "404" on drums, with floating postmarks.
  - Sender: Oatly tab labels, word-rise titles, a drum counter for "x of 4 filled", wobbling
    title-card stamps.
- **Buttons everywhere:**
  - every label rolls (Later);
  - primary lifts onto the Oatly double shadow;
  - secondary, ink and paper buttons take the Gumroad lift;
  - quiet links stretch their arrows (Later).

### D-058 · A fifth face, scoped: Patrick Hand SC for labels
Oatly's identity leans on hand-printed capitals. **Patrick Hand SC** (OFL, Patrick Wagesreiter) was
chosen from a rendered specimen of 12 OFL hand faces and carries labels, nav, tags and caption strips
(`marker` utility).
- **Scope:** the loader lives in `app/fonts-marker.ts`, imported only by the public shell and the
  sender layout. A font declared in `app/fonts.ts` would be preloaded on every route, the
  recipient's included. The recipient's route never downloads it.
- **Side fix:** the loader label moved from the pen face to the UI face, because Nanum Pen keeps "…"
  in its own 23 KB chunk and that label sits on the recipient's critical path. Recipient fonts went
  from 141 KB to 118 KB.

### D-059 · How the borrowed motion is built
- **CSS first:** keyframes, transitions and scroll-driven `view()` timelines, where supported;
  objects simply sit still elsewhere. JavaScript only where needed:
  - an IntersectionObserver to release word reveals and drum counters;
  - one rAF loop for cursor parallax and one for the orbit (both pause when off screen);
  - the page transition (Web Animations API on two fixed layers, then `router.push`).
- **Motion properties:** transform, translate, scale and box-shadow, except the page transition,
  which animates a clip-path.
- **Reduced motion:** every piece has a still state, under the system preference or the Demo Panel
  override.
- **Page transition safety:** only a plain left click is choreographed; middle-click, new tab and
  keyboard keep the native link.
- **Verification:** `scripts/motion-check.mjs` captures frames of each borrowed animation in
  action.

## Design revamp 4: "Wish You Were Here" (2026-10-09, evening)

### D-060 · A fresh direction, F "Wish You Were Here", replaces E
- **Why:** product owner: "keeping the footer the same, redesign the whole website to a new color
  palette and new design language. We need unique and new animations as well as references from the
  websites… start anew with a fresh perspective… use Emil Kowalski's principles." So F was drawn from
  the client's own brief (CLIENT_GUIDE: vintage postcards, hand-stamped type, warm imperfect texture;
  terracotta, cream, dusty blues, greens, pinks and reds), not by revising E.
- **The idea:** a 1940s linen "large-letter" postcard. Block capitals that are windows onto
  photographs ("Greetings from someone who MISSES YOU"), a sign-painter script, turquoise skies and
  sunsets on a woven weave, white-bordered postcards, perforated edges, postmarks and a wax heart.
- **Tokens:** same variable names, new values (`styles/tokens.css`): linen cream, sepia ink, navy,
  post-box red CTA, sky / sea / sunset gradients, five pastel stamp worlds with their "-ink"
  partners; radii 4 / 10 / 14px + pill; a hard 4px navy offset for pressable things and a soft warm
  shadow for things at rest; linen, rays and grain textures.
- **The footer is pinned:** its CSS keeps its literal colours and its own two faces (D-064), so it
  renders exactly as approved whatever the tokens do.
- **Home, nine scenes:** hero with photo letters, a biplane banner and postcards peeking from the
  perforated edge · three postcards that turn over · a souvenir rack of the four stamps (drag or
  flick to spin) · a sheet of occasion stamps · "Wish you were here." written across a sunset, with
  stickers · the first tap · the numbers on a postcard back · a clothesline of postcards · luggage-tag
  help.

### D-061 · Interior pages are postcards
- Claim, success, recover, tap help and the fine print share one pattern (`components/public/Interior.tsx`):
  a sky / sunset / sea masthead with a perforated bottom edge, then the page's work on the **back of a
  postcard** ("POST CARD" across the top, message side left, stamp box and ruled address lines right),
  posted up out of the masthead.
- Each page brings one piece of art with its own motion:
  - **Claim:** a fanned hand of the four stamps (dealt in on load; spreads under a mouse). The code
    is written as a letter ("Dear Saudade, here's the code from my box:"), and a ticket on the
    address side **types each character as it's entered** (a 170ms typewriter strike), then takes a
    CLAIMED postmark when the code is accepted.
  - **Success:** a large CLAIMED postmark with today's date thunks onto the sea; the private link gets
    a highlighter sweep when copied.
  - **Recover:** a biplane carries the link from the Saudade postmark to a heart pin along a marching
    dashed route.
  - **Tap help:** rings pulse out from the wax heart. The iPhone/Android switch is a clip-path tab
    (D-063); the steps crossfade with a little blur.
  - **Fine print:** the contents ride in a sticky postcard; the template sits on a postcard back.
  - **404:** "404" in photo letters with a RETURN TO SENDER postmark coming down across it and a
    plane towing "Return to sender · no such address".

### D-062 · Sender, recipient and admin in F
- **Sender:**
  - Sticky linen header. The tabs are a pill rail; each tab carries its stamp's world colour as a
    dot, and the current tab is navy.
  - Titles are inked on by a roller (the `ink-in` utility), with the last word in script.
  - Each editor's title card is the front of a postcard in its world colour.
  - The portal's envelope rests on a perforated sea "desk". The checklist uses perforated stamp
    swatches that tilt under a mouse.
  - The save dock is a floating pill on wider screens.
- **Recipient:**
  - The threshold prompt is in the script hand ("Someone who misses you sent this."), and "Tap to
    open" is a pill on an ochre shadow.
  - World sheet titles pair capitals with a script name ("PHOTOS FROM *Mira*").
  - The ceremony itself is unchanged.
- **Admin:** stays calm (D-026). Headings are now uppercase capitals; buttons, fields and panels take
  the 10 / 14px radii; the primary button is navy; buttons press at scale .97.
- **Design system:** the copy and type notes describe F. `/design-system/directions` adds Direction F
  (selected) with a live moodboard; E–A remain as history.

### D-063 · Motion follows Emil Kowalski's rules
- **Easing:** custom curves only: `--ease-out-strong` (0.23, 1, 0.32, 1) for entering and responding,
  `--ease-in-out-strong` (0.77, 0, 0.175, 1) for things moving on screen, `--ease-settle` for a touch
  of overshoot on playful landings. Linear only for constant motion (the plane, the dashed route).
- **Durations:** press feedback 140ms at scale(.97); UI transitions ≤ 300ms. Longer only for
  first-view moments (letters landing, a title inked on, a postcard posted) and explanation.
- **Rules:**
  - hover effects only for real pointers (`(hover: hover) and (pointer: fine)`);
  - transform, opacity and clip-path only;
  - nothing grows from scale(0);
  - stagger 40–60ms;
  - transitions, not keyframes, for anything that can be interrupted (tabs, flips, the ticket's
    postmark);
  - blur to bridge crossfades;
  - `@starting-style` for the menu;
  - springs for decorative pointer tracking (the photo letters lean towards the cursor) and for the
    rack's flick (velocity carries it, then it settles on a card; pointer capture; extra touches are
    ignored).
- **Catalogue:**
  - large letters landing;
  - the ink roller and script write-on;
  - postcards turning over;
  - the souvenir rack;
  - stamps sticking to the sheet;
  - "Wish you were here" written on;
  - postmark thunks;
  - the clothesline swing;
  - luggage tags that fill the screen (oatly.com);
  - drum counters (oatly.com);
  - the hard-shadow lift (gumroad.com);
  - clip-path reveals and tabs (later.com);
  - the biplane, the airmail route and the heart's rings.
- **Reduced motion:** every piece has a still state, under the system preference or the Demo Panel.

### D-064 · Fonts: Bowlby One, Grand Hotel and Karla; footer faces kept, not preloaded
- Bowlby One (display), Grand Hotel (script) and Karla (UI) join Courier Prime and Nanum Pen Script.
  All OFL, checked against `METADATA.pb` (docs/ASSETS.md).
- **Patrick Hand SC is retired** with `app/fonts-marker.ts`.
- Epilogue and Inter Tight now serve **only the footer** (`app/fonts-footer.ts`) and are **not
  preloaded**. The root not-found boundary uses the public shell, so a preload there reached every
  route, the recipient's included.
- **Recipient fonts went from 154.7 KB to 95.9 KB.**

### D-065 · Two robustness fixes found in QA
- **Code boxes under load:** focus moves to the next box a frame after each character. When frames
  are slow (WebKit; a busy phone), the next key could arrive first and be dropped.
  - `CodeInput` now sends a key to the box that focus is about to move to, and reads the latest code
    from a ref.
  - The claim ticket subscribes to a tiny store, so only the ticket re-renders while someone types.
- **Clip-path reveals:** Chromium's IntersectionObserver honours a target's own clip-path, so a fully
  clipped element can never report as visible. "Wish you were here." stayed hidden at tablet widths.
  - For clip effects, `InView` now observes the unclipped parent, then checks the element's own box
    on scroll.
- **Also:**
  - the clothesline (which scrolls sideways on small screens) is keyboard-focusable;
  - tags may wrap rather than overflow;
  - the occasion sheet runs two rows of six on tablets.

### D-066 · Verification (production build, `next start -p 3200`)
- **Static checks:** `tsc`, `eslint` and `next build` are clean.
- **e2e journey:** 32/32 in Chromium and 32/32 in WebKit, including axe across the journey.
- **Extra axe pass:** home, claim, recover, tap help (both tabs), privacy, terms, 404, the three
  design-system pages and the admin sign-in, at 390 and 1440. 0 violations.
- **Recipient performance (slow 4G, 4× CPU):** LCP 4.07s (previous phase ~4.1s), CLS 0, JS 259 KB,
  fonts 95.9 KB. The D-044 budget is still not met; it is owned in Phase 3.
- **Motion:** `scripts/motion-check.mjs` was rewritten for F and captures every signature animation
  in action, with no page errors.
- **Visual review:** galleries at 390 / 820 / 1440.

## Design revamp 4b: scroll stories (2026-10-09, night)

### D-067 · The example envelope becomes a pinned scroll story; header and hero fixes
- **Feedback:**
  - the navbar shouldn't be white before scrolling;
  - move the hero up;
  - the hero letters are cut at the end;
  - the example envelope and "Good to know" need far better designs;
  - bring in later.com's scroll animations, and look at other sites like it.
- **Header:** transparent over the page's first band at the top; the linen bar once the page scrolls
  (`PubHead`, a colour change with a plain `ease`). The page slides up under it (`--head-h`), so
  every first band now starts at the top of the screen.
  - Pages that open on the sea pass `headTone="light"` for cream text.
  - The sky gradient's top stop was lightened (#2a9eb0) so ink stays ≥ 4.5:1 over it.
- **Hero:** content sits about 60px higher. The photo letters were being cut because a background
  clipped to text only paints inside the letter's box, and Bowlby's glyphs (plus their outline)
  overhang it. Each letter's box is now padded, with a negative margin so spacing is unchanged.
- **"A year in one envelope":** replaces the clothesline. The section pins for about three screens
  (`YearInEnvelope`, Motion `useScroll`).
  - Over five months (Oct 2026 → Oct 2027), a letter, five postcards, a voice note and a song rise
    out of an open envelope into a growing fan; the pier ("a year on") lands last, on top.
  - The season colour crossfades underneath as stacked layers (opacity only).
  - The date, the moment and what was added change with a short blurred crossfade.
  - A tally fills in, and a plane flies along a month rail.
  - Each card's progress is a CSS variable on that card alone; its transform is computed in CSS.
  - Reduced motion: not pinned; the finished envelope is shown. Screen readers get the year as a
    list.

### D-068 · Good to know becomes a split-flap departures board (superseded by D-072)
- Someone far away, made literal. Six rows (how to tap, lost link, privacy, no app, never expires,
  need a hand), each a link: the Oatly colour-fill transition, or a plain `mailto:`.
- **Tiles:** one per character, and a space is a blank tile. On wide screens each row pads to a
  fixed strip like the real thing. Below 72rem the remark wraps beneath, whole words at a time.
- **Cascade:** when the board comes into view, characters cycle and settle left to right, row after
  row. Each flap drop is a fast linear 70ms, because it is a mechanism. It plays once; nothing
  re-flips on hover (a highlight and an arrow nudge only).
- **Scroll lean:** the board tips up from a slight backward lean, scrubbed by scroll.
- **Clock:** a live clock runs in the corner (client-only).
- **Accessibility:** the words are real text (sr-only); the tiles are decorative.

### D-069 · Scroll patterns borrowed from later.com and similar sites (patterns only)
- **Method:**
  - Playwright scrolled later.com, linktr.ee, planoly.com, pitch.com, mailchimp.com and
    headspace.com in steps.
  - It recorded their libraries, which sections pin, and which elements are scroll-scrubbed: they
    change with scroll and revert when you scroll back, as opposed to one-shot reveals.
- **Findings:**
  - **later.com:** full-screen sections, a three-screen pinned sequence (stat cards, then a
    gradient panel wiping sideways into the next scene with rising text), angled colour panels over
    full-bleed video, a fanned card row. Built with native CSS scroll timelines plus a pin.
  - **pitch.com:** depth parallax in the hero, pinned image crossfades, a word-by-word text fill,
    a nav that turns solid on scroll, a highlighted vertical word list.
  - **linktr.ee:** colour-block sections, a rounded card that widens to full-bleed.
  - **planoly, mailchimp, headspace:** mostly static or one-shot reveals.
- **What Saudade uses:**
  - the pinned story (D-067);
  - `ExpandBand`: the "Wish you were here" sunset grows from a rounded inset card to full width;
  - `ScrollFill`: its lede fills in word by word;
  - hero depth (the peeking postcards rise faster and the sun sinks slower). CSS scroll timelines
    run off the main thread; where unsupported, the hero is still;
  - the board's lean (D-068);
  - the scroll-aware header (D-067).
- **Rules:** all scroll-scrubbed motion is transform, opacity or clip-path, follows the finger
  exactly, and has a finished still state under reduced motion.
- **Also:** the interior postcard's entrance is now transform-only, so it is never caught at half
  opacity, which axe had flagged on the claim-success buttons.


## Design revamp 4c: the later.com sequence, smooth scrolling (2026-10-09, late)

### D-070 · Smooth, seamless scrolling; the hero fits every screen
- **Feedback:**
  - the hero letters run over the buttons;
  - the site's scrolling should be smooth and seamless.
- **Smooth scrolling:** Lenis 1.3.26 (MIT; `lerp` 0.11) eases wheel and trackpad input on the public
  pages (`components/public/SmoothScroll.tsx`), so the scroll-scrubbed scenes glide instead of
  stepping.
  - Touch keeps the phone's native scrolling. Reduced motion turns it off.
  - Dialogs, sheets and the demo panel opt out (`data-lenis-prevent`), and in-page anchors clear
    the header.
  - It is loaded with a dynamic import, so it never joins a shared bundle. The recipient's route
    stays at 259.6 KB of JS and never runs it.
- **Hero:** "MISSES YOU" is now sized to the content column and the screen height:
  `min(--fs-mega, column / 8.3, 19svh)`, and two lines on phones. It fits one line on every
  laptop and desktop without pushing the lede or buttons down.
  - The lede and buttons sit above the letters' layer.
  - The forward lean of the cursor-tracking tilt was reduced (rotateX 6° → 2.5°), so the bottom of
    the word never swings over the text below.
  - Checked at 1920×1080, 1536×864, 1366×768, 1280×720, 1024×768, 820×1180, 390×844 and 360×740.

### D-071 · "What fits" → "The first tap": later.com's "hype is real" and the scroll after it
- The old numbers postcard and first-tap section become one pinned sequence, about 3.3 screens
  (`HypeToTap.tsx`):
  1. A full-screen sunset field with four chunky stat cards on hard navy shadows (15 photos, 3:00
     minutes, 1 song, 0 apps), with drum counters and icons.
  2. As you scroll, the cards lift away and the colour field collapses into a rounded frame on the
     right (the lower half on phones). The railway photograph comes up inside it.
  3. The first-tap words rise in on the left, the ritual lines follow one by one, and the phone
     slides up beside the photo.
- Each layer reads its own 0 → 1 variable, written by scroll; the geometry lives in CSS. Everything
  is transform, opacity or clip-path.
- Layers that are off stage are `inert`. Reduced motion shows two ordinary sections.

### D-072 · Good to know: a bento of postcard scenes (replaces the departures board)
- **Feedback:** the departures board design was poor.
- **New layout:**
  - **Scene cards:** a large sky card ("Hold your phone to the heart", with the animated tap
    illustration), a sunset card ("Lost your link?", with the airmail route) and a sea card
    ("Private by design", with the wax heart). Each is a white-bordered postcard that lifts under
    a mouse while its art leans in, and fills the screen in its own colour when clicked.
  - **Quick answers:** a postcard back with four answers (app, expiry, changes, phones) and a
    support line.
- **Motion:** the art sits above the words, never under them, and drifts slightly with scroll
  (a CSS view timeline).

### D-073 · The year timeline is a strip of stamps
- In "A year in one envelope", the month rail becomes five perforated stamps along a dashed
  airmail route, each with that month's photo.
  - Months still to come wait greyed out.
  - Each month reached gets a postmark cancel (a quick thunk).
  - The current month lifts and tilts.
  - The route inks in navy as the plane flies along it.

### D-074 · Hero clearance, and the home page re-ordered as a story
- **Feedback:**
  - put "MISSES YOU" back as it was;
  - the hero letters that run over the buttons are the peeking postcards at the bottom ("for
    Theo"), not the headline;
  - make the hero taller;
  - re-arrange the sections.
- **Headline:** the D-070 sizing and tilt change was reverted. `--fs-mega` and the 7°/6° lean are
  back.
- **Peeking postcards:** they were pinned to the hero's bottom edge, and the scroll depth effect
  (D-069) lifted them 5rem into the buttons as the page scrolled.
  - They now sit in the normal flow under the buttons, so the hero grows around them, and tuck
    behind the perforated edge with a negative bottom margin.
  - Their scroll lift is halved (2.5rem).
  - The smallest gap between the buttons and a card is now 41px (360×740 phone, at full lift) and
    up to 121px on desktop, measured at 8 screen sizes while scrolling.
- **Order:** Hero (sky) → Wish you were here (sunset, expanding) → How it works (cream) → The four
  stamps (sea) → What fits → the first tap (sunset → cream, pinned) → Occasions (cream) → A year in
  one envelope (seasons, pinned) → Good to know (cream) → footer.
  - It reads as a story: what it is, why it matters, how it works, what goes inside, the moment
    they open it, when people send one, how it keeps growing, answers.
  - The sunset bands no longer stack, and the two pinned sequences are no longer back to back.
  - The Wish band gets a cream gap under the hero's edge.

## Backend on Supabase (2026-10-09)

### D-075 · The real backend runs on Supabase (Postgres + Storage), behind the existing REST contract
- **Why:** product owner's choice, for a demo Zeya can use end to end (her own phone fills an envelope,
  another phone opens it). It also matches the proposal's promise of "a staging link from week two, so you
  can claim a test unit and fill it yourself". One client-owned account covers the database and the files.
  This replaces Neon + Cloudflare R2 from `ARCHITECTURE.md` A1.
- **What was built:**
  - The server side of the contract the screens already used (`lib/services/api/*` →
    `ARCHITECTURE.md` §6): 25 route handlers in `app/api/*` over `lib/server/*`.
  - `supabase/migrations/0001_init.sql`, generated from `db/schema.sql` with three Supabase changes:
    `citext` in `extensions`; RLS on every table with no policies plus all grants revoked from
    `anon`/`authenticated`, and views set `security_invoker`; scrypt admin passwords (no native addon).
  - `npm run db:setup`: generates the secrets, migrates, creates the private bucket, creates the admin
    and seeds the demo (D-077).
  - `npm run api:smoke` and `npm run api:e2e`.
- **How it is built:**
  - **Database:** the `postgres` driver through Supabase's transaction pooler (`prepare: false`), plain
    parameterised SQL and real transactions. Claim, saves, seal, reveal and admin resets lock the unit
    row.
  - **Files:** a private bucket. Browsers upload straight to Storage with single-use signed upload URLs
    (no bytes pass through a function). `…/complete` checks the object exists, its size and its magic
    bytes. Reads are 1-hour signed URLs, pre-signed into envelope responses.
  - **Secrets and limits:** codes are HMAC-peppered and tokens/sessions are SHA-256 (§3). Rate limits are
    Postgres fixed windows (§9.2). The admin session is an HttpOnly SameSite=Strict cookie plus a CSRF
    header and an Origin check.
  - **Email:** server-rendered templates only. Delivered through Resend when a key is set; otherwise
    recorded in the admin email log (the demo default until O2).
  - **Screens:** no screen changed except two. The Demo Panel (and the logo's triple-tap) exists only
    on mock data. The admin dashboard now labels its activity feed from the stats response instead of
    fetching every unit, which also fixes a wrong count past 100 units.
- **Kept on mock:** `NEXT_PUBLIC_DATA_SOURCE` still defaults to `mock`, so the prototype, the Demo Panel
  and `scripts/e2e.mjs` work unchanged.
- **Deferred (docs/BACKEND.md §4):** server-side media normalisation (sharp/ffmpeg), real email, cron jobs,
  off-provider backups, TOTP, Turnstile, CSP/HSTS, hosting in Zeya's accounts.
- **Costs:** Supabase Pro $25/month (daily backups, 7 days) + hosting ≈ $45–50/month at 300 units, replacing
  the estimate in `ARCHITECTURE.md` §12.

### D-076 · Zeya's stamp reference sheet (received 9 Oct; sent in the Fiverr thread on 27 Sept)
- **What it shows:**
  - An album page of 15 real vintage postage stamps, tightly packed in mixed sizes and orientations, on
    white:
    - shells (Comoros, Monaco), a swan (Romania), a portrait (France), Mount Fuji (Japan);
    - a butterfly (Ecuador), Notre-Dame (France), a satellite over a starfield (Monaco);
    - London, Rome, a cat, a flower;
    - at the centre, a soft pink **heart stamp** with a round postmark.
  - Each stamp is pictorial, with:
    - a single deep engraving ink (green, blue, red, sepia) or a soft lithographic palette;
    - a country name and a denomination;
    - white perforated margins, slight wear, and the odd cancellation.
- **What it confirms:**
  - The direction (a cream ground, colour carried by the stamps, perforations, postmarks).
  - The heart stamp as the motif tying the page to the ceramic.
- **What it changes, to act on:**
  1. **Placeholder stamps** should move closer to this reference: one strong ink per stamp, a real
     pictorial scene, country-style lettering and a big denomination, and white perforated margins. The
     current pastel duotones are lighter than the reference.
  2. **Mixed proportions:** her four finished stamps may not share one size or orientation. The envelope
     layout and the stamp frames (`config/stamps.ts`) must accept a per-stamp aspect ratio, and should
     be tested with a portrait, a landscape and a square stamp.
  3. **The home "occasions" sheet** can borrow the album-page collage (mixed sizes, tight gutters)
     instead of a uniform grid.
- **Rule:** reference only. None of these stamps (or their designs) may be used. Her own artwork replaces
  the placeholders (O4).

### D-077 · The shareable demo dataset
- **Hero code:** `SAUD-3K7M` (same code and chip link as the prototype, so every script and doc still
  works).
- **Spare codes:** 9 more unclaimed codes, plus `SAUD-9PXR` (already claimed).
- **Sample envelope:** a sealed Mira → Theo envelope at `/t/miratotheo23` with real uploaded photos, a
  voice note, the letter and the song, so Zeya can feel the first tap before filling one herself.
- **Replaying it:** the admin's "Reset reveal".
- **Wiping it:** `db:setup -- --reset --yes` (staging only).

### D-078 · Design pass before the approval demo: tickets, airmail labels, the footer joins the site
Product owner's review of the home page (9 Oct). Each item replaces an earlier choice:
- **Buttons are tickets, not pills.** Every `InkButton` / `InkLink` (and the rack's arrows, the reveal's
  "Tap to open" and the song world's "Open in…") takes the approved footer button's shape: square, with one
  clipped bottom-right corner. They keep the footer button's motion too (the label rolls over, the arrow's stem
  stretches) and each variant keeps its colours (coral, postcard white, navy, paper). The outline and the hard
  shadow follow the cut: two clipped layers and a `drop-shadow`. Supersedes "pills for buttons" (D-060).
- **Tags are airmail labels, not pills.** The `tag` utility is a typewritten slip edged in red-and-navy
  airmail stripes with a hairline frame inside. One change covers the hero ("A ceramic envelope · tap the heart
  to open"), the interior page heads and the sender portal.
- **No em dashes in visible copy.** The few that were on screen now use a colon or a middle dot, and empty
  admin table cells say "None".
- **The footer joins the site.** Same layout and content as approved, now in the site's own language: a
  navy linen band with a perforated top edge, the wavy cancellation lines kept, Bowlby One headline with a
  Grand Hotel word, Courier Prime labels, Karla links, the site's ticket button (cream, coral shadow, mustard on
  hover, the old button's colours), and the giant wordmark in Bowlby capitals on a coral extrusion.
  `app/fonts-footer.ts` (Epilogue + Inter Tight) is deleted, so two fewer fonts download. Supersedes the
  "footer is pinned" rule (D-060, D-064).
- **A new biplane.** The hero plane is redrawn side-on: a cowled engine, a spinning prop, two wings with
  struts and wires, a pilot in goggles with a streaming scarf, a heart roundel and a striped rudder. Its banner
  is a stitched cloth on a bridle that flutters as it goes.
- **The year timeline ("A year in one envelope")** gets the same biplane, smaller and facing the way the
  year runs, flying its own lane above the month stamps instead of a line through their postmarks. The route
  has a stop per month (an open ring until reached, then a navy dot); each stamp hangs from its stop on a
  thread, and the lane is the gap between the envelope and the stamps. The tally (photos, letter, voice,
  song) is a row of parcel tags with punched holes, not pills.
- **The rack turns on its own** every 3 seconds. It waits while a pointer rests on the cards, while it has
  keyboard focus, while it is dragged, off-screen and in a hidden tab. A pause button stops it (WCAG 2.2.2),
  and its details aren't announced while it turns by itself. Reduced motion: it doesn't turn by itself.
- **Header:** the three nav links sit on the page's centre line (a three-column grid), and the logo scrolls
  back to the top when you're already on its page (it also drops a `#how` anchor from the address).
- **Hover never moves the hover target.** Things that lift or tilt on hover (stickers, occasion stamps, buttons,
  the rack's arrows, the sender's stamp slots, the "Good to know" cards, the hero's peeking postcards) used
  to move their own hit area, so a pointer resting on an edge fell off, the hover ended, the thing dropped back
  and it started again: a jitter. Now either the hover is read from a parent that stays put (`peel`), or only
  the drawn layers move and the hit box stays (buttons), or a hit slop covers the spot it rose from (cards).
  A press can no longer slide a button out from under the pointer and lose the click.
- **"Four small worlds" scrolls up over "How it works"** (`components/motion/CoverStack.tsx`): how it works
  holds once its bottom meets the bottom of the screen (so a tall phone layout is still read in full), the sea
  band slides over it with its perforated edge, and the postcards sink back a little (scroll-driven, where
  supported). The hold ends with the pair.
- **The year timeline fits every screen.** The envelope and the cards rising out of it are sized from the room
  the desk has (a size container: `cqw`/`cqh`), not from the screen's width, so on short laptop screens
  (1280×720, 1366×768) the fan no longer runs under the header; the copy, date and stamps also cap their size by
  screen height. Measured at 13 sizes from 360×640 to 2560×1440.
- **Responsive audit** (`scripts/responsive.mjs`): every route at 13 screen sizes, checked by rule (QA_CHECKLIST).

### D-079 · Responsive pass: every screen from a 320px phone to a 2560px monitor (2026-10-10)
Product owner's ask: mobile-first, and properly formatted on phones, tablets, laptops and monitors. The rule-based
audit (`scripts/responsive.mjs`) plus four visual reviews (home on small and large screens, the public pages, the
sender / recipient / admin flows) found the problems; the fixes follow a few principles:
- **Size by the room something really has, not by the screen.** Grid columns are `minmax(0, 1fr)` so content
  can't push a column (and the page) wider than the screen (the stamp rack, the occasion sheet, the voice
  waveform, the admin details). Things that must fit a box size from the box with container units: the year
  timeline's envelope and fan (`cqw`/`cqh`), the claim page's code boxes and ticket (`cqi`).
- **Wide but short screens are their own case.** The hero letters, the inner-page mastheads, the year scene and
  the stat cards cap their size by screen height too (`min(…vw, …svh)`), so on 1280×720 and 1366×768 laptops
  the main button stays above the fold and pinned scenes fit. "MISSES YOU" also never breaks onto two lines
  from tablets up (it sets at 6.91× its size).
- **Monitors:** past 1600px the root size grows to 125% at 2560px (in rem, so a reader's font setting still
  counts); the whole design scales instead of floating in a narrow column.
- **Touch tablets get touch sizes.** Compact controls are compact only for a mouse (`pointer-fine:`), not by
  width, so an iPad at 768–1024px keeps 44px targets (admin, legal contents, the sender's tabs).
- **Phones and tablets:** the first-tap scene puts its words above the photograph (they used to run over it);
  short phones drop the scene's three steps and the year scene's extra lines; the header button shortens to
  "Claim" under 384px so the logo keeps its room; the nav links never wrap; the footer links take the width
  their labels need; long button labels wrap inside the button instead of running off a small screen.
- **The envelope face:** the bottom row of stamps rises (up to 36% down) before the stamps shrink, so a short
  laptop face no longer puts the voice stamp on "for"; the sender's face keeps extra room for the tags below
  its stamps. The seal screen's hold ring is a little smaller and the name a little lower, so they don't touch.
- **Smaller fixes:** the sign-off wraps (a textarea that grows); dialog titles wrap instead of truncating; the
  stamp worlds fill their dialog to the bottom in their own colour; the handwritten letter isn't hyphenated;
  in-page anchors land just under the header (Lenis honours `scroll-margin-top`; its extra offset counted the
  header twice); the first-tap scene's phases overlap so it never shows an empty panel; two occasion labels
  are shorter words ("Cap and gown", "A year together") so they fit a third of a phone at 12px.
- **Accepted:** the letter's "Dear ___" and sign-off lines are 42px tall, the letter paper's rule pitch (above
  the 24px WCAG 2.5.8 minimum); on 320px phones the code boxes are about 38px wide.
- **Revised the same day (product owner: the hero letters and the year scene had shrunk too far on a laptop):**
  - "MISSES YOU" is back to full size. From tablets up it may use the screen's whole width (less the gutters),
    so it stays on one line at full size, and its line box hugs the letters (the inherited line height left
    half a letter of empty space), which keeps the buttons above the fold at 1280×720 to 1536×730 instead of
    shrinking the letters.
  - The year scene wins room instead of shrinking: the site header slides away while the scene is pinned
    (`html[data-immersive]`, back as the scene ends, on focus, or with the menu open); the cards are larger
    against the envelope and rise from deeper in the pocket, a little less far (the rise sets the fan's
    height); the text and the timeline stamps are back to within a few percent of their original sizes. At
    1536×730 the cards went from 117px to 150px wide (164px originally, when the fan ran under the header).

### D-080 · Hero letters on two rows, a "Contents" slip, a stamp cursor (2026-10-10)
Product owner's review, replacing parts of D-079's revision:
- **"MISSES YOU" is two rows at every size** ("MISSES" over "YOU"), at `clamp(3.6rem, min(0.6rem + 9.6vw,
  19.5svh), 9.75rem)` (142px on a 1536×730 laptop window), with the line box hugging the letters, so the
  buttons stay in view. The one-row, full-width version was too big.
- **The year scene's images are bigger:** the timeline stamps (up to 7rem; 102px at 1536×730, from 84px) and the
  cards out of the envelope (0.34 of the envelope's width, rising 92% of their height; 151px at 1536×730).
  The fit factor is re-measured (`--fan-k` 1.03).
- **"Contents" slip:** the photos / letter / voice / song tally is a small customs-style slip with a ticked box per
  part, four in a row (two by two on a phone), every row the same height. It replaced uneven parcel tags whose
  big photo count made one taller than the rest.
- **Desktop cursor** (`components/ui/StampCursor.tsx`, `styles/cursor.css`): a navy dot exactly on the pointer
  and a postmark ring trailing it on a spring; over anything clickable the ring becomes the logo's red heart
  stamp, which presses flat on click; over the postcard rack, a "Drag" disc. Only for a mouse or trackpad on a
  screen at least 1024px wide (never on phones or tablets, nor in a narrow window); text fields, embedded players
  and the admin (`data-native-cursor`) keep the system cursor; the system cursor shows until it loads; reduced
  motion drops the spring. It replaced a pen-nib cursor image.

### D-082 · Client round 1 (Zeya, 13 Oct): three fonts, muted dark blue, the letter writes itself (2026-10-13)
- **Three faces, not five.** Zeya: "only 2-3 styles… I'm liking 'chosen for you' and 'side A' or 'comes the sun'".
  Kept Bowlby One ("HERE COMES THE SUN": headlines), Nanum Pen Script ("chosen for you": the letter, names and every
  script word) and Karla (reading text, buttons, and the postal labels as tracked capitals). Dropped Grand Hotel and
  Courier Prime. The `--ff-script` / `--ff-postal` tokens stay and now point at Nanum Pen / Karla, so no markup
  changed. Nanum Pen draws capitals at 0.56 of the em against Grand Hotel's ~0.68, so every script use carries
  `font-size-adjust: var(--fsa-script)` (`cap-height 0.68`): same visual size, unchanged line boxes. If she prefers
  "SIDE A" (Courier Prime) over Bowlby for headlines, that is a loader swap in `app/fonts.ts` plus `--ff-display`.
- **Cyan → muted dark blue.** The turquoise sky, sea and dusty blue are now `#3b5878` / `#2f4a68` / `#b7c5d6`.
  The sky band became a dark band (cream text, `headTone="light"` on the pages that open on it); light panels that
  carry dark drawings use the new `band-mist`. The hero's sun is a low warm glow so cream text reads over it.
- **The letter writes itself out** the first time it is opened, then simply reads (like the opening reveal).
  `LetterWorld typeOut`: character by character (graphemes), pausing at punctuation and line ends, ~34 a second,
  never longer than 18 s; the unwritten words hold their place so nothing reflows; the page follows the pen until
  the reader scrolls. A tap, Enter/Space or "Show the whole letter" finishes it. Screen readers get the whole text
  at once; reduced motion skips it. Live route: once per letter version per device (`useDevice.lettersRead`, so an
  edited letter is written out again). Preview: every "First tap" run, never in "Coming back".

### D-081 · Seal & send: a bigger envelope, no dead space; the address the heart opens (2026-10-10)
- **Dead space fixed.** The room kept above the envelope for its open flap was a percentage padding on the
  stage, which CSS measures against the column (862px), not the envelope (352px): it reserved 325px for a
  149px flap. It is now a spacer sized from the envelope's own width.
- **Bigger envelope:** as wide as the column allows (up to 34rem), short enough that the open envelope and the
  start of the hold prompt fit under the title, never below the old 22rem (457px on a 1440×900 screen).
- **The sealed heading:** while sealing in front of you, the intro stays (nothing jumps) and "It's sealed."
  rises into the flap's room, centred above the envelope. Opened already sealed, the heading sits directly above
  the closed envelope with no flap room.
- **[SHOWCASE] The address the heart opens** (`site.showRecipientLinkAfterSeal`): after sealing, the sender
  sees `https://<site>/t/<slug>` with Copy and Open, so the first tap can be tried with no ceramic. In the
  product nobody sends anything: the recipient holds their phone to the heart and the chip opens that page.
  Set the flag to false for launch.

## Launch hardening (2026-10-16)

Scope check first: the product owner confirmed the contract is `CLIENT_GUIDE.md` (the $1,000 offer), not the
earlier proposal's plans, so the four stamps stay Photos / Letter / Voice / Song and the deferred list stands.
Everything below closes the "not built yet" list in `BACKEND.md` §4 and the gaps found by auditing every
CLIENT_GUIDE requirement (`LAUNCH_READINESS.md`).

### D-083 · The launch work, as built
- **Media pipeline** (`lib/server/media-pipeline.ts`, `media-jobs.ts`): on upload-complete, photos become a display
  JPEG (≤ 1600 px, mozjpeg q80) and a 480 px WebP thumbnail, EXIF orientation applied and **every** metadata field
  dropped, 50 MP decompression-bomb guard; voice notes become mono AAC 64 kbps m4a, loudness-normalised, and their
  length is measured by ffmpeg (the 3:00 cap no longer trusts the browser). A bad file is rejected
  (`upload_failed` / `too_long`); a platform failure serves the verified original and queues a retry, so a sender
  is never blocked. Envelopes sign the variants (thumbnails under `{id}:thumb`) and report the voice note as
  `audio/mp4`. Variants live at `media/{unit}/{media}/v1/…`; a format change means v2, never an overwrite.
- **Jobs and cron**: the `jobs` table is now used (`for update skip locked`, backoff, `dead` after 5 tries).
  `vercel.json` runs `/api/cron/daily` at 03:00 UTC (allowed on every Vercel plan): stale uploads, a 7-day orphan
  sweep into the 90-day recovery window, the purge after it, raw-upload deletion 7 days after conversion, a
  backfill of anything never converted (covers staging's older uploads), retries, song checks, and the §5.2
  retention clean-up. `/api/cron/jobs` exists for a frequent schedule on Vercel Pro. Both need `CRON_SECRET`.
- **Songs**: every saved track is recorded in `song_catalog`; the nightly check marks a track unavailable only on
  a definite provider "not found", never on an error. Envelopes merge `unavailable`; the song world already
  rendered it; the sender's editor now says so.
- **Admin two-factor (AQ5)**: RFC 6238 TOTP, secrets AES-256-GCM sealed to their admin row with `TOTP_ENC_KEY`,
  replay blocked by the last used step, 10 hashed single-use recovery codes, stateless enrolment (the secret only
  stored once a code proves it). On when `TOTP_ENC_KEY` is set: a first sign-in is held on Admin → Security until
  enrolled. Wrong codes count towards the same 5-strike lock as passwords. Lost phone and codes: CLI only.
- **Claim breaker + Turnstile**: with Turnstile keys, 300 failed claims in an hour turn on a bot check for every
  claim for 6 hours (logged once as `system.breaker_tripped`); without keys, the old behaviour (pause to the end of
  the hour). New error code `challenge_required`.
- **Admin packing checks**: a reveal POST from a browser with an admin session is `admin_excluded` (the recipient
  client now sends cookies on that one call).
- **Batches**: list shows every batch with status, claim count, code length and domain; **Mark encoded**
  (permanent) and **Void** (only before encoding and before any claim; a void batch's codes are unknown codes).
  The factory CSV uses the domain recorded on the batch, never the current setting. Generation hands out two
  files: the card file (codes, for the printer) and the factory file (URLs + NDEF bytes); codes never go to the
  factory.
- **History and restore**: unit detail lists every saved version; restoring saves the old payload as the newest
  version and brings back soft-removed media (refused once purged). This is the "file versioning so media can be
  recovered" of CLIENT_GUIDE §8, made usable.
- **Launch checklist**: `GET /api/admin/readiness` on the dashboard; build-time items are shared with the
  prototype (`lib/readiness-config.ts`).
- **Operator CLIs**: `npm run provision` (the ceremony from a terminal, dry run unless `--yes`, files mode 600)
  and `npm run admin` (list / add / reset-password / reset-2fa / disable / enable, all audited).
- **Legal pages**: the wording now lives in `content/legal.ts`; a section with text renders it, an empty one keeps
  the placeholder. We still write none of it (O14).
- Migration `0002_ops.sql`: `ops_runs` (last run of each scheduled task) and `media.original_deleted_at`. Additive.

### D-084 · Deployment settings come from the environment; the defaults keep today's demo working
`NEXT_PUBLIC_CHIP_DOMAIN`, `NEXT_PUBLIC_CODE_LENGTH`, `NEXT_PUBLIC_SUPPORT_EMAIL` and
`NEXT_PUBLIC_SHOW_RECIPIENT_LINK` replace hard-coded values, so production is configured on the host with no code
change. Unset, each keeps its current value (placeholder domain, 4-character codes, showcase link on), so Zeya's
staging demo is unchanged by a redeploy. Production safety comes from the launch checklist (which flags each one),
the batch screen's warning, and the provisioning CLI's refusal of the placeholder domain, rather than from changing
defaults under a live demo. One code length per deployment: the HMAC is over the body, so mixing lengths would
only add ambiguity. 8-character bodies are shown as two groups (`SAUD-3K7M-Q2XF`); the second group wraps on a
phone, with the dash hanging in the gap so no line overflows at 320 px. Generated bodies never start with "SAUD",
so typing the prefix into the boxes is always caught.

### D-085 · Two Content-Security-Policies, and 'unsafe-eval' only for Spotify
A nonce policy (ARCHITECTURE §9.3's plan for the admin) needs per-request rendering, which Cache Components' static
shells rule out; so both policies are static headers. The public site allows `'unsafe-eval'` because Spotify's
official iFrame API (loaded from `embed-cdn.spotifycdn.com`) is a webpack build that evaluates strings: without it
the record can't follow the music. Found by `scripts/e2e.mjs`, which fails on any CSP violation. Per-page policies
can't help: a page keeps the policy it loaded with through client-side navigation, and the sender's and recipient's
pages link into each other. The admin, reached only from admin pages and showing no third-party content, gets a
stricter policy (no eval, no third-party scripts, `frame-src 'none'`). Also: HSTS (no `preload` until the domain
is final), `X-Frame-Options: DENY`, COOP, and `Referrer-Policy: no-referrer` on `/s/*`.

### D-086 · Not done, on purpose
- **No `proxy.ts` rewrite for upper-case `/T/` QR codes** (ARCHITECTURE §3.4): it would put a proxy hop in front of
  every first tap, the most speed-sensitive request in the product. A fallback QR (O8, still open) must encode the
  URL exactly as in the factory file (lower case).
- **No server-rendered envelope contents to speed up the recipient page**: link-preview bots would read letters
  (ARCHITECTURE §8). The speed budget is reported as not met, with the options (`LAUNCH_READINESS.md` §3).
- **No automatic 2FA switch-on for staging**: `db:setup` doesn't generate `TOTP_ENC_KEY`, so Zeya isn't asked to
  set up an authenticator on the demo without being told.

### D-087 · Off-site backups: what B2 keeps of deleted files
The nightly media copy never deletes (a write-only key, Object Lock). So that it doesn't keep what the app deletes
for privacy: a B2 lifecycle rule hides `media/incoming/` (raw uploads, which may carry location data) 30 days
after upload; an upload whose conversion failed is still in Supabase and is simply copied again. Files of purged
stamps are removed from B2 by a quarterly step with the master key (`BACKUPS.md` §2). The Privacy Policy facts
(HANDOVER §9) say so.

### D-088 · Tooling
- `vitest` for unit tests (`tests/`), with `server-only` aliased to an empty module.
- `@types/node` follows the runtime (Node 24), which vitest 5 also requires.
- `rolldown` is a direct, pinned dev dependency: npm (npm/cli#4828) kept dropping its platform bindings from the
  lockfile when it was only transitive (through vite), which broke `vitest` here and would break `npm ci` on
  Linux CI. Keep it at the version vite uses.
- `scripts/test/storage-stub.mjs`: an in-memory Supabase Storage stand-in so CI runs the whole API against
  PostgreSQL 15 with no cloud account. `scripts/api-smoke.mjs` and `scripts/e2e-api.mjs` create throwaway admins
  when they can reach the database, so 2FA is exercised on every run and runs repeat cleanly.
- `scripts/perf.mjs --slug` measures a real envelope on the real backend.

## Sender & recipient build + integration (2026-10-08)

### D-041 · Prototype media stored as bytes, not Blobs
IndexedDB records are `{ bytes: ArrayBuffer, type }`. WebKit in private/ephemeral contexts
(**Safari Private Browsing**, automated WebKit) refuses Blobs in IndexedDB, which broke photo
upload. Found by the WebKit e2e run. Prototype-only; production uploads go to R2.

### D-042 · Stamp controls are transparent hit areas beside the artwork
Recipient stamp buttons and sender portal slots no longer *contain* the artwork: postmark words
("SNAPSHOTS", dates) are visible text, and text inside a control must be part of its accessible
name (WCAG 2.5.3). The wrapper carries the hover/press motion; labels stay descriptive
("Open voice message from Mira, 1 minute 8 seconds"; "+ (new)" when updated).

### D-043 · Font loading for the recipient route
Preload only Fraunces (optical-size axis only) and Caveat, Latin subset; DM Sans and Special Elite
load on demand with metric-matched fallbacks; other scripts still load via unicode-range. Fonts
transferred went from 782 KB to 309 KB, LCP from 6.8 s to 4.2 s. The SOFT/WONK axes are dropped
(buttons lose a slight softness).

### D-044 · Performance budget not met yet; accepted for the showcase, owned in Phase 3
Recipient route: CLS 0.001 ✅; LCP 4.2 s ❌; initial JS 251 KB ❌ (framework + Motion floor ≈ 160 KB).
The prototype's client-side mock data and simulated latency add ~0.6 s that production won't
have. Plan: QA_CHECKLIST §4. **Not hidden from the client**: stated in the showcase debrief.

### D-045 · Sender portal behaviours
Save keeps you on the editor (no autosave, so people save often); every photo is re-encoded to
JPEG; photos still uploading count toward 15 and block Save; the letter limit is soft (Save
disabled when over, nothing truncated); an empty letter can't be saved (use Remove); voice uploads
on Save; takes under 1 s are discarded; hold-to-seal = 900 ms with a plain "Seal it now"
alternative; in-app browsers hide the recorder but offer "Try recording anyway" and upload.
The photo-compression worker is self-hosted (`/public/vendor`, MIT).

### D-046 · Recipient behaviours
Sender edits appear when the recipient returns to the tab (never mid-ceremony); an envelope
sealed while "still being written" is open switches to the ceremony. Voice meter uses a live
AnalyserNode where safe, else the stored waveform (cross-origin audio; iOS < 16.4 under the silent
switch). Apple Music: the record spins on interaction and stops after the track length, with a
manual toggle (confirms D-013). If recording the reveal fails, it isn't cached on the phone, so
the ceremony replays next time rather than being lost. The letter is dated from its last save.

### D-047 · Toasts sit above pinned bottom bars
`--toast-offset` lets the sender's Save dock push toasts up instead of covering Save.

### D-048 · QA tooling pinned to the installed WebKit
`playwright-core@1.57.0` (dev) matches the intact WebKit build used as the iPhone-Safari proxy;
the Python Playwright WebKit build was removed from disk (likely antivirus). Scripts:
`scripts/e2e.mjs` (journey + axe), `scripts/axe-pages.mjs` (pages outside the journey), `scripts/perf.mjs`, `scripts/qa.py`, `scripts/shot.py`.

## Public, admin & demo build (2026-10-08)

### D-026 · Admin uses its own calm kit
The ticket-style `InkButton` is too expressive for a utilitarian admin. Admin has its own buttons and
inputs on the same tokens (paper tones, clean tables, text status chips), per MBP §5.2.

### D-027 · Proposed statuses are flagged in the admin
`assigned`, `sealed`, `revealed` carry a † with a footnote ("proposed, pending O7"); the client agreed
`unassigned`, `claimed`, `filled` (CLIENT_GUIDE §6.6).

### D-028 · Claim submits on Enter or the button, never on the last keystroke
Auto-submitting on the 4th character surprises people mid-correction and would burn rate-limit attempts.

### D-029 · Email copy lives in one module
`lib/email/templates.ts` is used by the mock services and the admin's preview-before-send, so the
preview always matches what's sent. Production renders the same templates server-side.

### D-030 · Demo jumps write real history
Demo Panel state jumps also write audit entries and (for "revealed") a reveal event marked
"Demo Panel (simulated)", so the admin timeline is truthful during the showcase.

### D-019 · Engineering hygiene
One shared dev server during the build (port 3100); agents verify with `scripts/shot.py`
(Playwright Chromium + WebKit at 375×812, DPR 2). `devIndicators` off so screenshots match the showcase.
