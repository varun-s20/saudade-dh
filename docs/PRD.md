# PRD — Saudade (Phase 0–2: client showcase prototype)

**Owner:** Product Manager · **Status:** v1.0, Gate 0 · **Last updated:** 2026-10-08
**Sources:** `CLIENT_GUIDE.md` (authority #1), `MASTER_BUILD_PROMPT.md` (authority #2), `DECISIONS.md` (our judgement, logged)

> "The physical object is the envelope. The digital experience is the letter inside it."
> Every recipient-facing screen must pass the **letter, not software** test.

---

## 1. Goal of this phase

Build a **complete, high-end, clickable prototype** of the whole product for a client showcase:

- Looks, moves, and feels like the finished product on a real phone.
- Functionality may be simulated, but simulated features behave realistically (latency, progress,
  errors) and sit behind service interfaces (`/lib/services/*`) so Phase 3 can swap in the real
  backend with **zero UI changes**.
- Real where it is cheap: photo selection + compression, in-browser voice recording, Spotify / Apple
  Music link parsing and official embeds, CSV generation.

**Out of this phase:** the production backend (blueprint only, in `ARCHITECTURE.md`), payments (O1),
and every item in §6 "Deferred".

## 2. Users

| User | Job to be done | Access |
|---|---|---|
| **Sender** (buyer) | "Help me say *I miss you* to someone far away in a way they can keep." | Activation code → private tokenised link. No account. |
| **Recipient** | "Let me open it, feel it, and come back to it." | Taps the ceramic's NFC heart → `/t/{slug}`. No login, app, or download. |
| **Admin** (Zeya + developer) | "Let me track units, send gift codes, and fix problems." | Secure admin login. |

## 3. Requirements traceability

Priority key: **P0** = client launch priority / non-negotiable · **P1** = agreed requirement ·
**P2** = team proposal (`[PROPOSED]`, needs client approval) · **—** = not in this build.
Prototype key: **Real** = genuinely works in the browser · **Sim** = simulated behind a service
interface · **Doc** = documented for Phase 3 only.

### 3.1 Product & visual

| ID | Requirement | Source | Pri | Proto | Screen(s) |
|---|---|---|---|---|---|
| R-01 | Recipient page feels like a discovery, not a dashboard | CG §2, §12 | P0 | Real | S15–S19 |
| R-02 | "Four small, different worlds on one page", unified by a vintage postal aesthetic | CG §2 | P0 | Real | S16, S17 |
| R-03 | Vintage postcards, hand-stamped type, warm imperfect textures. **Not** clean/corporate/tech | CG §3 | P0 | Real | All |
| R-04 | Warm sun-bleached palette: terracotta, cream, dusty blues, greens, pinks, reds | CG §3 | P1 | Real | Tokens |
| R-05 | Recipient page = envelope covered in vintage stamps; each stamp = a content type; tap opens it | CG §3 | P0 | Real | S16, S17 |
| R-06 | Paper textures, postmarks, perforated edges | CG §3 | P1 | Real | Components |
| R-07 | Client-supplied stamp artwork; original placeholders until it arrives, marked `PLACEHOLDER — client artwork pending` | CG §1, §3 | P1 | Real | `/config/stamps.ts` |
| R-08 | Colours, fonts, motifs swappable (design tokens) — rebrand follows in ~Dec | CG §3, §10 | P0 | Real | Tokens, asset map |

### 3.2 Activation codes (client priority #1)

| ID | Requirement | Source | Pri | Proto | Screen(s) |
|---|---|---|---|---|---|
| R-10 | Unique activation code per unit, e.g. `SAUD-3K7M`; case-insensitive; no 0/O, 1/I/L | CG §6.1 | P0 | Real (format) / Sim (lookup) | S2 |
| R-11 | Codes never expire | CG §2, §5 | P0 | Sim | S2, S7 |
| R-12 | Path A: printed card in box → buyer claims on site → private link | CG §6.1 | P0 | Sim | S2, S3 |
| R-13 | Path B: code emailed to buyer, no card in box; admin sends manually for first 300 | CG §6.1 | P0 | Sim | S23 |
| R-14 | Brute-force protection / rate limiting | CG §6.1 | P0 | Sim (UI) / Doc | S2 |
| R-15 | Clear messages for invalid and already-claimed codes | CG §6.1 | P0 | Sim | S2 |
| R-16 | Sender email captured at claim for link recovery `[PROPOSED, O6]` | CG §11 O6 | P2 | Sim | S3, S4 |

### 3.3 Sender portal (client priority #2)

| ID | Requirement | Source | Pri | Proto | Screen(s) |
|---|---|---|---|---|---|
| R-20 | Private link, no account or password | CG §4, §6.2 | P0 | Sim | S7 |
| R-21 | Edit, add, remove content any time, before or after gifting | CG §6.2 | P0 | Sim | S7–S12 |
| R-22 | Explicit **Save** button (autosave deferred) + unsaved-changes guard | CG §6.2, §10 | P1 | Real | S8–S12 |
| R-23 | Fully usable on a phone (mobile-first) | CG §6.2 | P0 | Real | All sender |
| R-24 | **Photos:** up to 15, auto-compressed for mobile | CG §6.3 | P0 | Real | S8 |
| R-25 | **Letter:** looks like real handwriting on stationery; good short or long | CG §6.3 | P0 | Real | S9, S17 |
| R-26 | **Voice:** record in browser **or** upload; ≤ 3:00; re-record/replace any time | CG §6.3 | P0 | Real | S10 |
| R-27 | **Song:** paste a Spotify or Apple Music link | CG §6.3 | P0 | Real | S11 |
| R-28 | Sender preview of the recipient view, which **never** counts as the first open | CG §6.4, §10 | P0 | Real | S13 |
| R-29 | "Seal & send" step that arms the first-tap reveal `[PROPOSED, O7]` | CG §11 O7 | P2 | Sim | S14 |
| R-30 | Per-photo caption `[PROPOSED]` | MBP §6.3 | P2 | Real | S8, S17 |
| R-31 | Letter "Dear ___" + sign-off fields, ~2,000 char limit `[PROPOSED]` | MBP §6.3 | P2 | Real | S9 |

### 3.4 First-tap reveal & recipient page (client priorities #3, #4)

| ID | Requirement | Source | Pri | Proto | Screen(s) |
|---|---|---|---|---|---|
| R-40 | On the **first** tap the envelope opens and stamps appear **one by one** | CG §6.4 | P0 | Real | S15 |
| R-41 | After that, the page opens calmly straight to the envelope | CG §6.4 | P0 | Real | S16 |
| R-42 | Sender preview does not count as the first open | CG §6.4 | P0 | Real | S13 |
| R-43 | Opens from the NFC tap; no login, app, or download | CG §6.5 | P0 | Real | S15–S19 |
| R-44 | Envelope layout built around the stamp artwork | CG §6.5 | P0 | Real | S16 |
| R-45 | Each stamp opens its content in a clean, simple view | CG §6.5 | P0 | Real | S17 |
| R-46 | Photos view: snapshot / worn postcard border / photo-album corner mounts | CG §6.3 | P1 | Real | S17 |
| R-47 | Voice view: simple clean player; motif radio / gramophone / sound-wave postmark | CG §6.3 | P1 | Real | S17 |
| R-48 | Song view: rotating vintage vinyl + **official** Spotify / Apple Music embed; ~30 s preview accepted | CG §6.3 | P0 | Real | S17 |
| R-49 | Sender edits appear automatically | CG §6.5 | P1 | Sim | S16 |
| R-50 | Fast on mobile data; reliable on iPhone Safari + Android Chrome | CG §6.5 | P0 | Real | S15–S19 |
| R-51 | Stays live for years | CG §6.5 | P0 | Doc | — |
| R-52 | Empty / "still being written" state `[PROPOSED, O7]` | CG §11 O7 | P2 | Real | S18 |
| R-53 | "New" postmark on stamps updated since last visit `[PROPOSED]` | MBP §6.3 | P2 | Real | S16 |

### 3.5 Admin

| ID | Requirement | Source | Pri | Proto | Screen(s) |
|---|---|---|---|---|---|
| R-60 | Secure admin login | CG §6.6 | P0 | Sim | S20 |
| R-61 | All units with status: unassigned, claimed, filled (+ `sealed`, `revealed` `[PROPOSED]`) | CG §6.6 | P0 | Sim | S21, S22 |
| R-62 | Search by code or email | CG §6.6 | P0 | Sim | S22 |
| R-63 | Email codes manually for gift orders (Path B) | CG §6.1, §6.6 | P0 | Sim | S23 |
| R-64 | Reset a lost or compromised code | CG §6.6 | P0 | Sim | S23 |
| R-65 | View or remove content for support | CG §6.6 | P0 | Sim | S23 |
| R-66 | Reset reveal `[PROPOSED]` | MBP §6.3 | P2 | Sim | S23 |

### 3.6 NFC & provisioning

| ID | Requirement | Source | Pri | Proto | Screen(s) |
|---|---|---|---|---|---|
| R-70 | 300 unique, non-sequential, non-guessable identifiers in one batch | CG §6.7 | P0 | Real (generator) | S24 |
| R-71 | CSV with the exact URL per unit for the NFC encoding run | CG §6.7 | P0 | Real (shape) | S24 |
| R-72 | Compatible with NTAG213/215 | CG §6.7 | P0 | Doc | `ARCHITECTURE.md` |
| R-73 | Each chip carries a unique identifier linking to its content page | CG §6.7 | P0 | Real | S15 |
| R-74 | Fallback QR for phones without background NFC `[OPEN, O8]` | CG §11 O8 | P2 | Mention only | S5 |

### 3.7 Privacy, security, durability, platform

| ID | Requirement | Source | Pri | Proto | Where |
|---|---|---|---|---|---|
| R-80 | Long random URLs with no pattern between units | CG §7 | P0 | Real | ID generator |
| R-81 | Pages hidden from search engines | CG §7 | P0 | Real | `robots`, `noindex` meta |
| R-82 | Photos/audio via signed private links | CG §7 | P0 | Doc | `ARCHITECTURE.md` |
| R-83 | Forwarded link works (accepted); no PIN | CG §7 | P1 | Real | — |
| R-84 | Daily DB backups; durable storage; file versioning | CG §8 | P0 | Doc | `ARCHITECTURE.md` |
| R-85 | Next.js + Postgres + S3-compatible + CDN, client-owned accounts, TypeScript, documented | CG §9 | P0 | Real (Next/TS) / Doc | Repo |
| R-86 | Styled Privacy + Terms pages; wording from client | CG §10 | P1 | Real (placeholder text) | S6 |
| R-87 | Payment / checkout | CG §5 #5 | — | **Not built (O1)** | — |

## 4. Deferred — must be absent from the prototype

Drawing canvas · video · autosave and live preview (the sender **preview** of the reveal page is still
required) · drag-to-reorder photos · custom animated audio player skin · automatic code emails at
checkout · full data export. **No "coming soon" teasers** (see `DECISIONS.md` D-014).

## 5. Screen inventory

| # | Route | Screen | Key states |
|---|---|---|---|
| S1 | `/` | Brand entry | default |
| S2 | `/claim` | Code entry | empty, typing, ambiguous-char hint, validating, invalid, already claimed, rate limited, success (stamp press) |
| S3 | `/claim/success` | "Your envelope is yours." | default, email sent, copy success |
| S4 | `/recover` | Lost your link? | default, sending, sent (simulated magic link), unknown email (same message, no enumeration) |
| S5 | `/help/tap` | How to tap | iPhone, Android, fallback |
| S6 | `/privacy`, `/terms` | Legal templates | placeholder text clearly marked |
| S7 | `/s/[token]` | Portal home: envelope + 4 slots | loading, empty, partially filled, filled, sealed, opened, invalid token |
| S8 | `/s/[token]/photos` | Photos editor | empty, compressing (progress stamp), n/15, limit reached, upload failed, unsaved, saved |
| S9 | `/s/[token]/letter` | Letter editor | empty, typing, near limit, unsaved, saved |
| S10 | `/s/[token]/voice` | Voice editor | idle, requesting mic, recording (waveform + countdown), recorded, playing, uploading, mic denied, in-app browser, file too long |
| S11 | `/s/[token]/song` | Song editor | empty, parsing, preview card, unsupported link, saved |
| S12 | (all editors) | Save behaviour | Save, unsaved guard, "Sealed with care" toast |
| S13 | `/s/[token]/preview` | Sender preview | framed "Preview — this doesn't count as their first open", replay reveal |
| S14 | `/s/[token]/seal` | Seal & send ceremony | ready, pressing, sealed, nothing-to-seal |
| S15 | `/t/[slug]` | First-tap reveal | intro, tap-to-open, opening, stamps placing, settled; reduced motion |
| S16 | `/t/[slug]` | Envelope (repeat visit) | settled, "new" postmarks |
| S17 | `/t/[slug]` (sheet) | Stamp views: Photos, Letter, Voice, Song | loading, content, media error |
| S18 | `/t/[slug]` | Still being written | default |
| S19 | `/t/[slug]` | Not found / unavailable | default |
| S20 | `/admin` | Admin login | default, wrong password, signing in |
| S21 | `/admin/dashboard` | Dashboard | counts, recent activity, quick search |
| S22 | `/admin/units` | Units table | filters, search, empty results |
| S23 | `/admin/units/[id]` | Unit detail | content overview, timeline, reset code, reset reveal, email code (preview), remove item, audit log |
| S24 | `/admin/batch` | Batch provisioning | generate, preview, download CSV |
| — | `/design-system` | Tokens, components, stamps, the three directions | — |

## 6. User stories & acceptance criteria

### Sender

**US-1 Claim (Path A).** As a buyer with a code card, I want to enter my code and get a private
link so I can fill my envelope.
- Code input is segmented, auto-uppercases, accepts paste of `saud3k7m`, `SAUD-3K7M`, or `3k7m`.
- Characters `0 O 1 I L` are refused at the keystroke with a friendly hint (they are never in a code).
- `SAUD-3K7M` → stamp-press success → `/claim/success` with the private link.
- `SAUD-9PXR` → "This code has already found its envelope. If that's yours, check your email for your link."
- Unknown well-formed code → "We can't find that code. Check the card in your box, or the email we sent you."
- Rate-limited (Demo Panel) → a calm wait message with a countdown; no input lost.

**US-2 Keep my link.** As a sender, I want to save my link and optionally have it emailed so I don't lose access.
- Copy-link and "Email it to me" both work; email is optional and explained ("only used to send you this link").
- `/recover` always shows the same confirmation whether or not the email is known (no account enumeration).

**US-3 Fill the four stamps.** As a sender on my phone, I want to add photos, a letter, a voice note and a song.
- Photos: pick up to 15; real compression with a progress stamp; counter "n / 15"; remove; optional caption; limit state at 15.
- Letter: the editor surface looks like the final stationery (WYSIWYG); counter near 2,000; Dear/sign-off optional.
- Voice: record with live waveform and 3:00 countdown that auto-stops; play back; re-record; or upload an audio file ≤ 3:00. Mic-denied and in-app-browser states explain how to fix it.
- Song: paste a Spotify or Apple Music link (incl. short links); a preview card with title/artist and the vinyl; clear error for unsupported links; note about 30-second previews.
- Every editor has an explicit Save; leaving with unsaved changes asks first; saving shows "Sealed with care".

**US-4 Preview without spoiling.** As a sender, I want to see exactly what they'll see, without using up their first open.
- Preview is visibly framed: "Preview — this doesn't count as their first open".
- "Replay reveal" plays the full choreography; the unit's reveal state is unchanged afterwards (verifiable in admin).

**US-5 Seal & send.** As a sender, I want a moment that says "it's ready".
- Wax-seal press ceremony; explains the next tap on the ceramic triggers the reveal; editing stays possible.
- With nothing filled yet, the seal is unavailable with a gentle reason.

### Recipient

**US-6 First tap.** As a recipient tapping for the first time, I want the envelope to open for me.
- Nothing happens before my gesture: intro → "Tap to open" → seal lifts, flap opens, letter rises, stamps placed one by one with postmarks (only stamps with content).
- Skippable after 1.5 s. Reveal is recorded **only after** the choreography completes (or is skipped), never on page load.
- Reduced motion → crossfade sequence, stamps fade in place, no 3D or overshoot.

**US-7 Coming back.** As a recipient returning later, I want it to open calmly, and to notice what's new.
- Repeat visit goes straight to the settled envelope. Stamps updated since my last visit carry a small "new" postmark.

**US-8 Open a stamp.** As a recipient, I want each stamp to feel like its own little world.
- Photos: snapshot stack/album, swipe, pinch-zoom, captions.
- Letter: aged paper, handwriting, gentle scroll, readable at any length.
- Voice: voice object, play/pause, scrubber, duration; accessible labels.
- Song: vinyl spins and the tonearm drops while playing (Spotify via iFrame API events; Apple on play), official embed below, "Open in app" link.

**US-9 Too early.** As a recipient who taps before the sender is done, I see "Your letter is still being written ✉" — and my first-open moment is preserved for later.

### Admin

**US-10 Find and fix.** As the admin, I want to find a unit by code or email, see its status and content, and fix problems.
- Dashboard counts by status; units table with status chips, filters, and search; unit detail with timeline, content (view/remove), reset code, reset reveal, email code (with an email preview), audit log.
- Every admin action appears in the audit log.

**US-11 Provision a batch.** As the admin, I want to generate 300 identifiers and download the CSV for the encoding run.
- Generate N units (default 300), preview the first rows, download `code,slug,url` CSV. Codes and slugs are random, unique, non-sequential.

## 7. Non-functional acceptance (from MBP §8)

- Recipient route `/t/[slug]`: LCP < 2.5 s on throttled 4G, CLS < 0.05, INP < 200 ms, initial JS ≲ 150 KB gz, stamp contents lazy-loaded.
- WCAG 2.2 AA: stamps are real buttons with descriptive labels; keyboard + screen reader paths; on-brand focus rings; touch targets ≥ 44×44; reduced-motion variant for every animation.
- Tokens only: no raw hex in components; stamp art swappable from `/config/stamps.ts` alone.
- No default browser controls on recipient screens except the official music embed.

## 8. Success measures for the showcase

1. Client says the first-tap reveal "feels like opening a letter" (qualitative, captured in revision log).
2. Presenter completes `SHOWCASE_SCRIPT.md` (claim → fill → preview → seal → first tap → repeat → admin) in ≤ 7 min without dead ends.
3. Every Demo Panel state reachable; zero console errors during the run.
4. All P0 rows above marked Real or Sim are demonstrable.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Domain (O2) / encoding date (O3) not confirmed | Chips encoded with wrong URL = permanent | PM chases in week 1; CSV generator ready; never encode a provider domain |
| Stamp artwork late (O4) | Reveal page not final for launch | Asset map isolates art; placeholders are production-quality |
| 4-char codes guessable at scale | Code hijack | Recommend `SAUD-XXXX-XXXX` for production (O9) + rate limiting |
| Sender never seals | Recipient stuck on "still being written" | Prominent Seal prompt in portal; admin can seal; config flag if O7 rejected |
| In-app browsers block mic | Sender can't record | Detect + "Open in Safari/Chrome" + upload alternative |
| Link-preview bots burn the reveal | First moment lost | Reveal recorded client-side after animation only |
