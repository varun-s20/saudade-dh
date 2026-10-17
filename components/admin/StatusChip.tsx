import type { UnitStatus } from "@/lib/services/types";
import { cn } from "@/lib/utils/cn";

/** Unit status chip. Colour is never the only signal: every chip carries its label. */
export const STATUS_META: Record<UnitStatus, { label: string; description: string; chip: string; dot: string }> = {
  unassigned: {
    label: "Unassigned",
    description: "Made, not yet claimed by a sender.",
    chip: "border-admin-line bg-admin-bg text-admin-ink-soft",
    dot: "border border-ink-faded bg-transparent",
  },
  assigned: {
    label: "Assigned",
    description: "Code emailed to a buyer (Path B), not yet claimed.",
    chip: "border-dusty-blue/60 bg-dusty-blue/15 text-dusty-blue-ink",
    dot: "bg-dusty-blue",
  },
  claimed: {
    label: "Claimed",
    description: "Claimed by a sender. Nothing added yet.",
    chip: "border-ochre/60 bg-ochre/15 text-ochre-ink",
    dot: "bg-ochre",
  },
  filled: {
    label: "Filled",
    description: "At least one stamp has something in it.",
    chip: "border-terracotta/60 bg-terracotta/15 text-terracotta-ink",
    dot: "bg-terracotta",
  },
  sealed: {
    label: "Sealed",
    description: "The sender sealed it. The next tap plays the first-tap reveal.",
    chip: "border-wax/50 bg-wax/10 text-red-ink",
    dot: "bg-wax",
  },
  revealed: {
    label: "Revealed",
    description: "The recipient has opened it.",
    chip: "border-sage/70 bg-sage/20 text-sage-ink",
    dot: "bg-sage-ink",
  },
};

export function StatusChip({ status, className }: { status: UnitStatus; className?: string }) {
  const m = STATUS_META[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 text-xs leading-5 font-medium whitespace-nowrap", m.chip, className)}
      title={m.description}
    >
      <span aria-hidden className={cn("size-1.5 rounded-pill", m.dot)} />
      {m.label}
    </span>
  );
}
