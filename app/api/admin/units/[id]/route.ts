/**
 * GET   /api/admin/units/{id}             → 200 UnitDetail (unit, current contents, audit, reveals)
 * PATCH /api/admin/units/{id} { path }    → 204 (an unassigned unit becomes "assigned")
 */
import { toAudit, toUnit, UUID, type AuditRow } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { isoReq, sql, tx } from "@/lib/server/db";
import { audit, currentContents, unitById } from "@/lib/server/envelopes";
import { ApiError, body, json, noContent, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

async function idOf(ctx: Ctx): Promise<string> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new ApiError("not_found");
  return id;
}

export const GET = route<Ctx>(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const id = await idOf(ctx);
  const unit = await unitById(sql(), id);
  if (!unit) throw new ApiError("not_found");
  const audits = await sql()<AuditRow[]>`
    select id, unit_id, action, actor, at, detail ->> 'text' as text
    from audit_log where unit_id = ${id} order by at desc, id desc limit 200`;
  const reveals = await sql()<{ id: string; at: Date; skipped: boolean | null; reduced_motion: boolean | null; user_agent: string | null }[]>`
    select id, at, skipped, reduced_motion, user_agent from reveal_events
    where unit_id = ${id} and outcome = 'revealed' order by at desc`;
  return json({
    unit: toUnit(unit),
    contents: await currentContents(sql(), id),
    audit: audits.map(toAudit),
    reveals: reveals.map((r) => ({
      id: r.id,
      unitId: id,
      at: isoReq(r.at),
      skipped: Boolean(r.skipped),
      reducedMotion: Boolean(r.reduced_motion),
      userAgent: r.user_agent ?? "unknown",
    })),
  });
});

const Patch = z.object({ path: z.enum(["A", "B"]) });

export const PATCH = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const id = await idOf(ctx);
  const { path } = await body(req, Patch, 256);
  await tx(async (t) => {
    const unit = await unitById(t, id, true);
    if (!unit) throw new ApiError("not_found");
    // A code already emailed (Path B) can't become a card-in-the-box unit without a reset first.
    if (path === "A" && unit.code_emailed_at) throw new ApiError("invalid_input", "code already emailed: reset the code first");
    await t`update units set delivery_path = ${path},
              status = case when status = 'unassigned' then 'assigned'::unit_status else status end
            where id = ${id}`;
    await audit(t, { unitId: id, action: "unit.path_set", actor: "admin", adminId, detail: `Path ${path}` });
  });
  return noContent();
});
