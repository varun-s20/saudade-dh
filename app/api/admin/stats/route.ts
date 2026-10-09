/** GET /api/admin/stats → 200 AdminStats (counts by status, opens in 7 days, latest activity). */
import { UNIT_STATUSES, type AdminStats, type UnitStatus } from "@/lib/services/types";
import { MASKED_CODE, toAudit, type AuditRow } from "@/lib/server/admin";
import { requireAdmin } from "@/lib/server/admin-auth";
import { sql } from "@/lib/server/db";
import { unitNo } from "@/lib/server/envelopes";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  await requireAdmin(req);
  const counts = await sql()<{ status: UnitStatus; n: number }[]>`select status, count(*)::int as n from units group by status`;
  const byStatus = Object.fromEntries(UNIT_STATUSES.map((s) => [s, 0])) as Record<UnitStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  const [{ week }] = await sql()<{ week: number }[]>`
    select count(*)::int as week from units where revealed_at > now() - interval '7 days'`;
  const recent = await sql()<(AuditRow & { unit_no: number | null })[]>`
    select a.id, a.unit_id, a.action, a.actor, a.at, a.detail ->> 'text' as text, u.unit_no
    from audit_log a left join units u on u.id = a.unit_id
    order by a.at desc, a.id desc limit 12`;
  const stats: AdminStats = {
    total: counts.reduce((n, c) => n + c.n, 0),
    byStatus,
    revealedLast7Days: week,
    recent: recent.map((r) => ({ ...toAudit(r), unitNo: r.unit_no ? unitNo(r.unit_no) : null, code: r.unit_id ? MASKED_CODE : null })),
  };
  return json(stats);
});
