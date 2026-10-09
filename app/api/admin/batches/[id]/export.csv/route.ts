/**
 * GET /api/admin/batches/{id}/export.csv → the FACTORY file: unit_no, slug, url, ndef_bytes.
 * Codes can't be re-exported (only their HMACs are stored); the card-printing file is the one-time
 * output of batch generation. `ndef_bytes` lets the encoder cross-check the NTAG213 budget (§3.4).
 */
import { recipientUrl } from "@/config/site";
import { UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { sql } from "@/lib/server/db";
import { unitNo } from "@/lib/server/envelopes";
import { ApiError, route } from "@/lib/server/http";
import type { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

/** One short NDEF URI record with the https:// prefix code: the URL minus "https://", plus 8 bytes. */
const ndefBytes = (url: string) => url.replace(/^https:\/\//, "").length + 8;

export const GET = route<Ctx>(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;
  if (!UUID.test(id)) throw new ApiError("not_found");
  const units = await sql()<{ unit_no: number; slug: string }[]>`
    select unit_no, slug from units where batch_id = ${id} order by unit_no`;
  if (!units.length) throw new ApiError("not_found");
  const lines = ["unit_no,slug,url,ndef_bytes", ...units.map((u) => {
    const url = recipientUrl(u.slug);
    return `${unitNo(u.unit_no)},${u.slug},${url},${ndefBytes(url)}`;
  })];
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store", "content-disposition": `attachment; filename="factory-${id.slice(0, 8)}.csv"` },
  });
});
