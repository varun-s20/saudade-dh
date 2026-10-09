"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useNow } from "@/components/public/useNow";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";
import { UNIT_STATUSES, type ServiceError } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { AuditList } from "./AuditList";
import { StatCard } from "./StatCard";
import { STATUS_META } from "./StatusChip";
import { AdminButton, AdminLinkButton, Card, LoadError, PageHeader, SearchInput, Skeleton } from "./ui";

/** Plain wording for a failed admin load. */
export function loadErrorText(error: ServiceError): string {
  if (error.code === "network") return "We couldn't reach the server. Check your connection and try again.";
  if (error.code === "not_found") return "We couldn't find that.";
  return "Something went wrong while loading. Try again.";
}

/** Session expired mid-visit (or was reset from the Demo Panel): back to sign-in. */
export function useUnauthorizedRedirect(error: ServiceError | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (error?.code === "unauthorized") router.replace("/admin");
  }, [error, router]);
}

/** S21: counts by status, recent activity, quick search. */
export function DashboardScreen() {
  const router = useRouter();
  const now = useNow();
  const stats = useServiceQuery(() => services.admin.getStats(), []);
  const [q, setQ] = useState("");
  useUnauthorizedRedirect(stats.error);

  const s = stats.status === "success" ? stats.data : null;
  // Label each activity entry with its unit. The stats response already carries the unit number
  // (S-0042, stable, not secret) and the code (masked on the real backend), so no second request.
  const codes = s
    ? Object.fromEntries(s.recent.filter((e) => e.unitId).map((e) => [e.unitId as string, e.unitNo ? `${e.unitNo} · ${e.code ?? ""}` : (e.code ?? "")]))
    : undefined;

  const search = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/admin/units?search=${encodeURIComponent(term)}` : "/admin/units");
  };

  return (
    <>
      <PageHeader
        eyebrow="Saudade admin"
        title="Overview"
        description="Every envelope, from the factory run to the first tap."
        actions={
          <>
            <AdminLinkButton href="/admin/units">All units</AdminLinkButton>
            <AdminLinkButton href="/admin/batch">Batches &amp; CSV</AdminLinkButton>
          </>
        }
      />

      <form onSubmit={search} role="search" className="mb-8 flex max-w-2xl gap-2">
        <SearchInput value={q} onChange={setQ} className="flex-1" label="Find a unit by code, email, slug or unit number" placeholder="Code, email, slug or unit no." />
        <AdminButton type="submit" tone="primary">
          Search
        </AdminButton>
      </form>

      {stats.status === "error" && stats.error.code !== "unauthorized" && (
        <div className="mb-6">
          <LoadError message={loadErrorText(stats.error)} onRetry={() => stats.reload()} />
        </div>
      )}

      <section aria-labelledby="by-status">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="by-status" className="display text-xl text-admin-ink">
            Units by status
          </h2>
          <p className="text-sm text-admin-ink-soft tabular-nums">{s ? `${s.total} units in total` : <Skeleton className="inline-block h-4 w-28 align-middle" />}</p>
        </div>
        <ol className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {UNIT_STATUSES.map((status, i) => {
            const m = STATUS_META[status];
            return (
              <li key={status}>
                <StatCard
                  href={`/admin/units?status=${status}`}
                  marker={<span aria-hidden className={cn("size-2 rounded-pill", m.dot)} />}
                  label={
                    <span>
                      <span className="sr-only">Step {i + 1}: </span>
                      {m.label}
                      {m.proposed && (
                        <abbr title="Proposed status, pending the client's approval" className="ml-0.5 no-underline">
                          †
                        </abbr>
                      )}
                    </span>
                  }
                  value={s ? s.byStatus[status] : null}
                  hint={m.description}
                  className="h-full"
                />
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-xs text-admin-ink-soft">
          † Proposed statuses, pending the client&apos;s approval (O7): assigned, sealed, revealed. Agreed: unassigned, claimed, filled.
        </p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Recent activity" description="The latest changes across every unit." bodyClassName="px-4 py-5 md:px-5" className="order-2 lg:order-none">
          {s ? (
            <AuditList entries={s.recent} now={now} codes={codes} emptyText="No activity yet." />
          ) : (
            <div className="space-y-4" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="order-1 grid content-start gap-3 sm:grid-cols-3 lg:order-none lg:grid-cols-1">
          <StatCard
            label="Opened in the last 7 days"
            value={s ? s.revealedLast7Days : null}
            hint="Recipients who tapped and watched (or skipped) the first reveal."
            href="/admin/units?status=revealed"
          />
          <StatCard
            label="Waiting to be claimed"
            value={s ? s.byStatus.unassigned + s.byStatus.assigned : null}
            hint="Unassigned plus codes emailed but not yet used."
          />
          <StatCard
            label="Being filled"
            value={s ? s.byStatus.claimed + s.byStatus.filled : null}
            hint="Claimed or filled, not sealed yet. The recipient would see “still being written”."
          />
        </div>
      </div>
    </>
  );
}
