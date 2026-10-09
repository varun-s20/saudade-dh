import Link from "next/link";
import type { ReactNode } from "react";
import { PubHead } from "@/components/public/PubHead";
import { SiteMenu } from "@/components/public/SiteMenu";
import { SmoothScroll } from "@/components/public/SmoothScroll";
import { InkLink } from "@/components/ui/InkButton";
import { Logo } from "@/components/ui/Logo";
import { site } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import "./public.css";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#stamps", label: "The four stamps" },
  { href: "/help/tap", label: "How to tap" },
  { href: "/recover", label: "Find my link" },
] as const;

/**
 * Frame for the public pages (/, /claim, /recover, /help/tap, legal, 404). Full-width canvas:
 * each page lays out its own sections with the `wrap` container. Server component; the Logo and
 * the mobile menu are client islands (the Logo's triple-tap toggles the Demo Panel).
 */
export function PublicShell({
  children,
  cta = true,
  footer = true,
  className,
  headTone = "dark",
}: {
  children: ReactNode;
  /** Show the "Claim your code" button in the header (hide it on /claim itself). */
  cta?: boolean;
  /** Kept for API compatibility with older pages; navigation now lives in the header. */
  back?: { href: string; label: string };
  /** Kept for API compatibility; pages set their own widths. */
  wide?: boolean;
  footer?: boolean;
  className?: string;
  /** "light" when the page opens on a dark band (the sea): the header's text turns cream until it scrolls. */
  headTone?: "dark" | "light";
}) {
  return (
    <div className="pub-shell flex min-h-dvh flex-col overflow-x-clip">
      <a href="#main" className="sr-only-focusable eyebrow m-2 bg-paper-raised px-3 py-2 text-ink">
        Skip to content
      </a>
      <SmoothScroll />
      <PubHead tone={headTone}>
        {/* Three columns from lg: the two outer ones share the leftover width equally, so the
            nav sits on the page's centre line whatever the logo and the buttons measure. */}
        <div className="wrap flex h-16 items-center gap-4 md:h-19 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <Logo size="md" className="shrink-0 justify-self-start" />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.filter((n) => n.href !== "/recover").map((n) => (
              <Link key={n.href} href={n.href} className="pub-nav">
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 lg:ml-0 lg:justify-self-end">
            <Link href="/recover" className="pub-nav hidden md:inline-flex">
              <span>Find my link</span>
            </Link>
            {cta ? (
              <InkLink href="/claim" size="sm" className="pub-cta ml-1">
                <span className="min-[24rem]:hidden">Claim</span>
                <span className="hidden min-[24rem]:inline sm:hidden">Claim code</span>
                <span className="hidden sm:inline">Claim your code</span>
              </InkLink>
            ) : null}
            <SiteMenu items={NAV} />
          </div>
        </div>
      </PubHead>
      <main id="main" className={cn("pub-main flex-1", className)}>
        {children}
      </main>
      {footer && <PublicFooter />}
    </div>
  );
}

/**
 * The footer. Same layout as the approved one (D-060), now drawn in the site's own language
 * (D-078): a navy linen band with a perforated top edge and a postmark's wavy cancellation lines,
 * block-capital headline with a script word, typewritten labels, the site's ticket button, and
 * the giant wordmark in large letters, cropped by the page edge.
 */
export function PublicFooter() {
  return (
    <footer className="ft band-ink mt-auto overflow-hidden">
      <div className="wrap pt-20 md:pt-28">
        {/* the links take the width their labels need (never "Find my / private link"); the
            headline takes the rest */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <h2 className="display ft-h">
              Someone far away is waiting to <em>hear from you.</em>
            </h2>
            <p className="ft-lede mt-5 max-w-md">{site.tagline} A ceramic envelope with a letter inside, made to keep for years.</p>
            <div className="mt-8">
              <InkLink href="/claim" variant="paper" size="lg" className="ft-cta">
                Claim your code
              </InkLink>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-8 sm:grid-cols-[repeat(3,max-content)] sm:gap-x-12 lg:pt-3 xl:gap-x-16">
            <nav aria-label="Start">
              <p className="eyebrow text-ochre">Start</p>
              <ul className="mt-3 space-y-0.5">
                <li>
                  <Link href="/claim" className="ft-link">
                    Claim your code
                  </Link>
                </li>
                <li>
                  <Link href="/recover" className="ft-link">
                    Find my private link
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Help">
              <p className="eyebrow text-ochre">Help</p>
              <ul className="mt-3 space-y-0.5">
                <li>
                  <Link href="/help/tap" className="ft-link">
                    How to tap the heart
                  </Link>
                </li>
                <li>
                  <Link href="/#how" className="ft-link">
                    How it works
                  </Link>
                </li>
                <li>
                  <a href={`mailto:${site.supportEmail}`} className="ft-link">
                    Email us
                  </a>
                </li>
              </ul>
            </nav>
            <nav aria-label="The fine print">
              <p className="eyebrow text-ochre">Fine print</p>
              <ul className="mt-3 space-y-0.5">
                <li>
                  <Link href="/privacy" className="ft-link">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="ft-link">
                    Terms
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="ft-base mt-16 flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Saudade. Made to keep.</p>
          <p className="postal-label">Showcase prototype · stamp artwork is placeholder</p>
        </div>
      </div>
      {/* Giant wordmark in large letters, cropped by the page edge: cream on an extruded coral side */}
      <div aria-hidden className="wrap mt-10 select-none md:mt-14">
        <p className="ft-mark">Saudade</p>
      </div>
    </footer>
  );
}
