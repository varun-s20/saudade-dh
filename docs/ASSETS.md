# ASSETS — Saudade prototype asset register

Every third-party or generated asset in the prototype is listed here with its source, author and licence.
**Golden rule: licensed or self-made assets only, and record every source.** If an asset has no row in
this file, it does not ship.

- Last updated: 2026-10-08 (asset producer)
- Demo content files: `public/demo/photos/*`, `public/demo/voice/*`, `public/demo/song.json`
- Machine-readable credits for the photos: `public/demo/photos/manifest.json`

---

## Rules

1. **No copied assets.** Inspiration sites are for study only. Never take layouts, illustrations, copy,
   icons or images from them. Never reproduce real postage stamps, another brand's artwork or
   trademarked characters (MASTER_BUILD_PROMPT §3, rules 5–6). Use only original work or licensed
   sources: Google Fonts / OFL fonts, Unsplash or Pexels photos, and self-made or CC0 textures.
2. **Record before you ship.** Any PR that adds an asset also adds its row here, with the source URL,
   author, licence and date checked. A PR with no row doesn't merge. If a licence is unclear, leave the
   asset out and log the question in `OPEN_QUESTIONS.md`.
3. **Swap path for client art.** Stamp artwork and the heart seal are referenced only through
   `/config/stamps.ts`. When the client's final artwork arrives (O4), it replaces the placeholders there
   and nowhere else, and the stamp rows below are updated in the same PR.

---

## Fonts

Direction F, "Wish You Were Here" (DECISIONS D-060, D-064). Every family comes from Google Fonts and
is loaded with `next/font/google`, which self-hosts the files at build time: visitors' browsers make
no runtime requests to Google, and the OFL allows this bundling.

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| **Bowlby One** | Display: large-letter block capitals (headlines, numbers, tab labels, the photo-filled letters) | [fonts.google.com/specimen/Bowlby+One](https://fonts.google.com/specimen/Bowlby+One). Designer: Vernon Adams | [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/) | One weight (400), always uppercase via the `display` utility. Never fake-bolded (`font-synthesis: style`). Preloaded (latin). |
| **Grand Hotel** | Script: "Greetings from…", the recipient's prompt, the paired word in headings | [fonts.google.com/specimen/Grand+Hotel](https://fonts.google.com/specimen/Grand+Hotel). Designer: Astigmatic | [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/) | One weight (400). One phrase at a time, never sentences or interface labels. Preloaded (latin). |
| **Karla** | UI + body text, buttons, forms, admin | [fonts.google.com/specimen/Karla](https://fonts.google.com/specimen/Karla). Designer: Jonny Pinhorn | [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/) | Variable weight. Preloaded (latin). |
| **Courier Prime** | Postal labels, codes, postmarks, postcard backs | [fonts.google.com/specimen/Courier+Prime](https://fonts.google.com/specimen/Courier+Prime). Designer: Alan Dague-Greene | [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/) | 400 + 700. Labels only, never body text. Loaded on demand. |
| **Nanum Pen Script** | The sender's handwriting: letter, names, captions | [fonts.google.com/specimen/Nanum+Pen+Script](https://fonts.google.com/specimen/Nanum+Pen+Script). Designer: Sandoll Communication | [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/) | Covers Latin and Korean. Other scripts fall back to the UI face. Preloaded (latin). |
| ~~Epilogue~~, ~~Inter Tight~~ | Removed 2026-10-09 (D-078): the footer now uses the faces above | (were SIL OFL 1.1) | `app/fonts-footer.ts` deleted. |

Licences and designers were checked against `METADATA.pb` in
[github.com/google/fonts](https://github.com/google/fonts) (`ofl/` directory = SIL OFL): Courier
Prime and Nanum Pen Script on 2026-10-08; Epilogue and Inter Tight on 2026-10-09; Bowlby One,
Grand Hotel and Karla on 2026-10-09 (evening).

**Retired with the redesigns (no longer shipped):** Patrick Hand SC (OFL) with Direction F; Instrument
Serif (OFL) and Bricolage Grotesque (OFL) with Direction E; Fraunces (OFL), Caveat (OFL), Special
Elite (Apache 2.0) and DM Sans (OFL) with Direction D. Branding is not final; the rebrand fonts will
need new rows here.

---

## Photos (demo content: Mira → Theo)

These are six demo photos for the sample envelope. Each was fetched through [Lorem Picsum](https://picsum.photos),
which serves Unsplash photos, by Picsum id. Each was then resized to a 1600 px long edge with Pillow
(Lanczos), saved as progressive JPEG at q80 with metadata stripped, and comes in under 200 KB (112–187 KB).
None shows an identifiable person as its subject, so no model release is needed. All six were checked
against the Unsplash API on 2026-10-08: none is an Unsplash+ or premium image, so all are under the
free Unsplash License.

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| `public/demo/photos/01.jpg` | Photos stamp: "The pier where we said goodbye" | [unsplash.com/photos/jGKBncKGbrc](https://unsplash.com/photos/jGKBncKGbrc). Photo by [Dirk Sebregts](https://unsplash.com/@dirkseb). Picsum id 588 | [Unsplash License](https://unsplash.com/license) | 1600×1067, landscape. Wooden pier with rope railings at golden hour. |
| `public/demo/photos/02.jpg` | Photos stamp: "Your last train out. I waved till it was gone" | [unsplash.com/photos/gapYVvUg1M8](https://unsplash.com/photos/gapYVvUg1M8). Photo by [Charles Forerunner](https://unsplash.com/@charles_forerunner). Picsum id 524 | [Unsplash License](https://unsplash.com/license) | 1600×1067, landscape. Empty covered station platform at sunset. |
| `public/demo/photos/03.jpg` | Photos stamp: "The lane to the sea we walked every evening" | [unsplash.com/photos/Uax2bg5EizU](https://unsplash.com/photos/Uax2bg5EizU). Photo by [Bertrand Zuchuat](https://unsplash.com/@bertrandzuchuat). Picsum id 1065 | [Unsplash License](https://unsplash.com/license) | 1067×1600, **portrait**. Stone lane between old buildings that opens onto the sea. No people. |
| `public/demo/photos/04.jpg` | Photos stamp: "Coffee's never quite as good without you" | [unsplash.com/photos/k0SwnevO_wk](https://unsplash.com/photos/k0SwnevO_wk). Photo by [Alex Padurariu](https://unsplash.com/@alexpadurariu). Picsum id 755 | [Unsplash License](https://unsplash.com/license) | 1600×1216, landscape. Mittened hands holding a steaming cup; no face. Picsum lists the author as "Padurariu Alexandru"; we credit the current Unsplash name. |
| `public/demo/photos/05.jpg` | Photos stamp: "Next summer: this lake, both of us. Promise?" | [unsplash.com/photos/lpjb_UMOyx8](https://unsplash.com/photos/lpjb_UMOyx8). Photo by [Daniel Roe](https://unsplash.com/@danielroe). Picsum id 873 | [Unsplash License](https://unsplash.com/license) | 1067×1600, **portrait**. Turquoise mountain lake (Lake Louise, according to Unsplash). |
| `public/demo/photos/06.jpg` | Photos stamp: "Biscuit still waits by the door for you" | [unsplash.com/photos/2Ts5HnA67k8](https://unsplash.com/photos/2Ts5HnA67k8). Photo by [Matthew Henry](https://unsplash.com/@matthewhenry). Picsum id 1062 | [Unsplash License](https://unsplash.com/license) | 1600×1067, landscape. Pug wrapped in a blanket on a bed. **Picsum lists "Matthew Wiebe", but Unsplash credits Matthew Henry (@matthewhenry); we credit Unsplash.** |

What the Unsplash License allows: free commercial and non-commercial use with no permission needed.
Attribution isn't required but is good practice, and the app should show "Photo by X on Unsplash"
wherever credits appear. It does not allow selling the photos unaltered or compiling them into a
competing image service. These photos are showcase demo content only and never stand in for user uploads.

---

## Audio

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| `public/demo/voice/mira-voice.m4a` (AAC, mono, 44.1 kHz, 64 kbps, 547 KB) and `mira-voice.mp3` (fallback, mono, 64 kbps, 532 KB) | Voice stamp: Mira's placeholder voice note | Generated in-house by the Saudade team. Python/numpy synthesis with fixed seed 20261008, encoded with ffmpeg | **Generated in-house, original, no third-party material.** Team-owned | 68.0 s, peak −12 dBFS. A soft low-passed hum with slow pitch drift, shaped into 1–4 s "phrases" with short pauses over a faint room-tone floor. **Contains no speech and no real person's voice.** The file metadata title reads "Saudade placeholder voice note (generated tone, not speech)". |
| `public/demo/voice/waveform.json` | Static waveform for the voice player | Computed from the generated audio above | Original, team-owned | `durationSec` 68.0 and 96 normalised RMS peaks (0–1). |

If a real recording ever replaces the placeholder, it must be the team's own or the client's, with the
speaker's written consent recorded here.

---

## Music

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| "Here Comes the Sun", The Beatles (*Abbey Road*, 2009 remaster) | Song stamp sample: the rotating vinyl plus the official player | Spotify track [`6dGnYIeXmHdcikdzNNDMm2`](https://open.spotify.com/track/6dGnYIeXmHdcikdzNNDMm2). Apple Music song [`1441164589`](https://music.apple.com/us/album/here-comes-the-sun/1441164426?i=1441164589), album 1441164426 | **Link only.** We host no audio and hold no licence. Playback happens only through the official Spotify / Apple Music embed, under those platforms' terms. | No audio is downloaded, stored or re-streamed, and the iTunes `previewUrl` is not played in our own player. Artwork comes from the provider's metadata at runtime (Spotify oEmbed `thumbnail_url`, iTunes `artworkUrl…`) and is not stored in the repo. Logged-out listeners hear a ~30 s preview, which the client has accepted. Verification and CORS findings: `public/demo/song.json`. **Open check:** before production, review the Spotify and Apple Music artwork/branding guidelines, because rendering cover art inside a circular vinyl label crops it. |

---

## Textures

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| Paper grain and fibre | Envelope, letter and card surfaces | Generated in code with SVG `feTurbulence` (`--texture-grain`, `--texture-fibre` in `styles/tokens.css`) | Original, team-owned | **Built.** No bitmap textures. Any added later must be self-made or CC0 and get their own row. |
| Ink speckle, postmark ink imperfection, deckled/torn edges | Buttons, postmarks, paper edges | Generated in code (`--texture-ink`, SVG `feDisplacementMap`, seeded clip-paths in `components/paper/seeded.ts`) | Original, team-owned | **Built.** |

---

## Stamp artwork & heart seal

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| Placeholder stamps: Photos, Letter, Voice, Song | Stamps on the envelope and the reveal choreography | Original placeholders drawn in SVG by the team: `public/placeholders/stamps/{photos,letter,voice,song}.svg` (4–7 KB each, no external refs) | Original, team-owned | **Built.** Each is visibly marked **`PLACEHOLDER · CLIENT ART PENDING`** (+ `PLACEHOLDER_LABEL` title). Mapped only in `/config/stamps.ts`. They don't imitate real postage stamps or other brands' art. |
| Heart seal / NFC heart stamp | Seal on the envelope, sealing step and first-tap reveal | Original placeholder drawn in SVG by the team: `public/placeholders/stamps/heart-seal.svg`; the wax around it is drawn in code | Original, team-owned | **Built.** Marked placeholder. |
| *Final stamp and seal artwork* | Replaces the rows above | **Supplied by the client** (open question **O4**: delivery date and formats, SVG or transparent PNG @2x/@3x) | Client-owned. Record the licence or assignment terms when it is delivered | Swap only in `/config/stamps.ts`, then update this table. |

---

## Icons

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| UI icons (22: play/pause, close, back, upload, mic, mute, etc.) | Controls and navigation | Inline SVG drawn by the team (`components/ui/icons.tsx`) | Original, team-owned | **Built.** No icon library. If one is adopted, add a row with its name, version and licence. |

---

## Verification log

| Date | What | How |
| --- | --- | --- |
| 2026-10-08 | Photo sources and authors | `picsum.photos/id/{id}/info`, cross-checked with the Unsplash photo API (author, username, `premium`/`plus` = false) |
| 2026-10-08 | Font licences and designers | fonts.google.com family metadata, plus `google/fonts` `METADATA.pb` / `OFL.txt` |
| 2026-10-09 | Patrick Hand SC licence | `google/fonts` `ofl/patrickhandsc/METADATA.pb` (designer "Patrick Wagesreiter", license OFL) |
| 2026-10-09 | Epilogue, Inter Tight licences | `google/fonts` `ofl/epilogue/METADATA.pb` (designer "Tyler Finck, ETC", license OFL) and `ofl/intertight/METADATA.pb` (designer "Rasmus Andersson", license OFL) |
| 2026-10-08 | Song links | Spotify oEmbed (title, thumbnail, `access-control-allow-origin: *`) and iTunes Lookup API (`Access-Control-Allow-Origin: *`); both embed URLs return 200 with no frame-blocking headers |
| 2026-10-08 | Placeholder voice clip | Generated in-house; ffprobe/volumedetect confirm 68.0 s, mono 44.1 kHz, peak ≈ −12 dBFS |

---

## Third-party code shipped as a static file

| Asset | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| `public/vendor/browser-image-compression-2.0.2.js` | Web Worker script for in-browser photo compression | browser-image-compression 2.0.2 (Donald Lu), copied from `node_modules` | MIT | Self-hosted so no third-party CDN (jsDelivr) is contacted. Keep in sync with the npm version. |

## Runtime libraries added for the design

| Library | Used for | Source / author | Licence | Notes |
| --- | --- | --- | --- | --- |
| `lenis` 1.3.26 (npm, pinned exactly) | Smooth wheel/trackpad scrolling on the public pages (D-070) | [github.com/darkroomengineering/lenis](https://github.com/darkroomengineering/lenis), darkroom.engineering | MIT (checked in `node_modules/lenis/package.json`) | Bundled by Next (no CDN). Loaded with a dynamic import, only where the public shell renders; off for touch, reduced motion and the recipient's route. |
