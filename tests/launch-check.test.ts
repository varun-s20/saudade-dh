import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_CHIP_DOMAIN as SITE_PLACEHOLDER } from "@/config/site";
import { configChecks, dataChecks, PLACEHOLDER_CHIP_DOMAIN } from "../scripts/lib/launch-checks.mjs";

const legal = fs.readFileSync(path.join(import.meta.dirname, "..", "content", "legal.ts"), "utf8");
const HEX = "ab".repeat(32);
const byId = (checks: { id: string; status: string; detail: string }[]) => Object.fromEntries(checks.map((c) => [c.id, c]));

describe("npm run launch:check (developer only, not in the admin)", () => {
  it("flags a fresh env file: placeholder domain, no email, demo link on, legal still a draft", () => {
    const c = byId(configChecks({ NEXT_PUBLIC_DATA_SOURCE: "api", CODE_PEPPER_V1: HEX, IP_HASH_KEY: HEX }, legal));
    expect(c.chip_domain.status).toBe("fail");
    expect(c.email.status).toBe("fail");
    expect(c.cron.status).toBe("fail");
    expect(c.showcase_link.status).toBe("warn");
    expect(c.support_email.status).toBe("warn");
    expect(c.legal.status).toBe("warn");
    expect(c.secrets.status).toBe("ok");
  });

  it("is all clear for a finished production env", () => {
    const env = {
      NEXT_PUBLIC_DATA_SOURCE: "api",
      NEXT_PUBLIC_CHIP_DOMAIN: "saudade.gift",
      NEXT_PUBLIC_SHOW_RECIPIENT_LINK: "0",
      NEXT_PUBLIC_SUPPORT_EMAIL: "hello@saudade.gift",
      CODE_PEPPER_V1: HEX,
      IP_HASH_KEY: HEX,
      RESEND_API_KEY: "re_x",
      EMAIL_FROM: "Saudade <letters@saudade.gift>",
      PUBLIC_APP_ORIGIN: "https://saudade.gift",
      CRON_SECRET: "s",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
      TURNSTILE_SECRET_KEY: "k",
    };
    const approved = legal.replace(/^(\s*)draft:\s*true\b/gm, "$1draft: false").replace(/^(\s*)updated:\s*null\b/gm, '$1updated: "1 November 2026"');
    expect(configChecks(env, approved).filter((c) => c.status !== "ok")).toEqual([]);
  });

  it("refuses hosting-provider domains and the wrong data source", () => {
    const c = byId(configChecks({ NEXT_PUBLIC_DATA_SOURCE: "mock", NEXT_PUBLIC_CHIP_DOMAIN: "saudade.vercel.app" }, legal));
    expect(c.chip_domain.status).toBe("fail");
    expect(c.data_source.status).toBe("fail");
    expect(c.secrets.status).toBe("fail");
  });

  it("reads the nightly runs, backups and job queue", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    const fresh = { last_finished_at: new Date(now - 6 * 3_600_000), last_ok: true, last_error: null };
    const stale = { last_finished_at: new Date(now - 3 * 86_400_000), last_ok: true, last_error: null };
    const ok = byId(dataChecks({ runs: new Map([["cron.daily", fresh], ["backup.nightly", fresh]]), jobs: { dead: 0, stuck: 0, pending_media: 0 }, placeholderBatches: 0, cronConfigured: true }, now));
    expect([ok.cron.status, ok.backup.status, ok.jobs.status, ok.batches]).toEqual(["ok", "ok", "ok", undefined]);
    const bad = byId(dataChecks({ runs: new Map([["cron.daily", stale]]), jobs: { dead: 1, stuck: 0, pending_media: 2 }, placeholderBatches: 3, cronConfigured: true }, now));
    expect([bad.cron.status, bad.backup.status, bad.jobs.status, bad.batches.status]).toEqual(["fail", "warn", "warn", "warn"]);
  });

  it("uses the same placeholder domain as the site", () => {
    expect(PLACEHOLDER_CHIP_DOMAIN).toBe(SITE_PLACEHOLDER);
  });
});
