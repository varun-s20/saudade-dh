import type { Metadata } from "next";
import { MotionPlayground } from "./_components/MotionPlayground";

export const metadata: Metadata = { title: "Motion playground" };

/**
 * Motion playground (Motion & Interaction Designer). Run the first-tap reveal with any mix of
 * stamps, toggle reduced motion, replay; inspect envelope states, the settled EnvelopeView with
 * NEW marks, the Sheet, the Vinyl and the VoiceObject.
 *
 * Query params (handy for screenshots): ?kinds=photos,letter,voice,song&name=Theo&from=Mira
 */
export default function MotionPlaygroundPage() {
  return <MotionPlayground />;
}
