import type { Unit } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";
import { dateTime } from "@/lib/utils/format";
import { Card } from "./ui";

interface Step {
  label: string;
  at: string | null;
  /** Shown instead of "Not yet" when the step doesn't apply. */
  note?: string;
  proposed?: boolean;
}

/** created → code emailed → claimed → sealed → revealed */
export function UnitTimeline({ unit }: { unit: Unit }) {
  const steps: Step[] = [
    { label: "Created", at: unit.createdAt },
    {
      label: "Code emailed",
      at: unit.codeEmailedAt,
      note: unit.codeEmailedAt ? undefined : unit.path === "A" ? "Not needed: code card in the box (Path A)" : undefined,
    },
    { label: "Claimed", at: unit.claimedAt },
    { label: "Sealed", at: unit.sealedAt, proposed: true },
    { label: "Revealed", at: unit.revealedAt, proposed: true },
  ];

  return (
    <Card title="Timeline">
      <ol className="space-y-0">
        {steps.map((s, i) => {
          const done = Boolean(s.at);
          return (
            <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
              {i < steps.length - 1 && <span aria-hidden className={cn("absolute top-4 left-1.5 h-full w-px", done ? "bg-sage-ink/50" : "bg-admin-line")} />}
              <span
                aria-hidden
                className={cn("relative mt-1 size-3 shrink-0 rounded-pill border-2", done ? "border-sage-ink bg-sage-ink" : s.note ? "border-admin-line bg-admin-line" : "border-paper-edge bg-admin-surface")}
              />
              <div className="min-w-0 text-sm">
                <p className={cn(done ? "text-admin-ink" : "text-admin-ink-soft")}>
                  {s.label}
                  {s.proposed && (
                    <abbr title="Proposed status, pending the client's approval (O7)" className="ml-0.5 no-underline">
                      †
                    </abbr>
                  )}
                  <span className="sr-only">{done ? ": done" : ": not yet"}</span>
                </p>
                <p className="text-xs text-admin-ink-soft">{s.at ? <time dateTime={s.at}>{dateTime(s.at)}</time> : (s.note ?? "Not yet")}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
