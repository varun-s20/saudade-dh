# Saudade backups: runbook

For the developer who looks after Saudade. What is backed up, where, how to check it works, and how to get
everything back. Design: `ARCHITECTURE.md` §10, adapted to Supabase (`DECISIONS.md` D-075).

| File | What it does |
| --- | --- |
| `.github/workflows/backup.yml` | Nightly at 02:30 UTC (and on demand): database dump, media copy, optional report to the app |
| `scripts/backup/backup-db.sh` | Dumps the `public` schema, encrypts it with `age`, writes `manifest.json` |
| `scripts/backup/restore-drill.sh` | Decrypts, restores into an empty database and checks it against the manifest |

## 1. What is backed up

There are two layers. Supabase's own backups are the first line: fast, but inside the same provider and the same
account. The nightly job keeps a second copy at another provider (Backblaze B2), encrypted, that a mistake or a
lost Supabase account cannot delete.

| What | How | When | Kept | Where |
| --- | --- | --- | --- | --- |
| Database (first line) | Supabase daily backups (Pro plan; point-in-time recovery is a paid add-on) | Daily | 7 days | Supabase |
| Database (off-provider) | `pg_dump` of schema `public`, encrypted with `age` | Daily, 02:30 UTC | 35 daily + 12 monthly | B2 `db/`, `db-monthly/` |
| Media (off-provider) | `rclone copy` of the private `media` bucket (copy, never sync) | Daily, 02:30 UTC | Forever (the job never deletes) | B2 `media/` |
| Code and config | GitHub; Vercel keeps every deployment | Every push | Forever | GitHub, Vercel |

**Not in the backups**, kept elsewhere:

| Item | Where it lives | Why it matters |
| --- | --- | --- |
| `CODE_PEPPER_V1` and the other app secrets | Vault (password manager), pepper also on paper | The dump holds codes only as HMACs. Without the pepper every unclaimed card is dead. |
| The `age` private key | Offline only: vault + paper | Without it no backup can be read |
| Supabase's own schemas (`auth`, `storage`, …) | Supabase | Not ours. The app uses only `public` and one Storage bucket. |
| Supabase project settings, API keys | Supabase dashboard | Re-created by hand in a disaster (§7) |

Each database backup comes with a manifest: the time of the snapshot, server and `pg_dump` versions, applied
migrations, the exact row count and a checksum of every table, and the size and sha256 of the encrypted file. The
counts are taken inside the same snapshot as the dump, so they match the dump exactly even while the app is in use.

## 2. Where it lives

One private B2 bucket (`saudade-backups` below; use your own name):

```
saudade-backups/
  db/2026/10/saudade-20261016-023012.dump.age        encrypted pg_dump (custom format)
  db/2026/10/saudade-20261016-023012.manifest.json   its manifest (not encrypted: counts and versions only)
  db/latest-manifest.json                            the last good night's manifest (compared every night)
  db-monthly/2026/10/…                               the first backup of each month, kept a year
  media/…                                            same keys as the Supabase bucket
```

| Rule (B2 lifecycle) | Prefix | Hide after (days from upload) | Delete after (days from hiding) | Result |
| --- | --- | --- | --- | --- |
| Daily dumps | `db/` | 35 | 1 | 35 daily backups |
| Monthly dumps | `db-monthly/` | 366 | 1 | 12 monthly backups |
| Raw uploads | `media/incoming/` | 30 | 1 | Gone from the backup about 35 days after upload (after the Object Lock); see below |
| Media | `media/` | none | 90 | Current files kept forever; overwritten old versions kept 90 days |

B2 applies the most specific matching prefix, so `media/incoming/` follows its own rule and the normalised files under
`media/media/` follow the `media/` rule.

On top of that the bucket has **Object Lock, 35 days** by default: no one, not even the account owner, can delete or
overwrite a file version in its first 35 days. The key the workflow uses can write but not delete. A leaked CI
key or a compromised GitHub account cannot destroy the backups.

`latest-manifest.json` is rewritten every night. B2 keeps each old version until its 35-day lock ends; the `db/`
rule then removes it.

**Files the app deletes on purpose (privacy, DECISIONS D-083).** The job copies and never deletes, so two kinds of
file the app removes (`ARCHITECTURE.md` §5.2) need their own handling in B2:

| In Supabase | The app deletes it | In B2 |
| --- | --- | --- |
| `incoming/{unit}/{media}`: the raw upload, which may carry EXIF/GPS | 7 days after the normalised files exist (`media.original_deleted_at`) | Hidden by the `media/incoming/` rule 30 days after upload, deleted once the lock allows (~35 days). If a raw file is still in Supabase (its processing failed, so it is what's served), the next night's copy sees it missing and uploads it again: it never loses its off-site copy. |
| Every file of a removed stamp | 90 days after removal (`media.purged_at`) | Removed by the quarterly purge below (the CI key can't delete, by design) |

**Quarterly: purge backup copies of purged media** (with the restore drill, §5). Needs the B2 **master** key (from the
vault) and read access to the database:

```bash
# 1. The storage keys of everything purged since the last run (adjust the date)
psql "$BACKUP_DATABASE_URL" -At -c "
  select original_key from media where purged_at >= '2026-10-01'
  union all
  select v.r2_key from media_variants v join media m on m.id = v.media_id where m.purged_at >= '2026-10-01'" > purged.txt
# 2. Delete those files from the backup bucket with the master key. Media keys are never overwritten,
#    so each has a single version; --b2-hard-delete removes it instead of hiding it.
rclone delete b2master:saudade-backups/media --files-from purged.txt --b2-hard-delete
```

Locked versions refuse deletion until their 35 days are up; run it again next quarter for those. The privacy wording
should say deleted photos and voice notes leave the off-site backup within about three months (HANDOVER.md §9).

## 3. One-time setup

Do this once, from your own machine, in this order. About an hour.

### 3.1 The `age` key pair

[age](https://github.com/FiloSottile/age) encrypts each dump to a public key. Only the private key can decrypt it.

```bash
age-keygen -o saudade-backup-key.txt
# Public key: age1…   ← goes into the GitHub secret BACKUP_AGE_RECIPIENT
```

| Copy | Where |
| --- | --- |
| Private key (the whole file; the line that matters starts `AGE-SECRET-KEY-1`) | Password manager entry "Saudade backup age key" |
| Private key on paper | Written out by hand, checked twice, in the same envelope as the `CODE_PEPPER_V1` paper copy |
| Public key (`age1…`) | GitHub secret `BACKUP_AGE_RECIPIENT`; also in every manifest |

Then delete `saudade-backup-key.txt` from the computer. The private key is never stored on a server, in GitHub or in
the repository. Losing it makes every backup unreadable.

### 3.2 The B2 bucket

1. [backblaze.com](https://www.backblaze.com) → B2 Cloud Storage, in the client's name (shared mailbox, 2FA on).
2. Buckets → **Create a Bucket**: private, encryption on (SSE-B2), **Object Lock: enable**. Note the endpoint shown
   on the bucket (e.g. `s3.us-west-004.backblazeb2.com`; the region is `us-west-004`).
3. Bucket settings → **Object Lock** → default retention: **Compliance, 35 days**.
4. Bucket settings → **Lifecycle Settings** → custom rules, exactly the four rows in §2.

### 3.3 The B2 application keys

The web console cannot make a key without delete rights, so use the
[B2 command line tool](https://www.backblaze.com/docs/cloud-storage-command-line-tools) (`pip install b2`), signed
in with the master key (`b2 account authorize`):

```bash
# CI key: write, read, list. No deleteFiles.
b2 key create --bucket saudade-backups saudade-backup-ci listBuckets,listFiles,readFiles,writeFiles
# Read-only key for drills and disasters (vault only, not in GitHub)
b2 key create --bucket saudade-backups saudade-backup-read listBuckets,listFiles,readFiles
```

Older versions of the tool spell it `b2 create-key`. Each command prints a `keyID` (the S3 access key id) and an
`applicationKey` (the S3 secret), shown once. The master key stays in the vault.

### 3.4 Supabase: the database URL and Storage S3 keys

| Value | Where in Supabase | Notes |
| --- | --- | --- |
| Database URL | **Connect** → **Session pooler** URI (port 5432), password filled in | Not the transaction pooler (6543): `pg_dump` cannot use it. Not the direct `db.<ref>.supabase.co` host: it is IPv6 only and GitHub runners have no IPv6. |
| Storage S3 endpoint and region | Project settings → **Storage** → **S3 Connection** | Endpoint `https://<project-ref>.supabase.co/storage/v1/s3`; region is the project's (e.g. `ap-southeast-2`) |
| Storage S3 keys | Same page → **New access key** | These keys can read and write every bucket (like the service role key). Treat them the same way. |

The session pooler URL logs in as `postgres`, the owner of the tables. A read-only role is better, but every table
has row-level security on with no policies, so a role that is not the owner reads nothing unless it has
`BYPASSRLS`. If Supabase lets you create such a role (not verified yet), use it:

```sql
create role saudade_backup login password '<long random>' bypassrls;
grant usage on schema public to saudade_backup;
grant select on all tables in schema public to saudade_backup;
grant select on all sequences in schema public to saudade_backup;
alter default privileges in schema public grant select on tables to saudade_backup;
alter default privileges in schema public grant select on sequences to saudade_backup;
```

Its session pooler user name is `saudade_backup.<project-ref>`. Without `BYPASSRLS` the dump fails at the first
table; that was checked against PostgreSQL 15.

### 3.5 GitHub secrets

Repository → Settings → Secrets and variables → **Actions** → New repository secret:

| Secret | Value | Required |
| --- | --- | --- |
| `BACKUP_DATABASE_URL` | Session pooler URI (§3.4) | Yes |
| `BACKUP_AGE_RECIPIENT` | `age1…` public key (§3.1) | Yes |
| `BACKUP_S3_ENDPOINT` | `https://s3.<region>.backblazeb2.com` | Yes |
| `BACKUP_S3_REGION` | e.g. `us-west-004` | Yes |
| `BACKUP_S3_BUCKET` | e.g. `saudade-backups` | Yes |
| `BACKUP_S3_ACCESS_KEY_ID` | CI key `keyID` (§3.3) | Yes |
| `BACKUP_S3_SECRET_ACCESS_KEY` | CI key `applicationKey` | Yes |
| `MEDIA_S3_ENDPOINT` | Supabase Storage S3 endpoint (§3.4) | Yes |
| `MEDIA_S3_REGION` | Supabase project region | Yes |
| `MEDIA_S3_ACCESS_KEY_ID` | Supabase S3 access key id | Yes |
| `MEDIA_S3_SECRET_ACCESS_KEY` | Supabase S3 secret | Yes |
| `MEDIA_BUCKET` | Storage bucket name | No (default `media`) |
| `BACKUP_REPORT_URL` | `https://<app-domain>/api/cron/backup-report` | No |
| `BACKUP_REPORT_TOKEN` | The app's `CRON_SECRET` | No |

A missing required secret fails the job with its name in the error. Nothing passes silently.

When both `BACKUP_REPORT_URL` and `BACKUP_REPORT_TOKEN` are set, a last job posts the outcome to the app, so the
admin's launch checklist can show when the last good backup ran. It sends counts only: `ok`, database size, units,
media objects, and a short reason when something failed. If the app cannot be reached, the run shows a warning; the
backups themselves still count as done. Without the two secrets the report is skipped with a notice, and the
checklist keeps saying no backup has reported in.

### 3.6 First run

1. Actions → **Backups** → **Run workflow**.
2. Check the run's summary page: a table of rows per table, the file size, and the media object counts.
3. Check B2: `db/YYYY/MM/` has a `.dump.age` and a `.manifest.json`, `db/latest-manifest.json` exists, `media/` has
   files.
4. Do a restore drill (§5) now. A backup is only real once it has been restored.

## 4. Day to day

When a scheduled run fails, GitHub emails the person who created the workflow, or whoever last changed its
`cron` line. Make sure that is someone who reads it. Glance at a run's summary once a month (`ARCHITECTURE.md` §10.5).

| Failure | What it means | What to do |
| --- | --- | --- |
| "Database backup is not configured" / "Media backup is not configured" | Secrets missing | Add them (§3.5) and re-run |
| `pg_dump` connection or authentication error | Wrong URL or password, or Supabase down | Check the session pooler URI; database password changes need the secret updated |
| `pg_dump … server version mismatch` | Supabase upgraded Postgres past the installed client | Raise `postgresql-client-17` and the `/usr/lib/postgresql/17/bin` path in the workflow |
| **Units count dropped** | Tonight's dump has fewer `units` rows than the last good one. Units are never deleted. | Treat as an incident. Tonight's dump is uploaded; `latest-manifest.json` is not, so the alarm repeats every night. Check the audit log and the database. If the drop is expected (for example test units cleared before launch), re-run the workflow with **Accept a lower units count** ticked. |
| Upload or "previous manifest unreadable" | B2 key, bucket or endpoint wrong, or B2 down | Check the `BACKUP_S3_*` secrets; re-run |
| "media objects are missing or different in the backup" | The copy did not finish | Re-run. If it repeats, check the B2 key and the Supabase S3 keys. |
| "Backup report failed" (warning only) | The app did not accept the report | Check `BACKUP_REPORT_URL`, and that `BACKUP_REPORT_TOKEN` equals the app's `CRON_SECRET` |

Never add `-v` to the `rclone` commands in the workflow: it logs every object key, and media ids are capabilities.

GitHub turns off scheduled workflows in **public** repositories after 60 days without activity. Keep the
repository private.

## 5. The restore drill (quarterly, and once before launch)

Run by a person, on their own computer, because it needs the offline private key. About 20 minutes.

**You need:** bash (Git Bash on Windows), PostgreSQL client tools of the same major version as the `pg_dump` in the
manifest (the workflow uses **17**), `age`, the AWS CLI, `rclone`, a local PostgreSQL server or a scratch Supabase
project, and the B2 **read-only** key (§3.3).

1. **Download last night's backup.**

   ```bash
   mkdir drill && cd drill
   export AWS_ACCESS_KEY_ID=<read-only keyID> AWS_SECRET_ACCESS_KEY=<read-only applicationKey>
   export AWS_DEFAULT_REGION=us-west-004
   export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
   B2=https://s3.us-west-004.backblazeb2.com
   aws s3 cp s3://saudade-backups/db/latest-manifest.json . --endpoint-url $B2
   grep '"name"' latest-manifest.json        # → saudade-20261016-023012.dump.age
   aws s3 cp s3://saudade-backups/db/2026/10/saudade-20261016-023012.dump.age . --endpoint-url $B2
   ```

2. **Put the private key in a file** only you can read: paste the vault entry into `drill/key.txt`.

3. **Create an empty scratch database.**

   ```bash
   createdb -h localhost -U postgres restore_drill_20261016
   ```

4. **Run the drill** from the repository root.

   ```bash
   bash scripts/backup/restore-drill.sh \
     --dump drill/saudade-20261016-023012.dump.age \
     --manifest drill/latest-manifest.json \
     --identity drill/key.txt \
     --target postgresql://postgres@localhost:5432/restore_drill_20261016 | tee drill/report.md
   ```

   Put the password in `PGPASSWORD` rather than the URL if the server needs one. The script refuses (exit 2) if the
   target already has anything in `public`. Exit 0 is PASS, 1 is FAIL.

   What it does: checks the file's size and sha256 against the manifest, decrypts to a temporary file (deleted at the
   end), creates the `extensions` schema and `citext`, restores in a single transaction, then checks:

   | Check | Proves |
   | --- | --- |
   | Tables = manifest | Nothing missing, nothing extra |
   | Row counts = manifest | Every row of every table came back |
   | Row contents = manifest checksums | Every row is byte-identical to the night it was taken |
   | `schema_migrations` = manifest | Same schema version |
   | `audit_log` append-only | Both triggers exist and really refuse UPDATE, DELETE and TRUNCATE (tested, then rolled back) |
   | Identity sequences ahead of the data | The restored database can take new rows |
   | RLS on every table, views `security_invoker` | Supabase's public Data API would still expose nothing |

   Roles `anon` and `authenticated` are not needed: owners and grants are not restored. The script creates them only
   if a future dump contains row-level-security policies.

5. **Spot-check 10 media files** against Supabase, byte for byte.

   ```bash
   export RCLONE_CONFIG_SUPABASE_TYPE=s3 RCLONE_CONFIG_SUPABASE_PROVIDER=Other RCLONE_CONFIG_SUPABASE_FORCE_PATH_STYLE=true
   export RCLONE_CONFIG_SUPABASE_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3 RCLONE_CONFIG_SUPABASE_REGION=<region>
   export RCLONE_CONFIG_SUPABASE_ACCESS_KEY_ID=<id> RCLONE_CONFIG_SUPABASE_SECRET_ACCESS_KEY=<secret>
   export RCLONE_CONFIG_BACKUP_TYPE=s3 RCLONE_CONFIG_BACKUP_PROVIDER=Other
   export RCLONE_CONFIG_BACKUP_ENDPOINT=$B2 RCLONE_CONFIG_BACKUP_REGION=us-west-004
   export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID=<read-only keyID> RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY=<read-only applicationKey>
   rclone lsf supabase:media -R --files-only | shuf -n 10 > drill/sample.txt
   rclone check supabase:media backup:saudade-backups/media --files-from drill/sample.txt --download --one-way
   ```

   Expect `0 differences found` and `10 matching files`.

6. **Record it.** Paste `drill/report.md`, the media line and your name into `docs/OPS_LOG.md` (create it on the
   first drill).

7. **Clean up.**

   ```bash
   dropdb -h localhost -U postgres restore_drill_20261016
   rm -rf drill          # includes key.txt
   ```

A FAIL is an incident. Keep the scratch database and the report, then find out why before the next night's backup.

## 6. Disaster scenarios

RPO is how much data can be lost; RTO is how long until the site works again.

| Scenario | Detect | First line | Off-provider copy | RPO | RTO |
| --- | --- | --- | --- | --- | --- |
| Bad deploy | Sentry, uptime | Vercel instant rollback | — | 0 | 5 min |
| Bad data change (bug, wrong admin action) | Audit log, support | Supabase point-in-time recovery, if bought. A Supabase restore replaces the whole database, so later changes are lost. | Restore last night's dump into a scratch database with the drill script; copy the affected rows back with SQL | ≤ 24 h for those rows | 1 h |
| Supabase project deleted, account locked or unusable | Uptime, health check | Supabase daily backup, if the project still exists (7 days) | New project, restore the latest dump and media (§7) | ≤ 24 h | 2–4 h |
| Media deleted from Storage by mistake | Support, canary | None: Storage has no undelete. Removing a stamp in the app only marks it; the file stays 90 days. | Copy it back from B2 (§8) | Uploads since 02:30 UTC | 30 min |
| Whole bucket lost | Canary media check | — | Copy all of B2 `media/` into a new private bucket (§8) | ≤ 24 h | 1–2 h |
| B2 CI key leaked | — | Make a new key (§3.3), update the two secrets, delete the old key | Backups survive: no delete right, and Object Lock | — | 15 min |
| `age` private key lost | Drill fails at decrypt | Paper copy | New key pair, update `BACKUP_AGE_RECIPIENT`, run the workflow. Older backups stay unreadable. | — | 15 min |
| GitHub account or repository lost | No more nightly runs | B2 still holds 35 days | Push any clone to a new repository and add the secrets | — | 1 h |
| Vercel account lost | Uptime | — | Deploy the repository elsewhere, point DNS at it. Chips keep working: the domain is ours. | 0 | ≤ 1 day |
| `CODE_PEPPER_V1` lost | Claims fail | Vault, paper copy | Not in any backup by design | — | — |

## 7. Restoring the database for real

When the Supabase project is gone or unusable.

1. **New project.** Supabase → New project (Pro), the same region if possible. Save the database password.
2. **Restore and verify in one step.** The drill script is the restore tool. Point it at the new project's
   **session pooler** URI; a new project's `public` schema is empty.

   ```bash
   bash scripts/backup/restore-drill.sh --dump <latest>.dump.age --manifest <its manifest> \
     --identity key.txt --target '<new session pooler URI>' | tee restore-report.md
   ```

   Everything written after the backup's snapshot time (`created_at` in the manifest) is lost. The audit log of the
   old project, if it can still be read, shows what happened since.
3. **Lock it down again.** The restore leaves out grants, and a Supabase project may grant `anon`/`authenticated`
   access to new tables by default. RLS is already on (the drill checks it), so nothing is readable, but put the revokes back: run
   the last section of `supabase/migrations/0001_init.sql` (from "Lock the public Data API out of everything" to the
   end) in the SQL editor. It is safe to run twice. Do not run `npm run db:setup` against this project: it is for
   new, empty projects and seeds demo data.
4. **Media.** Storage → New bucket `media`, **private**, 30 MB file limit. Create S3 keys and copy the files back
   (§8).
5. **Point the app at it.** In Vercel, update `DATABASE_URL` (transaction pooler, 6543), `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. Keep `CODE_PEPPER_V1`, `IP_HASH_KEY`, `CRON_SECRET` and the rest exactly as they
   were. Redeploy.
6. **Back up the new project.** Update `BACKUP_DATABASE_URL` and the `MEDIA_S3_*` secrets, run the workflow, check
   its summary.

## 8. Restoring media

Set the two `rclone` remotes as in §5 step 5 (Supabase keys of the project you restore into, B2 read-only key).
Look first, then copy:

```bash
rclone copy backup:saudade-backups/media supabase:media --size-only --dry-run
rclone copy backup:saudade-backups/media supabase:media --size-only
rclone check backup:saudade-backups/media supabase:media --one-way --size-only
```

One file:

```bash
rclone copyto backup:saudade-backups/media/<key> supabase:media/<key>
```

Keys are the same on both sides. The backup also holds files the app deleted on purpose (§2, open decision). After
a full restore, delete them again from Supabase: every object of media rows with `purged_at` set, and the
`incoming/` original of rows with `original_deleted_at` set.

## 9. Yearly, and when someone leaves

| Task | How |
| --- | --- |
| Rotate the B2 CI key | §3.3, update two secrets, delete the old key |
| Rotate the Supabase S3 keys | Storage → S3 Connection: new key, update secrets, revoke the old one |
| Change the database password | Supabase → Database settings; update `BACKUP_DATABASE_URL` (and the app's `DATABASE_URL`) |
| Check the paper copies | Readable, in the envelope, matching the vault |
| Check the client tools | Supabase's Postgres major version is not above the client installed by the workflow (17) |
| New `age` key pair (only if the old one may have leaked) | §3.1. Keep the old private key until its last backup has expired (a year, for the monthly copies). |
