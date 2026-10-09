# SAUDADE: DESIGN DIRECTIONS (Phase 0 → 1)

- Owner: Brand & Visual Designer
- Status: **F "Wish You Were Here" selected (9 Oct 2026, evening, D-060)**. Before that E "Correio" (D-052), D "Lisbon Post" (D-049); Gate 0 recommended A "Sun-Bleached Postcard" with B accents (D-001)
- Live boards: **`/design-system/directions`** (moodboard, palette, type pairing and one hero frame each). Living style guide: `/design-system`
- All boards are built from our own primitives, CSS/SVG and the licensed demo photos (`docs/ASSETS.md`). No copied imagery, stamps or layouts. Every stamp shown is an original **PLACEHOLDER (client artwork pending)**.

---

## 0. SELECTED (9 Oct 2026, evening): Direction F · Wish You Were Here

> Live board: `/design-system/directions#f`. Decision records: `DECISIONS.md` D-060 to D-066.

**Why a sixth direction.** The product owner asked for a fresh start rather than another revision:
"keeping the footer the same, redesign the whole website to a new color palette and new design
language… unique and new animations… use Emil Kowalski's principles." F was drawn from the
client's own words in CLIENT_GUIDE (vintage postcards, hand-stamped type, warm imperfect texture;
terracotta, cream, dusty blues, greens, pinks and reds) instead of from E.

**The idea.** A 1940s linen "large-letter" postcard. Every page is a postcard: a sky, sunset or sea
masthead with a perforated bottom edge, and the page's work done on the back of a postcard.

| Element | F |
|---|---|
| Type | Bowlby One block capitals (always uppercase) + Grand Hotel script for the one word that carries the feeling + Karla for reading + Nanum Pen for the sender's hand + Courier Prime for anything postal |
| Colour | Sepia ink on linen cream; post-box red for every call to action; navy for type on colour and for hard shadows; turquoise sky, deep sea and a mustard-to-coral sunset as bands; five pastel stamp worlds |
| Texture | A woven linen crosshatch over everything, sun rays on the bands, perforated edges as masks |
| Shape | White-bordered postcards with 14px corners; buttons are tickets with one clipped corner, tags are airmail labels (D-078); paper and stamps nearly square |
| Depth | Soft warm shadows for things resting on the desk; a hard 4px navy offset for things you can press |
| Footer | The approved layout in the site's type and colours: navy linen, perforated top, Bowlby wordmark (D-078) |

| Reference (patterns only) | What F borrows | Saudade version |
|---|---|---|
| later.com | Clip-path reveals, tabs whose active colour is a clipped copy | Photos clip up from the bottom edge; the iPhone/Android tabs wipe navy across; nav underlines draw on |
| gumroad.com | Hard-shadow lift, peeking cards, floating objects | Ticket buttons lift off a navy shadow; postcards peek from behind the hero's perforated edge; the biplane |
| oatly.com | Drum counters, colour that fills the screen when you follow a link, stickers and labels | Odometers on the postcard back; luggage tags whose colour fills the screen; the sticker cloud on the sunset |

**Risks:** photo-filled letters need short words and good photographs (one word per page); the script
is for one phrase at a time, never for sentences or labels.

---

## 0a. Previous selection (9 Oct 2026, morning): Direction E · Correio

> Live board: `/design-system/directions#e`. Decision records: `DECISIONS.md` D-052 to D-056.

**Why a fifth direction.** The product owner asked for the system to follow later.com (type,
colour and layout discipline), with gumroad.com and oatly.com as further references. E keeps the
postal identity and swaps in a bolder, better-organised structure. All references were studied for
patterns only; no copy, logos, photos, illustrations or 3D art were taken.

| Reference | What E borrows | Saudade version |
|---|---|---|
| later.com | Heavy grotesque display + tight UI sans; cream ground, black text, one hot accent | Epilogue 900/800 + Inter Tight; cream #F7F1E8, warm black #15120F, post-box vermilion #C8370F |
| later.com | Square buttons, clipped bottom-right corner, trailing arrow | `InkButton` primary / secondary / ink / paper / quiet |
| later.com | Folder tabs on a cream card; big-title story list on black | "The four stamps" and "How it works" on the home page |
| later.com | Extruded 3D block cards on a gradient band | `extrude` utility on the airmail dusk band (lilac → pink → vermilion) |
| later.com | 45° chamfered photo crops, full-bleed photo + angled translucent panel, fanned cards, giant footer wordmark | `chamfer`, the first-tap band, fanned example postcards, the extruded "saudade" wordmark |
| later.com | Moiré background | Postmark cancellation waves (`waves`, `band-cobalt`, `band-ink`) |
| gumroad.com | Black-outlined cards, hard shadows that lift on hover | `frame`, `--elev-print`, button hover lift |
| gumroad.com | Floating tilted objects, speech bubbles, pill cloud, one big number | Floating stamps and wax seal, `pub-bubble`, the occasions cloud, the numbers band |
| oatly.com | Graph-paper ground, framed cards with caption strip + coloured tag | `grid-paper`, `pub-card`, `tag` |
| oatly.com | Circular badges, sticky notes, handwritten asides, doodles, chatty copy | Postmarks as badges, `pub-note`, Nanum Pen asides with doodle arrows |

**Risk:** E is bolder than the brief's "not clean or corporate". The warmth has to come from the postal
motifs, textures and handwriting, so those are non-negotiable in E (D-053). D remains available as a
token swap.

---

### 0.1 Revision (9 Oct 2026, later): every section from all three, with their motion

Feedback: keep the footer; the rest leaned too far towards later.com. Each section now takes structure,
detail and motion from all three references (`DECISIONS.md` D-057 to D-059). The motion was read from
each site's live CSS and recordings, then rebuilt in our own code:

| Reference | Signature motion | Where it lives in Saudade |
|---|---|---|
| later.com | Label roll (out up, in from below, stretched) | Every button and the header CTA |
| later.com | Arrow stem stretch | Every link-button |
| later.com | Words rising out of masks | Headlines on every page (`RevealText`) |
| later.com | Skew "jelly" wobble | Floating stamps, seals, postmarks |
| later.com | Objects orbiting a statement, front and back | "Texts get buried. Letters get kept." (`Orbit`) |
| gumroad.com | Lift onto a hard shadow, land on press | Secondary buttons, cards, pills |
| gumroad.com | Cursor parallax + scroll drift (view timeline) | Hero, claim, 404 floaters; first-tap photo |
| gumroad.com | Back-and-forth pill marquee, pauses on hover | Occasions |
| gumroad.com | Looping character illustrations | How-it-works comics, stamp worlds, tap help, mail loop |
| oatly.com | Big-button double shadow | Primary buttons |
| oatly.com | Drum counters with a 3D "maxed" wobble | Numbers, stamp counts, 404, sender "x of 4 filled", code boxes |
| oatly.com | Bouncing bar chart | Voice waveform |
| oatly.com | Card grows to fill the screen, folds away on arrival | "Good to know", "How tapping works" |
| oatly.com | Bounce, image zoom in frames | Sticky note; framed cards |

Typography now mixes all three: heavy grotesque statements (Later), big regular-weight headlines with a
handwritten accent (Gumroad × the sender's pen), and hand-printed capitals for labels (Oatly).

## 0b. Earlier selection (8 Oct 2026 revision): Direction D · Lisbon Post

> Live board: `/design-system/directions#d`. Decision record: `DECISIONS.md` D-049.

**Why a fourth direction.** The Gate 0 build used A. Internal review found it too beige and too quiet:
- brown ink on cream
- four similar-weight fonts
- a kitschy speckled "ticket" button
- a single phone column on every screen, so desktop looked unfinished

D keeps A's restraint and everything the client asked for (vintage postcards, hand-stamped type, warm
imperfect texture, a sun-bleached palette, not corporate), and adds colour, editorial type and real
responsive layouts.

**Concept.** Sun-faded Portuguese postal ephemera. *Saudade* is a Portuguese word, so the palette
comes from Lisbon itself: azulejo tiles, terracotta roofs, pastel façades, yellow trams and post-box red,
printed on warm white paper in navy postal ink.

| Role | Token | Hex | Notes |
|---|---|---|---|
| Page / letter paper | `--paper` / `--paper-raised` | #FAF6EE / #FFFDF8 | Warm white, lighter than A's beige |
| Ink | `--ink` | #1B2638 | Navy postal ink, 14:1 on paper |
| Pen ink | `--ink-letter` | #23345A | The sender's handwriting |
| Colour fields | `--accent-cobalt` | #2B4C8C | Azulejo cobalt: bands, the reveal stage, footer |
| Letter world | `--accent-dusty-blue` | #A9C1E0 | Tile blue; also the envelope liner |
| Photos world | `--accent-terracotta` | #D2694A | Decorative and large italics only (D-050) |
| Voice world | `--accent-sage` | #B5CDB9 | Sea glass |
| Song world | `--accent-ochre` | #F2C665 | Tram yellow; the sun in the arches |
| Closing band, heart | `--accent-rose` | #EFBCAE | Façade pink |
| Wax, airmail | `--accent-red` / `--wax` | #C4402F / #B7352B | Post-box red |

**Type.** Each face was chosen from a rendered specimen of 41 candidates:
- **Instrument Serif** (display, real italic): editorial, condensed, fits big headlines on a phone.
- **Bricolage Grotesque** (UI): a grotesque with French-poster quirks, so it's warm rather than corporate.
- **Courier Prime** (postal labels and codes): a crisp typewriter in place of the grungy Special Elite.
- **Nanum Pen Script** (the sender's words): a real ballpoint letter, legible at 30px. Caveat read as a
  generic "handwriting font".

**Motifs.** All drawn in code and original:
- Lisbon arches (hero, help, recover, closing band)
- an azulejo tile pattern
- riso speckle on colour fields
- an airmail edge on every page
- print-offset shadows: buttons are inked tags that press into their offset

Perforated stamps, postmarks and the wax heart carry over from A.

**Layout.** Built responsive at 390, 820 and 1440 pixels wide:
- **Home:** an editorial grid. Hero with arch, postal ticker, three postcards, four colour-coded stamp
  worlds on cobalt, a first-tap feature with a phone, "Letters get kept", and a closing band.
- **Two-column flows:** claim, success, recover, help and legal (sticky contents).
- **Sender portal:** stamp tabs; a sticky envelope beside a checklist; each editor headed by a card in
  its world colour with its stamp.
- **Recipient:** the ceremony on a cobalt azulejo stage, cream envelope, large cream prompt, and the
  letter face on the tiles once settled.

**Inspiration, studied and never copied:**
- Lisbon azulejos and façades
- Kinfolk and Cereal (editorial grids, serif + italic accents)
- Partiful and Gumroad (tactile print-offset shadows)
- Paperless Post and Greenvelope (the envelope ceremony)
- Rifle Paper Co. (confident colour)
- Slowly (stamps as collectables)
- risograph prints (grain on flat colour)

**Risks.**
- Cobalt fields must never crowd the client's stamp artwork, so they're used for stages and bands, not
  behind stamps.
- Terracotta is decorative only.
- WebKit on Windows renders the variable fonts heavier than intended. That's a test-browser quirk:
  confirm on a real iPhone at Gate 1.

---

## 1. The brief all three answer

From `CLIENT_GUIDE.md` §2–3 and §12:

- **References:** vintage postcards, hand-stamped typography, warm and imperfect textures.
- **Palette:** sun-bleached terracotta, cream, dusty blues, greens, pinks and reds.
- **Agreed details:** paper textures, postmarks, perforated edges.
- **Recipient metaphor:** an envelope covered in vintage stamps, where each stamp is its own small world.
- **Explicitly NOT:** clean, corporate or tech-forward.
- **North star:** "The physical object is the envelope. The digital experience is the letter inside it." Every recipient screen must pass the *letter, not software* test.
- **Swappable:** branding is not final, so everything runs on tokens and the stamp asset map.

The three directions share one system: the same tokens, the same four typefaces and the same primitives (`StampFrame`, `Postmark`, `HeartSeal`, `PaperSheet`, `PhotoMount`…). They differ in **how much is on the page**: A is airy, B is layered, C is spare.

---

## 2. Direction A: Sun-Bleached Postcard (Gate 0 recommendation, superseded by D)

**Concept.** A postcard that has sat in a sunny window for a summer. Faded terracotta and cream, a soft grain, generous air. The page stays calm so the stamps and the handwriting carry the feeling.

**Moodboard (live).** A faded seaside snapshot (demo photo, pier at golden hour) in a worn white border; the back of a vintage postcard ("POST CARD" header, divider, message in handwriting, address lines, stamp box holding the Photos stamp); a terracotta wavy cancellation; paint chips of the palette; a pencilled note: "faded, warm, airy". The background is a cream sheet with light pooling from the top right.

**Palette.**

| Role | Token | Hex |
| --- | --- | --- |
| Page (cream) | `--paper` | `#f5ecdd` |
| Sheet / stamp margins | `--paper-raised` | `#fbf6ec` |
| Envelope body | `--paper-deep` | `#ecdfc9` |
| Signature warmth, Photos world | `--accent-terracotta` | `#c66b47` |
| Buttons, labels (text-safe) | `--accent-terracotta-ink` | `#9a4a2c` (5.3:1 on paper) |
| Letter world, sky | `--accent-dusty-blue` | `#8ba6be` |
| Voice world | `--accent-sage` | `#9db08a` |
| Liner, tape | `--accent-rose` | `#e0a8a0` |
| Handwriting | `--ink-letter` | `#2f3a52` (10.5:1 on paper-raised) |
| Body text | `--ink` | `#3a2e28` (11.2:1 on paper) |

**Type pairing.** Fraunces, soft optical axis, for display ("Someone who misses you sent this."). Caveat at 26px / 1.5 in fountain-pen blue-black for the letter. Special Elite for postal accents only (codes, postmarks, labels). DM Sans for small UI. Non-Latin letters fall back to a readable serif, never a cursive-only face.

**Texture.** Self-made SVG grain on every page, fibre on sheets and the envelope, an ink-speckle mask on stamped ink (buttons, rubber stamps), foxing and a tan edge on aged paper. All tiny, tiled and under the content.

**Hero frame.** A cream page. Above: "For Theo · from Mira" in postal type and "Someone who misses you sent this." in Fraunces. Below: a pale envelope whose folded flap seams meet at a glowing wax heart seal, and the four placeholder stamps at their resting places from `config/stamps.ts`, two with wavy cancellations and one with a small red "NEW". Below that, "Tap a stamp to open it." in handwriting.

**Against the brief.**

- Vintage postcard, sun-bleached palette and paper grain, exactly as briefed.
- The airy layout keeps the client's stamp art as the hero, and it reskins easily.
- Calm enough for repeat visits; legible on a small phone in sunlight.
- Warm and never corporate: hand type and imperfect ink do the work.

**Risks.**

- It can go too quiet if textures are dialled down. Keep the grain, postmarks and handwriting.
- It relies on the four stamp worlds for contrast and surprise (that's where B comes in).

---

## 3. Direction B: Desk Drawer Ephemera

**Concept.** The drawer where you keep the good things: kraft card, washi tape, a return ticket, photo corners, overlapping postmarks. Rich, tactile and personal.

**Moodboard (live).** On kraft card: a torn, ruled diary note ("Tuesday, rain. Found the ticket from our last train…") with a paperclip; a photo (demo, mittened hands and coffee) in black album corners with ochre tape; a typed label "THINGS I KEPT"; an ochre return ticket with notched ends; an "AIR MAIL" rubber stamp; the Song and Voice stamps overlapping, one cancelled, one marked NEW.

**Palette.**

| Role | Token | Hex |
| --- | --- | --- |
| Surround | `--desk` | `#e4d6c0` |
| Kraft (envelope, card) | mix of `--paper-edge` 62% + `--paper-deep` | ≈ `#d5bf9e` |
| Notes, letter | `--paper` | `#f5ecdd` |
| Tickets, Song world | `--accent-ochre` | `#d2a253` |
| Airmail, rubber stamps | `--accent-red` | `#b8442f` |
| Cancellations, airmail | `--postmark` | `#3f5873` |
| Labels | `--accent-sage-ink` | `#4c6340` |
| Typewriter text | `--ink` | `#3a2e28` |

**Type pairing.** Special Elite for headings and labels ("FROM MIRA — 08.10.26"), Caveat for notes, Fraunces italic for accents.

**Texture.** Heavier: kraft fibre, double grain, tape with torn zigzag ends, deckled and torn paper, notched tickets, an airmail chevron border.

**Hero frame.** A kraft desk. A typewritten header "FROM MIRA — 08.10.26" and a handwritten "for Theo, who is too far away". An airmail envelope, taped at one corner, with a station photo tucked behind it on one side and a torn "see you soon?" note on the other. The four stamps at their resting places, a red "PAR AVION" rubber stamp and the wax heart on the lower edge. "TAP A STAMP TO OPEN IT" in typewriter caps.

**Against the brief.**

- The most tactile and nostalgic: paper, tape, postmarks and perforations everywhere.
- It feels hand-assembled, the furthest of the three from tech-forward.
- It's perfect material for the *inside* of each stamp world.

**Risks.**

- Busy on a 375px screen, where the stamps compete with the collage.
- More layers to animate and keep at 60fps on mid-range Android.
- Typewriter headings tire quickly and read poorly in other scripts.

---

## 4. Direction C: Quiet Letterpress (alternative, not recommended)

**Concept.** Heavy cotton stock, blind deboss and one postmark-blue ink. Restrained and elegant, with lots of white space around a small, tidy cluster of stamps.

**Moodboard (live).** A debossed card with "Saudade" blind-embossed in Fraunces Light italic; one Letter stamp with a single blue circular cancellation; hairline rules; a small lake print with a thin border; a small wax seal.

**Palette.**

| Role | Token | Hex |
| --- | --- | --- |
| Page and card | `--paper-raised` | `#fbf6ec` |
| Secondary surface | `--paper` | `#f5ecdd` |
| Blind emboss, rules | `--paper-shadow` | `#dcc8a8` |
| The one ink | `--postmark` | `#3f5873` (6.3:1 on paper) |
| Text | `--ink` | `#3a2e28` |
| Meta | `--ink-faded` | `#6e5d52` |
| Used once (seal, a stamp) | `--accent-terracotta` | `#c66b47` |
| Heart seal | `--wax` | `#a8382a` |

**Type pairing.** Fraunces Light at large sizes with tight tracking ("For Theo."), DM Sans for body text, and Caveat only for the letter itself.

**Texture.** Almost none: fibre and blind deboss (inset shadows), no grain-heavy surfaces.

**Hero frame.** A near-white page. "For Theo." in large Fraunces Light, then "From Mira · 8 October" in small sans. A cream envelope with a debossed frame, the four stamps small in a neat 2×2 in its top-right corner under one blue wavy cancellation, "Theo" blind-embossed, and a small wax seal. "Tap a stamp to open it" in plain sans.

**Against the brief.**

- Elegant and timeless; it ages well and reskins easily.
- The fastest to build and the lightest on the page.

**Risks.**

- It is the closest to "clean", which the client explicitly ruled out.
- It loses the sun-bleached warmth and the sense of four different worlds.
- Small stamps in a corner undersell the client's artwork.

---

## 5. Recommendation: A, with B inside the stamp worlds

**Present A as primary to the client, enriched with B's ephemera where it means something.** Show C as the restrained alternative.

Why:

1. **The client's artwork is the hero.** A leaves the envelope uncluttered, so the stamps (the client's own art) carry the page. B's collage competes with them, and C shrinks them.
2. **The first-tap moment reads at a glance.** On a 375px phone the recipient sees one envelope, one seal and four stamps. Nothing else needs decoding before the reveal.
3. **"Four small worlds" needs a calm envelope.** If the outside is quiet, each opened stamp can turn up the texture in its own way. That is where B belongs:
   - **Photos:** album page, black corner pockets, washi tape, handwritten captions (`PhotoMount`).
   - **Letter:** aged, deckled, ruled stationery (`PaperSheet edge="deckled" tone="aged" ruled`).
   - **Voice:** a wireless with a dial label and a typed station card; the sound wave as a postmark.
   - **Song:** a record sleeve, a ticket-stub style track label, overlapping cancellations.
4. **Within the brief, away from "clean".** A keeps every agreed detail (paper, postmarks, perforations) and the sun-bleached palette without B's busyness or C's sterility.
5. **Performance and longevity.** A has fewer layers to animate on the reveal (60fps on mid-range Android) and dates more slowly than a heavy collage.
6. **Rebrand-safe.** All three run on the same tokens, so the December reskin changes values, not structure.

What we take from C: its restraint for the admin kit and for sender form screens, where clarity beats ornament.

---

## 6. How the system implements A (Phase 1)

- **Tokens:** `styles/tokens.css` (direction A values). Phase 1 appended `--elev-stamp-drop`, `--elev-paper-drop` and `--elev-lifted-drop` (drop-shadow filters for perforated, deckled and ticket shapes), `--paper-rule`, `--paper-rule-margin`, `--rule-letter` and `--paper-foxing` (stationery), `--wax-glow`, and `--texture-ink` / `--texture-ink-size` (rubber-stamp ink coverage mask). Tailwind mappings: `paper-rule`, `paper-rule-margin`, `paper-foxing`, `wax-glow`.
- **Stamp art:** original placeholders in `public/placeholders/stamps/` (240×300 faces, 200×200 heart). Each has 2–3 inks on cream, misregistered fills, halftone screens, a speckled key plate and a printed "PLACEHOLDER" mark. They are referenced only through `config/stamps.ts`.
- **Primitives:** see `/design-system` for every component in every state.

When the client's artwork arrives, replace the files in `config/stamps.ts` and set `placeholder: false`. Frames, postmarks and the wax seal take any art: the seal presses the heart art into the wax as a tone-on-tone relief.
