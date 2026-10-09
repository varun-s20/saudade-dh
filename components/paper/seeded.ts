/**
 * Deterministic "imperfection" helpers for paper, wax and ink. Pure: the same seed always
 * gives the same shape, so server and client markup match and nothing random runs in render.
 */

/** Small, fast seeded PRNG (mulberry32). Returns a function yielding floats in [0, 1). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric hash of a string (FNV-1a), for deriving seeds from props. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Round to 2 decimals for compact SVG/CSS strings. */
export const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Closed, smooth, slightly irregular blob around (cx, cy): wax seals, ink blots.
 * `wobble` is the radial jitter as a fraction of the radius.
 */
export function blobPath(cx: number, cy: number, radius: number, seed: number, points = 22, wobble = 0.06): string {
  const rnd = seeded(seed);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (1 + (rnd() - 0.5) * 2 * wobble + Math.sin(a * 3 + seed) * wobble * 0.35);
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  // Catmull-Rom → cubic Bézier, closed.
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return `${d}Z`;
}

/** Sanitise a React useId() value for use inside url(#…) references. */
export const svgId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");
