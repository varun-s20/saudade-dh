# MASTER BUILD PROMPT — SAUDADE

### Issued by: Senior Product Manager & Lead System Design Engineer

### To: Saudade product team (research, design, architecture, engineering, QA)

---

## 0. READ THIS FIRST

You are being assigned to build **Saudade**, a ceramic NFC keepsake envelope with a companion web app.
Your primary context file is **`CLIENT_GUIDE.md`**. Read it fully before doing anything else.

**Order of authority when instructions conflict:**

1. `CLIENT_GUIDE.md` (client's stated and approved requirements)
2. This prompt (how we work, quality bar, best practices)
3. Your own professional judgement (only where 1 and 2 are silent, and logged in `DECISIONS.md`)

**Never invent client requirements.** If something is unclear, add it to `OPEN_QUESTIONS.md` with a
recommended default, use the default in the prototype, and label it visibly as an assumption.

**Current mission (Phase 0–2):** produce a **complete, high-end, clickable design prototype** of the
entire product for a **client showcase**. Functionality may be **simulated**. It must look, move, and
feel like the finished product on a real phone, and its architecture must let us swap the simulated
layer for the real backend without redesigning or rewriting the UI.

**Later mission (Phase 3+):** production build. For now you only produce the architecture blueprint.

---

## 1. PRODUCT NORTH STAR

> "The physical object is the envelope. The digital experience is the letter inside it."

Every screen is judged against one question: **does this feel like receiving a real, thoughtful
letter, or like using software?** The recipient page must feel like a **discovery, not a dashboard**.
The sender portal must feel like **writing and sealing a letter**, not filling in a form.

Design pillars:

1. **Ceremony.** Opening is a moment. Respect pacing, anticipation, and reveal.
2. **Tactility.** Paper, ink, postmarks, perforations, slight imperfection. Nothing sterile.
3. **Four worlds, one envelope.** Each stamp has its own visual personality inside a unified postal system.
4. **Effortless.** No login for recipients, no friction for senders, phone-first always.
5. **Built to last years.** Calm, timeless, durable. Avoid trend gimmicks that will look dated.

---

## 2. THE TEAM & CAPABILITY ASSIGNMENTS

Operate as the following specialist roles. Each role owns specific deliverables and signs off on its
domain at each review gate. If you are a single agent, work through the roles in sequence and
produce each role's deliverables explicitly.

| Role                              | Capabilities you bring                                                                           | You own                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Product Manager (lead)**        | Scope control, prioritisation, acceptance criteria, client communication, risk management        | `PRD.md`, `OPEN_QUESTIONS.md`, `DECISIONS.md`, review gates, final showcase script |
| **UX Researcher**                 | Competitive teardown, pattern analysis, user journey mapping, emotional design research          | `RESEARCH.md`, journey maps, inspiration board                                     |
| **Brand & Visual Designer**       | Art direction, typography, colour, texture, illustration systems, vintage print and postal craft | Design direction options, design tokens, visual specs, placeholder stamp set       |
| **Motion & Interaction Designer** | Choreography, micro-interactions, physics-based animation, reduced-motion alternatives           | `MOTION_SPEC.md`, first-tap reveal choreography, stamp-open transitions            |
| **UX / Product Designer**         | Information architecture, flows, mobile ergonomics, form and upload UX, empty and error states   | Flow diagrams, screen inventory, wireframes, component specs                       |
| **System Architect**              | Data modelling, state machines, security, media pipelines, NFC and URL strategy, cost modelling  | `ARCHITECTURE.md`, service interfaces, state machine, URL and identifier spec      |
| **Frontend Engineer**             | Next.js, TypeScript, Tailwind, Motion (Framer Motion), Web Audio / MediaRecorder, performance    | Prototype codebase, component library, mock service layer                          |
| **Backend Engineer** (Phase 3)    | Postgres, auth tokens, signed URLs, transcoding, email deliverability, backups                   | API contracts in Phase 2; implementation in Phase 3                                |
| **Accessibility & QA Engineer**   | WCAG 2.2 AA, device testing (iOS Safari, Android Chrome), performance audits, test plans         | `QA_CHECKLIST.md`, device test matrix, audit reports                               |

---

## 3. GOLDEN RULES (NON-NEGOTIABLE)

1. **Follow `CLIENT_GUIDE.md` exactly.** Launch stamps are **Photos, Letter, Voice, Song**. Do **not**
   build video, the drawing canvas, drag-to-reorder, autosave, a custom audio player skin, automatic
   checkout emails, or data export. You may show "Coming soon" placeholders **only if** PM approves
   it for the showcase story.
2. **First-tap reveal is the hero.** Allocate the most design and motion effort here.
3. **Mobile-first.** Design at **375×812** first, then 390, 430, then tablet and desktop. The
   recipient page on desktop should present the envelope beautifully centred, but the phone is primary.
4. **Everything is tokenised.** Colours, type, spacing, radii, shadows, textures, and stamp assets
   come from tokens and a single asset map. The brand will change after launch; a reskin must take
   hours, not days.
5. **Original work only.** Inspiration sites are for studying patterns and quality, **never** for
   copying layouts, illustrations, copy, or assets. Do not reproduce real postage stamps, other
   brands' artwork, or trademarked characters. Placeholder stamps must be original and clearly
   marked `PLACEHOLDER — client artwork pending`.
6. **Licensed assets only.** Fonts from Google Fonts or other OFL sources. Photos for demo content from
   Unsplash or Pexels (record the source in `ASSETS.md`) or generated abstract placeholders. Textures
   must be self-made or CC0.
7. **Simulated, but honest.** Simulated features must behave realistically (latency, progress, errors)
   and sit behind interfaces that the real backend will implement later.
8. **Accessibility and reduced motion are part of the design**, not an afterthought.
9. **Log every assumption.** Use `DECISIONS.md` for choices made and `OPEN_QUESTIONS.md` for anything
   needing the client.

---

## 4. PHASE 0 — RESEARCH & DISCOVERY

**Goal:** understand the emotional space, the competitive landscape, and the best interaction
patterns before drawing a single screen.

### 4.1 Tasks

1. Read `CLIENT_GUIDE.md` twice. Extract every requirement into a traceability table in `PRD.md`
   (ID, requirement, source section, priority, screen(s) affected).
2. Study the inspiration sites below. For each one, capture what to learn, what to avoid, and
   screenshots for the internal board (internal reference only, never shipped).
3. Run a teardown of the closest competitors (TapKeeps, Bardstown gifting, Yoto Make-Your-Own,
   Lovebox, StoryWorth). Map their **giver → setup → recipient** journeys and note friction points.
4. Research the platform constraints that shape design:
   - iPhone background NFC reading (XS and later) shows a notification banner the user must tap, so
     "instant" means "one tap on a banner". Design the help page around this.
   - Android requires NFC to be enabled and the phone unlocked.
   - Browsers block audio autoplay, so the reveal must begin with a user gesture.
   - MediaRecorder output differs between Safari (MP4/AAC) and Chrome (WebM/Opus).
   - In-app browsers (Instagram, Facebook, WhatsApp) often block microphone access.
   - Spotify and Apple Music embeds play a ~30-second preview for logged-out users. Know the Spotify
     iFrame API's playback events.
   - iMessage and WhatsApp link previews fetch URLs, which affects first-open detection.
5. Produce **3 distinct design directions** (moodboard, palette, type pairing, one hero frame each),
   all within the client's brief. For example:
   - **A, "Sun-Bleached Postcard"**: faded terracotta and cream, soft grain, airy
   - **B, "Desk Drawer Ephemera"**: layered collage, tape, postmarks, richer textures
   - **C, "Quiet Letterpress"**: restrained, more whitespace, debossed paper, ink-stamp accents
6. PM selects one direction (or a blend) with written rationale in `DECISIONS.md`. Recommend which
   one to present to the client as primary.

### 4.2 Inspiration sites (study list)

**Reveal & envelope ceremony:** paperlesspost.com, greenvelope.com, jacquielawson.com, punchbowl.com, partiful.com
**Stamps & postal language:** slowly.app (stamp collection and letter-delivery ritual), postcrossing.com, postalmuseum.org
**Direct competitors (NFC / recordable keepsakes):** etsy.com/shop/tapkeeps, bardstownbourbon.com/gifting, yotoplay.com, tonies.com, lovebox.love
**Giver → recipient gifting journeys:** storyworth.com, remento.co, vidday.com, tribute.co, auraframes.com, skylightframe.com
**Letters & handwriting:** feltapp.com, futureme.org, letterloop.co, postable.com
**Voice as an object:** skinmotion.com, hereafter.ai
**Song / vinyl:** vinylmeplease.com
**Aesthetic and craft benchmark:** riflepaperco.com, artifactuprising.com, papier.com, minted.com, sugarpaper.com, smockpaper.com, milkbooks.com, polaroid.com
**Interaction galleries:** awwwards.com (search: paper, letter, stationery), godly.website, mobbin.com (redeem-code, upload, and audio-recording flows), lottiefiles.com (envelope open)

**Dribbble search terms:** envelope opening animation, digital envelope ui, wax seal animation,
postage stamp ui, perforated edge card, postmark design, handwritten letter ui, paper texture web
design, voice message player ui, vintage radio ui, vinyl record player ui, spinning vinyl animation,
polaroid gallery ui, scrapbook web design, redeem code screen, gift card activation ui, empty state
illustration letter, minimal admin dashboard, warm retro ui, tactile web design.

**Pinterest search terms:** vintage postage stamps aesthetic, heart postage stamp, ephemera collage,
vintage postcard design, sun bleached color palette, terracotta cream dusty blue palette, aged paper
texture, airmail envelope, postmark cancellation stamp, wax seal stationery, rubber stamp typography,
hand stamped lettering, saudade aesthetic, long distance love aesthetic.

### 4.3 Phase 0 deliverables

- `PRD.md` (requirements traceability, user stories, acceptance criteria)
- `RESEARCH.md` (findings, competitor journeys, constraint notes, top 15 patterns to adopt, 10 anti-patterns to avoid)
- `DIRECTIONS.md` + 3 direction boards → selected direction recorded in `DECISIONS.md`
- `OPEN_QUESTIONS.md` (start with O1–O8 from the client guide)

**Gate 0:** PM, Visual Designer, and Architect sign off before Phase 1.

---

## 5. PHASE 1 — DESIGN SYSTEM

### 5.1 Design tokens (`/styles/tokens.css` + `tokens.ts`)

- **Colour:** semantic tokens (`--paper`, `--paper-shadow`, `--ink`, `--ink-faded`, `--postmark`,
  `--accent-terracotta`, `--accent-dusty-blue`, `--accent-sage`, `--accent-rose`, `--accent-red`,
  `--success`, `--danger`). Never use raw hex values in components. Every text/background pair must
  meet WCAG AA contrast.
- **Typography (placeholders until the final brand arrives):**
  - Display/serif: e.g. Fraunces or Cormorant Garamond
  - Handwriting for the letter: a **legible** script (e.g. Caveat or Kalam) with a defined fallback.
    Minimum 18px, generous line-height. Test long letters and non-Latin characters.
  - Postal/typewriter accent: e.g. Special Elite or IBM Plex Mono, for postmarks, codes, and labels
  - UI sans: e.g. Inter or DM Sans, for the admin and small UI only
- **Spacing, radius, elevation, z-index, and motion durations/easings** as tokens.
- **Textures:** paper grain (SVG `feTurbulence` noise or optimised WebP under 40KB), subtle fibre,
  light foxing. Use them sparingly; they must not hurt legibility or performance.

### 5.2 Signature component primitives

- **`<StampFrame>`**: perforated edge via CSS mask (radial-gradient), slight rotation jitter,
  drop shadow, optional postmark overlay. Accepts client artwork through the asset map.
- **`<Postmark>`**: circular or wavy cancellation mark with date and place text, slight ink
  imperfection.
- **`<PaperSheet>`**: aged stationery surface with optional ruled lines and torn or deckled edge.
- **`<Envelope>`**: closed, opening, and open states; flap, liner, and seal layers for animation.
- **`<PhotoMount>`**: snapshot with worn border and corner mounts.
- **`<Vinyl>`**: record with label art, spin state, and a tonearm that drops and lifts.
- **`<VoiceObject>`**: voice stamp visual (radio, gramophone, or sound-wave postmark) with a
  simple, accessible player.
- **`<InkButton>`, `<StampedInput>`, `<CodeInput>`** (segmented, auto-uppercase, ambiguous
  characters rejected), **`<UploadTile>`**, **`<ProgressStamp>`**, **`<Toast>`**, **`<Sheet>`** (bottom sheet).
- **Admin kit**: deliberately calmer and more utilitarian, but still on-brand (paper tones, clean
  tables, status chips).

### 5.3 Stamp asset map (`/config/stamps.ts`)

A single source mapping `photos | letter | voice | song` to artwork, accent colour, label, and the
motif used inside the opened view. The client's artwork will replace the placeholders **only here**.

### 5.4 Phase 1 deliverables

- Tokens + documented component library (Storybook or a `/design-system` route in the prototype)
- `MOTION_SPEC.md` (principles, durations, easings, reduced-motion equivalents)
- Placeholder stamp set (original, 4 stamps + heart seal), clearly labelled

**Gate 1:** visual QA of the component library on a real iPhone and a real Android phone.

---

## 6. PHASE 2 — CLIENT SHOWCASE PROTOTYPE (MAIN DELIVERABLE)

### 6.1 Tech stack (prototype, kept production-compatible)

- **Next.js (App Router) + TypeScript (strict)**
- **Tailwind CSS** wired to CSS-variable tokens
- **Motion (Framer Motion)** for choreography; CSS for simple transitions
- **Zustand** for state, persisted to **localStorage**; **IndexedDB** (via `idb-keyval`) for photo and audio blobs
- **Real client-side features where cheap:** real photo selection and compression
  (`browser-image-compression`), real in-browser voice recording (MediaRecorder) with playback,
  real Spotify / Apple Music link parsing and embed
- **Mock service layer:** all data access goes through interfaces in `/lib/services/*`
  (`UnitService`, `ContentService`, `MediaService`, `RevealService`, `AdminService`, `EmailService`).
  Phase 2 ships `mock` implementations with realistic latency (300–900ms) and injectable errors.
  Phase 3 swaps in `api` implementations with **zero UI changes**.
- Deployed to a **Vercel preview URL** for the client.

### 6.2 Demo mode (critical for the showcase)

A discreet floating **Demo Panel** (toggle with `?demo=1` or a triple-tap on the logo) that lets the
presenter:

- Jump between unit states: `unclaimed → claimed/draft → filled → sealed → revealed`
- Simulate the **first tap** vs a **repeat visit** vs an **empty envelope**
- Simulate a **sender preview** (must not trigger the first-tap reveal)
- Trigger error states: invalid code, already claimed, rate limited, upload failed, mic denied, in-app browser
- Load the **sample filled envelope** or reset everything
- Toggle reduced motion

Seed demo codes: `SAUD-3K7M` (valid, unclaimed), `SAUD-9PXR` (already claimed), `SAUD-0000` (invalid).

### 6.3 Screen inventory & specs

Each screen needs: purpose, entry points, states (default, loading, empty, error, success),
mobile and desktop layouts, copy, and acceptance criteria. Minimum set:

**A. Public / entry**

1. `/` — **Brand entry** (minimal, optional for the showcase): a quiet hero with the envelope,
   "Fill your envelope", "Claim your code", and "How it works" in 3 steps.
2. `/claim` — **Code entry**: segmented `<CodeInput>`, helper "Find your code on the card in your
   box, or in your email", inline errors, and a rate-limit message. Success animates like a stamp
   being pressed.
3. `/claim/success` — "Your envelope is yours." Shows the private link, **Save this link** /
   **Email it to me** (captures email per O6), and **Start filling →**.
4. `/recover` — "Lost your link?" Enter email, then a simulated magic link.
5. `/help/tap` — **How to tap**: iPhone (tap the banner that appears), Android (NFC on, unlocked),
   fallback QR mention, friendly illustration.
6. `/privacy`, `/terms` — styled templates with clearly marked placeholder text. **Do not write legal text.**

**B. Sender portal (`/s/[token]`)** 7. **Portal home**: the envelope with four stamp slots. Each slot shows its fill state (empty
outline → filled stamp with postmark). Shows the recipient-facing unit status (draft / sealed /
opened). Primary actions: **Preview**, **Seal & send**. 8. **Photos editor**: upload up to 15 (counter "7 / 15"), real compression with a progress stamp,
remove, per-photo caption [PROPOSED, optional], and a clear limit-reached state.
(No drag-to-reorder; it is deferred.) 9. **Letter editor**: writing surface that already looks like the final handwritten stationery
(what you see is what they get), character counter (~2,000 [PROPOSED]), "Dear \_\_\_" and sign-off
fields [PROPOSED]. 10. **Voice editor**: big record button, live waveform, 3:00 limit with countdown, playback,
re-record, upload alternative. States for mic denied and in-app browser ("Open in Safari/Chrome"). 11. **Song editor**: paste-link field, real-time parsing for Spotify and Apple Music (including
short links), a preview card with track info and the vinyl, error for unsupported links, and
the note "Listeners not logged in hear a 30-second preview." 12. **Save** behaviour: explicit Save button on each editor, with an unsaved-changes guard and a
success toast ("Sealed with care"). 13. **Preview** (`/s/[token]/preview`): shows the recipient view inside a clear "Preview — this
doesn't count as their first open" frame. Includes a "Replay reveal" button for the sender. 14. **Seal & send** [PROPOSED, per O7]: a ceremony screen (wax seal press) explaining that the next
tap on the ceramic triggers the reveal; sender can keep editing afterwards.

**C. Recipient experience (`/t/[slug]`) — the hero** 15. **First-tap reveal** — see the choreography in §6.4. 16. **Envelope (repeat visit)**: opens calmly straight to the envelope with stamps placed. Stamps
updated since the last visit get a small "new" postmark [PROPOSED]. 17. **Stamp views** (full-screen sheet or page-turn transition, each its own "world"): - Photos: snapshot stack / album with swipe and pinch-zoom; captions if present - Letter: aged paper, handwriting, gentle scroll, readable at any length - Voice: voice-stamp object, play/pause, scrubber, duration, accessible labels - Song: vinyl spins and the tonearm drops when playing (synced via the Spotify iFrame API where
available; spins on play for Apple), with the official embed below and an "Open in app" link 18. **Empty / still being written**: sealed envelope with "Your letter is still being written ✉"
and a soft postmark date. 19. **Not found / unavailable**: gentle, on-brand, with a link to help.

**D. Admin (`/admin`)** 20. **Login** (simulated). 21. **Dashboard**: counts by status, recent activity, quick search. 22. **Units table**: code, slug, status chip, sender email, last updated, filters, search. 23. **Unit detail**: content overview (view/remove each item), status timeline, **Reset code**,
**Reset reveal** [PROPOSED], **Email code** (manual Path B send with an email preview), and an
audit-log list. 24. **Batch / provisioning**: "Generate batch", preview, and **Download CSV** (`code, slug, url`)
using mock data with the correct shape.

### 6.4 First-tap reveal choreography (Motion spec, starting point)

Total ~6–9s, skippable after 1.5s, never blocking.

| t (s)  | Beat                                                                                                                                                                                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.0    | Paper background fades in from warm cream; subtle grain settles.                                                                                                                               |
| 0.4    | Closed envelope slides up, settling with a slight overshoot; the heart seal glows softly (mirrors the ceramic tap zone).                                                                       |
| 1.2    | Prompt: "Someone who misses you sent this." + **Tap to open** (a user gesture that also unlocks audio).                                                                                        |
| on tap | Seal "lifts" (scale + rotate), the flap opens in 3D (`rotateX`), the liner is revealed.                                                                                                        |
| +0.8   | Letter surface rises out of the envelope and expands to fill the screen.                                                                                                                       |
| +1.4 → | Stamps are placed **one by one** (~350ms stagger): each drops in with a slight random rotation, lands with a soft "press", and a postmark ink-stamps over it. Only stamps with content appear. |
| end    | Settled envelope view; a soft hint "Tap a stamp to open it."                                                                                                                                   |

Rules:

- Mark the reveal as "seen" **only after** the choreography completes on the client. Never on page load.
- `prefers-reduced-motion`: a crossfade sequence with stamps fading in place, no 3D or overshoot.
- Optional subtle paper/seal sound **only after** the user gesture, with a mute toggle [PROPOSED].
- Target 60fps on a mid-range Android phone; animate only `transform` and `opacity`.

### 6.5 Copy voice

Warm, brief, human, a little poetic, never cute or salesy. Second person. Use postal metaphors
naturally (seal, postmark, envelope) and never in error messages that need clarity.
Example: "This code has already found its envelope. If that's yours, check your email for your link."

### 6.6 Sample demo content

A fictional sender **"Mira"** writing to **"Theo"**, who lives far away: 6 licensed photos, a
~180-word letter, a short recorded voice clip (record your own, or a silent placeholder with a
waveform), and one song link. Keep it tasteful and universal (friendship or family, not only romance).

### 6.7 Phase 2 deliverables

- Deployed preview URL + repository
- All screens in §6.3 with all states reachable through the Demo Panel
- `SHOWCASE_SCRIPT.md`: a 5–7 minute walkthrough (claim → fill → preview → seal → first tap → repeat visit → admin)
- A screen recording of the full flow on an actual phone
- Updated `OPEN_QUESTIONS.md` for the client meeting

**Gate 2:** internal review against the §8 quality bar, then client showcase.

---

## 7. PHASE 3 BLUEPRINT — PRODUCTION ARCHITECTURE (document now, build after approval)

Produce `ARCHITECTURE.md` covering:

- **Stack:** Next.js on Vercel (client-owned account); Postgres (Neon or Supabase) with Drizzle or
  Prisma; Cloudflare R2 (S3-compatible, no egress fees, versioning enabled) + CDN; Resend or
  Postmark email with SPF/DKIM/DMARC on the client's domain.
- **Identifiers:** two unrelated random values per unit:
  - `activation_code` (sender, printed or emailed, stored **hashed**), format `SAUD-XXXX[-XXXX]` from
    an unambiguous alphabet, with enough entropy that guessing is infeasible under rate limiting
  - `nfc_slug` (recipient, encoded on the chip), 10–16 chars base32. The URL must fit NTAG213 easily,
    e.g. `https://{client-domain}/t/{slug}`. **Never encode a provider domain.**
  - `sender_token` (private edit link), high entropy, stored hashed, revocable
- **Unit state machine:** `unassigned → assigned(path A|B) → claimed → filled → sealed → revealed`,
  with admin transitions (reset code, reset reveal) recorded in `audit_log`.
- **Data model:** `units`, `sender_sessions`, `contents` (type, payload, position, version),
  `media` (r2_key, mime, bytes, duration, version), `reveal_events`, `admin_users`, `audit_log`.
- **Media pipeline:** client-side compression → presigned upload → server validation → images
  normalised (HEIC→JPEG/WebP, EXIF orientation applied, **GPS and EXIF stripped**) → audio
  transcoded to AAC/m4a → short-lived signed CDN URLs.
- **First-open integrity:** reveals are recorded client-side after the animation; known
  bot/link-preview user-agents ignored; sender-token holders excluded; the sender preview uses a
  separate route.
- **Security:** rate limiting on `/claim`, `/t/*`, and `/recover`; `noindex` + `X-Robots-Tag`; CSP;
  admin auth with strong passwords + 2FA [PROPOSED]; no PII in URLs.
- **Durability:** daily automated DB backups with a tested restore; R2 versioning; a documented
  disaster-recovery runbook.
- **Song:** store the parsed provider, track ID, title, and artist so the stamp degrades gracefully
  if a track is removed.
- **Cost model:** per-unit lifetime storage at the agreed caps; monthly estimates at 300 and 3,000 units.
- **Future-ready (not built):** Shopify/Stripe webhook for automatic code emails, video, drawing
  canvas, data export, rebrand reskin.
- **Physical notes for the client:** lock each NFC tag after encoding; embed chips after kiln firing;
  test read range through the glaze.

---

## 8. QUALITY BAR

**Design quality**

- Passes the "letter, not software" test on every recipient-facing screen.
- Each stamp's opened view feels like its own world while clearly belonging to the same envelope.
- No default browser controls visible on recipient screens (except the official music embed).
- Typography is legible at arm's length on a phone; the letter is readable in sunlight.

**Performance (recipient route `/t/[slug]`)**

- LCP < 2.5s on a throttled 4G profile; CLS < 0.05; INP < 200ms
- JS for the initial route ≤ ~150KB gzipped; stamp contents lazy-loaded
- Textures and images in modern formats, responsive `srcset`, preloaded only when critical

**Accessibility (WCAG 2.2 AA)**

- Stamps are real buttons with descriptive labels ("Open voice message from Mira, 1 minute 12 seconds")
- Full keyboard and screen-reader paths; visible focus states styled on-brand
- Reduced-motion variant for every animation
- Touch targets ≥ 44×44px

**Device matrix (must test on real hardware)**

- iPhone (Safari, current and previous iOS), including a non-Pro model
- Android mid-range (Chrome), plus Samsung Internet
- In-app browsers: Instagram, WhatsApp, Gmail
- Desktop Chrome, Safari, and Firefox for the admin

**Code quality**

- TypeScript strict, ESLint + Prettier, no `any` in service interfaces
- Components small and documented; tokens only, no magic numbers
- `README.md` with setup, the demo-mode guide, and the folder map

---

## 9. REPOSITORY STRUCTURE (target)

```
/docs
  CLIENT_GUIDE.md  PRD.md  RESEARCH.md  DIRECTIONS.md  DECISIONS.md
  OPEN_QUESTIONS.md  MOTION_SPEC.md  ARCHITECTURE.md  QA_CHECKLIST.md
  SHOWCASE_SCRIPT.md  ASSETS.md
/app
  (public)/page.tsx  claim/  recover/  help/tap/  privacy/  terms/
  s/[token]/  (home, photos, letter, voice, song, preview, seal)
  t/[slug]/   (reveal, envelope, stamp views)
  admin/      (login, dashboard, units, units/[id], batch)
  design-system/
/components
  envelope/  stamps/  paper/  media/  forms/  admin/  demo/
/config     stamps.ts  site.ts
/lib
  services/  (interfaces + mock/ + api/ placeholders)
  state/  utils/  parsing/ (song links, codes)
/styles     tokens.css  globals.css  textures/
/public     placeholders/  textures/  demo/
```

---

## 10. WORKFLOW, TIMELINE & GATES

| Window (target) | Phase                          | Exit criteria                                       |
| --------------- | ------------------------------ | --------------------------------------------------- |
| Day 1–2         | Phase 0: Research & directions | Gate 0 signed, direction chosen                     |
| Day 3–4         | Phase 1: Design system         | Component library reviewed on real devices          |
| Day 5–9         | Phase 2: Showcase prototype    | All screens and states, deployed, script ready      |
| Day 10          | Client showcase                | Feedback captured; revision round 1 logged          |
| After approval  | Phase 3: Production build      | Per `ARCHITECTURE.md`, aligned to the 21 Nov launch |

**Parallel critical-path task for the PM and Architect (week 1, independent of design):** confirm
the domain (O2) and encoding date (O3), finalise the identifier and URL spec, and be ready to
generate the 300-unit CSV. The ceramics cannot wait for the UI.

Daily: a short written stand-up in `docs/STANDUP.md` (done / next / blocked).
Weekly: a client-facing progress update drafted by the PM.

---

## 11. DEFINITION OF DONE (SHOWCASE)

- [ ] Every requirement in `CLIENT_GUIDE.md` §5–§6 maps to at least one screen or state in `PRD.md`
- [ ] Deferred items are absent (or shown only as PM-approved "coming soon" teasers)
- [ ] First-tap reveal, repeat visit, empty envelope, and sender preview all demonstrable and distinct
- [ ] Real photo compression, real voice recording, and real song-link embed work on iPhone and Android
- [ ] Demo Panel reaches every state and error listed in §6.2
- [ ] Tokens drive all styling; placeholder stamps are swappable from `/config/stamps.ts` alone
- [ ] Reduced-motion and screen-reader passes completed
- [ ] Performance budget met on the recipient route
- [ ] `SHOWCASE_SCRIPT.md`, the screen recording, and the updated `OPEN_QUESTIONS.md` are ready
- [ ] No copied assets; `ASSETS.md` lists the source and licence of every font, photo, and texture

---

## 12. WHAT NOT TO DO

- Don't make it look like a SaaS dashboard, a social feed, or a generic template.
- Don't add accounts or logins for senders or recipients.
- Don't build checkout or payments (open question O1) unless the PM confirms with the client.
- Don't write legal text.
- Don't hard-code colours, fonts, or stamp art.
- Don't trigger the first-tap reveal on page load, link previews, or sender preview.
- Don't encode or suggest provider URLs (`*.vercel.app`) for the NFC chips.
- Don't copy any inspiration site's design, illustrations, or copy.

---

**Start now with Phase 0. Your first output is `PRD.md` (requirements traceability) and
`RESEARCH.md`. After that, present three design directions for Gate 0.**
