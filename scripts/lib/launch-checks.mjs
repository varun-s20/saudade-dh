/**
 * The launch checks behind `npm run launch:check` (scripts/launch-check.mjs). Pure functions: the
 * CLI reads the env file, content/legal.ts and the database, and these decide what each means.
 * A check is { id, label, status: "ok" | "warn" | "fail", detail } where detail says what to fix.
 */

/** Must match PLACEHOLDER_CHIP_DOMAIN in config/site.ts. */
export const PLACEHOLDER_CHIP_DOMAIN = "saudade.example";

/** Hosting-provider domains must never be written to a chip (MASTER_BUILD_PROMPT §12). */
const PROVIDER_DOMAIN = /(^|\.)(vercel\.app|netlify\.app|onrender\.com|supabase\.co|herokuapp\.com|pages\.dev|workers\.dev|github\.io)$/i;
const HEX64 = /^[0-9a-f]{64}$/i;
const DAY_AND_A_HALF_MS = 36 * 3_600_000;

const val = (env, name) => env[name]?.trim() || "";

function ago(date, now) {
  const h = Math.round((now - date.getTime()) / 3_600_000);
  return h < 1 ? "less than an hour ago" : h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

/**
 * What the env file and the repository alone can tell: the build settings, secrets and keys, and
 * whether the legal wording is still a draft. `legalSource` is the text of content/legal.ts.
 */
export function configChecks(env, legalSource) {
  const checks = [];
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

  add(
    "data_source",
    "Real backend",
    val(env, "NEXT_PUBLIC_DATA_SOURCE") === "api" ? "ok" : "fail",
    val(env, "NEXT_PUBLIC_DATA_SOURCE") === "api" ? "NEXT_PUBLIC_DATA_SOURCE=api." : "NEXT_PUBLIC_DATA_SOURCE must be api in production (mock keeps everything in the browser).",
  );

  const domain = val(env, "NEXT_PUBLIC_CHIP_DOMAIN").toLowerCase() || PLACEHOLDER_CHIP_DOMAIN;
  if (domain === PLACEHOLDER_CHIP_DOMAIN) {
    add("chip_domain", "Chip domain", "fail", `Still the placeholder ${domain}. Set NEXT_PUBLIC_CHIP_DOMAIN to Saudade's own domain and redeploy before generating the launch batch.`);
  } else if (PROVIDER_DOMAIN.test(domain)) {
    add("chip_domain", "Chip domain", "fail", `${domain} belongs to a hosting provider. Chips must carry a domain Saudade owns, or they break when hosting changes.`);
  } else {
    add("chip_domain", "Chip domain", "ok", `Chips will open https://${domain}/t/… (${domain.length + 23} of the NTAG213's 144 bytes).`);
  }

  const showLink = val(env, "NEXT_PUBLIC_SHOW_RECIPIENT_LINK") !== "0";
  add(
    "showcase_link",
    "Showcase-only link after sealing",
    showLink ? "warn" : "ok",
    showLink ? "Senders are shown the address the heart opens after sealing (for demos). Set NEXT_PUBLIC_SHOW_RECIPIENT_LINK=0 for launch." : "Off: the ceramic is the only way to open an envelope.",
  );

  const support = val(env, "NEXT_PUBLIC_SUPPORT_EMAIL");
  add(
    "support_email",
    "Support address",
    !support || support.endsWith(".example") ? "warn" : "ok",
    !support || support.endsWith(".example") ? "The pages still show the placeholder hello@saudade.example. Set NEXT_PUBLIC_SUPPORT_EMAIL." : `Pages show ${support}.`,
  );

  const drafts = (legalSource.match(/^\s*draft:\s*true\b/gm) ?? []).length;
  const undated = (legalSource.match(/^\s*updated:\s*null\b/gm) ?? []).length;
  add(
    "legal",
    "Privacy Policy and Terms wording",
    drafts || undated ? "warn" : "ok",
    drafts || undated
      ? "Still a draft in content/legal.ts. Once the wording is approved, fill the [bracketed] gaps, set `updated` and `draft: false`, and redeploy."
      : "Both pages are approved and dated (check every section has its wording).",
  );

  const badKeys = ["CODE_PEPPER_V1", "IP_HASH_KEY"].filter((n) => !HEX64.test(val(env, n)));
  add(
    "secrets",
    "Code and IP keys",
    badKeys.length ? "fail" : "ok",
    badKeys.length ? `${badKeys.join(" and ")} must be 64 hex characters. CODE_PEPPER_V1 must be the escrowed value: a new one voids every unclaimed card.` : "CODE_PEPPER_V1 and IP_HASH_KEY are set.",
  );

  if (!val(env, "RESEND_API_KEY")) {
    add("email", "Email delivery", "fail", "No RESEND_API_KEY: link emails, recovery links and gift codes are logged in the admin but not delivered.");
  } else {
    const from = val(env, "EMAIL_FROM");
    const fromDomain = /@([^>\s]+)>?\s*$/.exec(from)?.[1]?.toLowerCase() ?? "";
    if (!from || fromDomain.endsWith(".example")) add("email", "Email delivery", "warn", "Sending is on, but EMAIL_FROM is unset or a placeholder. Use an address on Saudade's verified domain.");
    else add("email", "Email delivery", "ok", `Delivered through Resend from ${from}.`);
  }

  const origin = val(env, "PUBLIC_APP_ORIGIN");
  add(
    "public_origin",
    "Address in emailed links",
    origin ? "ok" : "warn",
    origin ? `Links in emails start ${origin}.` : "PUBLIC_APP_ORIGIN is unset, so emailed links use whatever address the request came in on. Set it to the production address.",
  );

  if (!val(env, "CRON_SECRET")) add("cron", "Nightly jobs", "fail", "CRON_SECRET is not set, so the nightly jobs (clean-up, song checks, retries) can't run. Set it on the host.");

  const turnstile = Boolean(val(env, "NEXT_PUBLIC_TURNSTILE_SITE_KEY") && val(env, "TURNSTILE_SECRET_KEY"));
  add(
    "turnstile",
    "Bot check for the claim page",
    turnstile ? "ok" : "warn",
    turnstile
      ? "On standby: switches on for everyone for 6 hours if mass code-guessing is detected."
      : "Optional. Without Turnstile keys, mass code-guessing pauses all claims for up to an hour instead of asking for a bot check.",
  );
  return checks;
}

/**
 * What the database says: whether the scheduled work is running, and anything stuck.
 *   runs                Map task → { last_finished_at: Date | null, last_ok, last_error } from ops_runs
 *   jobs                { dead, stuck, pending_media } counts
 *   placeholderBatches  live batches (not demo, not void) made for the placeholder chip domain
 *   cronConfigured      whether CRON_SECRET is set (configChecks already reports it when not)
 */
export function dataChecks({ runs, jobs, placeholderBatches, cronConfigured }, now = Date.now()) {
  const checks = [];
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail });

  const daily = runs.get("cron.daily");
  if (!cronConfigured) {
    // Already a "fix" from configChecks.
  } else if (!daily?.last_finished_at) {
    add("cron", "Nightly jobs", "warn", "Configured, but no nightly run has finished yet (03:00 UTC).");
  } else if (now - daily.last_finished_at.getTime() > DAY_AND_A_HALF_MS) {
    add("cron", "Nightly jobs", "fail", `The last nightly run finished ${ago(daily.last_finished_at, now)}. Check the cron settings on the host.`);
  } else {
    add(
      "cron",
      "Nightly jobs",
      daily.last_ok ? "ok" : "warn",
      daily.last_ok ? `Last ran ${ago(daily.last_finished_at, now)}.` : `Last ran ${ago(daily.last_finished_at, now)} with problems: ${daily.last_error ?? "see the logs"}.`,
    );
  }

  const backup = runs.get("backup.nightly");
  if (!backup?.last_finished_at) {
    add("backup", "Off-site backups", "warn", "No nightly backup has reported in yet. Set up the backup workflow and its BACKUP_REPORT_URL / BACKUP_REPORT_TOKEN secrets (docs/BACKUPS.md).");
  } else if (!backup.last_ok || now - backup.last_finished_at.getTime() > DAY_AND_A_HALF_MS) {
    add("backup", "Off-site backups", "fail", `The last backup ${backup.last_ok ? "succeeded" : "FAILED"} ${ago(backup.last_finished_at, now)}. Check the workflow on GitHub.`);
  } else {
    add("backup", "Off-site backups", "ok", `Last good backup ${ago(backup.last_finished_at, now)}.`);
  }

  const problems = [
    jobs.dead && `${jobs.dead} job${jobs.dead === 1 ? "" : "s"} gave up (see the jobs table's last_error)`,
    jobs.stuck && `${jobs.stuck} waiting more than a day`,
    jobs.pending_media && `${jobs.pending_media} photo or voice file${jobs.pending_media === 1 ? "" : "s"} not converted yet (served as uploaded until then)`,
  ].filter(Boolean);
  add("jobs", "Media processing", problems.length ? "warn" : "ok", problems.length ? `${problems.join("; ")}.` : "Every photo and voice note has been converted.");

  if (placeholderBatches) {
    add(
      "batches",
      "Batches on the placeholder domain",
      "warn",
      `${placeholderBatches} batch(es) were generated for ${PLACEHOLDER_CHIP_DOMAIN}. Never encode those: void them and generate again on the real domain.`,
    );
  }
  return checks;
}
