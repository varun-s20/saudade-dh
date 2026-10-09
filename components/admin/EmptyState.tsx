import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Calm empty state: a faint dashed envelope, a sentence, and an optional action. */
export function EmptyState({ title, body, action, className }: { title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      <svg viewBox="0 0 64 44" className="mb-1 h-11 w-16 text-paper-edge" fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="3 3" aria-hidden>
        <rect x="2" y="2" width="60" height="40" rx="2" />
        <path d="M2 4l30 21L62 4" />
      </svg>
      <p className="display text-lg text-admin-ink">{title}</p>
      {body && <div className="max-w-sm text-sm text-admin-ink-soft">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
