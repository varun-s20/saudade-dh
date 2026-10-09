/**
 * GET /api/media/{id} → 302 to a short-lived signed Storage URL (Cache-Control: private, 10 min).
 * The media id is the capability (130 bits): it only appears inside contents that the holder of
 * a slug or token can already read. 404 once removed, or before it was verified.
 */
import { sql } from "@/lib/server/db";
import { ApiError, route } from "@/lib/server/http";
import { signedRead } from "@/lib/server/storage";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  if (!/^med_[a-z2-7]{26}$/.test(id)) throw new ApiError("not_found");
  const [m] = await sql()<{ original_key: string }[]>`
    select original_key from media where id = ${id} and state = 'ready' and removed_at is null`;
  const url = m ? await signedRead(m.original_key) : null;
  if (!url) throw new ApiError("not_found");
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=600" } });
});
