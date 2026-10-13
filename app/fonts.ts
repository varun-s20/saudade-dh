/**
 * Font loaders: three faces (DECISIONS.md D-082, the client's choice): Bowlby One for the
 * large-letter headlines, Nanum Pen Script for everything handwritten or script, and Karla for
 * reading text and labels. Placeholder brand typography until the client's branding specialist
 * delivers web fonts (~Dec 2026). To rebrand: swap these loaders, keep the CSS variable names, and
 * the --ff-* tokens in styles/tokens.css pick them up. Licences: docs/ASSETS.md (SIL OFL 1.1).
 *
 * Performance (QA_CHECKLIST §4): `subsets` = what is PRELOADED; other scripts still load on
 * demand through unicode-range. Grand Hotel and Courier Prime were dropped (D-082).
 */
import { Bowlby_One, Karla, Nanum_Pen_Script } from "next/font/google";

/** Display: the large-letter block capitals of a linen postcard. One weight. */
export const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bowlby",
  display: "swap",
});

/** UI + body + labels: a warm mid-century grotesque. Variable weight. */
export const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

/**
 * The hand: the sender's own words (letter, names, captions) and every script accent ("Greetings
 * from…", the word in a headline). Real ballpoint handwriting, legible at length.
 */
export const nanumPen = Nanum_Pen_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-nanum-pen",
  display: "swap",
});

export const fontVariables = [bowlby.variable, karla.variable, nanumPen.variable].join(" ");
