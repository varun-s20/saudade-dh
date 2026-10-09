# SAUDADE — MOTION SPEC

Owner: Motion & Interaction Designer · Status: Phase 2 showcase, implemented · Last updated: 2026-10-08

> "That first-tap moment is kind of the whole emotional point of the product." (client)

This document is the source of truth for motion intent. Numbers live in `lib/tokens.ts`
(`duration`, `ease`, `spring`, `reveal`, `revealReduced`, `calm`) and `styles/tokens.css`
(`--motion-*`). The reveal timeline is data in `components/reveal/timeline.ts`, which maps 1:1 to §3.
Everything here can be watched, slowed down and replayed at **`/design-system/motion`** (§14).

---

## 1. Principles

1. **Physical, not digital.** Things have weight, hinges, paper and ink. A flap rotates on its
   fold, a letter is drawn out and unfolded, a stamp is pressed down and cancelled. Nothing pops,
   bounces like a toy or slides in from nowhere.
2. **Unhurried, never slow.** The ceremony is rare (once per envelope), so it may take its time
   (≈ 4.9 s after the tap). Everything frequent (opening a stamp, pressing, closing) is short.
3. **One action at the threshold.** Nothing starts before the recipient's own tap. The tap is also
   the gesture that unlocks audio.
4. **The last frame is the real page.** The ceremony ends on the exact tree the repeat visit uses
   (`EnvelopeBoard`), so there is no hand-off jump and nothing to "load" after the moment.
5. **Reduced motion is a design state,** not an off switch: crossfades in the same order, same
   pacing intent, no 3D, no travel, no overshoot.
6. **Compositor only.** Only `transform` and `opacity` animate. Shadows, blur and shading are
   pre-rendered layers whose opacity changes.

Frequency gate: the reveal is *rare* (expressive allowed); stamp worlds are *occasional*
(< 0.5 s, purposeful); press/hover are *frequent* (instant-feeling springs, no decoration).

---

## 2. Tokens

| Token | CSS | JS (`lib/tokens.ts`) | Use |
|---|---|---|---|
| out | `--motion-ease-out` | `ease.out` `[0.22,1,0.36,1]` | entrances, fades |
| inOut | `--motion-ease-in-out` | `ease.inOut` `[0.65,0,0.35,1]` | symmetric moves, closing |
| paper | `--motion-ease-paper` | `ease.paper` `[0.3,0.7,0.2,1]` | paper settling |
| press | `--motion-ease-press` | `ease.press` `[0.55,0,0.75,0.2]` | things pressed / dismissed downward |
| lift | `--motion-ease-lift` | `ease.lift` `[0.33,0,0.15,1]` | the letter drawn out of the pocket |
| fall | `--motion-ease-fall` | `ease.fall` `[0.5,0,0.75,0]` | the empty envelope leaving |
| hinge | `--motion-ease-hinge` | `ease.hinge` `[0.45,0,0.2,1]` | flap and letter folds |
| bring | — | `ease.bring` `[0.45,0,0.15,1]` | the letter brought to the page |
| ink | — | `ease.ink` `[0.2,0.9,0.3,1]` | postmarks hitting paper |
| envelope | — | `spring.envelope` 140/17/m1 | the envelope arriving (one ~4% overshoot) |
| morph | — | `spring.morph` 260/32 | a stamp world growing out of its stamp |
| sheet | — | `spring.sheet` 380/38 | bottom sheet slide, drag spring-back |
| press | — | `spring.press` 520/30 | stamp press feedback |
| arm | — | `spring.arm` 90/18 | turntable tonearm swing |

Shading/colour tokens added for motion (`styles/tokens.css`, appended block): `--liner-line`,
`--liner-dot`, `--crease-dark`, `--crease-light`, `--shade`, `--cast-shadow`, `--seal-glow`,
`--dial-glow`, `--scrim`.

---

## 3. First-tap reveal (`<FirstTapReveal>`)

### 3.1 Story

The recipient sees the **back of a sealed envelope** with a wax heart seal (mirroring the heart
tap zone on the ceramic) and "for Theo" in pen. They tap. The seal cracks and lifts, the flap
swings toward them and lies back to show a rose liner, and **a letter folded in thirds** is drawn
out of the pocket. The empty envelope sinks away as the letter comes toward them and **opens, top
third then bottom third, into the page**. That page is the envelope face: the stamps are placed on
it one by one, each cancelled by its own postmark. The fold creases stay on the page.

Why the tri-fold (refinement of MASTER_BUILD_PROMPT §6.4 "letter rises and expands"): a
full-screen portrait page folded in thirds has almost exactly the proportions of a landscape
envelope (375×812 → 375×271 per third ≈ 1.38:1 vs the envelope's 1.42:1). So the letter fits the
envelope honestly and "expands to fill the screen" by **unfolding**, a real paper action, instead
of a non-uniform scale.

### 3.2 Timeline (full motion)

Intro times are from mount; the rest are seconds **after the tap**. `h` = envelope height.

| t (s) | Beat | Properties | Duration | Easing / spring | Reduced-motion equivalent |
|---|---|---|---|---|---|
| 0.00 | Desk tone fades in over the cream page (grain is already in the page) | desk `opacity` 0→1 | 0.70 | ease.out | same, 0.60 |
| 0.40 | Sealed envelope arrives | `opacity` 0→1; `y` +16% stage h → 0 | 0.35 / spring | ease.out / spring.envelope (one soft ~4% overshoot) | `opacity` only, 0.5 at 0.20; no travel |
| 0.95 | Heart seal halo breathes 3× then holds | halo `opacity` 0→1→.45→1→.45→1→.75 | 7.2 | easeInOut | steady 0.7 |
| 1.20 | "Someone who misses you sent this." + **Tap to open** (aria-live); mute toggle | `opacity` 0→1, `y` 8→0 | 0.55 | ease.out | `opacity` only at 0.80 |
| tap | Audio unlocked synchronously; jitter rolled; Skip becomes available (never before 1.5 s) | — | — | — | same |
| +0.00 | Threshold steps back | prompt `opacity` →0; halo →0 | 0.25 / 0.30 | ease.out | 0.30 |
| +0.00 | **Seal cracks and lifts**: 5° twist + 3.5% squash at 12%, then rises 0.5× its size, turns −16°, grows 1.18, fades after 45% | `y` `rotate` `scale` `opacity` (from one `seal` value 0→1) | 0.50 | ease.out | envelope crossfades out (0.45) |
| +0.20 | **Flap opens in 3D**, toward the viewer, and lies back; liner revealed. Shade layer darkens to 0.24 at 90° then the liner side brightens; z-order swaps at 90° (edge-on, invisible) | `rotateX` 0→180°, `perspective(900px)`, origin top edge | 0.85 | ease.hinge | — |
| +0.82 | **Letter drawn out** of the pocket (visible through the notch, then above the mouth) | letter `y` inside → clear of the mouth | 0.62 | ease.lift | — |
| +1.42 | Emptied envelope sinks away | body `y` 0→0.42h; `opacity` 1→0 (+0.06, 0.5) | 0.60 | ease.fall / ease.inOut | — |
| +1.44 | Letter brought to the page | letter `x` `y` `scale` (≈0.73→1) | 0.92 | ease.bring | — |
| +1.48 | **Top third unfolds** toward the viewer | panel `rotateX` −180→0°, `perspective(2200px)`; shade ≤ 0.13 | 0.62 | ease.hinge | — |
| +1.70 | **Bottom third unfolds** | panel `rotateX` 180→0° | 0.62 | ease.hinge | — |
| +2.02 | Open sheet's shadow takes over from the folded packet's | plate `opacity` 0→1 / packet 1→0 | 0.34 | ease.inOut | — |
| +2.36 | Same paper, same frame: the interactive face replaces the letter | face `opacity` 0→1, letter 1→0 (one frame) | 0.001 | — | face + decorations fade in at +0.20, 0.50 |
| +2.38 | Handwriting and dated cancellation ink in | decorations `opacity` 0→1 | 0.50 | ease.out | (with the face) |
| +2.50 + i·0.35 | **Stamp i placed** (only stamps with content, envelope order) — see §4 | `opacity` `y` `scale` `rotate` + cast shadow | 0.40 (+0.16 press) | see §4 | stamp `opacity` 0→1 at +0.70 + i·0.20, 0.35 |
| land + 0.04 | **Postmark ink-stamps** over it | mark `opacity` 0→1 (0.07), `scale` 1.22→1 (0.14) | 0.14 | ease.ink | mark `opacity` at +0.12, 0.35 |
| last mark + 0.25 | "Tap a stamp to open it."; Skip/mute fade away | hint `opacity` 0→1; chrome →0 | 0.50 | ease.out | hint at last + 0.15, 0.40 |
| ≈ +4.88 (4 stamps) | **Settled** → `onComplete({ skipped:false })` fires once; stamps become interactive | — | — | — | ≈ +2.2 s |

Total: 1.2 s threshold + the recipient's pause + 4.9 s ≈ **6–7 s**, inside the 6–9 s brief.
With fewer stamps the tail shortens by 0.35 s per missing stamp.

### 3.3 Rules (all implemented)

- **Never without the gesture.** The opening starts only from "Tap to open" (or a tap on the
  envelope itself, a pointer convenience; the button is the accessible path). Nothing is recorded
  on mount: the route calls `services.reveal.markRevealed` from `onComplete` only.
- **Skip** appears 1.5 s after mount **and only once the ceremony is running** (the threshold keeps
  a single action). Skip, `Escape`, a real resize, or the route being hidden by Activity mid-way all
  jump to the settled state via `controls.complete()` plus an explicit settle of every on-screen
  value; `onComplete({ skipped:true })` fires once.
- **`onComplete` fires exactly once** (guarded), after the last value settles or on skip.
- **Keyboard:** Enter/Space on Tap to open; when the ceremony ends, focus moves to the first stamp
  (only for keyboard users). The result is announced in a polite live region
  ("Your envelope is open. 4 stamps inside: photos, letter, voice, song. Tap a stamp to open it.").
- **Preview:** `mode="preview"` is visually identical; the caller simply doesn't record it.
- **Stage:** `h-svh` (stable under iOS toolbars), `overscroll-behavior: none`, safe-area aware.
  `contained` fills a parent box instead (sender preview frame, playground).

### 3.4 How it's built (for maintainers)

- One Motion **sequence** per mode (`timeline.ts`), driving plain motion values. Skip =
  `complete()`. `playbackRate` (design review only) sets `controls.speed`.
- **No `preserve-3d` anywhere.** Each hinged part (the flap, each third of the letter) is a single
  element on `rotateX` with its own `perspective()`. Its two looks (outside/inside) are layers whose
  opacity swaps at 90°, when it's edge-on, so Safari never depth-sorts planes. Paint order gives the
  right overlap. Writing on a back face is pre-flipped (`scaleY(-1)`).
- **Z-sandwich:** inside `<Envelope>` the order is back · open flap · liner · *contents* · pocket ·
  closed flap · seal. The body wrapper has no transform/opacity at rest (no stacking context), so
  the letter sits between liner and pocket; by the time the body sinks (and becomes a stacking
  context) the letter has cleared the mouth.
- **Geometry** is measured before first paint (stage + face rect); the letter is laid out at the
  face rect and transformed into the envelope, so its final transform is the identity.

---

## 4. Stamp placement physics

Each stamp (in `photos, letter, voice, song` order, content only):

- **Descend** 0.40 s from `y −30px`, `scale 1.17`, a slight random turn of ±(2.5–6.5)° alternating
  sides (rolled in the tap handler), `opacity` in over the first 0.14 s. Curve `[0.36,0,0.58,1]`:
  a hand lowering a stamp, not a free fall.
- A soft **cast shadow** (pre-blurred, offset 10px) peaks at 0.55 opacity a third of the way down
  and vanishes on contact; the stamp's own drop shadow takes over.
- **Press**: `scale` overshoots *down* to 0.982 at contact, then recovers to 1 over 0.16 s
  (ease.out). The turn resolves to the configured resting angle (`STAMPS[kind].place.rotate`) over
  0.48 s, so the settled pose is exactly the repeat-visit pose.
- **Postmark** 0.04 s after contact: opacity in 0.07 s, `scale 1.22 → 1` in 0.14 s (ease.ink), a
  dull "tock". Cancellations are **undated rings with the stamp's own wording and a heart**,
  leaning toward the middle of the face; the single **dated** cancellation sits on the address line.
- Stagger 0.35 s. Placement positions: `STAMPS[kind].place` (% of the face), stamp width = 35% of
  the face width, capped by 20% of its height (`stampWidthFor`).

---

## 5. Repeat visit (`<EnvelopeView>`, calm entrance)

No ceremony, settled in < 0.6 s: face `opacity` 0→1 + `y` 10→0 (0.42 s, ease.out); stamps fade
with `scale 0.985→1`, from 0.10 s, staggered 0.05 s, 0.32 s each; their marks 0.06 s behind; NEW
marks ink in at 0.36 s (`scale 1.2→1`, 0.18 s, ease.ink); hint at 0.30 s. Reduced: opacity only.
`entrance="none"` renders it already in place (the reveal's hand-off).

NEW marks (red "NEW" postmark) sit in the corner **opposite** each stamp's cancellation so they
never pile up; they only show once the reveal has settled.

---

## 6. Stamp worlds: `<Sheet>`

| Situation | Open | Close |
|---|---|---|
| From a stamp (`originRect`) | Paper layer morphs from the stamp's rect to the sheet (`x y scaleX scaleY`, spring.morph), paper opacity 0→1 in 0.14 s so the stamp shows through at first; content fades up at 0.16 s (opacity 0.30 s, `y 14→0` 0.42 s); scrim 0.32 s | Content out 0.12 s; paper folds back onto the stamp (0.34 s ease.inOut) and fades in its last 0.12 s; scrim 0.28 s; focus returns to the stamp |
| Phone, no origin | Slide up from below, spring.sheet | Slide down 0.26 s ease.press |
| Desktop, no origin | Fade 0.24 s + `y 16→0` 0.32 s | Fade 0.18 s + `y 0→12` |
| Phone drag on the header | 1:1 downward (elastic 0.04 upward); release past min(120px, 25% height) or a flick > 600 px/s closes; otherwise springs back (spring.sheet) | A drag-close continues downward (never back to the stamp) |
| Reduced motion | 0.20 s crossfade, no morph/slide | 0.15 s crossfade (drag still follows the finger) |

Only the plain paper layer is scaled (cheap, no text distortion). `world` = full screen on
phones, 40rem card from `sm`; `sheet` = bottom sheet ≤ 90svh on phones, 34rem card from `sm`.

---

## 7. Vinyl and tonearm (`<Vinyl>`)

- Spin is a motion value advanced each frame from a `speed` value: **eases up to 33⅓ rpm**
  (200°/s) in 1.3 s `[0.3,0,0.25,1]` and **coasts down** in 1.9 s `[0.12,0.45,0.3,1]`. No CSS
  keyframes, so it never snaps. The groove sheen is a separate static layer (the grooves turn under
  the light); the record's shadow is static too.
- Tonearm on play: swings onto the lead-in groove (19°, spring.arm), then **lowers** at 0.6 s
  (0.32 s, ease.press: its shadow tightens from offset 2.2/3.4% to 0.6/1%). On pause: **lifts**
  (0.22 s) then swings back to its rest post (spring.arm, after 0.2 s).
- Drive `playing` from **real** playback (Spotify `playback_update`); Apple Music is ambient on play
  (D-013). Never spin when nothing plays.
- Reduced motion: no spin; the tonearm is simply placed in its playing/rest position.

## 8. Voice object (`<VoiceObject>`)

An original cathedral-style wireless in the voice stamp's sage. On play: the **dial lamp warms**
(0.7 s), the **tuning needle sweeps onto the station** with one soft settle (spring 70/13) and the
tuning knob turns with it; the **speaker cloth glows** at `lamp × (0.55 + 0.45·level)` (level
smoothed by a 260/30 spring), steady 0.8 without a level. A hair of needle drift while playing
(±0.5 units, plus a tremble proportional to level). On pause: lamp 0.9 s, needle back 0.8 s
(ease.inOut). Reduced: lamp/glow crossfade only, needle placed, no drift. Decorative (aria-hidden).

## 9. Micro-interactions

| Element | Hover (fine pointers only) | Press | Reduced |
|---|---|---|---|
| Stamp button | `y −2px`; lifted shadow layer opacity 0→1 (200 ms) | `scale 0.97` (spring.press) | no lift; press = opacity 0.85 |
| Tap to open | — | `scale 0.97`, 150 ms CSS | CSS durations collapse globally |
| Envelope (threshold) | cursor pointer | opens | — |
| Sheet close / Skip / mute | colour only | — | — |

Keyboard focus never animates; focus rings are the global on-brand outline.

## 10. Sound design (`components/reveal/sound.ts`)

Synthesised with Web Audio, **no files**, all just above silence (master 0.75 × cue gains ≤ 0.13).
The `AudioContext` is created/resumed and a silent sample played **synchronously inside the tap**
(iOS unlock). Cues are scheduled on the audio clock against the same timeline:

| Cue | At | Recipe |
|---|---|---|
| crack | +0.02 | two short high-passed noise ticks + a 190→95 Hz sine tock |
| rustle | +0.26 | granular paper: ~28 band-passed noise grains (1.8–5.2 kHz) swelling over 0.55 s |
| slide | +0.82 | noise through a band-pass sweeping 1.1→2.6 kHz (0.6 s) under faint crinkles |
| unfold ×2 | +1.56, +1.78 | short bright rustles (0.22 s) |
| thud | each landing −0.02 | 105→52 Hz sine (0.15 s) + low-passed contact noise |
| ink | each postmark | 210→130 Hz sine + 760 Hz band-passed noise (dull rubber tock) |

A visible **mute** toggle (top right, persisted in `useDevice.soundMuted`) shows from the threshold
until settle. `site.revealSound=false` removes sound entirely. Skip silences everything already
scheduled. Sound never carries meaning (iOS silent switch may mute Web Audio).

## 11. Performance rules

- Animate only `transform` and `opacity`. Blurs are static (`blur-[…]` on layers that only fade);
  shading is a flat `--shade` layer whose opacity follows an angle.
- No `will-change` sprinkling: Motion promotes animating elements; nothing else hints.
- Folded-letter panels and the envelope layer exist only until settle, then unmount.
- The heavy SVG filters (postmark ink) are never scaled for long: a mark's `scale` animation is
  0.14 s, one at a time.
- Stage uses `svh`; geometry is measured once before paint; resizes during the ceremony skip to
  the end instead of re-laying out mid-flight.
- Target: 60 fps on a mid-range Android. QA on real hardware (QA_CHECKLIST): Chrome on a
  mid-range Android with 4× CPU throttle in DevTools as a proxy; iPhone Safari non-Pro.

## 12. Accessibility

Real `<button>`s with `STAMPS[kind].recipient.openLabel({ from, detail })` labels; 44px targets;
polite live regions for the threshold line and the completion summary; focus to the first stamp
after a keyboard-driven reveal; `Escape` skips; Sheet = `role="dialog"` + `aria-modal` +
`aria-labelledby`, focus in, Tab trapped, Esc closes, focus returned (stamp buttons focus
themselves on click for Safari). Every animation has the reduced-motion variant above, driven by
`useReducedMotionPref()` (OS setting or Demo Panel override) and Motion's `MotionConfig`.

---

## 13. Integration API

All components are client components. Import paths are exact.

```ts
// components/reveal/FirstTapReveal.tsx
export interface RevealResult { skipped: boolean; reducedMotion: boolean }
export interface FirstTapRevealProps {
  kinds: readonly StampKind[];                       // stamps with content; only these are placed
  newKinds?: ReadonlySet<StampKind>;                 // NEW marks, shown once settled (usually empty)
  toName?: string | null;                            // "for Theo" (envelope back + address)
  fromName?: string | null;                          // "from Mira"; also used in stamp labels
  prompt?: string;                                   // default "Someone who misses you sent this."
  postmarkDate?: string | null;                      // ISO; the dated cancellation by the address
  details?: Partial<Record<StampKind, string>>;      // extra label words, e.g. { voice: "1 minute 12 seconds" }
  hint?: string | null;                              // default "Tap a stamp to open it."; null hides
  mode?: "live" | "preview";                         // preview = identical visuals, caller doesn't record
  contained?: boolean;                               // fill the parent box instead of 100svh
  playbackRate?: number;                             // design review only (playground); never in screens
  onComplete: (result: RevealResult) => void;       // once: after settle or Skip. Pass to services.reveal.markRevealed(slug, result).
  onOpenStamp: (kind: StampKind, originRect: DOMRect, button: HTMLButtonElement) => void;
  className?: string;
}

// components/envelope/EnvelopeView.tsx
export interface EnvelopeViewProps {
  kinds: readonly StampKind[];
  newKinds?: ReadonlySet<StampKind>;
  toName?: string | null;
  fromName?: string | null;
  postmarkDate?: string | null;
  details?: Partial<Record<StampKind, string>>;
  hint?: string | null;
  entrance?: "calm" | "none";                        // default "calm" (< 600 ms)
  onOpenStamp: (kind: StampKind, originRect: DOMRect, button: HTMLButtonElement) => void;
  contained?: boolean;
  className?: string;
}
export function orderKinds(kinds: readonly StampKind[]): StampKind[];

// components/envelope/EnvelopeFace.tsx  (sender portal + recipient)
export interface FaceSlot { kind: StampKind; width: number; rotate: number; index: number }
export interface EnvelopeFaceProps {
  renderSlot: (kind: StampKind, slot: FaceSlot) => ReactNode;
  kinds?: readonly StampKind[];                      // default all four (sender shows empty slots too)
  toName?: string | null;
  fromName?: string | null;
  postmarkDate?: string | null;
  fit?: "fill" | number;                             // "fill" parent, or width/height ratio (default 0.62)
  decorOpacity?: MotionValue<number> | number;
  footer?: ReactNode;
  faceRef?: Ref<HTMLDivElement>;
  className?: string;
}
export function stampWidthFor(faceW: number, faceH: number): number;

// components/envelope/Envelope.tsx
export type EnvelopeState = "closed" | "opening" | "open" | "sealing";
export interface EnvelopeMotion {
  flap: MotionValue<number>;        // 0 closed … 180 open (deg)
  seal: MotionValue<number>;        // 0 seated … 1 lifted away
  glow: MotionValue<number>;        // seal halo 0..1
  bodyY: MotionValue<number>;       // px, envelope body only (contents unaffected)
  bodyOpacity: MotionValue<number>;
}
export interface EnvelopeProps {
  state?: EnvelopeState;            // default "closed"; "opening"/"sealing" animate, then settle
  drive?: EnvelopeMotion;           // external choreography (the reveal); disables `state` animation
  toName?: string | null;           // "for Theo" in pen on the back
  glow?: boolean;                   // seal halo: 3 breaths then steady (closed only)
  contents?: ReactNode;             // between liner and pocket
  onStateSettled?: (state: EnvelopeState) => void;
  className?: string;
  style?: CSSProperties;            // give it a width; height follows ENVELOPE_ASPECT (1.42)
}
export function useEnvelopeMotion(): EnvelopeMotion;
export const ENVELOPE_ASPECT: number;

// components/ui/Sheet.tsx
export type SheetVariant = "sheet" | "world";
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hideTitle?: boolean;
  description?: string;
  accent?: AccentToken;
  children: ReactNode;
  originRect?: DOMRect | null;
  variant?: SheetVariant;           // default "world"
  footer?: ReactNode;
  initialFocus?: RefObject<HTMLElement | null>;
  closeLabel?: string;              // default "Close"
  className?: string;               // scrolling content area
}

// components/media/Vinyl.tsx
export interface VinylProps {
  playing: boolean;                 // real playback only
  artworkUrl?: string | null;       // centre label; falls back to a printed paper label
  title: string;
  artist?: string | null;
  size?: number;                    // px width; height 0.88 × size; default 280
  accent?: AccentToken;             // printed label colour; default "ochre"
  plinth?: boolean;                 // default true
  className?: string;
}

// components/media/VoiceObject.tsx
export interface VoiceObjectProps {
  playing: boolean;
  level?: number | MotionValue<number>;   // 0..1; a MotionValue avoids per-frame re-renders
  size?: number;                          // px width; height 1.1 × size; default 220
  className?: string;
}
```

### Recipes

**Recipient route (`/t/[slug]`)**

```tsx
const [world, setWorld] = useState<{ kind: StampKind; rect: DOMRect } | null>(null);
const openStamp = (kind: StampKind, rect: DOMRect) => setWorld({ kind, rect });
// Activity: close any open world when the route hides (README rule 4).
useLayoutEffect(() => () => setWorld(null), []);

{mode === "first_tap" ? (
  <FirstTapReveal
    kinds={filledKinds(env.contents)}
    toName={recipientName(env.contents)}
    fromName={senderName(env.contents)}
    postmarkDate={env.sealedAt}
    details={{ voice: spokenDuration(voice.durationSec), song: track.title, photos: `${n} photos` }}
    onComplete={(r) => services.reveal.markRevealed(slug, r)}   // RevealResult = the service's info shape
    onOpenStamp={openStamp}
  />
) : (
  <EnvelopeView kinds={…} newKinds={newSince(env.contents, lastVisit)} … onOpenStamp={openStamp} />
)}
<Sheet open={!!world} onClose={() => setWorld(null)} title={STAMPS[k].label}
       accent={STAMPS[k].accent} originRect={world?.rect}>{/* the stamp's world */}</Sheet>
```

Keep `<FirstTapReveal>` mounted after `onComplete`: its settled state *is* the envelope view (it is
the same tree). If you prefer to swap, `<EnvelopeView entrance="none">` is pixel-identical.

**Sender preview** (`/s/[token]/preview`): `<FirstTapReveal mode="preview" contained … />` inside
the preview frame; **Replay** = change its `key`; never call the reveal service.

**Sender portal home**: `<EnvelopeFace fit={0.62} kinds={STAMP_KINDS} toName={…}
renderSlot={(kind, slot) => filled(kind) ? <Link …><Stamp kind={kind} width={slot.width}
rotate={slot.rotate} postmark /></Link> : <Link …><Stamp kind={kind} width={slot.width} empty /></Link>} />`

**Seal & send**: `<Envelope state={sealing ? "sealing" : "open"} toName={…} glow={false}
onStateSettled={(s) => s === "closed" && done()} className="w-[min(86vw,24rem)]" />` (the flap
folds down, then the seal presses in; reduced motion crossfades).

**Empty / still being written**: `<Envelope state="closed" glow toName={…} />`.

---

## 14. Playground & review

`/design-system/motion` — reveal with stamp checkboxes, addressee, motion override (System /
Reduced / Full, app-wide via the Demo store), slow motion (2×/4×), Replay and an event log; envelope
states (closed, open, interactive open/seal); EnvelopeView with NEW marks opening worlds from their
stamps; Sheet variants; Vinyl (artwork + printed label) and VoiceObject with a simulated level.

Query params for screenshots: `?kinds=letter,song&name=Theo&from=Mira&rate=0.25&frame=0`
(`frame=0` renders the reveal full-viewport at any width, like the real route). Example:

```bash
python scripts/shot.py "/design-system/motion?rate=0.25" out.png --wait 6000 \
  --click "[data-reveal-tap]" --frames 0,500,1000,1500,2000,3000,5000,9000
```

Stable hooks for QA: `[data-reveal-tap]`, `[data-reveal-skip]`, `[data-reveal-mute]`,
`[data-stamp-button=<kind>]`, `[data-sheet-close]`, `[data-envelope-face]`.
