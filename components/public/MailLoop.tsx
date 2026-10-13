/**
 * Airmail route (recover masthead): a little biplane carries your link from the Saudade postmark
 * to a heart pin, round and round, along a dashed route that marches like a moving map. A
 * gumroad.com-style character loop; constant motion, so linear dashes and a smooth ease-in-out
 * flight. Reduced motion hides the plane and keeps the route. Decorative.
 */
const ROUTE = "M44 214 C 112 150, 52 92, 158 92 S 288 140, 318 50";

export function MailLoop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" className={`ix-route ${className ?? ""}`} aria-hidden focusable="false">
      <path className="ix-route__path" d={ROUTE} fill="none" stroke="var(--accent-navy)" strokeWidth="2.5" strokeDasharray="3 8" strokeLinecap="round" />

      {/* from: the Saudade postmark */}
      <g transform="translate(44 214)">
        <circle r="22" fill="var(--paper-raised)" stroke="var(--accent-red)" strokeWidth="2.5" />
        <circle r="15" fill="none" stroke="var(--accent-red)" strokeWidth="1.2" strokeDasharray="2 3" />
        <path d="M0 6c-3.4-3-8-6-8-10.2 0-2.6 2-4.4 4.2-4.4 1.6 0 2.9.9 3.8 2.3.9-1.4 2.2-2.3 3.8-2.3 2.2 0 4.2 1.8 4.2 4.4C8 0 3.4 3 0 6z" fill="var(--accent-red)" />
      </g>
      <text x="44" y="254" textAnchor="middle" fill="var(--accent-navy)" style={{ fontFamily: "var(--ff-script)", fontSizeAdjust: "var(--fsa-script)", fontSize: 22 }}>
        Saudade
      </text>

      {/* to: a heart pin */}
      <g transform="translate(318 50)">
        <path d="M0 22c-9-8-20-15-20-25.5 0-6.5 5-11 10.5-11 4 0 7.3 2.2 9.5 5.8 2.2-3.6 5.5-5.8 9.5-5.8C15 -14.5 20 -10 20 -3.5 20 7 9 14 0 22z" fill="var(--accent-red)" stroke="var(--accent-navy)" strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <text x="318" y="98" textAnchor="middle" fill="var(--accent-navy)" style={{ fontFamily: "var(--ff-script)", fontSizeAdjust: "var(--fsa-script)", fontSize: 24 }}>
        you
      </text>

      <g className="ix-route__traveller">
        <g transform="scale(1.35) translate(-26 -16)">
          {/* the envelope it carries */}
          <rect x="-4" y="22" width="22" height="15" rx="2" fill="var(--paper-raised)" stroke="var(--accent-navy)" strokeWidth="2" />
          <path d="M-4 22 L7 31 L18 22" fill="none" stroke="var(--accent-navy)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M7 22v-4" stroke="var(--accent-navy)" strokeWidth="1.6" />
          {/* the plane, nose to the right */}
          <path d="M6 10h30c6 0 10 2.5 10 5s-4 5-10 5H10c-3 0-5-2-5-5z" fill="var(--accent-terracotta)" stroke="var(--accent-navy)" strokeWidth="2.2" strokeLinejoin="round" />
          <rect x="16" y="2" width="20" height="5" rx="2.5" fill="var(--paper-raised)" stroke="var(--accent-navy)" strokeWidth="2" />
          <path d="M22 7v3M31 7v3" stroke="var(--accent-navy)" strokeWidth="2" />
          <path d="M6 12l-6-6v14z" fill="var(--accent-ochre)" stroke="var(--accent-navy)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M48 8v14" stroke="var(--accent-navy)" strokeWidth="2.2" strokeLinecap="round" />
        </g>
        <animateMotion dur="6s" repeatCount="indefinite" rotate="auto" path={ROUTE} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines="0.45 0 0.25 1" />
      </g>
    </svg>
  );
}
