# Saudade

A ceramic NFC keepsake envelope with a companion web app. Design language: **Wish You Were Here**
(a 1940s linen postcard: photo-filled block capitals with a script word, turquoise skies, sunsets and a deep sea on a woven weave,
white-bordered postcards, perforated edges, postmarks, wax and handwriting; motion by Emil Kowalski's rules; references
later.com / gumroad.com / oatly.com, patterns only; `docs/DIRECTIONS.md` §0). **The physical object is the envelope;
the digital experience is the letter inside it.** This repository is the whole product: every screen, behind
service interfaces with two implementations: the clickable prototype (data simulated in the browser, with the
presenter's Demo Panel) and the real backend (Supabase Postgres + Storage, `app/api/*`), with no UI difference.

Start with [`docs/CLIENT_GUIDE.md`](docs/CLIENT_GUIDE.md) (source of truth), then
[`docs/PRD.md`](docs/PRD.md) (requirements → screens) and [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (add ?demo=1 to any URL for the Demo Panel)
npm run build && npm start
npm run lint
npm run typecheck
npm test             # unit tests (vitest): codes, two-factor, media conversion, checklist, legal
```

Node 24. No environment variables are needed for the prototype (mock data in the browser).
`NEXT_PUBLIC_DATA_SOURCE=api` switches to the real backend below.

## Real backend (Supabase)

The same screens run on a real backend when `NEXT_PUBLIC_DATA_SOURCE=api`: Supabase Postgres + Storage behind
`app/api/*`. Setup in five minutes: [`docs/BACKEND.md`](docs/BACKEND.md) (`.env.example` → `.env.local`, then
`npm run db:setup`). Checks: `npm run api:smoke`, `npm run api:e2e`.

**Going live:** [`docs/HANDOVER.md`](docs/HANDOVER.md) (accounts, every environment variable, the go-live order,
the provisioning ceremony, admins and two-factor sign-in, monitoring). What's done and what waits on Saudade:
[`docs/LAUNCH_READINESS.md`](docs/LAUNCH_READINESS.md). Backups: [`docs/BACKUPS.md`](docs/BACKUPS.md).

| Command | What |
|---|---|
| `npm run provision -- --count 300 --label "Launch run" --env-file <file>` | The provisioning ceremony from a terminal (dry run unless `--yes`): card file + factory file |
| `npm run admin -- list \| add \| reset-password \| reset-2fa \| disable \| enable` | Admin accounts (there is no sign-up page) |
| `npm run storage:stub` | In-memory Supabase Storage stand-in, to run the whole API locally or in CI |

CI (`.github/workflows/ci.yml`) runs lint, types, unit tests, a build, and the whole API on PostgreSQL 15 on every
push. Nightly off-site backups: `.github/workflows/backup.yml`.

## Demo mode

Open any page with `?demo=1` (or triple-tap the Saudade logo) to get the presenter's **Demo Panel**.
Full presenter guide: [`docs/SHOWCASE_SCRIPT.md`](docs/SHOWCASE_SCRIPT.md).

| Code | Behaviour |
|---|---|
| `SAUD-3K7M` | Valid and unclaimed: the "hero" unit used for the showcase |
| `SAUD-9PXR` | Already claimed by someone else |
| `SAUD-0000` | Invalid (0 is never used in codes; the input explains why) |
| `SAUD-QCJZ`, `SAUD-HNXD`, `SAUD-Y7H8`, `SAUD-9KHV`, `SAUD-ERXV`, `SAUD-FHV3`, `SAUD-WUCW`, `SAUD-EWUN` | More valid, unclaimed codes from the seeded batch (each claims once per browser) |

Admin (simulated): `/admin`, email `zeya@saudade.example`, password `postmark`.

The mock data lives in **this browser** (localStorage + IndexedDB), so run sender and recipient in the
same browser (tabs stay in sync). Reset any time from the Demo Panel.

## QA scripts

Run against a running server (`npm run dev` → :3000, or `next start -p 3200` for production numbers).

| Script | What it checks |
|---|---|
| `node scripts/e2e.mjs --base <url>` | The whole showcase journey in Chromium **and** WebKit (iPhone Safari proxy), first-open integrity against the mock DB, axe-core WCAG 2.2 AA at every step, console/page errors. Screenshots in `./.e2e/`. |
| `node scripts/perf.mjs --base <url> [--state first\|repeat\|empty] [--fast] [--slug <slug>]` | Recipient route on slow 4G + 4× CPU, cold cache: LCP, CLS, JS before the envelope is interactive, fonts. `--slug` measures a real envelope on the real backend. |
| `npm run api:smoke -- --base <url> [--env-file f] [--breaker]` | The whole real API (~94 checks), including two-factor sign-in, media conversion, history, batches and the nightly jobs. |
| `npm run api:e2e -- --base <url> [--env-file f] [--engine webkit]` | The real-backend journey in a browser, including authenticator set-up in the admin. Fails on any CSP violation. |
| `node scripts/responsive.mjs --base <mock build> [--sizes phones\|tablets\|desktops] [--shots dir]` | Every route at 13 screen sizes (320 px phones to 2560 px monitors): sideways scroll, text off-screen or cut off, text colliding, text hidden under the header in the pinned scenes, touch targets under 44 px, text under 12 px on phones. Needs a mock build (`NEXT_PUBLIC_DATA_SOURCE=mock`). |
| `python scripts/qa.py [routes…] --desktop` | Route sweep: axe violations, console errors, touch targets < 44 px. |
| `python scripts/shot.py <route> out.png [--frames …]` | Screenshot or frame sequence of one route (for design review). |
| `node scripts/gallery.mjs --widths 390,820,1440 [--setup claim\|sample\|sealed] <routes…>` | Responsive design review: full-page shots of many routes at several widths, with the demo envelope set up first. |
| `node scripts/reveal-frames.mjs --width 390 --frames 0,1000,3000,7600` | The first-tap reveal as frames, plus one opened stamp world. |
| `node scripts/motion-check.mjs --out <dir>` | Frames of the borrowed signature motion in action (label roll, double shadow, cursor parallax, drum counters, orbit, page transition). |

The Node scripts use `playwright-core` (dev dependency) and the browsers in the local Playwright
cache. Results and open items: `docs/QA_CHECKLIST.md`.

## Folder map

```
app/                    Routes (Next.js App Router)
  page.tsx              S1 brand entry
  claim/ recover/ help/tap/ privacy/ terms/
  s/[token]/            Sender portal: home, photos, letter, voice, song, preview, seal
  t/[slug]/             Recipient: first-tap reveal, envelope, stamp worlds
  admin/                Login, dashboard, units, units/[id], batch
  design-system/        Living style guide: tokens, components, stamps, directions, motion
  api/song/resolve/     Server-side Spotify / Apple Music link resolution (real)
components/
  paper/ stamps/ envelope/ reveal/ worlds/ media/ forms/ ui/ admin/ demo/
config/
  site.ts               Feature flags, limits, code format, chip domain (deployment values from NEXT_PUBLIC_*)
  stamps.ts             STAMP ASSET MAP: the only place stamp artwork is referenced
content/
  legal.ts              Privacy Policy and Terms wording (supplied by Saudade, O14)
lib/
  server/               The backend: auth (+ two-factor), envelopes, media pipeline, jobs, cron, songs, readiness
  services/             types.ts (contracts) · mock/ (prototype) · api/ (real backend)
  state/                Zustand stores: db (mock server), demo, device, toast, media-store
  parsing/              codes.ts (activation codes, slugs, tokens) · songs.ts (link parsing)
  demo/                 seed data, Mira→Theo sample envelope, presenter actions
  hooks/ utils/
  recipient-mode.ts     first_tap | repeat | empty | not_found decision (pure)
  tokens.ts             JS mirror of motion/z-index tokens
styles/
  tokens.css            ALL design tokens (colour, type, radius, elevation, motion, texture)
  globals.css           Tailwind v4 theme mapping + base styles + utilities
public/
  placeholders/stamps/  Original placeholder stamp art (PLACEHOLDER: client artwork pending)
  demo/                 Sample photos, placeholder voice clip, song metadata (see docs/ASSETS.md)
docs/                   PRD, research, directions, decisions, open questions, motion spec,
                        architecture, QA checklist, showcase script, assets register, stand-ups,
                        handover, launch readiness, backups
scripts/                QA scripts, db-setup, provision and admin CLIs, backup/ (dump + restore drill),
                        test/ (Storage stand-in), asset generators
supabase/migrations/    The database schema, applied in order by `npm run db:setup`
tests/                  Unit tests (vitest)
.github/workflows/      CI and nightly backups
```

## Engineering rules (all contributors)

**Stack:** Next.js 16.4 (App Router, Turbopack, `cacheComponents` + `partialPrefetching` on),
React 19.3, TypeScript strict, Tailwind CSS v4 (CSS-first config), Motion 14 (`motion/react`),
Zustand 5, idb-keyval, browser-image-compression.

1. **Read the bundled Next docs** in `node_modules/next/dist/docs/` before using an unfamiliar API.
   This Next version differs from older training data.
2. **Dynamic routes + Cache Components.** A page under `[token]`/`[slug]`/`[id]` must render any
   component that reads params (`useParams()` or `use(params)`) **inside `<Suspense>`**, or the
   build fails. Pattern: the server `page.tsx` returns `<Suspense fallback={…}><ClientScreen /></Suspense>`.
   Same for `useSearchParams()`.
3. **No synchronous IO during render.** No `Date.now()`, `new Date()`, `Math.random()`,
   `crypto.*` in render bodies. Use them in effects and event handlers only.
4. **Activity preserves routes.** Navigating away hides a route instead of unmounting it (up to 3
   routes). Reset transient UI (open menus, sheets, in-flight animations) in a `useLayoutEffect`
   cleanup. The Demo Panel uses full page loads for scenario jumps.
5. **Data only through services.** `import { services } from "@/lib/services"`. Never import from
   `lib/state/db` or `lib/services/mock/*` in screens. Handle every `ServiceResult` error code.
6. **Client stores need hydration gating.** Anything that reads localStorage-backed state renders a
   skeleton until `useHydrated()` is true.
7. **Tokens only.** No raw hex, no magic px values for colour/radius/shadow/type/motion. Use the
   Tailwind utilities mapped in `styles/globals.css` (`bg-paper`, `text-ink-faded`,
   `font-hand`, `shadow-stamp`, `rounded-card`, `ease-paper`…) or `var(--token)`. Motion JS uses
   `lib/tokens.ts`. Spacing uses Tailwind's scale.
8. **Stamp art only via `config/stamps.ts`.** Never hard-code `/placeholders/stamps/...`.
9. **Reduced motion is a design state.** Every animation has a reduced variant
   (`useReducedMotionPref()`); only animate `transform` and `opacity`.
10. **Accessibility.** Real buttons, descriptive labels, visible focus, 44×44 touch targets,
    `aria-live` for async status, no information by colour alone.
11. **Copy voice.** Warm, brief, human, second person. Postal metaphors are welcome, except in
    error messages, which must be plain and clear.
12. **Deferred features stay out.** No video, drawing, drag-to-reorder, autosave, custom audio skin,
    checkout, data export. No logins for senders or recipients.
13. **Never trigger the reveal on load.** `services.reveal.markRevealed` is called only by the
    recipient route after the choreography completes (or is skipped). Never from previews.
14. Keep components small, typed, and commented where intent isn't obvious. No `any`.
15. **Component CSS = prefixed global CSS inside `@layer components`**, not CSS Modules. The
    Tailwind Turbopack rule in `next.config.ts` turns `*.module.css` into plain CSS with empty class
    maps. Prefix classes per area (`sd-` primitives, `ds-` design system, `rv-` reveal…). CSS outside
    a layer beats Tailwind utilities, so callers' `className` would stop working.
16. **Overhang is intentional.** Postmarks and wavy cancellations hang past a stamp's edge (~18%).
    Don't clip stamp containers; use `overflow-x: clip` on the page instead.
17. **Route handlers** (`app/api/**/route.ts`) must not export `runtime` or `dynamic`: Next 16.4
    rejects them under Cache Components. `maxDuration` is fine. Request-time APIs keep them dynamic.
18. **Deployment values come from the environment** (`NEXT_PUBLIC_CHIP_DOMAIN`, `NEXT_PUBLIC_CODE_LENGTH`…, read in
    `config/site.ts`), never hard-coded. Add a new one to `.env.example`, `docs/HANDOVER.md` §4 and, if it matters
    for launch, the checklist (`lib/readiness-config.ts` or `lib/server/readiness.ts`).
19. **Third-party content needs the CSP** in `next.config.ts`: a new script, frame or image host must be added
    there, or `scripts/e2e.mjs` / `scripts/e2e-api.mjs` fail on the violation.
20. **Never serve an upload as uploaded.** Media goes through `lib/server/media-pipeline.ts`; a new kind of media
    gets its own conversion there.
