import { site } from "@/config/site";
import { generateId } from "@/lib/parsing/codes";
import type { RecipientEnvelope, RevealEvent, RevealService } from "@/lib/services/types";
import { isForced } from "@/lib/state/demo";
import { appendAudit, db, fail, latency, nowIso, ok, patchUnit, ready, unitBySlug, update } from "./runtime";

export const revealService: RevealService = {
  async getEnvelope(slug) {
    await ready();
    await latency(0.7);
    if (isForced("network")) return fail("network");
    const unit = unitBySlug(slug);
    if (!unit) return fail("not_found");
    const env: RecipientEnvelope = {
      slug: unit.slug,
      status: unit.status,
      sealedAt: unit.sealedAt,
      revealedAt: unit.revealedAt,
      contents: db().contents[unit.id] ?? {},
    };
    return ok(env);
  },

  async markRevealed(slug, info) {
    await ready();
    await latency(0.4);
    const unit = unitBySlug(slug);
    if (!unit) return fail("not_found");
    if (unit.revealedAt) return ok(undefined); // idempotent
    const revealable = unit.status === "sealed" || (!site.requireSealBeforeReveal && unit.status === "filled");
    if (!revealable) return ok(undefined);

    const at = nowIso();
    const event: RevealEvent = {
      id: generateId("rev"),
      unitId: unit.id,
      at,
      skipped: info.skipped,
      reducedMotion: info.reducedMotion,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    };
    update((s) => ({ reveals: [event, ...s.reveals] }));
    patchUnit(unit.id, { status: "revealed", revealedAt: at });
    appendAudit({ unitId: unit.id, action: "unit.revealed", actor: "recipient", detail: info.skipped ? "skipped choreography" : "watched choreography" });
    return ok(undefined);
  },
};
