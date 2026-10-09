/**
 * Original illustrations for the home page ("Wish You Were Here", D-060): flat linen-postcard
 * colours with sepia/navy line. Decorative unless stated; the words beside them say the same.
 */
import type { ReactNode } from "react";
import { HeartSeal } from "@/components/stamps/HeartSeal";

const NAVY = "var(--accent-navy)";
const LINE = { stroke: NAVY, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/**
 * A 1930s barnstorming biplane, drawn side-on with its nose to the left: a cowled radial engine
 * and a spinning prop, two wings with N-struts and bracing wires, a pilot in a leather helmet and
 * goggles with a scarf streaming back, a heart roundel on the fuselage and a striped rudder.
 * Used by the hero (towing a banner) and the year timeline (flying the route, mirrored).
 * `clipId` must be unique on the page (it clips the rudder stripes). `tow` adds the line from
 * the tail that a banner's bridle ties to.
 */
export function BiplaneCraft({ className, clipId, tow = false }: { className?: string; clipId: string; tow?: boolean }) {
  return (
    <svg viewBox="0 0 168 88" className={className} overflow="visible" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <path d="M130 40C135 31 141 23 149 21c6-1 8 3 7 7l-3 14z" />
        </clipPath>
      </defs>
      {/* propeller: a blur disc, and the blade that flicks through it */}
      <ellipse cx="14" cy="46" rx="3.2" ry="25" fill={NAVY} opacity="0.13" />
      <path className="hm-plane__prop" d="M14 22v48" stroke={NAVY} strokeWidth="3.2" strokeLinecap="round" />
      {/* undercarriage */}
      <path d="M54 60l6 14M71 59l-9 15" {...LINE} fill="none" />
      <circle cx="61" cy="75" r="7.5" fill={NAVY} />
      <circle cx="61" cy="75" r="2.6" fill="var(--paper-raised)" />
      {/* cabane and interplane struts, bracing wires */}
      <path d="M45 20l2 13M60 20l-2 13M51 20l3 37M86 19l2 38.5" {...LINE} fill="none" />
      <path d="M51 20l37 37.5M86 19L54 57" stroke={NAVY} strokeWidth="1" opacity="0.45" />
      {/* pilot: leather helmet, goggles */}
      <circle cx="102" cy="28" r="6.2" fill="var(--ink)" />
      <path d="M96.5 25.5c3-1.6 7-1.6 11 .4" stroke="var(--accent-ochre)" strokeWidth="1.6" fill="none" />
      <circle cx="97" cy="27" r="2.7" fill="var(--accent-sky)" stroke="var(--paper-raised)" strokeWidth="1.4" />
      {/* fuselage, with a cream cheat-line */}
      <path d="M36 33c34-1 74 3 116 8v7c-40 4-78 11-116 11z" fill="var(--accent-red)" {...LINE} />
      <path d="M39 46.5c38 0 76-.6 111-1.6" stroke="var(--paper-raised)" strokeWidth="3" fill="none" />
      {/* windscreen */}
      <path d="M91 34.2l2.4-7.2h3.4v7" fill="var(--accent-sky)" fillOpacity="0.55" stroke={NAVY} strokeWidth="1.6" strokeLinejoin="round" />
      {/* the heart roundel */}
      <circle cx="122" cy="44.6" r="5.6" fill="var(--paper-raised)" stroke={NAVY} strokeWidth="1.8" />
      <path d="M122 48.4s-3.7-2.3-4.5-4.6c-.6-1.6.4-3.3 2.1-3.3.9 0 1.7.5 2.4 1.4.7-.9 1.5-1.4 2.4-1.4 1.7 0 2.7 1.7 2.1 3.3-.8 2.3-4.5 4.6-4.5 4.6z" fill="var(--accent-red)" />
      {/* engine cowling and spinner */}
      <path d="M37 33c-10 0-16 5-16 13s6 13 16 13z" fill="var(--accent-ochre)" {...LINE} />
      <path d="M30 35.5c-3.6 3.6-3.6 17.4 0 21" stroke={NAVY} strokeWidth="1.3" opacity="0.5" fill="none" />
      <path d="M22 41.2Q11 46 22 50.8z" fill="var(--paper-raised)" {...LINE} strokeWidth="2" />
      {/* lower wing, in front of the fuselage */}
      <path d="M44 61c1-4 6-4.5 14-4.5l36 1c4 .2 4 6.3 0 6.5l-46 1c-3 0-4.4-1.7-4-4z" fill="var(--paper-raised)" {...LINE} />
      {/* upper wing, with its ribs */}
      <path d="M40 17c1-4.5 7-6 16-6l38 1.5c4 .2 4 6.5 0 6.7l-50 1.3c-3 0-4.4-1.5-4-3.5z" fill="var(--paper-raised)" {...LINE} />
      <path d="M56 11.6v8.4M68 12v7.8M80 12.4v7.2" stroke={NAVY} strokeWidth="1" opacity="0.35" />
      {/* tail: a striped rudder, the tailplane and the skid */}
      <path d="M130 40C135 31 141 23 149 21c6-1 8 3 7 7l-3 14z" fill="var(--paper-raised)" />
      <g clipPath={`url(#${clipId})`} stroke="var(--accent-red)" strokeWidth="3.4">
        <path d="M145 18v28M152 18v28" />
      </g>
      <path d="M130 40C135 31 141 23 149 21c6-1 8 3 7 7l-3 14z" fill="none" {...LINE} />
      <path d="M128 45l30-2c3 0 3 4.5 0 4.5L130 49z" fill="var(--paper-raised)" {...LINE} strokeWidth="2.1" />
      <path d="M146 49l5 6" {...LINE} strokeWidth="2.1" />
      {/* scarf, streaming back in the slipstream */}
      <path className="hm-plane__scarf" d="M104.5 31.5c7-3.4 12 1.6 20-2.4-2.6 4.6-9.6 5.6-17.6 5z" fill="var(--paper-raised)" stroke={NAVY} strokeWidth="1.5" strokeLinejoin="round" />
      {/* tow line to the banner's bridle */}
      {tow ? <path d="M152 47l16-3" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" /> : null}
    </svg>
  );
}

/** The hero: the biplane towing an aerial banner, a stitched cloth on a bridle that flutters behind. */
export function Biplane({ banner }: { banner: string }) {
  return (
    <div className="hm-plane" aria-hidden>
      <div className="hm-plane__bob">
        <BiplaneCraft className="hm-plane__craft" clipId="hm-plane-fin" tow />
        <div className="hm-plane__tow">
          <svg viewBox="0 0 60 40" preserveAspectRatio="none" className="hm-plane__rope">
            <path d="M0 20h38M38 20L60 2M38 20l22 18" fill="none" stroke={NAVY} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="hm-plane__banner">
            <span>{banner}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Small line icons for the occasion stamps. */
export const OCCASION_ICONS: Record<string, ReactNode> = {
  cake: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M4 20h16M5 20v-7h14v7M5 15c2 1.5 4.5 1.5 7 0s5-1.5 7 0M12 13V9M12 6.5c-1-1-1-2.2 0-3.5 1 1.3 1 2.5 0 3.5z" />
    </svg>
  ),
  plane: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M3 13.5l7-1.8L14.5 4c.8-1.3 2.8-1 2.6.6l-.9 6.7 4.3 1.6c.9.4.7 1.7-.3 1.8l-5 .2-3.7 5.8c-.5.8-1.8.4-1.7-.6l.5-4.8-6.1-.7c-1-.1-1.1-1-.2-1.1z" />
    </svg>
  ),
  house: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M4 11l8-6.5 8 6.5M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </svg>
  ),
  cap: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.5v4.5c3 2.4 8 2.4 11 0v-4.5M21.5 9.5v5" />
    </svg>
  ),
  suitcase: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M4 8h16v11H4zM9 8V5.5h6V8M4 12.5h16M10 12.5v2M14 12.5v2" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M12 20s-7.5-4.6-9.2-9.2C1.6 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.3 3.1 4.1 6.3C19.5 15.4 12 20 12 20z" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z" />
    </svg>
  ),
  flower: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M12 14v7M12 17c-2-2-4.5-2-5.5-1M12 14a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2zM12 8.8c0-2.2.9-4.3 2-5.3 1.1 1 1.4 3.2 0 5.3M14.4 11.5c2.2 0 4.2.8 5.2 2-1 1.1-3.2 1.3-5.2 0M9.6 11.5c-2.2 0-4.2.8-5.2 2 1 1.1 3.2 1.3 5.2 0" />
    </svg>
  ),
  cup: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M4.5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.8M8.5 6c0-1.2 1-1.4 1-2.6M12 6c0-1.2 1-1.4 1-2.6" />
    </svg>
  ),
  gift: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M4 10h16v3H4zM5.5 13v7h13v-7M12 10v10M12 10c-1.5-3.5-5.5-4-5.5-1.5S10.5 10 12 10zM12 10c1.5-3.5 5.5-4 5.5-1.5S13.5 10 12 10z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24">
      <path {...STROKE} d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />
    </svg>
  ),
};

/** The back of a postcard: "POST CARD" header, message on the left, stamp + address on the right. */
export function PostcardBack({ message, to, stamp, className }: { message: ReactNode; to: ReactNode; stamp?: ReactNode; className?: string }) {
  return (
    <div className={`hm-back ${className ?? ""}`}>
      <p className="hm-back__head" aria-hidden>
        Post card
      </p>
      <div className="hm-back__body">
        <div className="hm-back__msg">{message}</div>
        <div className="hm-back__side">
          <div className="hm-back__stampbox">{stamp}</div>
          <div className="hm-back__addr">{to}</div>
        </div>
      </div>
    </div>
  );
}

/** A phone showing the envelope waiting to be tapped. */
export function PhoneMock() {
  return (
    <div className="hm-phone" aria-hidden>
      <div className="hm-phone__screen">
        <span className="hm-phone__notch" />
        <p className="hm-phone__prompt">Someone who misses you sent this.</p>
        <div className="hm-phone__env">
          <svg viewBox="0 0 300 200" preserveAspectRatio="none">
            <path d="M0 0 L150 118 L300 0 Z" fill="var(--paper-deep)" />
            <path d="M0 0 L150 118 L300 0" stroke="var(--ink)" strokeWidth="2" fill="none" />
          </svg>
          <div className="hm-phone__seal">
            <HeartSeal size={40} glow />
          </div>
        </div>
        <span className="hm-phone__tap">
          <span aria-hidden className="text-red">
            ♥
          </span>
          Tap to open
        </span>
      </div>
    </div>
  );
}

/** The printed code ticket from the box (a sample, body blanked). */
export function CodeTicket() {
  return (
    <div className="hm-ticket" aria-hidden>
      <span className="hm-ticket__label">Your activation code</span>
      <span className="hm-ticket__code">SAUD-3K7M</span>
      <span className="hm-ticket__note">It never expires</span>
    </div>
  );
}
