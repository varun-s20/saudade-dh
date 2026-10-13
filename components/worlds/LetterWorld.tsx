"use client";

/**
 * Letter world (stationery, dusty-blue): the letter on aged, ruled, deckled paper, resting on its
 * airmail envelope. Handwriting at --text-letter in fountain-pen ink (--ink-letter, 10:1 on the
 * paper), one written line per ruled line, a comfortable measure (--measure-letter). Long letters
 * simply scroll inside the stamp world; short ones sit calmly near the top.
 *
 * Written out (D-082): the first time a letter is opened (`typeOut`), it writes itself onto the
 * page a letter at a time, pausing at commas, full stops and line ends, the page following the pen.
 * The words still to come hold their place, so nothing reflows. A tap on the letter, Enter/Space,
 * or "Show the whole letter" finishes it at once. Screen readers get the whole letter straight
 * away; with reduced motion it simply appears. Revisits read it at once (RecipientExperience).
 *
 * Scripts the handwriting font doesn't cover (CJK, Arabic, Hebrew, Devanagari, Greek, Thai…) fall
 * back to --ff-hand-fallback at a size and line pitch that stay readable (data-script="other").
 * Every paragraph is dir="auto", so right-to-left letters read correctly.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LetterContent } from "@/lib/services/types";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { useReducedMotionPref } from "@/lib/hooks/useReducedMotionPref";
import "./worlds.css";

export interface LetterWorldProps {
  letter: LetterContent;
  /** When the letter was last written/saved (ISO): the date in the top corner. */
  writtenAt?: string | null;
  /** Write the letter out as it opens (its first reading). Read once, at mount. */
  typeOut?: boolean;
  /** Called once when the writing finishes, is skipped, or the letter is closed part-way. */
  onTyped?: () => void;
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

// ─── The pen's pace ───────────────────────────────────────────────────────────

/** Letters per second at an even pace; a long letter speeds up to finish within MAX_MS. */
const PACE = 34;
const MAX_MS = 18_000;
/** Let the sheet finish opening before the pen starts. */
const START_MS = 500;
/** How many of the newest letters are still soaking into the paper. */
const FRESH = 4;
/** Extra beats after a character (× one letter's time). */
const PAUSE: Record<string, number> = { ".": 7, "!": 7, "?": 7, "…": 8, ",": 3, ";": 3, ":": 3, "—": 3 };
const LINE_END = 4;
const PARA_END = 9;

/** User-perceived characters, so an emoji or a composed Hangul syllable is written whole. */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

interface Run {
  /** The run's characters. */
  g: string[];
  /** Index of its first character in the whole letter. */
  start: number;
}

/** When each character appears (ms after the pen starts), and when the last one is down. */
function timeline(runs: Run[], ends: ("line" | "para")[]): { at: number[]; total: number } {
  const step = 1000 / PACE;
  const at: number[] = [];
  let t = 0;
  runs.forEach((r, i) => {
    for (const ch of r.g) {
      at.push(t);
      t += step * (PAUSE[ch] ?? 1);
    }
    t += step * (ends[i] === "para" ? PARA_END : LINE_END);
  });
  const k = Math.min(1, MAX_MS / Math.max(t, 1));
  return { at: at.map((x) => x * k), total: t * k };
}

/** Every line of writing, in order, as runs of characters, with when each character appears. */
function letterModel(to: string, body: string, signoff: string, from: string) {
  const runs: Run[] = [];
  const ends: ("line" | "para")[] = [];
  let n = 0;
  const add = (text: string, end: "line" | "para") => {
    const g = graphemes(text);
    runs.push({ g, start: n });
    ends.push(end);
    n += g.length;
    return runs.length - 1;
  };
  const toRun = to ? add(`Dear ${to},`, "para") : null;
  const paraRuns = paragraphsOf(body).map((lines) => lines.map((line, j) => add(line, j === lines.length - 1 ? "para" : "line")));
  const signoffRun = signoff ? add(signoff, "line") : null;
  const fromRun = from ? add(from, "para") : null;
  return { runs, toRun, paraRuns, signoffRun, fromRun, count: n, ...timeline(runs, ends) };
}

/** The nearest scrolling ancestor (the stamp world's sheet). */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

export function LetterWorld({ letter, writtenAt, typeOut = false, onTyped }: LetterWorldProps) {
  const to = letter.to.trim();
  const signoff = letter.signoff.trim();
  const from = letter.from.trim();
  const script = OTHER_SCRIPT.test(`${to} ${letter.body} ${signoff} ${from}`) ? "other" : "latin";
  const date = writtenAt ? letterDate(writtenAt) : null;

  // Every line of writing, in order, as a run of characters.
  const model = useMemo(() => letterModel(to, letter.body, signoff, from), [to, letter.body, signoff, from]);

  // Decided once, when the letter opens: later changes (it being marked read) don't stop the pen.
  const reduced = useReducedMotionPref();
  const [typing] = useState(() => typeOut && !reduced && model.count > 0);
  /** Characters written so far; null once the whole letter is down. */
  const [written, setWritten] = useState<number | null>(typing ? 0 : null);

  const onTypedRef = useRef(onTyped);
  useEffect(() => {
    onTypedRef.current = onTyped;
  });
  const reported = useRef(false);
  const report = () => {
    if (reported.current) return;
    reported.current = true;
    onTypedRef.current?.();
  };
  const finish = () => {
    setWritten(null);
    report();
  };

  // The pen: one clock, so pauses and pace stay true however often frames arrive.
  useEffect(() => {
    if (!typing) return;
    const { at, total } = model;
    let raf = 0;
    let i = 0;
    const t0 = performance.now() + START_MS;
    const tick = (now: number) => {
      const t = now - t0;
      while (i < at.length && at[i]! <= t) i++;
      if (t >= total) {
        setWritten(null);
        report();
        return;
      }
      setWritten(i);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // closed part-way: they've seen it; next time it simply reads
      report();
    };
    // the model is fixed for this opening; `report` only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typing]);

  // The page follows the pen, keeping it in the upper two-thirds, until the reader scrolls.
  const rootRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const follow = useRef(true);
  const lastTop = useRef(-1);
  useEffect(() => {
    if (!typing || !rootRef.current) return;
    const scroller = scrollerOf(rootRef.current) ?? rootRef.current.parentElement;
    if (!scroller) return;
    const stop = () => {
      follow.current = false;
    };
    scroller.addEventListener("wheel", stop, { passive: true });
    scroller.addEventListener("touchmove", stop, { passive: true });
    return () => {
      scroller.removeEventListener("wheel", stop);
      scroller.removeEventListener("touchmove", stop);
    };
  }, [typing]);
  useEffect(() => {
    const caret = caretRef.current;
    if (!caret || !follow.current) return;
    const top = caret.offsetTop;
    if (top === lastTop.current) return;
    lastTop.current = top;
    const scroller = scrollerOf(caret);
    if (!scroller) return;
    const c = caret.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const over = c.bottom - (s.top + s.height * 0.66);
    if (over > 0) scroller.scrollBy({ top: over, behavior: "smooth" });
  }, [written]);

  // The run the pen is in: the last one it has started (the end of a line while it pauses there).
  let caretRun = 0;
  if (written !== null) model.runs.forEach((r, i) => (r.start < written ? (caretRun = i) : null));

  /** A run's text: all of it, or (while writing) what's written, the pen, and the rest held in place. */
  const text = (i: number, upTo: number | null): ReactNode => {
    const r = model.runs[i]!;
    if (upTo === null) return r.g.join("");
    const done = Math.max(0, Math.min(r.g.length, upTo - r.start));
    const settled = Math.max(0, Math.min(done, upTo - FRESH - r.start));
    return (
      <>
        {r.g.slice(0, settled).join("")}
        {r.g.slice(settled, done).map((ch, k) => (
          <span key={r.start + settled + k} className="wd-letter__ink">
            {ch}
          </span>
        ))}
        {i === caretRun ? <span ref={caretRef} className="wd-letter__caret" /> : null}
        {done < r.g.length ? <span className="wd-letter__unwritten">{r.g.slice(done).join("")}</span> : null}
      </>
    );
  };

  const body = (upTo: number | null) => (
    <>
      {model.toRun !== null ? <p dir="auto">{text(model.toRun, upTo)}</p> : null}
      {model.paraRuns.map((lines, i) => (
        <p key={i} dir="auto">
          {lines.map((run, j) => (
            <span key={j}>
              {j > 0 ? <br /> : null}
              {text(run, upTo)}
            </span>
          ))}
        </p>
      ))}
      {model.signoffRun !== null || model.fromRun !== null ? (
        <div className="wd-letter__close">
          {model.signoffRun !== null ? <p dir="auto">{text(model.signoffRun, upTo)}</p> : null}
          {model.fromRun !== null ? (
            <p dir="auto" className="wd-letter__signature">
              {text(model.fromRun, upTo)}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const writing = written !== null;

  return (
    <div ref={rootRef} className="wd-letter min-h-full px-3 pt-4 pb-10 sm:px-8 sm:pt-6" data-world="letter">
      {/* Focusable (outside the deckle's clip, so its focus ring shows) so keyboard users can
          scroll a long letter with the arrow keys. While it's being written, a tap or Enter/Space
          shows it all. */}
      <article
        className="mx-auto max-w-(--measure-letter) rounded-paper"
        tabIndex={0}
        aria-label={from ? `Letter from ${from}` : "Letter"}
        onClick={writing ? finish : undefined}
        onKeyDown={
          writing
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  finish();
                }
              }
            : undefined
        }
      >
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
          {writing ? (
            <>
              <div className="sr-only">{body(null)}</div>
              <div className="wd-letter__body" aria-hidden>
                {body(written)}
              </div>
            </>
          ) : (
            <div className="wd-letter__body">{body(null)}</div>
          )}
        </PaperSheet>
      </article>
      {writing ? (
        <div className="pointer-events-none sticky bottom-4 mt-6 flex justify-center">
          <button type="button" className="wd-letter__skip tag pointer-events-auto" onClick={finish}>
            Show the whole letter
          </button>
        </div>
      ) : null}
    </div>
  );
}
