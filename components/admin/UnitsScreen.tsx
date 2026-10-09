"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useNow } from "@/components/public/useNow";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";
import { UNIT_STATUSES, type Unit, type UnitStatus } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { dateTime, relativeTime } from "@/lib/utils/format";
import { loadErrorText, useUnauthorizedRedirect } from "./DashboardScreen";
import { DataTable, Pagination, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { STATUS_META, StatusChip } from "./StatusChip";
import { AdminButton, Card, LoadError, PageHeader, SearchInput } from "./ui";

const PAGE_SIZE = 25;

const isStatus = (v: string | null): v is UnitStatus => Boolean(v && (UNIT_STATUSES as readonly string[]).includes(v));

/** S22: every unit, with status filter, search (code / email / slug) and pagination. URL-driven. */
export function UnitsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useNow();

  const search = params.get("search") ?? "";
  const rawStatus = params.get("status");
  const status: UnitStatus | "all" = isStatus(rawStatus) ? rawStatus : "all";
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const batchId = params.get("batch") ?? undefined;

  const list = useServiceQuery(
    () => services.admin.listUnits({ search, status, page, pageSize: PAGE_SIZE, batchId }),
    [search, status, page, batchId],
  );
  const stats = useServiceQuery(() => services.admin.getStats(), []);
  useUnauthorizedRedirect(list.error);

  const setParams = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || (k === "status" && v === "all") || (k === "page" && v === 1)) next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `/admin/units?${qs}` : "/admin/units", { scroll: false });
  };

  // The search box is a draft that follows the URL (e.g. when arriving from the dashboard search).
  const [draft, setDraft] = useState(search);
  const [synced, setSynced] = useState(search);
  if (search !== synced) {
    setSynced(search);
    setDraft(search);
  }
  // Debounce typing into the URL (runs only when the draft changes, not on every URL update).
  useEffect(() => {
    if (draft.trim() === search) return;
    const t = setTimeout(() => setParams({ search: draft.trim(), page: 1 }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const counts = stats.status === "success" ? stats.data.byStatus : null;
  const total = stats.status === "success" ? stats.data.total : null;
  const filtered = Boolean(search || status !== "all" || batchId);

  const columns: Column<Unit>[] = [
    { key: "no", header: <abbr title="Unit number, printed on the code card and the ceramic's base" className="no-underline">No.</abbr>, cell: (u) => <span className="whitespace-nowrap text-admin-ink-soft tabular-nums">{u.unitNo || "None"}</span> },
    { key: "code", header: "Code", cell: (u) => <span className="font-postal tracking-wide whitespace-nowrap text-admin-ink">{u.code}</span> },
    { key: "slug", header: "NFC slug", cell: (u) => <span className="font-mono text-xs text-admin-ink-soft">{u.slug}</span>, hideBelow: "lg" },
    { key: "status", header: "Status", cell: (u) => <StatusChip status={u.status} /> },
    {
      key: "path",
      header: <abbr title="A: code card in the box. B: code emailed to the buyer." className="no-underline">Path</abbr>,
      cell: (u) => (u.path ? <span className="text-admin-ink">{u.path}</span> : <span className="text-admin-ink-soft">None</span>),
    },
    {
      key: "email",
      header: "Sender email",
      cell: (u) =>
        u.senderEmail ? (
          <span className="block max-w-64 truncate">{u.senderEmail}</span>
        ) : u.codeEmailedTo ? (
          <span className="block max-w-64 truncate text-admin-ink-soft" title="Code emailed to (Path B)">
            {u.codeEmailedTo} <span className="text-xs">(code sent)</span>
          </span>
        ) : (
          <span className="text-admin-ink-soft">None</span>
        ),
    },
    {
      key: "updated",
      header: "Last updated",
      className: "whitespace-nowrap text-right",
      // tablets: the table keeps its key columns; the date is on the unit page
      hideBelow: "lg",
      cell: (u) => (
        <time dateTime={u.updatedAt} title={dateTime(u.updatedAt)} className="text-admin-ink-soft tabular-nums">
          {now ? relativeTime(u.updatedAt, now) : dateTime(u.updatedAt)}
        </time>
      ),
    },
  ];

  const data = list.status === "success" ? list.data : null;

  return (
    <>
      <PageHeader
        eyebrow="Saudade admin"
        title="Units"
        description="Search by code, the sender's email, the NFC slug, or the unit number (S-0042). Select a unit to see its content and actions."
      />

      <Card bodyClassName="p-0">
        <div className="space-y-3 border-b border-admin-line px-4 py-4 md:px-5">
          <SearchInput value={draft} onChange={setDraft} className="max-w-xl" />
          <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <FilterChip active={status === "all"} onClick={() => setParams({ status: "all", page: 1 })} label="All" count={total} />
            {UNIT_STATUSES.map((s) => (
              <FilterChip
                key={s}
                active={status === s}
                onClick={() => setParams({ status: s, page: 1 })}
                label={STATUS_META[s].label}
                count={counts ? counts[s] : null}
                dot={STATUS_META[s].dot}
              />
            ))}
          </div>
          {batchId && (
            <p className="flex items-center gap-2 text-sm text-admin-ink-soft">
              Showing one batch only.
              <button type="button" className="min-h-11 underline underline-offset-2 hover:text-admin-ink md:min-h-0" onClick={() => setParams({ batch: null, page: 1 })}>
                Show all batches
              </button>
            </p>
          )}
        </div>

        {list.status === "error" && list.error.code !== "unauthorized" ? (
          <div className="p-4">
            <LoadError message={loadErrorText(list.error)} onRetry={() => list.reload()} />
          </div>
        ) : (
          <>
            <DataTable<Unit>
              caption="Units"
              rows={data?.items ?? []}
              columns={columns}
              getKey={(u) => u.id}
              rowHref={(u) => `/admin/units/${u.id}`}
              primary="code"
              loading={!data}
              mobileCard={(u) => <UnitCard unit={u} now={now} />}
              empty={
                <EmptyState
                  title={filtered ? "No units match" : "No units yet"}
                  body={
                    filtered ? (
                      <>
                        Nothing matches {search ? <strong className="font-medium text-admin-ink">“{search}”</strong> : "these filters"}
                        {status !== "all" && search ? ` with status ${STATUS_META[status].label.toLowerCase()}` : ""}. Codes look like <span className="whitespace-nowrap">SAUD-3K7M</span>; you can also search part of an email.
                      </>
                    ) : (
                      "Generate a batch to create units."
                    )
                  }
                  action={
                    filtered ? (
                      <AdminButton
                        onClick={() => {
                          setDraft("");
                          setParams({ search: null, status: "all", batch: null, page: 1 });
                        }}
                      >
                        Clear search and filters
                      </AdminButton>
                    ) : undefined
                  }
                />
              }
            />
            {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setParams({ page: p })} />}
          </>
        )}
      </Card>
    </>
  );
}

function FilterChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count: number | null; dot?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill border px-3 text-sm whitespace-nowrap transition-colors duration-(--motion-dur-fast) pointer-fine:md:min-h-8",
        active ? "border-admin-ink bg-admin-ink text-ink-inverse" : "border-admin-line bg-admin-surface text-admin-ink hover:border-paper-edge",
      )}
    >
      {dot && <span aria-hidden className={cn("size-1.5 rounded-pill", dot)} />}
      {label}
      {count !== null && <span className={cn("tabular-nums", active ? "text-ink-inverse/75" : "text-admin-ink-soft")}>{count}</span>}
    </button>
  );
}

function UnitCard({ unit: u, now }: { unit: Unit; now: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span className="font-postal text-base tracking-wide text-admin-ink">{u.code}</span>
          {u.unitNo && <span className="text-xs text-admin-ink-soft tabular-nums">{u.unitNo}</span>}
        </span>
        <StatusChip status={u.status} />
      </div>
      <p className="truncate text-sm text-admin-ink">{u.senderEmail ?? (u.codeEmailedTo ? `${u.codeEmailedTo} (code sent)` : <span className="text-admin-ink-soft">No email</span>)}</p>
      <p className="flex flex-wrap gap-x-2 text-xs text-admin-ink-soft">
        <span className="font-mono">{u.slug}</span>
        <span aria-hidden>·</span>
        <span>{u.path ? `Path ${u.path}` : "No path"}</span>
        <span aria-hidden>·</span>
        <time dateTime={u.updatedAt}>{now ? relativeTime(u.updatedAt, now) : dateTime(u.updatedAt)}</time>
      </p>
    </div>
  );
}
