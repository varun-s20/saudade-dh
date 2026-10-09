import type { Metadata } from "next";
import { ClaimDesk } from "@/components/public/ClaimDesk";
import { PageMasthead, StampFan } from "@/components/public/Interior";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata: Metadata = { title: "Claim your code" };

/** S2: code entry, written on the back of a postcard; the sky masthead deals out the four stamps. */
export default function ClaimPage() {
  return (
    <PublicShell cta={false}>
      <PageMasthead
        tone="sky"
        eyebrow="Step 1 of 3 · Claim"
        titleId="claim-title"
        title={
          <>
            Claim your <em>envelope.</em>
          </>
        }
        lede="Type the code from the card in your box, or from your email. Capitals or not, it doesn't matter."
        art={<StampFan kinds={["letter", "photos", "voice", "song"]} />}
      />
      <div className="wrap pb-20 lg:pb-28">
        <ClaimDesk />
      </div>
    </PublicShell>
  );
}
