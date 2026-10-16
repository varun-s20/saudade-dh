/**
 * POST /api/admin/batches/{id}/encoded → 200 Batch. The factory has written, read back and locked
 * the chips (ARCHITECTURE.md §3.6 step 5). Permanent: from now on the batch can never be voided,
 * because its URLs exist on ceramics. Idempotent; 409 for a void batch.
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
    if (b.status === "void") throw new ApiError("invalid_input", "this batch was voided", undefined, 409);
    if (b.status === "generated") {
      await t`update batches set status = 'encoded', encoded_at = now() where id = ${id}`;
      await audit(t, { unitId: null, action: "batch.encoded", actor: "admin", adminId, detail: b.label });
    }
    return batchById(t, id);
  });
  return json(batch);
});
