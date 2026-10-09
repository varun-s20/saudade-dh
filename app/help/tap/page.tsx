import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { PageMasthead } from "@/components/public/Interior";
import { PublicShell } from "@/components/public/PublicShell";
import { TapHelp } from "@/components/public/TapHelp";
import { HeartSeal } from "@/components/stamps/HeartSeal";

export const metadata: Metadata = { title: "How to tap" };

/** S5: how to open the envelope with a phone (iPhone banner, Android NFC), and what to try next. */
export default function TapHelpPage() {
  return (
    <PublicShell headTone="light">
      <PageMasthead
        tone="sea"
        eyebrow="Help · Opening the envelope"
        title={
          <>
            Hold your phone to <em>the heart.</em>
          </>
        }
        lede="The heart stamp on the ceramic is where the letter lives. Hold your phone close to it, tap the notification that appears, and the envelope opens. No app to download."
        art={
          <div className="ix-rings">
            {[0, 1, 2].map((i) => (
              <span key={i} className="ix-rings__ring" style={{ "--i": i } as CSSProperties} />
            ))}
            <span className="ix-rings__seal">
              <HeartSeal size={150} glow />
            </span>
          </div>
        }
      />
      <div className="wrap pb-20 lg:pb-28">
        <TapHelp />
      </div>
    </PublicShell>
  );
}
