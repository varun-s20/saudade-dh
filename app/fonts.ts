/**
 * Font loaders: "Wish You Were Here" type system (DECISIONS.md D-060). Placeholder brand
 * typography until the client's branding specialist delivers web fonts (~Dec 2026). To rebrand:
 * swap these loaders, keep the CSS variable names, and the --ff-* tokens in styles/tokens.css
 * pick them up. Licences are recorded in docs/ASSETS.md (all SIL Open Font License 1.1).
 *
 * Performance (QA_CHECKLIST §4): `subsets` = what is PRELOADED; other scripts still load on
 * demand through unicode-range. The postal typewriter swaps in with a metric-matched fallback.
 * The footer uses these faces too (D-078); its old Epilogue / Inter Tight pair is gone.
 */
import { Bowlby_One, Courier_Prime, Grand_Hotel, Karla, Nanum_Pen_Script } from "next/font/google";

/** Display: the large-letter block capitals of a linen postcard. One weight. */
export const bowlby = Bowlby_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bowlby",
  display: "swap",
});

/** Script: "Greetings from…", "Wish you were here", the prompts that sound like a person. */
export const grandHotel = Grand_Hotel({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-grand-hotel",
  display: "swap",
});

/** UI + body: a warm mid-century grotesque. Variable weight. */
export const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

/** Postal labels, codes, postmarks, postcard backs. Typewriter (accents only). */
export const courierPrime = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-courier-prime",
  display: "swap",
  preload: false,
});

/** The sender's own words: letter, names, captions. Real ballpoint handwriting, legible at length. */
export const nanumPen = Nanum_Pen_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-nanum-pen",
  display: "swap",
});

export const fontVariables = [bowlby.variable, grandHotel.variable, karla.variable, courierPrime.variable, nanumPen.variable].join(" ");
