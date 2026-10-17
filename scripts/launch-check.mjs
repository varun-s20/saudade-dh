/**
 * The launch checklist, for the developer (not part of the admin): every deployment setting that
 * must be right before real ceramics ship, with the fix in plain words. Read-only.
 *
 *   vercel env pull .env.production.local --environment=production
 *   npm run launch:check -- --env-file .env.production.local
 *
 * It reads the env file (the same values the host builds with), content/legal.ts, and, with
 * DATABASE_URL, the nightly-job and backup records and anything stuck in the job queue.
 * Exits 1 while anything needs fixing, so it can gate a release.
 */
import fs from "node:fs";
import path from "node:path";
import { configChecks, dataChecks, PLACEHOLDER_CHIP_DOMAIN } from "./lib/launch-checks.mjs";
import { connect, fail, loadEnv, parseArgs, ROOT } from "./lib/ops-common.mjs";

const args = parseArgs();
const envFile = loadEnv(args["env-file"]);
const legal = fs.readFileSync(path.join(ROOT, "content", "legal.ts"), "utf8");
const checks = configChecks(process.env, legal);

if (process.env.DATABASE_URL?.trim()) {
  const sql = connect();
  try {
    const runs = new Map((await sql`select task, last_finished_at, last_ok, last_error from ops_runs`).map((r) => [r.task, r]));
    const [jobs] = await sql`
      select (select count(*)::int from jobs where state = 'dead') as dead,
             (select count(*)::int from jobs where state = 'queued' and run_after < now() - interval '1 day') as stuck,
             (select count(*)::int from media m where m.state = 'ready' and m.original_deleted_at is null
                and not exists (select 1 from media_variants v where v.media_id = m.id)) as pending_media`;
    const [{ n }] = await sql`
      select count(*)::int as n from batches where status <> 'void' and chip_domain = ${PLACEHOLDER_CHIP_DOMAIN} and label not like 'Demo%'`;
    checks.push(...dataChecks({ runs, jobs, placeholderBatches: n, cronConfigured: Boolean(process.env.CRON_SECRET?.trim()) }));
  } catch (e) {
    fail(`Couldn't read the database: ${e instanceof Error ? e.message : e}`);
  } finally {
    await sql.end();
  }
} else {
  checks.push({ id: "database", label: "Database", status: "warn", detail: "No DATABASE_URL in the env file, so the nightly jobs, backups and job queue weren't checked." });
}

const WORD = { fail: "FIX  ", warn: "CHECK", ok: "OK   " };
const ORDER = { fail: 0, warn: 1, ok: 2 };
console.log(`Launch check · ${path.basename(envFile)}\n`);
for (const c of [...checks].sort((a, b) => ORDER[a.status] - ORDER[b.status])) console.log(`${WORD[c.status]}  ${c.label}\n       ${c.detail}`);
const count = (s) => checks.filter((c) => c.status === s).length;
console.log(`\n${count("fail")} to fix, ${count("warn")} to check, ${count("ok")} ready.`);
process.exit(count("fail") ? 1 : 0);
