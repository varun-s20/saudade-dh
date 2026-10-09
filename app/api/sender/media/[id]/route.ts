/**
 * DELETE /api/sender/media/{id} (Bearer) → 204. A soft delete: the file stays recoverable for
 * 90 days (purge_after). Deferred (still 204) while the current stamp still uses it, e.g. a photo
 * taken out in the editor but not saved yet.
 */
import { sql } from "@/lib/server/db";
import { ApiError, limit, noContent, requireSender, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  const { unitId } = await requireSender(req);
  await limit("media_delete", unitId, 3600, 120);
  const [m] = await sql()<{ id: string; in_use: boolean }[]>`
    select m.id, exists (
      select 1 from content_media cm join contents c on c.id = cm.content_id
      where cm.media_id = m.id and c.superseded_at is null and c.removed_at is null
    ) as in_use
    from media m where m.id = ${id} and m.unit_id = ${unitId} and m.removed_at is null`;
  if (!m) throw new ApiError("not_found");
  if (!m.in_use) {
    await sql()`update media set state = 'removed', removed_at = now(), removed_by = 'sender', purge_after = now() + interval '90 days'
                where id = ${id}`;
  }
  return noContent();
});
