/**
 * Batch read model (one provisioning ceremony; ARCHITECTURE.md §3.6). A batch remembers the code
 * length and the chip domain it was generated with: its factory CSV always uses that domain, so
 * changing the configured domain later can never change a URL already written to a chip.
 */
import "server-only";
import type { Batch, BatchStatus } from "@/lib/services/types";
import { iso, isoReq, sql, type Tx } from "./db";

type Db = ReturnType<typeof sql> | Tx;

interface BatchRow {
  id: string;
  label: string;
  created_at: Date;
  unit_count: number;
  status: BatchStatus;
  code_length: number;
  chip_domain: string;
  encoded_at: Date | null;
  claimed: number;
}

const toBatch = (b: BatchRow): Batch => ({
  id: b.id,
  label: b.label,
  createdAt: isoReq(b.created_at),
  count: b.unit_count,
  status: b.status,
  codeLength: b.code_length,
  chipDomain: b.chip_domain,
  encodedAt: iso(b.encoded_at),
  claimedCount: b.claimed,
});

const SELECT = `
  select b.id, b.label, b.created_at, b.unit_count, b.status, b.code_length, b.chip_domain, b.encoded_at,
         (select count(*)::int from units u where u.batch_id = b.id and u.code_redeemed_at is not null) as claimed
  from batches b`;

export async function listBatches(db: Db): Promise<Batch[]> {
  return (await db.unsafe<BatchRow[]>(`${SELECT} order by b.created_at desc`)).map(toBatch);
}

export async function batchById(db: Db, id: string): Promise<Batch | null> {
  const [row] = await db.unsafe<BatchRow[]>(`${SELECT} where b.id = $1`, [id]);
  return row ? toBatch(row) : null;
}

export { ndefBytes } from "@/lib/parsing/ndef";
