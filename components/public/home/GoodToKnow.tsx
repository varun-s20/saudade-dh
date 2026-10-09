/**
 * Good to know (D-072): three postcard scenes and a postcard back of quick answers, in a bento.
 * Each scene is a link that fills the screen with its own colour (the oatly.com transition).
 * Motion (Emil Kowalski): the cards rise in once, staggered; under a mouse a card lifts and its
 * art leans in (200–300ms, ease-out); the art drifts slightly with scroll where CSS scroll
 * timelines exist (off the main thread). Reduced motion: still.
 */
import type { CSSProperties, ReactNode } from "react";
import { InView } from "@/components/motion/InView";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { MailLoop } from "@/components/public/MailLoop";
import { TapIllustration } from "@/components/public/TapIllustration";
import { HeartSeal } from "@/components/stamps/HeartSeal";
import { Stamp } from "@/components/stamps/Stamp";
import { InkLink } from "@/components/ui/InkButton";
import { site } from "@/config/site";

const ANSWERS: [string, ReactNode][] = [
  ["Do they need an app?", "No. It opens in their phone's browser the moment they tap the heart."],
  ["Does the code expire?", "Never. Keep adding photos, notes and songs for years."],
  ["Can I change it after it's given?", "Yes. They'll see what's new the next time they tap."],
  ["Which phones work?", "iPhone XS and later, and most Android phones with NFC switched on."],
];

const BAND = { sky: "band-sky", sunset: "band-sunset", sea: "band-sea" } as const;

function Scene({
  href,
  tone,
  fill,
  title,
  body,
  art,
  className,
  i,
}: {
  href: string;
  tone: "sky" | "sunset" | "sea";
  fill: string;
  title: ReactNode;
  body: string;
  art: ReactNode;
  className?: string;
  i: number;
}) {
  return (
    <li className={`kn-cell ${className ?? ""}`} style={{ "--i": i } as CSSProperties}>
      <TransitionLink href={href} color={fill} className="kn-card">
        <span className={`kn-scene ${BAND[tone]}`}>
          <span aria-hidden className="kn-art">
            {art}
          </span>
          <span className="kn-text">
            <span className="display kn-title">{title}</span>
            <span className="kn-body">{body}</span>
          </span>
          <span aria-hidden className="kn-go">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </span>
      </TransitionLink>
    </li>
  );
}

export function GoodToKnowBento() {
  return (
    <section aria-labelledby="know-title" className="kn section-y">
      <div className="wrap">
        <div className="kn-head">
          <div>
            <p className="eyebrow text-terracotta-ink">Before you give one</p>
            <h2 id="know-title" className="display mt-4 text-d1">
              Good to <em>know.</em>
            </h2>
          </div>
          <InkLink href="/help/tap" variant="quiet">
            All help
          </InkLink>
        </div>

        <InView as="ul" effect="rise" className="kn-grid">
          <Scene
            i={0}
            className="kn-cell--big"
            href="/help/tap"
            tone="sky"
            fill="var(--accent-sky)"
            title={
              <>
                Hold your phone to <em>the heart.</em>
              </>
            }
            body="iPhone: the top edge. Android: the middle of the back. A notification appears; tap it."
            art={<TapIllustration variant="iphone" className="kn-art__tap" />}
          />
          <Scene
            i={1}
            href="/recover"
            tone="sunset"
            fill="var(--accent-terracotta)"
            title={
              <>
                Lost your <em>link?</em>
              </>
            }
            body="We'll send it again, to the email you gave us."
            art={<MailLoop className="kn-art__route" />}
          />
          <Scene
            i={2}
            href="/privacy"
            tone="sea"
            fill="var(--accent-cobalt)"
            title={
              <>
                Private by <em>design.</em>
              </>
            }
            body="Only someone with the envelope, or its link, can open it."
            art={
              <span className="kn-art__seal">
                <HeartSeal size={112} glow />
              </span>
            }
          />
          <li className="kn-cell kn-cell--wide" style={{ "--i": 3 } as CSSProperties}>
            <div className="kn-back">
              <div className="kn-back__head">
                <p className="eyebrow text-ink-faded">Post card · quick answers</p>
                <span aria-hidden className="kn-back__stamp">
                  <Stamp kind="letter" width={52} rotate={6} />
                </span>
              </div>
              <dl className="kn-answers">
                {ANSWERS.map(([q, a]) => (
                  <div key={q}>
                    <dt className="display leading-[1.12]">{q}</dt>
                    <dd>{a}</dd>
                  </div>
                ))}
              </dl>
              <p className="kn-back__foot">
                Still stuck? Write to{" "}
                <a href={`mailto:${site.supportEmail}`} className="font-semibold text-ink underline decoration-red decoration-2 underline-offset-4">
                  {site.supportEmail}
                </a>{" "}
                and a person will help.
              </p>
            </div>
          </li>
        </InView>
      </div>
    </section>
  );
}
