"use client";

/**
 * The launch checklist (GET /api/admin/readiness): deployment settings that must be right before
 * real ceramics ship, each with its fix in plain words. Problems first; what's already fine folds
 * away. Status is carried by the words ("Fix", "Check", "Ready"), not by colour alone.
 */
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";
import type { ReadinessCheck } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { loadErrorText } from "./DashboardScreen";
import { AdminButton, Card, LoadError, Skeleton } from "./ui";

const TONE: Record<ReadinessCheck["status"], { word: string; className: string }> = {
  fail: { word: "Fix", className: "bg-danger text-ink-inverse" },
  warn: { word: "Check", className: "bg-ochre text-ink" },
  ok: { word: "Ready", className: "border border-admin-ink/25 text-admin-ink-soft" },
};

function Item({ check }: { check: ReadinessCheck }) {
  return (
    <li className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-3 py-2.5">
      <span className={cn("mt-0.5 rounded-soft px-1.5 py-0.5 text-center text-[0.7rem] font-semibold tracking-wide uppercase", TONE[check.status].className)}>
        {TONE[check.status].word}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-admin-ink">{check.label}</p>
        <p className="text-sm [overflow-wrap:anywhere] text-admin-ink-soft">{check.detail}</p>
      </div>
    </li>
  );
}

export function LaunchChecklist() {
  const q = useServiceQuery(() => services.admin.getReadiness(), []);
  const checks = q.status === "success" ? q.data.checks : [];
  const open = checks.filter((c) => c.status !== "ok").sort((a, b) => (a.status === b.status ? 0 : a.status === "fail" ? -1 : 1));
  const done = checks.filter((c) => c.status === "ok");
  const fails = open.filter((c) => c.status === "fail").length;

  return (
    <Card
      title="Launch checklist"
      description={
        q.status === "success"
          ? open.length
            ? `${fails ? `${fails} to fix, ` : ""}${open.length - fails} to check, ${done.length} ready.`
            : "Everything the system can check is ready."
          : "Settings that must be right before ceramics ship."
      }
      actions={
        <AdminButton tone="quiet" onClick={() => q.reload(true)} className="pointer-fine:md:min-h-9">
          Check again
        </AdminButton>
      }
      bodyClassName="px-4 py-2 md:px-5"
    >
      {q.status === "loading" && (
        <div className="space-y-3 py-3" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
      {q.status === "error" && q.error.code !== "unauthorized" && (
        <div className="py-3">
          <LoadError message={loadErrorText(q.error)} onRetry={() => q.reload()} />
        </div>
      )}
      {q.status === "success" && (
        <>
          {open.length > 0 && (
            <ul className="divide-y divide-admin-line" aria-label="Needs attention">
              {open.map((c) => (
                <Item key={c.id} check={c} />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <details className={cn("group py-2", open.length > 0 && "border-t border-admin-line")}>
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-admin-ink-soft hover:text-admin-ink pointer-fine:md:min-h-9">
                {done.length} ready
              </summary>
              <ul className="divide-y divide-admin-line">
                {done.map((c) => (
                  <Item key={c.id} check={c} />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}
