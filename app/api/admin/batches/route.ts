/**
 * GET  /api/admin/batches                 → 200 Batch[] (newest first, void batches hidden)
 * POST /api/admin/batches { count, label } → 201 { batch, rows: ProvisionedRow[] }
 *
 * The provisioning ceremony (ARCHITECTURE.md §3.6): one transaction creates the batch and its
 * units with independent random codes and slugs. This response is the ONLY time the codes exist
 * in clear (the card-printing file); later exports carry slugs and URLs only.
 */
import { recipientUrl, site } from "@/config/site";
import { generateCode, generateSlug } from "@/lib/parsing/codes";
import type { Batch, ProvisionedRow } from "@/lib/services/types";
import { requireAdmin } from "@/lib/server/admin-auth";
import { codeHash } from "@/lib/server/crypto";
import { isoReq, sql, tx } from "@/lib/server/db";
import { audit, unitNo } from "@/lib/server/envelopes";
import { body, json, route } from "@/lib/server/http";
import { z } from "zod";

export const maxDuration = 60;

export const GET = route(async (req) => {
  await requireAdmin(req);
  const rows = await sql()<{ id: string; label: string; created_at: Date; unit_count: number }[]>`
    select id, label, created_at, unit_count from batches where status <> 'void' order by created_at desc`;
  return json(rows.map((b): Batch => ({ id: b.id, label: b.label, createdAt: isoReq(b.created_at), count: b.unit_count })));
});

const Body = z.object({ count: z.number().int().min(1).max(5000), label: z.string().trim().max(80) });

export const POST = route(async (req) => {
  const { adminId } = await requireAdmin(req);
  const { count, label } = await body(req, Body, 1024);
  const name = label || `Batch · ${count}`;

  const result = await tx(async (t) => {
    const [b] = await t<{ id: string; created_at: Date }[]>`
      insert into batches (label, unit_count, code_length, chip_domain, created_by)
      values (${name}, ${count}, ${site.codes.length}, ${site.chipDomain}, ${adminId})
      returning id, created_at`;

    const rows: ProvisionedRow[] = [];
    let missing = count;
    // Insert in chunks; a code or slug collision just drops that row, which is re-drawn next round.
    for (let round = 0; missing > 0 && round < 10; round++) {
      for (let done = 0; done < missing; ) {
        const n = Math.min(500, missing - done);
        const draft = Array.from({ length: n }, () => ({ code: generateCode(), slug: generateSlug() }));
        const values = draft.map((d) => ({ batch_id: b.id, slug: d.slug, code_hash: codeHash(d.code) }));
        const inserted = await t<{ unit_no: number; slug: string }[]>`
          insert into units ${t(values)}
          on conflict do nothing returning unit_no, slug`;
        const bySlug = new Map(draft.map((d) => [d.slug, d.code]));
        for (const r of inserted) rows.push({ unitNo: unitNo(r.unit_no), code: bySlug.get(r.slug)!, slug: r.slug, url: recipientUrl(r.slug) });
        done += n;
      }
      missing = count - rows.length;
    }
    if (missing > 0) throw new Error("batch generation kept colliding");
    rows.sort((a, b2) => a.unitNo.localeCompare(b2.unitNo));
    await audit(t, { unitId: null, action: "batch.generated", actor: "admin", adminId, detail: `${name}: ${count} units, ${site.codes.length}-char codes` });
    return { batch: { id: b.id, label: name, createdAt: isoReq(b.created_at), count } satisfies Batch, rows };
  });
  return json(result, 201);
});
