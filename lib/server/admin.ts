/**
 * Admin read models. Activation codes are stored as HMACs, so the admin never sees a code again
 * after it was issued: `Unit.code` is masked, and `senderToken` is always null (ARCHITECTURE.md
 * §13.3). Plaintext codes appear only in the responses of batch generation, reset and email-code.
 */
import "server-only";
import { site } from "@/config/site";
import type { AuditEntry, Unit } from "@/lib/services/types";
import { iso, isoReq } from "./db";
import { unitNo, type UnitRow } from "./envelopes";

export const MASKED_CODE = `${site.codes.prefix}-····`;

export function toUnit(u: UnitRow): Unit {
  return {
    id: u.id,
    unitNo: unitNo(u.unit_no),
    code: MASKED_CODE,
    codeRedeemedAt: iso(u.code_redeemed_at),
    slug: u.slug,
    status: u.status,
    path: u.delivery_path,
    batchId: u.batch_id,
    senderEmail: u.sender_email,
    senderToken: null,
    createdAt: isoReq(u.created_at),
    updatedAt: isoReq(u.updated_at),
    claimedAt: iso(u.claimed_at),
    sealedAt: iso(u.sealed_at),
    revealedAt: iso(u.revealed_at),
    codeEmailedAt: iso(u.code_emailed_at),
    codeEmailedTo: u.code_emailed_to,
  };
}

export interface AuditRow {
  id: string | number;
  unit_id: string | null;
  action: string;
  actor: AuditEntry["actor"];
  at: Date;
  text: string | null;
}

export const toAudit = (a: AuditRow): AuditEntry => ({
  id: String(a.id),
  unitId: a.unit_id,
  action: a.action as AuditEntry["action"],
  actor: a.actor,
  at: isoReq(a.at),
  ...(a.text ? { detail: a.text } : {}),
});

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
