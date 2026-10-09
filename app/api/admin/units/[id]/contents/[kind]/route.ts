/**
 * DELETE /api/admin/units/{id}/contents/{kind}?photoId= → 204. Support tool: remove a whole stamp,
 * or one photo (saved as a new version without it). History stays; status is recomputed.
 */
import { STAMP_KINDS, type PhotosContent, type StampKind } from "@/lib/services/types";
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { tx } from "@/lib/server/db";
import { audit, currentContents, removeContent, saveContent, unitById } from "@/lib/server/envelopes";
import { ApiError, noContent, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; kind: string }> };

export const DELETE = route<Ctx>(async (req: NextRequest, ctx) => {
  const { adminId } = await requireAdmin(req);
  const { id, kind } = await ctx.params;
  if (!UUID.test(id) || !(STAMP_KINDS as readonly string[]).includes(kind)) throw new ApiError("not_found");
  const photoId = new URL(req.url).searchParams.get("photoId");

  await tx(async (t) => {
    const unit = await unitById(t, id, true);
    if (!unit) throw new ApiError("not_found");
    const photos = (await currentContents(t, id)).photos;
    if (kind === "photos" && photoId && photos) {
      const items = (photos.content as PhotosContent).items.filter((p) => p.id !== photoId);
      if (items.length) await saveContent(t, unit, { kind: "photos", items }, "admin");
      else await removeContent(t, unit, "photos", "admin");
    } else {
      await removeContent(t, unit, kind as StampKind, "admin");
    }
    await audit(t, { unitId: id, action: "content.removed_by_admin", actor: "admin", adminId, detail: photoId ? `photo ${photoId}` : kind });
  });
  return noContent();
});
