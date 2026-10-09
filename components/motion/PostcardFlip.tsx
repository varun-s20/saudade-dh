"use client";

/**
 * <PostcardFlip>: a postcard that turns over to its written back.
 * Motion (Emil Kowalski): a 3D turn is movement on screen, so it eases in and out (strong
 * curve, 520ms: it explains, it isn't a control you hit all day). It is a CSS transition, so a
 * quick hover-off mid-turn reverses smoothly from where it is instead of restarting.
 * Mouse: hover turns it. Touch and keyboard: the "Turn over" button (aria-pressed). Reduced
 * motion: the faces swap without the turn.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import "./motion.css";

export function PostcardFlip({ front, back, label, tilt = "0deg", className }: { front: ReactNode; back: ReactNode; label: string; tilt?: string; className?: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className={cn("pf", className)} data-flipped={flipped || undefined} style={{ ["--tilt" as string]: tilt } as CSSProperties}>
      <div className="pf__card">
        <div className="pf__face pf__front">{front}</div>
        <div className="pf__face pf__back">{back}</div>
      </div>
      <button type="button" className="pf__turn" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)}>
        <svg aria-hidden viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 10a6.5 6.5 0 0 1 11.3-4.4M16.5 10a6.5 6.5 0 0 1-11.3 4.4" />
          <path d="M15.2 2.6v3.2H12M4.8 17.4v-3.2H8" />
        </svg>
        <span>{flipped ? "Turn back" : "Turn over"}</span>
        <span className="sr-only">: {label}</span>
      </button>
    </div>
  );
}
