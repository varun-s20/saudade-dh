/**
 * The launch checklist (GET /api/admin/readiness): every deployment setting that must be right
 * before real ceramics ship, checked live, with the fix in plain words. It reads configuration and
 * counts only; it never changes anything. docs/HANDOVER.md §4 explains each variable.
 *
 * Build-time items (chip domain, showcase link, support address, legal wording) come
 * from lib/readiness-config.ts, shared with the prototype; this adds what only the server knows.
 */
import "server-only";
import { PLACEHOLDER_CHIP_DOMAIN, site } from "@/config/site";
import { configChecks } from "@/lib/readiness-config";
import type { Readiness, ReadinessCheck } from "@/lib/services/types";
import { sql } from "./db";
import { env } from "./env";

const ago = (d: Date) => {
  const h = Math.round((Date.now() - d.getTime()) / 3_600_000);
  return h < 1 ? "less than an hour ago" : h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
};

const DAY_AND_A_HALF_MS = 36 * 3_600_000;

interface RunRow {
  task: string;
  last_finished_at: Date | null;
  last_ok: boolean | null;
  last_error: string | null;
}

export async function readiness(): Promise<Readiness> {
  const checks: ReadinessCheck[] = configChecks();
  const add = (id: string, label: string, status: ReadinessCheck["status"], detail: string) => checks.push({ id, label, status, detail });

  // ── Email ──
  if (!env.resendApiKey()) {
    add("email", "Email delivery", "fail", "No RESEND_API_KEY: link emails, recovery links and gift codes are logged in the admin but not delivered.");
  } else {
    const from = env.emailFrom();
    const fromDomain = /@([^>\s]+)>?\s*$/.exec(from)?.[1]?.toLowerCase() ?? "";
    if (fromDomain.endsWith(".example")) add("email", "Email delivery", "warn", `Sending is on, but EMAIL_FROM is still ${from}. Use an address on Saudade's verified domain.`);
    else add("email", "Email delivery", "ok", `Delivered through Resend from ${from}.`);
  }
  add(
    "public_origin",
    "Address in emailed links",
    env.publicOrigin() ? "ok" : "warn",
    env.publicOrigin() ? `Links in emails start ${env.publicOrigin()}.` : "PUBLIC_APP_ORIGIN is unset, so emailed links use whatever address the request came in on. Set it to the production address.",
  );

  // ── Scheduled work ──
  const runs = new Map((await sql()<RunRow[]>`select task, last_finished_at, last_ok, last_error from ops_runs`).map((r) => [r.task, r]));
  const daily = runs.get("cron.daily");
  if (!env.cronSecret()) {
    add("cron", "Nightly jobs", "fail", "CRON_SECRET is not set, so the nightly jobs (clean-up, song checks, retries) can't run. Set it in the host's environment.");
  } else if (!daily?.last_finished_at) {
    add("cron", "Nightly jobs", "warn", "Configured, but no nightly run has finished yet (03:00 UTC).");
  } else if (Date.now() - daily.last_finished_at.getTime() > DAY_AND_A_HALF_MS) {
    add("cron", "Nightly jobs", "fail", `The last nightly run finished ${ago(daily.last_finished_at)}. Check the cron settings on the host.`);
  } else {
    add("cron", "Nightly jobs", daily.last_ok ? "ok" : "warn", daily.last_ok ? `Last ran ${ago(daily.last_finished_at)}.` : `Last ran ${ago(daily.last_finished_at)} with problems: ${daily.last_error ?? "see the logs"}.`);
  }

  const backup = runs.get("backup.nightly");
  if (!backup?.last_finished_at) {
    add("backup", "Off-site backups", "warn", "No nightly backup has reported in yet. Set up the backup workflow and its BACKUP_REPORT_URL / BACKUP_REPORT_TOKEN secrets (docs/BACKUPS.md).");
  } else if (!backup.last_ok || Date.now() - backup.last_finished_at.getTime() > DAY_AND_A_HALF_MS) {
    add("backup", "Off-site backups", "fail", `The last backup ${backup.last_ok ? "succeeded" : "FAILED"} ${ago(backup.last_finished_at)}. Check the workflow on GitHub.`);
  } else {
    add("backup", "Off-site backups", "ok", `Last good backup ${ago(backup.last_finished_at)}.`);
  }

  const [jobs] = await sql()<{ dead: number; stuck: number; pending_media: number }[]>`
    select (select count(*)::int from jobs where state = 'dead') as dead,
           (select count(*)::int from jobs where state = 'queued' and run_after < now() - interval '1 day') as stuck,
           (select count(*)::int from media m where m.state = 'ready' and m.original_deleted_at is null
              and not exists (select 1 from media_variants v where v.media_id = m.id)) as pending_media`;
  const jobProblems = [
    jobs.dead && `${jobs.dead} job${jobs.dead === 1 ? "" : "s"} gave up (see the jobs table's last_error)`,
    jobs.stuck && `${jobs.stuck} waiting more than a day`,
    jobs.pending_media && `${jobs.pending_media} photo or voice file${jobs.pending_media === 1 ? "" : "s"} not converted yet (served as uploaded until then)`,
  ].filter(Boolean);
  add("jobs", "Media processing", jobProblems.length ? "warn" : "ok", jobProblems.length ? `${jobProblems.join("; ")}.` : "Every photo and voice note has been converted.");

  // ── Abuse protection ──
  const turnstile = Boolean(site.turnstileSiteKey && env.turnstileSecret());
  add(
    "turnstile",
    "Bot check for the claim page",
    turnstile ? "ok" : "warn",
    turnstile
      ? "On standby: switches on for everyone for 6 hours if mass code-guessing is detected."
      : "Optional. Without Turnstile keys, mass code-guessing pauses all claims for up to an hour instead of asking for a bot check.",
  );

  const [{ n: placeholderBatches }] = await sql()<{ n: number }[]>`
    select count(*)::int as n from batches where status <> 'void' and chip_domain = ${PLACEHOLDER_CHIP_DOMAIN} and label not like 'Demo%'`;
  if (placeholderBatches) {
    add("batches", "Batches on the placeholder domain", "warn", `${placeholderBatches} batch(es) were generated for ${PLACEHOLDER_CHIP_DOMAIN}. Never encode those: void them and generate again on the real domain.`);
  }

  return { checkedAt: new Date().toISOString(), checks };
}
