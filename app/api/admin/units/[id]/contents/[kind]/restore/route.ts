/**
 * POST /api/admin/units/{id}/contents/{kind}/restore { version } → 204.
 * Support tool (CLIENT_GUIDE §8): put back a stamp a sender removed or replaced by mistake. The old
 * version is saved again as the newest one (so nothing is lost either way), its soft-deleted files
 * come back, and the unit's status follows. Refused once its files were purged (after 90 days).
 */
import { STAMP_KINDS, type StampKind } from "@/lib/services/types";
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { tx } from "@/lib/server/db";
import { audit, restoreVersion, unitById } from "@/lib/server/envelopes";
import { ApiError, body, noContent, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string; kind: string }> };

const Body = z.object({ version: z.number().int().min(1).max(1_000_000) });

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const { id, kind } = await ctx.params;
  if (!UUID.test(id) || !(STAMP_KINDS as readonly string[]).includes(kind)) throw new ApiError("not_found");
  const { version } = await body(req, Body, 256);

  await tx(async (t) => {
    const unit = await unitById(t, id, true);
    if (!unit) throw new ApiError("not_found");
    const rec = await restoreVersion(t, unit, kind as StampKind, version);
    await audit(t, { unitId: id, action: "content.restored", actor: "admin", adminId, detail: `${kind} v${version} → v${rec.version}` });
  });
  return noContent();
});
