"use client";

/**
 * Every saved version of a unit's stamps (CLIENT_GUIDE §8: replaced or removed content can be
 * recovered). Restoring saves the old version again as the newest one, so nothing is lost either
 * way, and brings back its photos or voice note if they were set aside. Files are deleted for good
 * 90 days after nothing uses them; such versions can no longer be restored.
 */
import { useState } from "react";
import { dataSource, services } from "@/lib/services";
import type { ContentVersion, StampKind } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { dateTime } from "@/lib/utils/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdminButton, Card } from "./ui";

const STAMP: Record<StampKind, string> = { photos: "Photos", letter: "Letter", voice: "Voice", song: "Song" };

function state(v: ContentVersion): string {
  if (v.current) return "Showing now";
  if (v.removedAt && !v.supersededAt) return `Removed ${dateTime(v.removedAt)}`;
  if (v.supersededAt) return `Replaced ${dateTime(v.supersededAt)}`;
  return "";
}

export function ContentHistory({ unitId, history, onChanged }: { unitId: string; history: ContentVersion[]; onChanged: () => void }) {
  const [pending, setPending] = useState<ContentVersion | null>(null);
  const [busy, setBusy] = useState(false);

  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    const res = await services.admin.restoreContent(unitId, pending.kind, pending.version);
    setBusy(false);
    const v = pending;
    setPending(null);
    if (!res.ok) {
      toast("Not restored", { tone: "error", body: res.error.code === "network" ? "Check your connection and try again." : (res.error.detail ?? "Try again.") });
      return;
    }
    toast(`${STAMP[v.kind]} restored`, { tone: "success", body: "The recipient sees it on their next visit." });
    onChanged();
  };

  return (
    <Card
      title="History"
      description={
        dataSource === "api"
          ? "Every saved version, newest first. Restore one the sender removed or replaced by mistake."
          : "The prototype keeps only the current version; the live system keeps every one."
      }
      bodyClassName="px-4 py-2 md:px-5"
    >
      {history.length === 0 ? (
        <p className="py-3 text-sm text-admin-ink-soft">Nothing saved yet.</p>
      ) : (
        <ul className="divide-y divide-admin-line/70">
          {history.map((v) => (
            <li key={`${v.kind}-${v.version}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-admin-ink">
                  <span className="font-medium">
                    {STAMP[v.kind]} v{v.version}
                  </span>
                  <span className="text-admin-ink-soft"> · {v.summary}</span>
                </p>
                <p className="text-xs text-admin-ink-soft">
                  Saved by {v.savedBy === "admin" ? "admin" : "the sender"} {dateTime(v.savedAt)}
                  {state(v) && ` · ${state(v)}`}
                </p>
              </div>
              {!v.current &&
                (v.restorable ? (
                  <AdminButton onClick={() => setPending(v)} className="min-h-9 px-3 pointer-fine:md:min-h-8">
                    Restore…
                  </AdminButton>
                ) : (
                  <span className="text-xs text-admin-ink-soft">Files deleted after 90 days</span>
                ))}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={restore}
        busy={busy}
        tone="primary"
        title={pending ? `Restore ${STAMP[pending.kind].toLowerCase()} v${pending.version}?` : ""}
        confirmLabel="Restore"
      >
        <p className="text-sm leading-relaxed text-admin-ink">
          {pending?.summary}. It becomes what the recipient sees, saved as a new version; the current one stays in this history and can be restored too.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
