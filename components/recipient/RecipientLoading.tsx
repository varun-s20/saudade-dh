"use client";

/**
 * Loading state for the recipient route (and the Suspense fallback): the plain cream paper of
 * the page, full height, so nothing shifts when the envelope arrives. The loader only fades in
 * if the wait passes 400 ms, so a fast load never flashes a spinner.
 */
import { PaperLoader } from "@/components/ui/PaperLoader";
import { cn } from "@/lib/utils/cn";
import "./recipient.css";

export function RecipientLoading({ contained, label = "Opening your envelope…" }: { contained?: boolean; label?: string }) {
  return (
    <div className={cn("relative w-full", contained ? "h-full" : "h-svh min-h-screen")} aria-busy="true">
      <div className="rc-loading absolute inset-0 grid place-items-center">
        <PaperLoader label={label} className="text-postmark" />
      </div>
    </div>
  );
}
