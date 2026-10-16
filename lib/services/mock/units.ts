import { site, senderPath } from "@/config/site";
import { HERO } from "@/lib/demo/constants";
import { generateToken, normaliseCode } from "@/lib/parsing/codes";
import type { ClaimResult, SenderEnvelope, ServiceResult, UnitService } from "@/lib/services/types";
import { isForced } from "@/lib/state/demo";
import { recoverLinkEmail, senderLinkEmail } from "@/lib/email/templates";
import { emailService } from "./email";
import { appendAudit, db, fail, hasContent, latency, nowIso, ok, patchUnit, ready, unitByToken, update } from "./runtime";

function rateLimitStatus(): { limited: boolean; retryAfterSec: number } {
  const { claimAttempts, claimWindowSec, claimCooldownSec } = site.rateLimit;
  const now = Date.now();
  const recent = db().claimFailures.filter((t) => now - t < claimWindowSec * 1000);
  if (recent.length < claimAttempts) return { limited: false, retryAfterSec: 0 };
  const last = Math.max(...recent);
  const remaining = Math.ceil((last + claimCooldownSec * 1000 - now) / 1000);
  return remaining > 0 ? { limited: true, retryAfterSec: remaining } : { limited: false, retryAfterSec: 0 };
}

function recordFailure() {
  update((s) => ({ claimFailures: [...s.claimFailures, Date.now()].slice(-50) }));
}

export function toSenderEnvelope(unitId: string): SenderEnvelope {
  const u = db().units[unitId];
  return {
    unit: {
      id: u.id,
      slug: u.slug,
      status: u.status,
      senderEmail: u.senderEmail,
      claimedAt: u.claimedAt,
      sealedAt: u.sealedAt,
      revealedAt: u.revealedAt,
      updatedAt: u.updatedAt,
    },
    contents: db().contents[unitId] ?? {},
  };
}

export const unitService: UnitService = {
  async claim(input): Promise<ServiceResult<ClaimResult>> {
    await ready();
    await latency();

    if (isForced("rate_limited")) return fail("rate_limited", { retryAfterSec: site.rateLimit.claimCooldownSec });
    const rl = rateLimitStatus();
    if (rl.limited) return fail("rate_limited", { retryAfterSec: rl.retryAfterSec });
    if (isForced("invalid_code")) return fail("invalid_code");
    if (isForced("already_claimed")) return fail("already_claimed");

    const code = normaliseCode(input);
    const found = code ? Object.values(db().units).find((u) => u.code === code) : undefined;
    // Codes from a voided batch (its card CSV was lost before encoding) are unknown codes.
    const unit = found && db().batches.find((b) => b.id === found.batchId)?.status !== "void" ? found : undefined;
    if (!unit) {
      recordFailure();
      return fail("invalid_code");
    }
    if (unit.codeRedeemedAt) {
      recordFailure();
      return fail("already_claimed");
    }

    // A code reissued by the admin re-claims the same envelope: content, seal and reveal are
    // kept; only a new private link is issued (the old one was revoked at reset).
    const token = unit.id === HERO.id ? HERO.token : generateToken();
    const at = nowIso();
    const fresh = unit.status === "unassigned" || unit.status === "assigned";
    patchUnit(unit.id, {
      status: fresh ? "claimed" : unit.status,
      senderToken: token,
      codeRedeemedAt: at,
      claimedAt: unit.claimedAt ?? at,
      path: unit.path ?? "A",
    });
    appendAudit({ unitId: unit.id, action: "unit.claimed", actor: "sender", detail: fresh ? undefined : "re-claimed with a reissued code" });
    appendAudit({ unitId: unit.id, action: "unit.token_issued", actor: "system" });
    return ok({ token, slug: unit.slug, senderUrl: senderPath(token) });
  },

  async saveSenderEmail(token, email) {
    await ready();
    await latency();
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");
    patchUnit(unit.id, { senderEmail: email.trim().toLowerCase() });
    const link = `${typeof window !== "undefined" ? window.location.origin : ""}${senderPath(token)}`;
    await emailService.send(senderLinkEmail({ to: email, link }));
    return ok(undefined);
  },

  async recoverLink(email) {
    await ready();
    await latency();
    const addr = email.trim().toLowerCase();
    const matches = Object.values(db().units).filter((u) => u.senderEmail === addr && u.senderToken);
    if (matches.length) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const links = matches.map((u) => `${origin}${senderPath(u.senderToken as string)}`);
      await emailService.send(recoverLinkEmail({ to: addr, links }));
    }
    // Same response either way: never reveal whether an email is known.
    return ok(undefined);
  },

  async seal(token) {
    await ready();
    await latency(1.3);
    if (isForced("network")) return fail("network");
    const unit = unitByToken(token);
    if (!unit) return fail("not_found");
    if (!hasContent(db().contents[unit.id])) return fail("nothing_to_seal");
    if (unit.status === "sealed" || unit.status === "revealed") return ok(toSenderEnvelope(unit.id));
    patchUnit(unit.id, { status: "sealed", sealedAt: nowIso() });
    appendAudit({ unitId: unit.id, action: "unit.sealed", actor: "sender" });
    return ok(toSenderEnvelope(unit.id));
  },
};
