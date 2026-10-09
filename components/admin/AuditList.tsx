"use client";

import Link from "next/link";
import type { AuditEntry } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { dateTime, relativeTime } from "@/lib/utils/format";
import { auditTone, describeAudit } from "./audit";

const DOT = { neutral: "bg-paper-edge", good: "bg-sage-ink", attention: "bg-terracotta" } as const;

/**
 * Human-readable activity list. `codes` maps unit ids to activation codes so dashboard entries
 * can name (and link to) their unit; omit it on a unit's own page.
 */
export function AuditList({
  entries,
  now,
  codes,
  emptyText = "Nothing has happened here yet.",
}: {
  entries: AuditEntry[];
  /** From useNow(); 0 before hydration, in which case absolute times are shown. */
  now: number;
  codes?: Record<string, string>;
  emptyText?: string;
}) {
  if (!entries.length) return <p className="py-2 text-sm text-admin-ink-soft">{emptyText}</p>;
  return (
    <ol className="relative space-y-0">
      {entries.map((e, i) => {
        const d = describeAudit(e);
        const code = e.unitId && codes ? codes[e.unitId] : undefined;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* Thread line between entries */}
            {i < entries.length - 1 && <span aria-hidden className="absolute top-4 left-1.25 h-full w-px bg-admin-line" />}
            <span aria-hidden className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-pill ring-2 ring-admin-surface", DOT[auditTone(e.action)])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-admin-ink">
                {code && e.unitId && (
                  <>
                    <Link href={`/admin/units/${e.unitId}`} className="font-postal tracking-wide text-postmark hover:underline">
                      {code}
                    </Link>{" "}
                    <span aria-hidden className="text-admin-ink-soft">
                      ·
                    </span>{" "}
                  </>
                )}
                {d.title}
                {d.detail && <span className="text-admin-ink-soft">: {d.detail}</span>}
              </p>
              <p className="mt-0.5 text-xs text-admin-ink-soft">
                {d.actor} ·{" "}
                <time dateTime={e.at} title={dateTime(e.at)}>
                  {now > 0 ? relativeTime(e.at, now) : dateTime(e.at)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
