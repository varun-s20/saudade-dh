import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** A number with a label. Links through to the filtered units table when `href` is given. */
export function StatCard({
  label,
  value,
  hint,
  href,
  marker,
  className,
}: {
  label: ReactNode;
  value: number | string | null;
  hint?: ReactNode;
  href?: string;
  /** Small visual on the label row (e.g. a status dot). */
  marker?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-admin-ink-soft uppercase">
        {marker}
        {label}
      </div>
      <div className="mt-1 font-display text-3xl leading-none text-admin-ink tabular-nums">
        {value === null ? <span className="inline-block h-7 w-10 animate-pulse rounded-soft bg-admin-line/70 align-middle" aria-label="Loading" /> : value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-admin-ink-soft">{hint}</div>}
    </>
  );
  const base = cn("block rounded-card border border-admin-line bg-admin-surface px-4 py-3.5 shadow-flat", className);
  return href ? (
    <Link href={href} className={cn(base, "transition-colors duration-(--motion-dur-fast) hover:border-paper-edge hover:bg-paper-raised")}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
