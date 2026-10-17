import { recipientUrl, site } from "@/config/site";
import { summarise } from "@/lib/content-summary";
import { codeBody, generateCode, generateId, generateSlug } from "@/lib/parsing/codes";
import type {
  AdminService,
  AdminSession,
  AdminStats,
  Batch,
  ContentMap,
  ContentVersion,
  ProvisionedRow,
  Unit,
  UnitStatus,
} from "@/lib/services/types";
import { STAMP_KINDS, UNIT_STATUSES } from "@/lib/services/types";
import { giftCodeEmail, withoutHtml } from "@/lib/email/templates";
import { emailService } from "./email";
import { appendAudit, db, fail, latency, nowIso, ok, patchUnit, ready, statusAfterEdit, update } from "./runtime";

/** Prototype-only credentials, shown on the login screen as a demo hint. */
export const DEMO_ADMIN = { email: "zeya@saudade.example", password: "postmark" } as const;

/** Version history lives on the real backend. */
const BACKEND_ONLY = { detail: "Available with the real backend (NEXT_PUBLIC_DATA_SOURCE=api)" };

function signedIn(): boolean {
  return Boolean(db().admin);
}

/** Batches saved by an older prototype build lack the lifecycle fields. */
function asBatch(b: Batch): Batch {
  const units = Object.values(db().units).filter((u) => u.batchId === b.id);
  return {
    ...b,
    status: b.status ?? "generated",
    chipDomain: b.chipDomain ?? site.chipDomain,
    encodedAt: b.encodedAt ?? null,
    claimedCount: units.filter((u) => u.codeRedeemedAt || u.claimedAt).length,
  };
}

function patchBatch(id: string, patch: Partial<Batch>): Batch | null {
  const found = db().batches.find((b) => b.id === id);
  if (!found) return null;
  update((s) => ({ batches: s.batches.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  return asBatch({ ...found, ...patch });
}

/** The prototype keeps only the current version of each stamp. */
function currentVersions(map: ContentMap): ContentVersion[] {
  return STAMP_KINDS.flatMap((kind) => {
    const rec = map[kind];
    if (!rec) return [];
    return [{ kind, version: rec.version, savedBy: "sender", savedAt: rec.updatedAt, supersededAt: null, removedAt: null, current: true, summary: summarise(rec.content), restorable: true } satisfies ContentVersion];
  }).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

function toCsv(rows: ProvisionedRow[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return ["unit_no,code,slug,url", ...rows.map((r) => [r.unitNo, r.code, r.slug, r.url].map(esc).join(","))].join("\n") + "\n";
}

export const adminService: AdminService = {
  async signIn(email, password) {
    await ready();
    await latency(1.2);
    if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) return fail("unauthorized");
    const session: AdminSession = { email: DEMO_ADMIN.email, signedInAt: nowIso() };
    update(() => ({ admin: session }));
    appendAudit({ unitId: null, action: "admin.signed_in", actor: "admin", detail: session.email });
    return ok(session);
  },

  async signOut() {
    await ready();
    update(() => ({ admin: null }));
  },

  async getSession() {
    await ready();
    return db().admin;
  },

  async getStats() {
    await ready();
    await latency(0.6);
    if (!signedIn()) return fail("unauthorized");
    const units = Object.values(db().units);
    const byStatus = Object.fromEntries(UNIT_STATUSES.map((s) => [s, 0])) as Record<UnitStatus, number>;
    units.forEach((u) => byStatus[u.status]++);
    const weekAgo = Date.now() - 7 * 86_400_000;
    const stats: AdminStats = {
      total: units.length,
      byStatus,
      revealedLast7Days: units.filter((u) => u.revealedAt && Date.parse(u.revealedAt) > weekAgo).length,
      recent: db().audit.slice(0, 12).map((a) => {
        const u = a.unitId ? db().units[a.unitId] : undefined;
        return { ...a, unitNo: u?.unitNo ?? null, code: u?.code ?? null };
      }),
    };
    return ok(stats);
  },

  async listUnits({ search = "", status = "all", batchId, page = 1, pageSize = 25 }) {
    await ready();
    await latency(0.5);
    if (!signedIn()) return fail("unauthorized");
    const q = search.trim().toLowerCase();
    const qCode = codeBody(search);
    let items = Object.values(db().units);
    if (status !== "all") items = items.filter((u) => u.status === status);
    if (batchId) items = items.filter((u) => u.batchId === batchId);
    if (q) {
      items = items.filter(
        (u) =>
          (qCode.length >= 2 && codeBody(u.code).includes(qCode)) ||
          u.unitNo.toLowerCase() === q ||
          u.slug.includes(q) ||
          (u.senderEmail ?? "").includes(q) ||
          (u.codeEmailedTo ?? "").includes(q),
      );
    }
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = items.length;
    const start = (page - 1) * pageSize;
    return ok({ items: items.slice(start, start + pageSize), total, page, pageSize });
  },

  async getUnit(unitId) {
    await ready();
    await latency(0.5);
    if (!signedIn()) return fail("unauthorized");
    const unit = db().units[unitId];
    if (!unit) return fail("not_found");
    const contents = db().contents[unitId] ?? {};
    return ok({
      unit,
      contents,
      audit: db().audit.filter((a) => a.unitId === unitId),
      reveals: db().reveals.filter((r) => r.unitId === unitId),
      history: currentVersions(contents),
    });
  },

  async resetCode(unitId) {
    await ready();
    await latency();
    if (!signedIn()) return fail("unauthorized");
    const unit = db().units[unitId];
    if (!unit) return fail("not_found");
    const taken = new Set(Object.values(db().units).map((u) => u.code));
    let code = generateCode();
    while (taken.has(code)) code = generateCode();
    // New unredeemed code; the old code and the old private link stop working. Status, content,
    // seal and reveal are untouched: the sender re-claims the same envelope with the new code.
    patchUnit(unitId, { code, codeRedeemedAt: null, senderToken: null });
    appendAudit({ unitId, action: "unit.code_reset", actor: "admin", detail: `${unit.code} → ${code}` });
    if (unit.senderToken) appendAudit({ unitId, action: "unit.tokens_revoked", actor: "admin" });
    return ok({ code });
  },

  async resetReveal(unitId) {
    await ready();
    await latency();
    if (!signedIn()) return fail("unauthorized");
    const unit = db().units[unitId];
    if (!unit) return fail("not_found");
    patchUnit(unitId, { revealedAt: null, status: unit.status === "revealed" ? "sealed" : unit.status });
    appendAudit({ unitId, action: "unit.reveal_reset", actor: "admin" });
    return ok(undefined);
  },

  async emailCode(unitId, to) {
    await ready();
    if (!signedIn()) return fail("unauthorized");
    const unit = db().units[unitId];
    if (!unit) return fail("not_found");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const sent = await emailService.send(withoutHtml(giftCodeEmail({ to, code: unit.code, origin })));
    if (!sent.ok) return sent;
    patchUnit(unitId, {
      codeEmailedAt: sent.data.sentAt,
      codeEmailedTo: sent.data.to,
      path: "B",
      status: unit.status === "unassigned" ? "assigned" : unit.status,
    });
    appendAudit({ unitId, action: "unit.code_emailed", actor: "admin", detail: sent.data.to });
    return ok(sent.data);
  },

  async setPath(unitId, path) {
    await ready();
    await latency(0.4);
    if (!signedIn()) return fail("unauthorized");
    if (!db().units[unitId]) return fail("not_found");
    patchUnit(unitId, { path });
    appendAudit({ unitId, action: "unit.path_set", actor: "admin", detail: `Path ${path}` });
    return ok(undefined);
  },

  async removeContent(unitId, kind, photoId) {
    await ready();
    await latency();
    if (!signedIn()) return fail("unauthorized");
    const unit = db().units[unitId];
    if (!unit) return fail("not_found");
    const map: ContentMap = { ...(db().contents[unitId] ?? {}) };
    const photos = map.photos;
    if (kind === "photos" && photoId && photos) {
      const items = photos.content.items.filter((p) => p.id !== photoId);
      if (items.length) map.photos = { ...photos, content: { kind: "photos", items }, version: photos.version + 1, updatedAt: nowIso() };
      else delete map.photos;
    } else {
      delete map[kind];
    }
    update((s) => ({ contents: { ...s.contents, [unitId]: map } }));
    patchUnit(unitId, { status: statusAfterEdit(unit.status, map) });
    appendAudit({ unitId, action: "content.removed_by_admin", actor: "admin", detail: photoId ? `photo ${photoId}` : kind });
    return ok(undefined);
  },

  async restoreContent() {
    await ready();
    await latency(0.4);
    if (!signedIn()) return fail("unauthorized");
    return fail("not_found", BACKEND_ONLY);
  },

  async listBatches() {
    await ready();
    await latency(0.4);
    if (!signedIn()) return fail("unauthorized");
    return ok([...db().batches].map(asBatch).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async markBatchEncoded(batchId) {
    await ready();
    await latency(0.5);
    if (!signedIn()) return fail("unauthorized");
    const b = db().batches.find((x) => x.id === batchId);
    if (!b) return fail("not_found");
    if (b.status === "void") return fail("invalid_input", { detail: "this batch was voided" });
    if (b.status === "encoded") return ok(asBatch(b));
    appendAudit({ unitId: null, action: "batch.encoded", actor: "admin", detail: b.label });
    return ok(patchBatch(batchId, { status: "encoded", encodedAt: nowIso() })!);
  },

  async voidBatch(batchId) {
    await ready();
    await latency(0.5);
    if (!signedIn()) return fail("unauthorized");
    const b = db().batches.find((x) => x.id === batchId);
    if (!b) return fail("not_found");
    if (b.status === "encoded") return fail("invalid_input", { detail: "the chips are already encoded: an encoded batch can never be voided" });
    if (b.status === "void") return ok(asBatch(b));
    const claimed = asBatch(b).claimedCount;
    if (claimed) return fail("invalid_input", { detail: `${claimed} of its codes are already claimed` });
    appendAudit({ unitId: null, action: "batch.voided", actor: "admin", detail: b.label });
    return ok(patchBatch(batchId, { status: "void" })!);
  },

  async generateBatch(count, label) {
    await ready();
    await latency(1.5);
    if (!signedIn()) return fail("unauthorized");
    const n = Math.max(1, Math.min(5000, Math.floor(count)));
    const codes = new Set(Object.values(db().units).map((u) => u.code));
    const slugs = new Set(Object.values(db().units).map((u) => u.slug));
    const batch: Batch = {
      id: generateId("batch"),
      label: label || `Batch · ${n}`,
      createdAt: nowIso(),
      count: n,
      status: "generated",
      chipDomain: site.chipDomain,
      encodedAt: null,
      claimedCount: 0,
    };
    const created: Record<string, Unit> = {};
    const rows: ProvisionedRow[] = [];
    let nextNo = Object.keys(db().units).length;
    for (let i = 0; i < n; i++) {
      let code = generateCode();
      while (codes.has(code)) code = generateCode();
      let slug = generateSlug();
      while (slugs.has(slug)) slug = generateSlug();
      codes.add(code);
      slugs.add(slug);
      const id = generateId("unit");
      const at = nowIso();
      const unitNo = `S-${String(++nextNo).padStart(4, "0")}`;
      created[id] = {
        id, unitNo, code, codeRedeemedAt: null, slug, status: "unassigned", path: null, batchId: batch.id, senderEmail: null, senderToken: null,
        createdAt: at, updatedAt: at, claimedAt: null, sealedAt: null, revealedAt: null, codeEmailedAt: null, codeEmailedTo: null,
      };
      rows.push({ unitNo, code, slug, url: recipientUrl(slug) });
    }
    update((s) => ({ units: { ...s.units, ...created }, batches: [batch, ...s.batches] }));
    appendAudit({ unitId: null, action: "batch.generated", actor: "admin", detail: `${batch.label}: ${n} unit${n === 1 ? "" : "s"}` });
    return ok({ batch, rows });
  },

  async exportBatchCsv(batchId) {
    await ready();
    await latency(0.6);
    if (!signedIn()) return fail("unauthorized");
    const rows = Object.values(db().units)
      .filter((u) => u.batchId === batchId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((u) => ({ unitNo: u.unitNo, code: u.code, slug: u.slug, url: recipientUrl(u.slug) }));
    if (!rows.length) return fail("not_found");
    return ok(toCsv(rows));
  },
};

export { toCsv };
