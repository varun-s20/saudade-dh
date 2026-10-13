import { site } from "@/config/site";
import { PageMasthead } from "./Interior";
import { PublicShell } from "./PublicShell";

/**
 * Styled template for /privacy and /terms (S6). We build and style the page; the WORDING comes
 * from Saudade (their lawyer or a service like Termly), CLIENT_GUIDE §10, OPEN_QUESTIONS O14.
 * Section titles are only a suggested outline: every body is a clearly marked placeholder.
 * Never put real legal text here without the client's supplied wording.
 */
export function LegalDocument({ title, intro, sections }: { title: string; intro: string; sections: readonly string[] }) {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return (
    <PublicShell headTone="light">
      <PageMasthead
        tone="sky"
        eyebrow={`${site.name} · The fine print`}
        titleId="doc-title"
        title={title}
        lede={
          <>
            Last updated: <Placeholder inline>date to be supplied</Placeholder>
          </>
        }
      />
      <div className="wrap relative z-[2] -mt-14 grid gap-8 pb-24 md:-mt-16 lg:grid-cols-[16rem_1fr] lg:gap-12">
        <nav aria-label="Sections" className="postcard px-4 pt-4 pb-3 sm:px-5 lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow text-ink-faded">Contents</p>
          <ol className="mt-3 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-1">
            {sections.map((s, i) => (
              <li key={s}>
                <a
                  href={`#${slug(s)}`}
                  className="press -ml-2 inline-flex min-h-11 items-baseline gap-2.5 rounded-pill px-2 py-2.5 text-ink-soft transition-colors duration-150 hover:bg-paper-deep hover:text-ink pointer-fine:lg:min-h-9 pointer-fine:lg:py-1.5"
                >
                  <span className="font-postal text-sm font-bold text-red-ink">{String(i + 1).padStart(2, "0")}</span>
                  {s}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="ix-sheet mt-0! px-5 pt-8 pb-10 sm:px-12 sm:pt-12" aria-labelledby="doc-title">
          <div role="note" className="rounded-card border-2 border-ink bg-ochre px-5 py-4 leading-relaxed text-ink shadow-print-sm">
            <p className="eyebrow">Template · wording pending</p>
            <p className="mt-1.5">
              {intro} The wording will be supplied by Saudade (a lawyer or a service like Termly) and dropped in here, section by section.
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {sections.map((s, i) => (
              <section key={s} id={slug(s)} aria-labelledby={`${slug(s)}-h`} className="scroll-mt-28">
                <h2 id={`${slug(s)}-h`} className="flex items-baseline gap-3 display text-d3 leading-[1.08] text-ink">
                  <span className="font-postal text-base font-bold text-red-ink">{String(i + 1).padStart(2, "0")}</span>
                  {s}
                </h2>
                <Placeholder />
              </section>
            ))}
          </div>

          <p className="mt-14 border-t-2 border-ink/10 pt-5 text-sm text-ink-soft">
            Questions about this page? Write to{" "}
            <a href={`mailto:${site.supportEmail}`} className="font-semibold text-ink underline decoration-red decoration-2 underline-offset-4">
              {site.supportEmail}
            </a>
            .
          </p>
        </article>
      </div>
    </PublicShell>
  );
}

/** The clearly marked placeholder block (never legal text). */
function Placeholder({ inline, children }: { inline?: boolean; children?: string }) {
  if (inline) {
    return (
      <span className="rounded-[4px] border-[1.5px] border-dashed border-current px-1.5 py-0.5 font-postal text-xs tracking-wide uppercase">
        {children}
      </span>
    );
  }
  return (
    <div className="mt-3 rounded-soft border-2 border-dashed border-ink/25 bg-paper px-4 py-4">
      <p className="postal-label text-ink-faded">Placeholder</p>
      <p className="mt-1 text-ink-soft">Wording to be supplied by Saudade (lawyer or a service like Termly).</p>
      {/* Faint "lines of text to come" so the page shows its finished rhythm. */}
      <div aria-hidden className="mt-4 space-y-2.5">
        <span className="block h-2 w-full bg-paper-shadow/60" />
        <span className="block h-2 w-11/12 bg-paper-shadow/60" />
        <span className="block h-2 w-4/5 bg-paper-shadow/60" />
        <span className="block h-2 w-2/3 bg-paper-shadow/45" />
      </div>
    </div>
  );
}
