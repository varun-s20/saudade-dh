# Launch readiness: every requirement, its status, and what's left

**As of 16 October 2026** (launch: 21 November 2026). Checked line by line against `CLIENT_GUIDE.md`, the source
of truth for the contract (the $1,000 offer; it supersedes the earlier proposal's plans, STANDUP 9 Oct).

| Status | Meaning |
| --- | --- |
| **Done** | Built, and verified by the tests listed in §4 |
| **Done · needs input** | Built and switchable; waits on a decision or a value from Saudade (the open question is named) |
| **Not met yet** | Measured, short of its target; what it would take is written down |
| **Not in this contract** | Deferred by agreement (CLIENT_GUIDE §10) or never agreed |

---

## 1. Requirements

### Launch priorities (CLIENT_GUIDE §5)

| # | Priority | Status | Where |
| --- | --- | --- | --- |
| 1 | Activation code system | **Done** | §6.1 below |
| 2 | Sender upload portal: Photos, Letter, Voice, Song | **Done** | §6.2–6.3 |
| 3 | First-tap reveal; sender previews never count | **Done** | §6.4 |
| 4 | Recipient reveal page | **Done** (speed: see §6.5) | §6.5 |
| 5 | Payment / checkout | **Not in this contract** (O1). Path B codes are emailed from the admin for the first 300; an order webhook is designed for later (ARCHITECTURE §16) | — |
| 6 | Data backup and durability | **Done · needs input** (accounts: Supabase Pro, Backblaze B2, GitHub secrets) | §8 |

### Activation codes and delivery (§6.1)

| Requirement | Status | Where |
| --- | --- | --- |
| Unique code per unit, `SAUD-3K7M` style, case-insensitive, no 0/O 1/I/L | **Done** | `lib/parsing/codes.ts`, `components/forms/CodeInput.tsx` |
| Code length | **Done**: 4 characters, the agreed `SAUD-3K7M` (O9). Guessing at scale is held off by the claim limits and the breaker (HANDOVER §10) | `config/site.ts` |
| Codes never expire | **Done** | Claim has no expiry; reset mints a new code |
| Path A: card in the box → claim → private link | **Done** | `/claim`, `app/api/claim` |
| Path B: code emailed, no card in the box; admin sends manually | **Done · needs input** (O2 domain + Resend key to actually deliver) | Admin → unit → Email the code |
| Protection against guessing | **Done**: per-network and global limits; a 6-hour bot check (Turnstile) when mass guessing is detected | `app/api/claim`, HANDOVER §10 |
| Clear messages for invalid / already-claimed codes | **Done** | `components/public/ClaimForm.tsx` |

### Sender portal (§6.2)

| Requirement | Status | Where |
| --- | --- | --- |
| Private link, no account or password | **Done** | `/s/{token}`; 160-bit tokens stored hashed |
| Edit, add, remove any time, before or after giving | **Done** | Sealed and opened envelopes stay editable; the recipient sees edits on their next visit |
| Save button (autosave deferred) | **Done** | Every editor; unsaved-changes guard |
| Mobile-first, fully usable on a phone | **Done** | Responsive audit 320 px → 2560 px (D-079) |
| Email for link recovery (O6) | **Done** (optional, explained) | Claim success, `/recover` |

### The four stamps (§6.3)

| Stamp | Requirement | Status | Where |
| --- | --- | --- | --- |
| Photos | Up to 15, compressed for mobile | **Done**: compressed in the browser, then converted on the server to a display JPEG (≤ 1600 px) and a thumbnail, with all metadata (location) removed | `lib/server/media-pipeline.ts` |
| Letter | Handwriting on aged stationery, good short or long | **Done** (and writes itself out on first reading, D-082) | `components/worlds/LetterWorld.tsx` |
| Voice | Record or upload, ≤ 3:00, re-record any time | **Done**: the length is now measured on the server, and every note is converted to AAC so Android recordings play on iPhones | `lib/server/media-pipeline.ts` |
| Song | Spotify / Apple Music link, rotating vinyl, official embed, 30-s previews accepted | **Done**, plus a nightly check: a song removed from Spotify/Apple shows as a labelled record (never a broken player) and the sender is told | `lib/server/songs.ts` |
| All | Client's stamp artwork | **Done · needs input (O4)**: placeholders until the artwork arrives; swapped in one file | `config/stamps.ts` |

### First-tap reveal (§6.4)

| Requirement | Status | Where |
| --- | --- | --- |
| Envelope opens, stamps appear one by one, on the first tap only | **Done** | `components/reveal/*` |
| Calm on every later visit | **Done** | `lib/recipient-mode.ts` |
| Sender's preview never counts | **Done**: preview never records; the sender's own phone is excluded; so is an admin's packing check | `app/api/t/[slug]/reveal` |
| Link-preview bots (iMessage, WhatsApp) can't use it up | **Done**: loading records nothing; only a tap after the ceremony does | ARCHITECTURE §8 |

### Recipient page (§6.5)

| Requirement | Status | Where |
| --- | --- | --- |
| Opens from the tap, no login / app / download | **Done** | `/t/{slug}` |
| Envelope layout, vintage postal look, four worlds | **Done** | Approved in client round 1 (D-082) |
| Sender edits appear automatically | **Done** (on the next visit; content is never cached) | `GET /api/t/{slug}` |
| Works on iPhone Safari and Android Chrome | **Done** in WebKit and Chromium automation; **real phones with real chips still to do** (AQ11, needs encoded samples) | `scripts/e2e.mjs`, `scripts/e2e-api.mjs` |
| Fast on mobile data | **Not met yet**: on Lighthouse's "slow 4G + 4× slower CPU" the page is ready in ~4.0 s (budget 2.5 s), 277 KB of JavaScript (budget ~150 KB); about 1.2 s is the ceremony's deliberate pacing. Meeting it needs a design decision: show the envelope before the data arrives (changes the approved opening) and/or trim the animation library. See §3 | `scripts/perf.mjs --slug` |
| Stays live for years | **Done**: client-owned domain on the chips, backups, handover, maintenance plan | HANDOVER §14 |

### Admin (§6.6)

| Requirement | Status | Where |
| --- | --- | --- |
| Secure admin login | **Done**: email and password, lock-out after 5 wrong passwords, 12 h idle sessions, CSRF protection, audit log | `/admin` |
| Every unit with its status | **Done** | Dashboard, Units |
| Search by code or email | **Done** (also unit number, slug) | Units |
| Email codes manually (Path B) | **Done** | Unit → Email the code |
| Reset a lost or compromised code | **Done** | Unit → Reset code |
| View or remove content for support | **Done**, plus **restore** an earlier version | Unit → What's inside, History |
| Settings that must be right before launch | **Done**, for the developer only (not shown in the admin) | `npm run launch:check` |

### NFC and provisioning (§6.7)

| Requirement | Status | Where |
| --- | --- | --- |
| 300 unique, non-sequential, unguessable identifiers in one batch | **Done** (admin or `npm run provision`) | Admin → Batches; HANDOVER §7 |
| CSV with the exact URL per unit for the encoding run | **Done**: a factory file (URLs, NDEF byte count) separate from the card file (codes) | same |
| NTAG213/215 compatible | **Done**: one short URI record; 38 of 144 bytes with the placeholder domain | `lib/parsing/ndef.ts` |
| Batch lifecycle (encoded / void) | **Done** | Admin → Batches |
| Chip domain | **Done · needs input (O2)**: `NEXT_PUBLIC_CHIP_DOMAIN`; each batch remembers its own domain | `config/site.ts` |

### Privacy and security (§7)

| Requirement | Status |
| --- | --- |
| Long random URLs, no pattern between units | **Done** (60-bit slugs, 160-bit tokens, 130-bit media ids) |
| Hidden from search engines | **Done** (`X-Robots-Tag`, robots meta, `robots.txt`, neutral link previews) |
| Photos and audio through signed private links | **Done** (private bucket, 1-hour signed URLs) |
| A forwarded link works (accepted) | **Done** |
| Optional PIN | **Not in this contract** (offered, not requested) |
| Hardening beyond the brief | Content-Security-Policy, HSTS, no-referrer on private links, clickjacking protection, every secret hashed or encrypted (D-083) |

### Durability and backups (§8)

| Requirement | Status |
| --- | --- |
| Daily database backups | **Done · needs input**: Supabase Pro (daily, 7 days) **and** a nightly encrypted off-site copy to Backblaze B2 (35 daily + 12 monthly), with a tested restore drill. Needs the accounts and GitHub secrets (`BACKUPS.md` §3) |
| Durable media storage | **Done** (Supabase Storage + nightly copy to B2) |
| File versioning: deleted or replaced media can be recovered | **Done**: every save is a new version; removed files are kept 90 days; the admin can restore any version |
| Full data export (download button) | **Not in this contract** (deferred) |

### Technical foundation (§9) and scope (§10)

| Requirement | Status |
| --- | --- |
| Next.js, PostgreSQL, S3-compatible storage with CDN | **Done** (Supabase Postgres + Storage, D-075) |
| Client-owned accounts; repo ownership | **Done · needs input**: at handover (HANDOVER §2–3) |
| TypeScript, clean, documented, ready to grow past 300 | **Done**; CI on every push |
| Privacy Policy and Terms pages, wording from the client | **Done · needs input (O14)**: styled pages; wording goes in `content/legal.ts`; HANDOVER §9 lists the facts the lawyer needs |
| Deferred items stay out: drawing, video, autosave/live preview, drag-to-reorder, custom audio skin, automatic code emails, data export | **Done** (none built) |

---

## 2. Waiting on Saudade

| # | What | Blocks | By |
| --- | --- | --- | --- |
| O2 / AQ12 | The chip domain, registered 10 years in Saudade's name | The launch batch, real email | ASAP (chips are permanent) |
| O3 / AQ2 | Encoding date; card printer and lead time | The ceremony date | — |
| O4 | Stamp artwork (SVG or PNG) | The final look | — |
| O14 | Privacy Policy and Terms wording | Launch | 7 Nov |
| AQ6 | OK for Backblaze B2 off-site backups (~$0–1/month) | Backups | — |
| AQ11 | 5 encoded sample ceramics in final glaze | Real-phone testing | 13 Nov |
| Accounts | Vercel Pro, Supabase Pro, Resend, B2, GitHub org in Saudade's name | Production | — |
| Speed | Show the envelope before its data loads, or keep the current opening (§3) | The speed budget | — |

## 3. Not met yet: speed on slow mobile data

Measured 16 Oct on a production build with the real backend (`node scripts/perf.mjs --base … --slug …`, slow 4G
150 ms / 1.6 Mbps, 4× CPU slowdown, cold cache): ready to tap after **~4.0 s**, LCP 4.1–4.3 s, CLS 0.000, 277 KB
of JavaScript before the envelope is interactive, stamp worlds loaded only on demand. The budget is 2.5 s.

Where the time goes: the page shell arrives in under a second, then the JavaScript (React, Next and the animation
library are ~165 KB of it) downloads and starts on a slowed CPU, the envelope's contents are fetched, and the
ceremony then paces itself (envelope at 0.4 s, prompt at 1.2 s, as designed). Two ways forward, for Saudade to
choose (QA_CHECKLIST §4):

1. **Draw the envelope in the page shell** so it appears in about a second, and fade in the prompt when the data
   arrives. Fastest, but it changes the first moments of the approved opening, so it needs a design review.
2. **Trim the animation library** (load only the features the opening uses): about 25 KB less. Invisible, but on
   its own not enough to reach 2.5 s.

Server-rendering the envelope's contents is ruled out: it would let link-preview bots read letters (ARCHITECTURE §8).
On a real recent phone on 4G the page is much faster than this worst-case profile; the real-device pass (AQ11)
will give the true number.

## 4. How this was verified (16 Oct, re-run after D-089)

| Check | Result |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm test` (23 unit tests) | Clean, clean, 23/23 |
| `scripts/api-smoke.mjs` (real API on PostgreSQL 15 + the Storage stand-in, migration 0003 applied) | 84/84, including password lock-out; 86/86 with the claim breaker and Turnstile |
| `scripts/e2e-api.mjs` (browser journey, real API, CSP violations fail it) | Chromium 26/26, including admin sign-in, restore and batches; WebKit 25/25 (the voice upload is skipped there: test WebKit can't play recorded audio; the real-iPhone pass covers it) |
| `scripts/e2e.mjs` (prototype journey + accessibility) | 64/64 across Chromium and WebKit, 0 axe violations |
| Backup and restore drill (`BACKUPS.md`) | Backup → drill PASS; every tamper case fails or is refused |
| Real phones with encoded ceramics | **Not yet** (AQ11) |
