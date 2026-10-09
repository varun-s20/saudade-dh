"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Skeleton } from "./ui";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on narrower desktop widths to keep the table calm. */
  hideBelow?: "lg" | "xl";
}

/**
 * Responsive table: a real <table> from md up, stacked cards on phones.
 * Whole rows are clickable with a mouse; the `primary` cell renders a real link for keyboard and
 * screen-reader users (so the row is never the only way in).
 */
export function DataTable<T>({
  caption,
  rows,
  columns,
  getKey,
  rowHref,
  primary,
  mobileCard,
  loading,
  skeletonRows = 8,
  empty,
}: {
  caption: string;
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  rowHref?: (row: T) => string;
  /** Key of the column whose cell is wrapped in the row link. */
  primary?: string;
  mobileCard: (row: T) => ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
}) {
  const router = useRouter();
  const hide = (c: Column<T>) => (c.hideBelow === "lg" ? "hidden lg:table-cell" : c.hideBelow === "xl" ? "hidden xl:table-cell" : "");

  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-admin-line">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-admin-ink-soft uppercase first:pl-5", hide(c), c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-busy={loading || undefined}>
            {loading
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={i} className="border-b border-admin-line/70 last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-3.5 first:pl-5", hide(c))}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const href = rowHref?.(row);
                  return (
                    <tr
                      key={getKey(row)}
                      onClick={(e) => {
                        if (!href || (e.target as HTMLElement).closest("a,button")) return;
                        router.push(href);
                      }}
                      className={cn("border-b border-admin-line/70 last:border-0", href && "cursor-pointer transition-colors duration-(--motion-dur-fast) hover:bg-paper-raised")}
                    >
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-4 py-3 align-middle first:pl-5", hide(c), c.className)}>
                          {href && c.key === primary ? (
                            <Link href={href} className="rounded-soft hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
                              {c.cell(row)}
                            </Link>
                          ) : (
                            c.cell(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Phone cards */}
      <ul className="divide-y divide-admin-line md:hidden" aria-label={caption} aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: Math.min(skeletonRows, 5) }, (_, i) => (
              <li key={i} className="space-y-2 px-4 py-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-48" />
              </li>
            ))
          : rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <li key={getKey(row)}>
                  {href ? (
                    <Link href={href} className="block px-4 py-3.5 transition-colors duration-(--motion-dur-fast) hover:bg-paper-raised active:bg-paper-raised">
                      {mobileCard(row)}
                    </Link>
                  ) : (
                    <div className="px-4 py-3.5">{mobileCard(row)}</div>
                  )}
                </li>
              );
            })}
      </ul>
    </>
  );
}

/** "1–25 of 41" with previous / next. */
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    "inline-flex min-h-11 items-center rounded-soft border border-admin-line bg-admin-surface px-3 text-sm text-admin-ink hover:bg-paper disabled:opacity-45 pointer-fine:md:min-h-9";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-line px-4 py-3 md:px-5">
      <p className="text-sm text-admin-ink-soft tabular-nums" aria-live="polite">
        {from}–{to} of {total}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1}>
            <span aria-hidden>←&nbsp;</span>Previous
          </button>
          <span className="text-sm text-admin-ink-soft tabular-nums">
            Page {page} of {pages}
          </span>
          <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages}>
            Next<span aria-hidden>&nbsp;→</span>
          </button>
        </div>
      )}
    </nav>
  );
}
