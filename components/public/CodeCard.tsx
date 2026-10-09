import { Postmark } from "@/components/paper/Postmark";
import { cn } from "@/lib/utils/cn";

/**
 * The printed code card from the box, drawn in real type (decorative; copy beside it explains).
 * `code` shows a sample with the body blanked, so nobody mistakes it for a real code.
 */
export function CodeCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[1.6] w-full max-w-[26rem] rotate-[-3deg] border-2 border-ink bg-paper-raised p-[6%] text-ink shadow-print paper-grain",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-[clamp(1.35rem,1rem+1.4vw,1.85rem)] leading-none font-black tracking-[-0.045em]">saudade</span>
        <span className="grid aspect-[5/6] w-[15%] place-items-center bg-cobalt text-rose shadow-stamp">
          <svg viewBox="0 0 24 24" className="w-[62%]" fill="currentColor">
            <path d="M12 21s-7.5-4.6-9.4-9.3C1.2 8.2 3.4 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.6 0 5.8 3.7 4.4 7.2C19.5 16.4 12 21 12 21z" />
          </svg>
        </span>
      </div>
      <p className="eyebrow mt-[7%] text-[0.62rem] text-ink-faded sm:text-[0.7rem]">Your activation code</p>
      <p className="mt-[2%] flex items-center gap-[0.35em] font-postal text-[clamp(1.5rem,1rem+2.4vw,2.4rem)] leading-none font-bold tracking-[0.04em] text-ink">
        SAUD-
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="inline-block h-[1.15em] w-[0.8em] border-2 border-dashed border-ink/35" />
        ))}
      </p>
      <div className="absolute inset-x-[6%] bottom-[8%] flex items-end justify-between gap-4 border-t-2 border-ink/10 pt-[3%]">
        <span className="text-[0.7rem] leading-snug text-ink-faded sm:text-xs">
          Enter it at <b className="font-semibold text-ink-soft">saudade.example/claim</b>
          <br />
          It never expires.
        </span>
        <Postmark variant="circle" size={46} rotate={-12} place="SAUDADE" ink="red" opacity={0.6} />
      </div>
    </div>
  );
}
