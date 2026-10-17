# Saudade: handover and operations

For the developer who runs Saudade after us, and for Zeya. It says how to deploy, configure, launch and look after
the system. Where something has its own runbook, this page points to it. Read `CLIENT_GUIDE.md` first for what the
product is; `ARCHITECTURE.md` for why it is built this way; `LAUNCH_READINESS.md` for what is done and what still
waits on a decision.

| Topic | Where |
| --- | --- |
| Setting up the backend (Supabase) | `BACKEND.md` |
| Backups and the restore drill | `BACKUPS.md` |
| Every decision and the reason for it | `DECISIONS.md` |
| Requirements, status, what's left | `LAUNCH_READINESS.md` |

---

## 1. The system in one page

One Next.js app (TypeScript) with three front doors, one database and one private file bucket:

| Front door | Address | Who |
| --- | --- | --- |
| Claim and the sender's portal | `/claim`, then the private link `/s/{token}` | The buyer. No account. |
| The recipient's envelope | `/t/{slug}`, the address on the NFC chip | Whoever taps the ceramic. No login. |
| Admin | `/admin` | Zeya and the developer. Email and password. |

| Part | Service | Notes |
| --- | --- | --- |
| App and API | Vercel (Next.js 16) | `app/` pages, `app/api/*` route handlers |
| Database | Supabase Postgres | `supabase/migrations/*`, applied by `npm run db:setup` |
| Photos and voice notes | Supabase Storage, one private bucket | Browsers upload straight to it with single-use signed URLs; everyone reads through 1-hour signed URLs |
| Email | Resend | Sender links, recovery links, gift codes |
| Nightly jobs | Vercel Cron → `/api/cron/daily` | `vercel.json` |
| Off-site backups | GitHub Actions → Backblaze B2 | `.github/workflows/backup.yml`, `BACKUPS.md` |
| Bot check (optional) | Cloudflare Turnstile | Only while mass code-guessing is detected |

Every uploaded photo becomes a display JPEG (≤ 1600 px) and a WebP thumbnail with no metadata; every voice note
becomes AAC/m4a (plays on every phone), with its length measured on the server. The raw upload is deleted 7 days
later. Removed files stay recoverable for 90 days (Admin → unit → History → Restore), then are deleted.

---

## 2. Accounts (all in Saudade's name)

Create each one under a shared mailbox Saudade controls (e.g. `tech@{domain}`), with two-factor sign-in on. The
developer is invited as a member and removed when support ends. Nothing is billed to us.

| Account | For | Plan |
| --- | --- | --- |
| Domain registrar (Cloudflare Registrar recommended) | The chip domain (O2). **10 years, auto-renew, registrar lock** | ~$10/year |
| Vercel | Hosting, cron | Pro ($20/month): Hobby is for non-commercial use |
| Supabase | Database + file storage | Pro ($25/month): daily backups kept 7 days |
| Resend | Email | Free up to 100/day; Pro ($20) for busy months |
| GitHub | The code, CI, nightly backups | Free |
| Backblaze B2 | Off-site backups | ~$0–1/month |
| Cloudflare (Turnstile) | Bot check, optional | Free |
| UptimeRobot | Uptime alerts | Free |
| Password manager | Every secret below, plus the paper copies' locations | Saudade's own |

---

## 3. Deploying

1. **GitHub:** move the repository into Saudade's GitHub organisation.
2. **Supabase:** create the project (region near most customers, AQ7) and run `npm run db:setup` against it from
   a laptop with a `.env.production.local` (see `BACKEND.md` §1). It applies the migrations, creates the private
   bucket and the first admin, and generates the secrets it needs. Add `--no-demo` for production.
3. **Vercel:** import the repository, framework Next.js, Node 24. Add every variable in §4 for Production. Deploy.
4. **Domain:** add the chip domain to the Vercel project and point DNS at it. HTTPS must work before any chip
   is encoded.
5. **Resend:** verify the domain (SPF, DKIM, DMARC), create a sending-only API key, set `RESEND_API_KEY` and
   `EMAIL_FROM`.
6. Pull the production settings (`vercel env pull .env.production.local --environment=production`) and run
   `npm run launch:check -- --env-file .env.production.local`. It checks the settings below, the legal wording,
   the nightly jobs and backups, and says what to fix. It is a developer tool: the admin doesn't show it.

Every push to `main` is checked by CI (`.github/workflows/ci.yml`: lint, types, unit tests, build, and the whole
API against a test database). Vercel deploys `main`; preview deployments get their own URLs and never touch chips.

---

## 4. Environment variables

`NEXT_PUBLIC_*` values are built into the pages: after changing one, **redeploy**. The others are read at run time.

| Variable | Needed for launch | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_DATA_SOURCE` | `api` | `mock` is the clickable prototype (data in the browser) |
| `NEXT_PUBLIC_CHIP_DOMAIN` | **Yes** | The domain on every chip, e.g. `saudade.gift`. Permanent once chips are encoded. Each batch remembers the domain it was made with |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Yes | The help address shown on the pages |
| `NEXT_PUBLIC_SHOW_RECIPIENT_LINK` | `0` | `1` shows senders the envelope's address after sealing (demos only) |
| `SUPABASE_URL` | Yes | Supabase → Project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same page. Server only. Never share it |
| `DATABASE_URL` | Yes | Supabase → Connect → **Transaction pooler** (port 6543) |
| `SUPABASE_MEDIA_BUCKET` | Default `media` | The private bucket |
| `CODE_PEPPER_V1` | Yes | 64 hex. **Escrow in two places**: losing it voids every unclaimed card |
| `IP_HASH_KEY` | Yes | 64 hex. Keys IP addresses for rate limits; can be rotated any time |
| `RESEND_API_KEY` | Yes | Without it, emails are logged in the admin but never sent |
| `EMAIL_FROM` | Yes | e.g. `Saudade <letters@saudade.gift>`, on the verified domain. Before the domain exists, `Saudade <onboarding@resend.dev>` works for testing, but Resend then delivers only to its own account's address |
| `PUBLIC_APP_ORIGIN` | Yes | e.g. `https://saudade.gift`: the start of every emailed link, and where the emails' images load from. Unset, emails use the address the request came in on (fine on one domain; set it so preview deployments never email their own URLs) |
| `CRON_SECRET` | Yes | Any long random string. Vercel Cron sends it to the nightly job; the backup workflow uses it to report in |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Recommended | Cloudflare Turnstile widget keys (§10) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Setup only | Used by `npm run db:setup` to create the first admin; not needed on Vercel |
| `FFMPEG_PATH` | No | Only to use a specific ffmpeg binary instead of the bundled one |

Make a 64-hex secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

---

## 5. Go-live, in order

| # | Step | Owner |
| --- | --- | --- |
| 1 | Domain registered for 10 years with auto-renew and lock (O2) | Zeya |
| 2 | Production deployed (§3) with every variable in §4; `npm run launch:check` has no **FIX** left | Developer |
| 3 | Privacy Policy and Terms wording pasted into `content/legal.ts` (O14, facts in §9) | Zeya's lawyer, developer |
| 4 | Stamp artwork swapped in (`config/stamps.ts`, O4) | Developer |
| 5 | Backups set up and one restore drill passed (`BACKUPS.md` §5) | Developer |
| 6 | Provisioning ceremony (§7): card file to the printer, factory file to the encoding run | Developer + Zeya |
| 7 | Factory confirms the chips are written and locked → Admin → Batches → **Mark encoded** | Zeya |
| 8 | At least 5 encoded sample ceramics tapped on an iPhone and an Android (AQ11) | Zeya + developer |
| 9 | Packing: card S-0042 with ceramic S-0042; each box tapped while signed in to the admin (it never uses up the first open) | Zeya |

---

## 6. Scheduled jobs

| Job | When | What |
| --- | --- | --- |
| `/api/cron/daily` | 03:00 UTC (`vercel.json`) | Clears uploads that never finished; sets aside files no stamp uses any more (recoverable 90 days); deletes files past those 90 days; deletes raw uploads 7 days after conversion; converts anything not converted yet; retries failed conversions; checks every song is still on Spotify / Apple Music; and the retention clean-up in §9 |
| `/api/cron/jobs` | Optional | Only the conversion retries. On Vercel Pro you can add `{ "path": "/api/cron/jobs", "schedule": "*/10 * * * *" }` to `vercel.json` so a retry never waits for the night |
| Backups | 02:30 UTC (GitHub Actions) | `BACKUPS.md` |

Both cron routes refuse any call without `Authorization: Bearer $CRON_SECRET` (Vercel adds it). The last run of
each, and of the backup, shows in `npm run launch:check`. To run the nightly job by hand:
`curl -H "Authorization: Bearer $CRON_SECRET" https://{domain}/api/cron/daily`.

---

## 7. Making a batch of units (the provisioning ceremony)

Codes are stored only as hashes, so **the card file exists once**, at generation. Do it on a call with Zeya.

From a terminal (recommended, with the production env file):

```bash
npm run provision -- --count 300 --label "Launch run" --env-file .env.production.local          # shows the plan
npm run provision -- --count 300 --label "Launch run" --env-file .env.production.local --yes    # makes it
```

Or in the browser: Admin → Batches → Generate, then download **Card file (codes)** and **Factory file (URLs)**
before leaving the page.

| File | Columns | Goes to | Then |
| --- | --- | --- | --- |
| Card file | `unit_no, code` | The card printer | Deleted once the cards are printed and checked |
| Factory file | `unit_no, slug, url, ndef_bytes` | The encoding run | Kept; downloadable again any time |

If either file is lost **before** the chips are written: Admin → Batches → **Void** (its codes stop working), and
generate again. Once the factory confirms: **Mark encoded** (permanent: an encoded batch can never be voided).
A damaged card: Admin → unit → **Reset code**, and print one new card.

---

## 8. Admins

There is no sign-up page. Admins are managed from a terminal with the production env file:

```bash
npm run admin -- list
npm run admin -- add developer@example.com --name "Developer"     # prints a password, once
npm run admin -- reset-password zeya@saudade.gift                 # prints a new one; signs them out everywhere
npm run admin -- disable developer@example.com                    # when support ends
```

Admins sign in with their email and password. Five wrong passwords lock an account for 15 minutes, and one
network address gets 20 failed sign-ins a day. Every sign-in, failure and sign-out is in the audit log. Keep each
password in the password manager; a forgotten one is replaced with `reset-password`.

---

## 9. Facts for the Privacy Policy wording

We build the pages; the words come from Saudade's lawyer (O14). These are the facts they will need. Paste the
supplied wording into `content/legal.ts` (instructions at the top of that file).

| Data | Kept | Then |
| --- | --- | --- |
| Letters, photos, voice notes, songs in an envelope | As long as the product runs ("codes never expire") | — |
| Earlier versions of a stamp (replaced or removed) | Text forever; files 90 days after nothing uses them | Files deleted |
| Raw uploads (before conversion, may carry location data) | 7 days | Deleted; only the converted copies (no metadata) are kept |
| Off-site backup copies | Database 35 daily + 12 monthly; files as above, removed from the backup within about 3 months (`BACKUPS.md` §2) | Deleted |
| Sender's email (optional, for link recovery) | Until they ask to remove it | Removed by the admin |
| IP addresses | Never stored; a keyed hash for rate limits, cleared from open records after 90 days | — |
| Email log (to, subject, time; never the body) | 13 months | Address replaced by a one-way hash |
| Admin sessions | 30 days | Deleted |

Processors: Vercel (hosting), Supabase (database and files, region chosen at setup), Resend (email), Backblaze
(backups), Cloudflare (Turnstile, only during an attack), Spotify / Apple Music (the official players on the song
stamp). No analytics or advertising trackers. The recipient's page is not indexed by search engines; anyone with
the chip's link can open it (the accepted cost of "just tap", CLIENT_GUIDE §7).

---

## 10. Abuse protection

Claims are limited per network address (10 wrong codes in 15 minutes, 30 a day) and globally (300 wrong codes an
hour). If the global limit trips, Turnstile turns on a quiet "are you a person" check for every claim for six
hours, and the dashboard's activity shows it. Without Turnstile keys, claims instead pause until the hour is up.
These limits and the breaker are what protect the agreed 4-character codes (SAUD-3K7M, O9) from guessing at scale.

---

## 11. Monitoring

| What | How |
| --- | --- |
| Is it up? | UptimeRobot on `https://{domain}/api/health` (answers `{"ok":true,"db":true,"version":…}`) and on the home page, alerting Zeya and the developer |
| Domain and certificate expiry | UptimeRobot's domain/SSL monitor |
| Nightly jobs, backups, email, conversion | `npm run launch:check -- --env-file <production env file>` (developer) |
| Errors | Vercel → Logs. An unexpected server error is logged as `[api {id}]` with its stack, and the API's error response carries the same id (`"server error {id}"`), so a report can be matched to its log line |
| Who did what | Admin → unit → Audit log; Dashboard → Recent activity |

---

## 12. Testing

| Command | What |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm test` | Lint, types, unit tests (codes, media conversion, checklist, legal) |
| `npm run api:smoke -- --base <url> --env-file <file>` | 80+ checks of the whole API: claim, uploads and conversion, stamps, reveal rules, admin sign-in, history, batches, cron, checklist. `--breaker` also trips the claim breaker (test databases only) |
| `npm run api:e2e -- --base <url> --env-file <file>` | The same journey in a real browser, including the admin (sign-in, restore, batches). Fails on any Content-Security-Policy violation |
| `node scripts/e2e.mjs --base <url>` | The prototype journey (mock data), Chromium and WebKit, with accessibility checks |

To run the API locally with no Supabase at all: start `npm run storage:stub` (an in-memory Storage stand-in), point
`SUPABASE_URL` at `http://127.0.0.1:54330` and `DATABASE_URL` at a local PostgreSQL 15 prepared as in
`.github/workflows/ci.yml`. CI does exactly this on every push.

---

## 13. Secrets: escrow and rotation

| Secret | Escrow | Rotate |
| --- | --- | --- |
| `CODE_PEPPER_V1` | Password manager **and** a sealed paper copy | Never casually (it would void unclaimed cards) |
| `SUPABASE_SERVICE_ROLE_KEY`, database password | Password manager | Yearly and when someone leaves |
| `RESEND_API_KEY`, `CRON_SECRET`, Turnstile secret | Password manager | Yearly |
| `IP_HASH_KEY` | Not needed | Any time |
| Backup `age` private key | Offline only: password manager + paper | Never stored on a server (`BACKUPS.md` §3.1) |

**Rotate now:** the staging Supabase service-role key and database password were shared in a chat during the build
(STANDUP 9 Oct).

---

## 14. Keeping it alive for years

| When | What |
| --- | --- |
| Daily (automatic) | Nightly jobs, backups; run `npm run launch:check` weekly |
| Monthly | Dependency updates (patch/minor) with CI green; read the audit log for anything odd |
| Quarterly | Restore drill and backup-copy purge (`BACKUPS.md` §5, §2); tap a real ceramic on a current iPhone and Android; check the Spotify / Apple embeds still work |
| Yearly | Node LTS and major updates; rotate secrets (§13); confirm the domain is renewed at least 5 years ahead |

Exit plan: a plain Postgres dump, S3-compatible files and a standard Next.js app. It moves to any host without
touching a chip, because the chips carry Saudade's own domain.
