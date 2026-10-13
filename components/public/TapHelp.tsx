"use client";

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Stamp } from "@/components/stamps/Stamp";
import { site } from "@/config/site";
import { AddressLines, PostcardSheet, StampBox } from "./Interior";
import { TapIllustration } from "./TapIllustration";

type Platform = "iphone" | "android";

const noop = () => () => {};
/** Detected once on the client; null on the server (so markup matches before hydration). */
function useDetectedPlatform(): Platform | null {
  return useSyncExternalStore(
    noop,
    () => (/Android/i.test(navigator.userAgent) ? "android" : "iphone"),
    () => null,
  );
}

const STEPS: Record<Platform, { title: string; steps: ReactNode[]; note: ReactNode }> = {
  iphone: {
    title: "On an iPhone",
    steps: [
      <>Unlock your phone. If it has just restarted, unlock it once first.</>,
      <>
        Hold the <strong className="font-medium text-ink">top of your iPhone</strong> close to the heart, and keep it there for a moment.
      </>,
      <>
        A small banner appears at the top of the screen. <strong className="font-medium text-ink">Tap the banner</strong> and your letter opens.
      </>,
    ],
    note: <>Works on iPhone XS and later. It won&apos;t read while the Camera or Wallet is open, or in Airplane Mode.</>,
  },
  android: {
    title: "On Android",
    steps: [
      <>
        Check that <strong className="font-medium text-ink">NFC is on</strong>: open Settings and search for “NFC”. It&apos;s often under Connected devices or
        Connections.
      </>,
      <>Unlock your phone.</>,
      <>
        Hold the <strong className="font-medium text-ink">middle of the back</strong> of your phone close to the heart, and keep it there for a moment.
      </>,
      <>If a notification asks to open the link, tap it.</>,
    ],
    note: <>Most Android phones can read the heart. Where NFC lives in Settings depends on the phone&apos;s maker.</>,
  },
};

/**
 * S5 body: platform tabs, steps, troubleshooting, and how to get help.
 * Tabs (Emil Kowalski): the active style is a second copy of the tab list, clipped to the chosen
 * tab, so switching wipes one clean colour across instead of fading two. The steps crossfade
 * with a touch of blur so the two lists read as one change.
 */
export function TapHelp() {
  const detected = useDetectedPlatform();
  const [chosen, setChosen] = useState<Platform | null>(null);
  const active: Platform = chosen ?? detected ?? "iphone";
  const baseId = useId();
  const tabs = useRef<Record<Platform, HTMLButtonElement | null>>({
    iphone: null,
    android: null,
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: Platform = e.key === "Home" ? "iphone" : e.key === "End" ? "android" : active === "iphone" ? "android" : "iphone";
    setChosen(next);
    tabs.current[next]?.focus();
  };

  const data = STEPS[active];
  const label = (p: Platform) => (p === "iphone" ? "iPhone" : "Android");

  return (
    <>
      <PostcardSheet aria-label="How to open it on your phone">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="ix-dear">Which phone is it?</p>
          <div className="ix-tabs" data-active={active}>
            <div role="tablist" aria-label="Your phone" className="ix-tabs__list" onKeyDown={onKey}>
              {(["iphone", "android"] as const).map((p) => (
                <button
                  key={p}
                  ref={(el) => {
                    tabs.current[p] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${p}`}
                  aria-selected={active === p}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={active === p ? 0 : -1}
                  onClick={() => setChosen(p)}
                  className="ix-tabs__tab"
                >
                  {label(p)}
                </button>
              ))}
            </div>
            <div aria-hidden className="ix-tabs__list ix-tabs__list--on">
              <span className="ix-tabs__tab">iPhone</span>
              <span className="ix-tabs__tab">Android</span>
            </div>
          </div>
        </div>

        <section
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${active}`}
          className="mt-8 grid items-center gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12"
        >
          <div className="postcard">
            <div key={active} className="ix-swap band-mist overflow-hidden rounded-[calc(var(--r-card)-6px)] px-5 pt-10 pb-3">
              <TapIllustration variant={active} />
            </div>
          </div>
          <div key={active} className="ix-swap">
            <h2 className="display text-d2 text-ink">{data.title}</h2>
            <ol className="mt-5 space-y-4">
              {data.steps.map((step, i) => (
                <li key={i} className="flex gap-4 text-lede leading-relaxed text-ink-soft">
                  <span aria-hidden className="ix-num">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[0.95rem] leading-relaxed text-ink-faded">{data.note}</p>
          </div>
        </section>
      </PostcardSheet>

      <PostcardSheet
        aria-labelledby="still-title"
        className="mt-10 md:mt-14"
        side={
          <>
            <div className="ix-sidetop">
              <h3 className="display pt-2 text-d3 text-ink">
                Older <em>phones</em>
              </h3>
              <StampBox className="shrink-0">
                <Stamp kind="photos" width={60} rotate={-5} />
              </StampBox>
            </div>
            <p className="leading-relaxed text-ink-soft">
              Some phones can&apos;t read the heart. A small QR code on the note in the box opens the same letter with the camera instead.
            </p>
            <p className="tag self-start">Prototype note · QR fallback awaiting decision (O8)</p>
            <AddressLines
              items={[
                [
                  "Need a hand?",
                  <>
                    Write to us at{" "}
                    <a href={`mailto:${site.supportEmail}`} className="font-semibold text-ink underline decoration-red decoration-2 underline-offset-4">
                      {site.supportEmail}
                    </a>{" "}
                    and we&apos;ll help you open it.
                  </>,
                ],
              ]}
            />
          </>
        }
      >
        <h2 id="still-title" className="display text-d2 text-ink">
          Still not <em>working?</em>
        </h2>
        <ul className="mt-5 space-y-3.5 leading-relaxed text-ink-soft">
          {[
            "Move slowly around the heart. The spot is small, and it can take a second or two.",
            "Take off a thick case, or one with metal or a card wallet in it.",
            "Close the Camera and Wallet, turn off Airplane Mode, and unlock your phone.",
            "If a blank browser page opens, try again. On an iPhone, Safari as your default browser works best.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span aria-hidden className="mt-[0.55em] size-2 shrink-0 rounded-full bg-red" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </PostcardSheet>
    </>
  );
}
