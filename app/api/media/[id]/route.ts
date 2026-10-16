/**
 * GET /api/media/{id}?v=display|thumb|audio → 302 to a short-lived signed Storage URL
 * (Cache-Control: private, 10 min). The media id is the capability (130 bits): it only appears
 * inside contents that the holder of a slug or token can already read. 404 once removed, or
 * before it was verified.
 *
 * Serves the normalised file (ARCHITECTURE.md §7): `display` (photos, the default) or `audio`
 * (voice), or `thumb` for a photo; the verified original only until normalisation has run.
 */
import { sql } from "@/lib/server/db";
import { ApiError, route } from "@/lib/server/http";
import { signedRead } from "@/lib/server/storage";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params;
  if (!/^med_[a-z2-7]{26}$/.test(id)) throw new ApiError("not_found");
  const wantThumb = new URL(req.url).searchParams.get("v") === "thumb";
  const [m] = await sql()<{ original_key: string; main_key: string | null; thumb_key: string | null }[]>`
    select m.original_key,
      (select v.r2_key from media_variants v where v.media_id = m.id and v.variant in ('display', 'audio') order by v.version desc limit 1) as main_key,
      (select v.r2_key from media_variants v where v.media_id = m.id and v.variant = 'thumb' order by v.version desc limit 1) as thumb_key
    from media m where m.id = ${id} and m.state = 'ready' and m.removed_at is null`;
  const key = m ? (wantThumb ? m.thumb_key : null) ?? m.main_key ?? m.original_key : null;
  const url = key ? await signedRead(key) : null;
  if (!url) throw new ApiError("not_found");
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=600" } });
});
