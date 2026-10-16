"use client";

/**
 * S2's postcard back: the code form on the message side; on the address side, a ticket that
 * types each character as you enter it (a typewriter strike, 170ms) and takes a CLAIMED postmark
 * when the code is accepted. The ticket only mirrors the form, so it's hidden from assistive tech.
 */
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { CodeInputState } from "@/components/forms/CodeInput";
import { Postmark } from "@/components/paper/Postmark";
import { Stamp } from "@/components/stamps/Stamp";
import { site } from "@/config/site";
import { ClaimForm } from "./ClaimForm";
import { AddressLines, PostcardSheet, StampBox } from "./Interior";

type Echo = { body: string; state: CodeInputState };

/** A tiny store, so only the ticket re-renders while someone types (the postcard stays put). */
function createEcho() {
  let value: Echo = { body: "", state: "idle" };
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set: (body: string, state: CodeInputState) => {
      if (body === value.body && state === value.state) return;
      value = { body, state };
      subs.forEach((f) => f());
    },
    subscribe: (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}
type EchoStore = ReturnType<typeof createEcho>;
const SERVER_ECHO: Echo = { body: "", state: "idle" };

export function ClaimDesk() {
  const [echo] = useState(createEcho);

  return (
    <PostcardSheet
      aria-label="Enter your code"
      side={
        <>
          <div className="ix-sidetop">
            <LiveTicket store={echo} />
            <StampBox className="shrink-0">
              <Stamp kind="photos" width={76} rotate={5} />
            </StampBox>
          </div>
          <div>
            <h2 className="display text-d3 text-ink">
              Where&apos;s my <em>code?</em>
            </h2>
            <AddressLines
              className="mt-2"
              items={[
                ["In the box", "On a small card, tucked in beside the ceramic."],
                ["In your email", "If the envelope went straight to your friend, there's no card: we emailed you the code instead."],
              ]}
            />
            <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-faded">
              Codes use letters and numbers, never 0, O, 1, I or L, so a smudged card is easy to read.
            </p>
          </div>
        </>
      }
    >
      <p className="ix-dear">Dear Saudade,</p>
      <p className="ix-hand">here&apos;s the code from my box:</p>
      <ClaimForm onEcho={echo.set} />
      <p className="mt-7 text-ink-soft">
        Already claimed it?{" "}
        <Link href="/recover" className="font-semibold text-ink underline decoration-red decoration-2 underline-offset-4 hover:decoration-ink">
          Find your private link
        </Link>
      </p>
    </PostcardSheet>
  );
}

function LiveTicket({ store }: { store: EchoStore }) {
  const { body, state } = useSyncExternalStore(store.subscribe, store.get, () => SERVER_ECHO);
  const chars = Array.from({ length: site.codes.length }, (_, i) => body[i] ?? "");
  return (
    <div aria-hidden className="ix-ticket min-w-0 flex-1" data-state={state}>
      <span className="ix-ticket__label">Your activation code</span>
      <span className="ix-ticket__code">
        {site.codes.prefix}-
        {chars.map((c, i) => (
          <span key={i} className="ix-ticket__slot" data-filled={c ? "" : undefined}>
            {c && (
              <span key={c} className="ix-ticket__ch">
                {c}
              </span>
            )}
          </span>
        ))}
      </span>
      <span className="ix-ticket__note">It never expires.</span>
      <span className="ix-ticket__mark">
        <Postmark variant="circle" size={74} rotate={-10} place="SAUDADE · CLAIMED" ink="red" />
      </span>
    </div>
  );
}
