/**
 * Original illustration for /help/tap: the ceramic envelope with its heart tap zone, and a phone
 * reaching it. iPhone: the TOP edge of the phone meets the heart and a banner appears on screen
 * (RESEARCH §4.1). Android: the middle of the BACK of the phone meets the heart (§4.2).
 * Decorative: the steps beside it carry the same information in words.
 * Loops like a gumroad.com character animation (public.css `ti-*`): the phone glides to the
 * heart, the signal rings pulse, the banner drops in and a fingertip taps it. Reduced motion:
 * the arrived frame, still.
 */
import { cn } from "@/lib/utils/cn";

const HEART = "M0 6.2C-3.6 2.9-9.6-.6-9.6-5.6c0-3 2.3-5.2 5-5.2 2 0 3.6 1.1 4.6 2.7 1-1.6 2.6-2.7 4.6-2.7 2.7 0 5 2.2 5 5.2 0 5-6 8.5-9.6 11.8z";

function Ceramic({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={`translate(0 ${dy})`}>
      {/* glazed ceramic envelope */}
      <rect x="58" y="16" width="204" height="104" rx="12" fill="var(--paper-raised)" stroke="var(--paper-edge)" strokeWidth="1.6" />
      <rect x="64" y="22" width="192" height="92" rx="9" fill="none" stroke="var(--paper-shadow)" strokeWidth="0.8" opacity="0.7" />
      <path d="M64 24 L160 78 L256 24" fill="none" stroke="var(--paper-edge)" strokeWidth="1.3" />
      <path d="M72 30 Q110 26 130 34" fill="none" stroke="var(--ink-inverse)" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      {/* the heart stamp = the tap zone */}
      <g transform="translate(160 80) scale(1.35)">
        <path d={HEART} fill="var(--accent-red)" />
        <path d={HEART} fill="none" stroke="var(--wax-shadow)" strokeWidth="0.6" opacity="0.5" />
      </g>
    </g>
  );
}

function Waves({ cy }: { cy: number }) {
  return (
    <g className="ti-waves" fill="none" stroke="var(--postmark)" strokeLinecap="round" opacity="0.55">
      <path d={`M146 ${cy} Q160 ${cy + 7} 174 ${cy}`} strokeWidth="1.6" />
      <path d={`M138 ${cy + 7} Q160 ${cy + 18} 182 ${cy + 7}`} strokeWidth="1.4" strokeDasharray="3 3" />
      <path d={`M130 ${cy + 14} Q160 ${cy + 29} 190 ${cy + 14}`} strokeWidth="1.2" strokeDasharray="2 4" />
    </g>
  );
}

export function TapIllustration({ variant, className }: { variant: "iphone" | "android"; className?: string }) {
  return (
    <svg viewBox="0 0 320 250" className={cn("h-auto w-full", className)} aria-hidden focusable="false">
      <Ceramic dy={variant === "android" ? 50 : 0} />
      {variant === "iphone" ? (
        <>
          <Waves cy={96} />
          {/* phone, screen towards us, its top edge reaching the heart */}
          <g className="ti-phone">
          <g transform="rotate(-6 160 200)">
            <rect x="106" y="126" width="108" height="150" rx="20" fill="var(--ink)" />
            <rect x="111" y="131" width="98" height="150" rx="16" fill="var(--paper)" />
            <rect x="146" y="136" width="28" height="7" rx="3.5" fill="var(--ink)" />
            {/* the banner to tap */}
            <g className="ti-banner">
              <rect x="116" y="149" width="88" height="30" rx="9" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth="1.4" />
              <g transform="translate(129 164) scale(0.62)">
                <path d={HEART} fill="var(--accent-red)" />
              </g>
              <rect x="139" y="157" width="46" height="4" rx="2" fill="var(--ink-soft)" opacity="0.7" />
              <rect x="139" y="166" width="32" height="4" rx="2" fill="var(--ink-faded)" opacity="0.5" />
            </g>
            {/* a fingertip tapping the banner */}
            <g className="ti-tip">
              <circle cx="184" cy="170" r="11" fill="var(--accent-terracotta)" opacity="0.25" />
              <circle cx="184" cy="170" r="5.5" fill="none" stroke="var(--accent-terracotta-ink)" strokeWidth="1.6" />
            </g>
            <rect x="122" y="192" width="76" height="5" rx="2.5" fill="var(--paper-shadow)" />
            <rect x="122" y="203" width="58" height="5" rx="2.5" fill="var(--paper-shadow)" opacity="0.7" />
          </g>
          </g>
        </>
      ) : (
        <>
          {/* phone, back towards us, its middle over the heart */}
          <g className="ti-phone ti-phone--back">
          <g transform="rotate(5 160 130)">
            <rect x="112" y="30" width="96" height="200" rx="18" fill="var(--postmark)" opacity="0.95" />
            <rect x="122" y="42" width="28" height="40" rx="9" fill="var(--ink)" opacity="0.55" />
            <circle cx="136" cy="54" r="6" fill="var(--ink)" />
            <circle cx="136" cy="71" r="5" fill="var(--ink)" />
            {/* antenna area, over the heart */}
            <circle className="ti-ring" cx="160" cy="130" r="22" fill="none" stroke="var(--ink-inverse)" strokeWidth="1.4" strokeDasharray="3 3" opacity="0.8" />
            <circle className="ti-ring ti-ring--2" cx="160" cy="130" r="34" fill="none" stroke="var(--ink-inverse)" strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
          </g>
          </g>
          {/* the heart, seen through the phone: where to hold */}
          <g transform="translate(160 130) scale(1.35)">
            <path d={HEART} fill="none" stroke="var(--ink-inverse)" strokeWidth="1.2" strokeDasharray="2 2" />
          </g>
          {/* notification chip */}
          <g className="ti-chip">
          <g transform="translate(214 196)">
            <rect x="0" y="0" width="92" height="28" rx="14" fill="var(--paper-raised)" stroke="var(--ink)" strokeWidth="1.4" />
            <g transform="translate(16 15) scale(0.55)">
              <path d={HEART} fill="var(--accent-red)" />
            </g>
            <rect x="28" y="9" width="48" height="4" rx="2" fill="var(--ink-soft)" opacity="0.7" />
            <rect x="28" y="16" width="34" height="4" rx="2" fill="var(--ink-faded)" opacity="0.5" />
          </g>
          </g>
        </>
      )}
    </svg>
  );
}
