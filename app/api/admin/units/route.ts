/**
 * GET /api/admin/units?search&status&batchId&page&pageSize → 200 UnitListPage.
 * Search: a full code → exact HMAC match; "S-0042" / "42" → unit number; otherwise slug prefix or
 * a sender / gift-email match.
 */
import { UNIT_STATUSES } from "@/lib/services/types";
import { normaliseCode } from "@/lib/parsing/codes";
import { toUnit, UUID } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { codeHash } from "@/lib/server/crypto";
import { sql } from "@/lib/server/db";
import type { UnitRow } from "@/lib/server/envelopes";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const q = new URL(req.url).searchParams;
  const search = (q.get("search") ?? "").trim().slice(0, 100);
  const status = q.get("status");
  const batchId = q.get("batchId");
  const page = Math.max(1, Number(q.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize")) || 25));
  const db = sql();

  const statusF = status && (UNIT_STATUSES as readonly string[]).includes(status) ? db`and status = ${status}` : db``;
  const batchF = batchId && UUID.test(batchId) ? db`and batch_id = ${batchId}` : db``;
  let searchF = db``;
  if (search) {
    const code = normaliseCode(search);
    const no = /^(?:s-?)?(\d{1,7})$/i.exec(search);
    if (code) searchF = db`and code_hash = ${codeHash(code)}`;
    else if (no) searchF = db`and unit_no = ${Number(no[1])}`;
    else {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      searchF = db`and (slug like ${`${search.toLowerCase().replace(/[^a-z2-7]/g, "")}%`} or sender_email ilike ${like} or code_emailed_to ilike ${like})`;
    }
  }

  const [{ total }] = await db<{ total: number }[]>`select count(*)::int as total from units where true ${statusF} ${batchF} ${searchF}`;
  const rows = await db<UnitRow[]>`
    select id, unit_no, batch_id, slug, status, delivery_path, sender_email::text as sender_email,
           code_redeemed_at, claimed_at, sealed_at, revealed_at, code_emailed_at, code_emailed_to::text as code_emailed_to,
           content_updated_at, created_at, updated_at
    from units where true ${statusF} ${batchF} ${searchF}
    order by updated_at desc, unit_no desc
    limit ${pageSize} offset ${(page - 1) * pageSize}`;
  return json({ items: rows.map(toUnit), total, page, pageSize });
});
