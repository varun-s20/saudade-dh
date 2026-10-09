import type { Metadata } from "next";
import { LargeLetters } from "@/components/motion/LargeLetters";
import { Postmark } from "@/components/paper/Postmark";
import { Biplane } from "@/components/public/home/HomeArt";
import { PublicShell } from "@/components/public/PublicShell";
import { InkLink } from "@/components/ui/InkButton";
import "@/components/public/home/home.css";
import "@/components/public/interior.css";

export const metadata: Metadata = { title: "Page not found" };

const PHOTOS = ["/demo/photos/05.jpg", "/demo/photos/01.jpg", "/demo/photos/03.jpg"];

/**
 * Global 404, returned to sender: a large-letter postcard of "404" with a RETURN TO SENDER
 * postmark coming down across it, and a plane towing the news. (The recipient's "envelope not
 * found" lives in /t/[slug].)
 */
export default function NotFound() {
  return (
    <PublicShell>
      <section aria-labelledby="nf-title" className="ix-404 band-sky">
        <span aria-hidden className="hm-hero__sun" />
        <Biplane banner="Return to sender · no such address" />
        <div className="wrap ix-404__inner">
          <h1 id="nf-title">
            <span className="script block text-script text-navy">Greetings from nowhere,</span>
            <span className="sr-only">Page not found (404)</span>
            <span aria-hidden className="ix-404__ll">
              <LargeLetters word="404" photos={PHOTOS} delay={150} />
              <span className="ix-404__mark">
                <Postmark variant="circle" size={200} rotate={-14} place="RETURN TO SENDER" bottom="NO SUCH ADDRESS" ink="red" opacity={0.95} />
              </span>
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lede font-medium text-ink">
            The address may have a typo, or the page has moved. If you tapped an envelope and landed here, try holding your phone to the heart again.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <InkLink href="/" size="lg">
              Go to the home page
            </InkLink>
            <InkLink href="/help/tap" variant="secondary" size="lg">
              How to tap the heart
            </InkLink>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
