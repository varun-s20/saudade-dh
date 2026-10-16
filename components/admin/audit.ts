/** Human-readable audit log wording for the admin. Pure. */
import type { AuditAction, AuditEntry, StampKind } from "@/lib/services/types";

const ACTION: Record<AuditAction, string> = {
  "unit.created": "Unit created",
  "unit.claimed": "Claimed by the sender",
  "unit.code_reset": "Activation code reset",
  "unit.code_emailed": "Code emailed",
  "unit.path_set": "Delivery path set",
  "unit.sealed": "Sealed by the sender",
  "unit.revealed": "Opened by the recipient",
  "unit.reveal_reset": "First-tap reveal reset",
  "content.saved": "Content saved",
  "content.removed": "Content removed by the sender",
  "content.removed_by_admin": "Content removed by admin",
  "content.restored": "Earlier version restored by admin",
  "batch.generated": "Batch generated",
  "batch.encoded": "Batch marked as encoded",
  "batch.voided": "Batch voided",
  "unit.token_issued": "Private link issued",
  "unit.tokens_revoked": "Private links revoked",
  "unit.reveal_excluded": "Opened, not counted as the first reveal",
  "media.rejected": "Upload rejected",
  "admin.signed_in": "Admin signed in",
  "admin.signed_out": "Admin signed out",
  "admin.sign_in_failed": "Admin sign-in failed",
  "admin.created": "Admin account created",
  "admin.password_reset": "Admin password reset",
  "admin.disabled": "Admin account disabled",
  "admin.enabled": "Admin account enabled again",
  "system.breaker_tripped": "Mass code-guessing detected: bot check on for 6 hours",
};

const ACTOR: Record<AuditEntry["actor"], string> = {
  sender: "Sender",
  recipient: "Recipient",
  admin: "Admin",
  system: "System",
};

const STAMP_NAME: Record<StampKind, string> = { photos: "Photos", letter: "Letter", voice: "Voice", song: "Song" };

/** "Letter v3" from "letter v3"; "Photos" from "photos". */
function prettyDetail(entry: AuditEntry): string | undefined {
  const d = entry.detail;
  if (!d) return undefined;
  if (entry.action === "content.saved" || entry.action === "content.removed" || entry.action === "content.removed_by_admin" || entry.action === "content.restored") {
    const [kind, ...rest] = d.split(" ");
    if (kind in STAMP_NAME) return [STAMP_NAME[kind as StampKind], ...rest].join(" ");
    if (kind === "photo") return "One photo";
  }
  if (entry.action === "unit.revealed") return d === "skipped choreography" ? "Skipped the opening" : "Watched the opening";
  return d;
}

export function describeAudit(entry: AuditEntry): { title: string; detail?: string; actor: string } {
  return { title: ACTION[entry.action] ?? entry.action, detail: prettyDetail(entry), actor: ACTOR[entry.actor] };
}

/** Which audit entries are worth a dot colour (for quick scanning; text carries the meaning). */
export function auditTone(action: AuditAction): "neutral" | "good" | "attention" {
  if (action === "unit.revealed" || action === "unit.sealed" || action === "unit.claimed") return "good";
  if (
    action === "unit.code_reset" ||
    action === "unit.reveal_reset" ||
    action === "content.removed_by_admin" ||
    action === "unit.tokens_revoked" ||
    action === "batch.voided" ||
    action === "media.rejected" ||
    action === "admin.sign_in_failed" ||
    action === "system.breaker_tripped"
  )
    return "attention";
  return "neutral";
}
