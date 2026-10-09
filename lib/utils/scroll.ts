/**
 * Scrolling to the top of the page, through the smooth scroller when one is running (the public
 * pages run Lenis: components/public/SmoothScroll.tsx). A native smooth scroll would be fought
 * by Lenis, so it registers itself here.
 */
interface Scroller {
  scrollTo(target: number, options?: { immediate?: boolean }): void;
}

let scroller: Scroller | null = null;

export function setScroller(s: Scroller | null) {
  scroller = s;
}

export function scrollToTop({ reduced = false }: { reduced?: boolean } = {}) {
  if (scroller) scroller.scrollTo(0, { immediate: reduced });
  else window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
}
