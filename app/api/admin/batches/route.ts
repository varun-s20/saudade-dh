/**
 * GET  /api/admin/batches                 → 200 Batch[] (newest first, with status and claim counts)
 * POST /api/admin/batches { count, label } → 201 { batch, rows: ProvisionedRow[] }
 *
 * The provisioning ceremony (ARCHITECTURE.md §3.6): one transaction creates the batch and its
 * units with independent random codes and slugs. This response is the ONLY time the codes exist
 * in clear (the card-printing file); later exports carry slugs and URLs only.
 */
import { recipientUrl, site } from "@/config/site";
import { generateCode, generateSlug } from "@/lib/parsing/codes";
import type { ProvisionedRow } from "@/lib/services/types";
import { requireAdmin } from "@/lib/server/admin-auth";
import { batchById, listBatches } from "@/lib/server/batches";
import { codeHash } from "@/lib/server/crypto";
import { sql, tx } from "@/lib/server/db";
import { audit, unitNo } from "@/lib/server/envelopes";
import { body, json, route } from "@/lib/server/http";
import { z } from "zod";

export const maxDuration = 60;

export const GET = route(async (req) => {
  await requireAdmin(req);
  return json(await listBatches(sql()));
});

const Body = z.object({ count: z.number().int().min(1).max(5000), label: z.string().trim().max(80) });

export const POST = route(async (req) => {
  const { adminId } = await requireAdmin(req);
  const { count, label } = await body(req, Body, 1024);
  const name = label || `Batch · ${count}`;

  const result = await tx(async (t) => {
    const [b] = await t<{ id: string }[]>`
      insert into batches (label, unit_count, code_length, chip_domain, created_by)
      values (${name}, ${count}, ${site.codes.length}, ${site.chipDomain}, ${adminId})
      returning id`;

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
    await audit(t, { unitId: null, action: "batch.generated", actor: "admin", adminId, detail: `${name}: ${count} units, ${site.codes.length}-char codes, ${site.chipDomain}` });
    return { batch: (await batchById(t, b.id))!, rows };
  });
  return json(result, 201);
});
