# Saudade backend (Supabase): setup and status

The screens talk to data only through `lib/services` (`Services` interface). Two implementations:

| `NEXT_PUBLIC_DATA_SOURCE` | Data lives in | Use it for |
| --- | --- | --- |
| `mock` (default) | the browser (localStorage + IndexedDB) | the clickable prototype, the Demo Panel, `scripts/e2e.mjs` |
| `api` | **Supabase**: Postgres + Storage, through the REST API in `app/api/*` | the shareable demo, staging, production |

Nothing in the screens changes between the two. Decision record: `DECISIONS.md` D-075.

## 1. Create the Supabase project (5 minutes)

1. [supabase.com](https://supabase.com) → **New project**. Free plan is fine for the demo; production needs Pro
   (daily backups). Region: closest to most customers (AQ7; US East by default). Save the database password.
2. Copy `.env.example` to `.env.local` and fill in:

   | Variable | Where in Supabase |
   | --- | --- |
   | `SUPABASE_URL` | Project settings → API → **Project URL** |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project settings → API → **service_role** secret. Server only. Never share it, never prefix it with `NEXT_PUBLIC_`. |
   | `DATABASE_URL` | Connect → **Transaction pooler** (port **6543**) URI, with your database password filled in |

   Leave `CODE_PEPPER_V1`, `IP_HASH_KEY` and `ADMIN_PASSWORD` empty: the setup script generates them.
3. Run:

   ```bash
   npm run db:setup
   ```

   It applies `supabase/migrations/*`, creates the private `media` bucket, creates the admin sign-in
   (`ADMIN_EMAIL` / the generated `ADMIN_PASSWORD` in `.env.local`), and seeds the demo:

   | Demo item | What it shows |
   | --- | --- |
   | `SAUD-3K7M` | The hero code from every walkthrough. Unclaimed: claim it to start an envelope. |
   | `SAUD-QCJZ`, `SAUD-HNXD`, `SAUD-Y7H8`, `SAUD-9KHV`, `SAUD-ERXV`, `SAUD-FHV3`, `SAUD-WUCW`, `SAUD-EWUN`, `SAUD-5HVD` | Spare unclaimed codes |
   | `SAUD-9PXR` | Already claimed: shows the "already found its envelope" message |
   | `/t/miratotheo23` | A sealed sample envelope (Mira → Theo: 6 photos, letter, voice note, song). Its first tap plays the reveal. |
   | `.env.local`, `.demo-links.local.json` | The admin password and the sample's private sender link (both git-ignored) |

   Re-running is safe. `npm run db:setup -- --reset --yes` wipes every Saudade table and the bucket's files and
   starts again (staging only).
4. Restart the dev server (`npm run dev`) or rebuild: `NEXT_PUBLIC_DATA_SOURCE=api` is read at build time.

## 2. Verify

```bash
npm run build && npx next start -p 3200      # second terminal
npm run api:smoke -- --base http://localhost:3200   # 51 API checks: claim → uploads → stamps → seal → reveal → admin
npm run api:e2e   -- --base http://localhost:3200   # the same journey in a real browser, ~21 checks (add --engine webkit)
```

`scripts/e2e.mjs` keeps testing the mock prototype (it needs a build without `NEXT_PUBLIC_DATA_SOURCE=api`).

Verified on 2026-10-09 against PostgreSQL 15 with Supabase's `anon` / `authenticated` roles: migration applies and
re-applies cleanly; all 17 tables have RLS on and `anon` is refused on tables and views; API smoke 41/41 and the
browser journey 17/17 in Chromium and WebKit (database paths).

Verified the same day on the live Supabase project (Sydney): setup, bucket and seed; the `anon` key is refused on every
table and view and sees no files; API smoke 51/51 including uploads and signed URLs; browser journey 21/21 in Chromium
and 20/20 in WebKit (the voice step needs a real iPhone: the Windows WebKit build cannot play recorded audio).

## 3. How it fits together

- **Database:** Supabase Postgres, accessed only by the server through the transaction pooler (`postgres` driver,
  plain parameterised SQL, real transactions). Schema: `supabase/migrations/0001_init.sql`, generated from
  `db/schema.sql` (the design source; rationale in `ARCHITECTURE.md` §5). Every table has Row Level Security on with
  no policies and all grants revoked from `anon`/`authenticated`, so Supabase's public Data API exposes nothing.
- **Files:** one private Storage bucket. Browsers upload straight to Storage with a single-use signed upload URL
  (`POST /api/sender/media/uploads`); the server then checks the object exists, its size and its first bytes
  (`…/complete`) before it can be used. Reads are 1-hour signed URLs, pre-signed into every envelope response.
- **Secrets:** activation codes are stored only as HMAC-SHA-256 with `CODE_PEPPER_V1`; sender links and admin
  sessions only as SHA-256; admin passwords as scrypt. **Escrow `CODE_PEPPER_V1`**: losing it voids every unclaimed
  printed card.
- **Endpoints:** `ARCHITECTURE.md` §6 (unchanged contract). Rate limits (§9.2) live in Postgres.
- **First-open integrity (§8):** loading a recipient page never writes. The reveal is recorded only by the POST after
  the ceremony; a sender opening their own envelope on the device they filled it from does not use it up (AQ8);
  admin "Reset reveal" replays it.
- **Email:** with `RESEND_API_KEY` + a verified domain, emails are delivered; without, they are recorded in the
  admin's email log but not sent (the demo default, until the domain is decided: O2).
- **The presenter's Demo Panel** only exists on mock data. On the real backend, the admin panel does that job
  (reset reveal, reset code, statuses, the email log).

## 4. Not built yet (Phase 3, before launch)

| Item | Why it matters | Notes |
| --- | --- | --- |
| Server-side media normalisation (sharp / ffmpeg) | Voice notes recorded on Android (WebM/Opus) may not play on older iPhones; photos are already compressed in the browser | `ARCHITECTURE.md` §7. Until then the verified original is served. |
| Email delivery | Recover link, "email me my link", Path B codes | Needs the domain (O2) + Resend (or Supabase SMTP) |
| Off-provider backups + restore drill | "Codes never expire" | Supabase Pro gives daily backups (7 days); add the nightly dump to a second provider (§10) |
| Purge / song-check / cleanup jobs | 90-day media purge, removed tracks, old rate-limit rows | Supabase cron or Vercel Cron (§6.6) |
| Admin 2FA (TOTP) | Admin can read every envelope | [PROPOSED AQ5]; columns exist |
| Turnstile on the global claim breaker | Guessing at scale | §9.2; 8-character codes (O9) matter more |
| Security headers (CSP, HSTS) | Defence in depth | §9.3 |
| Hosting in the client's accounts | Ownership (proposal §02) | Vercel/Render + Supabase under Zeya's email, at handover |

## 5. Costs (to restate to the client)

Supabase **Free** is enough for the demo (it pauses after a week without visits). For launch: Supabase **Pro $25/month**
(8 GB database, 100 GB files, daily backups kept 7 days) + hosting (~$20/month on Vercel Pro) ≈ **$45–50/month at 300
units**, rising slowly with storage. This replaces the Neon + R2 estimate in `ARCHITECTURE.md` §12 (D-075).
