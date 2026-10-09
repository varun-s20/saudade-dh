import type { Metadata } from "next";
import { InView } from "@/components/motion/InView";
import { Postmark } from "@/components/paper/Postmark";
import { AddressLines, PageMasthead, PostcardSheet, StampBox } from "@/components/public/Interior";
import { MailLoop } from "@/components/public/MailLoop";
import { PublicShell } from "@/components/public/PublicShell";
import { RecoverForm } from "@/components/public/RecoverForm";
import { Stamp } from "@/components/stamps/Stamp";

export const metadata: Metadata = { title: "Find your link" };

/** S4: lost your link? Asked for on the back of a postcard; an airmail plane loops in the sunset. */
export default function RecoverPage() {
  return (
    <PublicShell>
      <PageMasthead
        tone="sunset"
        eyebrow="Help · Your private link"
        titleId="recover-title"
        title={
          <>
            Lost your <em>link?</em>
          </>
        }
        lede="Tell us the email you used and we'll send your private link again, so you can keep filling your envelope."
        art={<MailLoop />}
      />
      <div className="wrap pb-20 lg:pb-28">
        <PostcardSheet
          aria-labelledby="recover-title"
          side={
            <>
              <div className="ix-sidetop">
                <InView effect="thunk" delay={300} className="pt-2">
                  <Postmark variant="wavy" size={84} rotate={-8} place="SAUDADE · RESENT" ink="postmark" />
                </InView>
                <StampBox className="shrink-0">
                  <Stamp kind="letter" width={76} rotate={-4} />
                </StampBox>
              </div>
              <AddressLines
                items={[
                  ["To", <span key="to" className="ix-hand mt-0! block">you, again</span>],
                  ["Your private link", <span key="l" className="font-postal font-bold tracking-wide text-ink">saudade.example/s/•••••</span>],
                  ["Delivery", "By email, usually within a minute or two."],
                ]}
              />
            </>
          }
        >
          <p className="ix-dear">Dear Saudade,</p>
          <p className="ix-hand">I&apos;ve lost my link. Could you send it again?</p>
          <RecoverForm />
        </PostcardSheet>
      </div>
    </PublicShell>
  );
}
