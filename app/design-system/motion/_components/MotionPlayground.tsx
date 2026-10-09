"use client";

import { useEffect, useState } from "react";
import type { StampKind } from "@/lib/services/types";
import { STAMP_KINDS } from "@/lib/services/types";
import { RevealLab } from "./RevealLab";
import { EnvelopeStatesLab, EnvelopeViewLab, LabSection, MediaLab, SheetLab } from "./Labs";

interface Params {
  kinds: StampKind[];
  name: string;
  from: string;
  rate: number;
  /** false (?frame=0): the reveal fills the viewport at every width, like the real route. */
  frame: boolean;
}

/** Reads ?kinds=…&name=…&from=…&rate=…&frame=0 once on the client (no useSearchParams, so no Suspense needed). */
function useInitialParams() {
  const [params, setParams] = useState<Params | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const kinds = (q.get("kinds")?.split(",") ?? [...STAMP_KINDS]).filter((k): k is StampKind => (STAMP_KINDS as readonly string[]).includes(k));
    const rate = Number(q.get("rate") ?? 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL after hydration
    setParams({
      kinds,
      name: q.get("name") ?? "Theo",
      from: q.get("from") ?? "Mira",
      rate: rate > 0 && rate <= 1 ? rate : 1,
      frame: q.get("frame") !== "0",
    });
  }, []);
  return params;
}

export function MotionPlayground() {
  const params = useInitialParams();
  if (!params) return <div className="h-svh min-h-screen bg-desk" />;
  return (
    <main className="bg-paper">
      <RevealLab initialKinds={params.kinds} initialName={params.name} initialFrom={params.from} initialRate={params.rate} framed={params.frame} />
      <LabSection id="lab-envelope" title="Envelope states" note="Poses (closed, open) and the declarative transitions the sender's Seal & send can reuse.">
        <EnvelopeStatesLab />
      </LabSection>
      <LabSection
        id="lab-view"
        title="EnvelopeView (repeat visit)"
        note="Opens calmly in under 600 ms. Voice and Song carry a NEW mark. Stamps are real buttons; their worlds open in a Sheet from the stamp."
      >
        <EnvelopeViewLab />
      </LabSection>
      <LabSection id="lab-sheet" title="Sheet" note="Phone: drag the header down to close. Desktop: a centred card. Esc, scrim and the close button all close it.">
        <SheetLab />
      </LabSection>
      <LabSection id="lab-media" title="Vinyl and VoiceObject" note="The record eases up to 33⅓ rpm and coasts down; the tonearm swings in, lowers, lifts and returns.">
        <MediaLab />
      </LabSection>
    </main>
  );
}
