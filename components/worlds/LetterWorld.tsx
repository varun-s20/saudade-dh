"use client";

/**
 * Letter world (stationery, dusty-blue): the letter on aged, ruled, deckled paper, resting on its
 * airmail envelope. Handwriting at --text-letter in fountain-pen ink (--ink-letter, 10:1 on the
 * paper), one written line per ruled line, a comfortable measure (--measure-letter). Long letters
 * simply scroll inside the stamp world; short ones sit calmly near the top.
 *
 * Scripts the handwriting font doesn't cover (CJK, Arabic, Hebrew, Devanagari, Greek, Thai…) fall
 * back to --ff-hand-fallback at a size and line pitch that stay readable (data-script="other").
 * Every paragraph is dir="auto", so right-to-left letters read correctly.
 */
import type { LetterContent } from "@/lib/services/types";
import { PaperSheet } from "@/components/paper/PaperSheet";
import "./worlds.css";

export interface LetterWorldProps {
  letter: LetterContent;
  /** When the letter was last written/saved (ISO): the date in the top corner. */
  writtenAt?: string | null;
}

/**
 * Anything the pen face (Nanum Pen Script) doesn't cover: it has Latin and Korean (Hangul), plus
 * shared punctuation/emoji. Cyrillic, Greek, Arabic, CJK ideographs… use the readable fallback.
 */
const OTHER_SCRIPT = /[^\p{Script=Latin}\p{Script=Hangul}\p{Script=Common}\p{Script=Inherited}]/u;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-08T…" → "8 October 2026", read from the string itself (no Date, no timezone shift). */
function letterDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/** Blank lines separate paragraphs; single line breaks inside a paragraph are kept. */
function paragraphsOf(body: string): string[][] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.split("\n"));
}

export function LetterWorld({ letter, writtenAt }: LetterWorldProps) {
  const paragraphs = paragraphsOf(letter.body);
  const to = letter.to.trim();
  const signoff = letter.signoff.trim();
  const from = letter.from.trim();
  const script = OTHER_SCRIPT.test(`${to} ${letter.body} ${signoff} ${from}`) ? "other" : "latin";
  const date = writtenAt ? letterDate(writtenAt) : null;

  return (
    <div className="wd-letter min-h-full px-3 pt-4 pb-10 sm:px-8 sm:pt-6" data-world="letter">
      {/* Focusable (outside the deckle's clip, so its focus ring shows) so keyboard users can
          scroll a long letter with the arrow keys. */}
      <article className="mx-auto max-w-(--measure-letter) rounded-paper" tabIndex={0} aria-label={from ? `Letter from ${from}` : "Letter"}>
        <PaperSheet
          as="div"
          tone="aged"
          ruled
          edge="deckled"
          seed={23}
          data-script={script}
          className="wd-letter__paper px-5 pt-7 pb-12 sm:px-10 sm:pt-10"
        >
          {date ? (
            <p className="wd-letter__date text-right" dir="auto">
              {date}
            </p>
          ) : null}
          <div className="wd-letter__body">
            {to ? <p dir="auto">Dear {to},</p> : null}
            {paragraphs.map((lines, i) => (
              <p key={i} dir="auto">
                {lines.map((line, j) => (
                  <span key={j}>
                    {j > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </p>
            ))}
            {signoff || from ? (
              <div className="wd-letter__close">
                {signoff ? <p dir="auto">{signoff}</p> : null}
                {from ? (
                  <p dir="auto" className="wd-letter__signature">
                    {from}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </PaperSheet>
      </article>
    </div>
  );
}
