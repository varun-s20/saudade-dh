/**
 * Sender tokens and activation codes (ARCHITECTURE.md §3.2, §3.5).
 *   - A token is 32 base32 characters; only sha256(token) is stored. At most 5 active per unit.
 *   - A code is minted fresh whenever one is needed in clear (batch, reset, Path B email): the
 *     database only ever holds its HMAC, so it can never be looked up or re-sent later.
 */
import "server-only";
import { generateCode, generateToken } from "@/lib/parsing/codes";
import { codeHash, sha256 } from "./crypto";
import type { Tx } from "./db";

const MAX_ACTIVE_TOKENS = 5;

/** Issue a new sender token for the unit and return it (the only time it exists in clear). */
export async function issueToken(t: Tx, unitId: string, origin: "claim" | "recover" | "admin"): Promise<string> {
  const token = generateToken();
  await t`insert into sender_tokens (unit_id, token_hash, origin) values (${unitId}, ${sha256(token)}, ${origin})`;
  await t`
    update sender_tokens set revoked_at = now(), revoked_reason = 'superseded'
    where id in (
      select id from sender_tokens where unit_id = ${unitId} and revoked_at is null
      order by created_at desc offset ${MAX_ACTIVE_TOKENS}
    )`;
  return token;
}

/** Revoke every active link for the unit (admin code reset). Returns how many were revoked. */
export async function revokeTokens(t: Tx, unitId: string, reason: "code_reset" | "admin"): Promise<number> {
  const rows = await t`update sender_tokens set revoked_at = now(), revoked_reason = ${reason}
                       where unit_id = ${unitId} and revoked_at is null returning id`;
  return rows.length;
}

/**
 * Give the unit a brand-new claimable code and return it in clear. Retries on the (astronomically
 * rare at 8 chars, merely rare at 4) collision with another unit's code.
 */
export async function mintCode(t: Tx, unitId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    const rows = await t`
      update units set code_hash = ${codeHash(code)}, code_issued_at = now(), code_redeemed_at = null
      where id = ${unitId} and not exists (select 1 from units where code_hash = ${codeHash(code)})
      returning id`;
    if (rows.length) return code;
  }
  throw new Error("could not mint a unique code");
}
