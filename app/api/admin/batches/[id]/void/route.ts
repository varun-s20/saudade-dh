/**
 * POST /api/admin/batches/{id}/void → 200 Batch. The batch's card CSV was lost (or leaked) before
 * the chips were written: its codes stop working (POST /api/claim treats them as unknown) and a
 * new batch is generated instead (ARCHITECTURE.md §3.6 step 6).
 *
 * Refused (409) once the batch is encoded (its URLs are on ceramics) or any of its codes has been
 * claimed (a sender is already using it). Idempotent for a batch that is already void.
 */
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { batchById } from "@/lib/server/batches";
import { tx } from "@/lib/server/db";
import { audit } from "@/lib/server/envelopes";
import { ApiError, json, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new ApiError("not_found");
  const batch = await tx(async (t) => {
    const [b] = await t<{ status: string; label: string }[]>`select status, label from batches where id = ${id} for update`;
    if (!b) throw new ApiError("not_found");
    if (b.status === "encoded") throw new ApiError("invalid_input", "the chips are already encoded: an encoded batch can never be voided", undefined, 409);
    if (b.status === "generated") {
      // Lock the batch's units against a claim racing the void.
      const [{ claimed }] = await t<{ claimed: number }[]>`
        select count(*)::int as claimed from (select 1 from units where batch_id = ${id} and code_redeemed_at is not null for update) x`;
      if (claimed > 0) throw new ApiError("invalid_input", `${claimed} of its codes are already claimed`, undefined, 409);
      await t`update batches set status = 'void', voided_at = now() where id = ${id}`;
      await audit(t, { unitId: null, action: "batch.voided", actor: "admin", adminId, detail: b.label });
    }
    return batchById(t, id);
  });
  return json(batch);
});
