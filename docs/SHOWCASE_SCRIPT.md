# Showcase script: Saudade prototype

**Audience:** Zeya Liu (founder). **Length:** 5–7 minutes walkthrough + questions.
**Presenter:** PM. **Driver device:** a phone (iPhone preferred) mirrored to the screen, or a laptop
browser in a 390×844 responsive view. The admin part is best on a laptop.

> The physical object is the envelope. The digital experience is the letter inside it.
> Everything you'll see works end to end. The data is simulated, so nothing here touches a real
> server yet; the real backend plugs in behind the same screens (`ARCHITECTURE.md`).

---

## Before the meeting (10 minutes)

1. Open the preview URL with **`?demo=1`** (or triple-tap the Saudade logo). The small round
   **DEMO** postmark appears bottom-right: that's the presenter's panel. Only you see it.
2. In the Demo Panel: **Reset everything** → confirm. **Motion: system.** **Fast mode: off**
   (realistic latency). **Force errors: none.**
3. **Record a real voice note now** (it makes the demo personal): Demo Panel → hero state
   **Claimed · draft** → Go to **Sender portal** → Voice → record ~20 seconds ("Hi Zeya, this is
   what your customers' friends will hear…") → Save. Then Demo Panel → **Reset everything** again
   *only if* you want to claim live (the recording will be wiped). Otherwise skip step 4's claim.
   *Alternative:* the sample envelope includes a placeholder voice clip (generated, no speech).
4. Keep a second tab open on `/admin` (signed in: `zeya@saudade.example` / `postmark`).
5. Phone: volume on, silent switch off (the reveal has a soft paper sound after the tap).

## The walkthrough

### 1 · The core mechanic: claiming a code (≈ 60 s) · client priority #1
- Start at **`/`**. "This is the quiet front door: one job, claim your code."
- **Claim your code** → type **`SAUD-0`** … "Codes never use 0, O, 1, I or L, so a handwritten or
  misread card can't trip anyone up." *(the input refuses it and explains.)*
- Type **`SAUD-9PXR`** → "This code has already found its envelope…" "Clear, kind errors, and a
  route to recover a lost link."
- Mention: "Guessing is rate-limited." *(Optional: Demo Panel → Force **Rate limited** → try again
  → calm countdown → untick.)*
- Type **`SAUD-3K7M`** → **Open my envelope** → the stamp press → **"Your envelope is yours."**
- "No account, no password. This private link *is* the key. They can email it to themselves
  (that's O6, your call) and come back any time, because codes never expire."
- **Start filling →**

### 2 · Filling the envelope (≈ 90 s) · priority #2
- **Portal home:** "Four stamps, four small worlds. Empty ones are dotted outlines."
- **Letter:** type two lines. "It already looks like the letter they'll receive: handwriting on
  stationery, not a text box." **Save** → "Sealed with care."
- **Photos:** add 2–3 photos from the phone → watch the postmark progress rings: "Real
  compression, in the browser, so it's fast on mobile data." Counter "3 / 15".
- **Voice:** show the big record button and live waveform (or play the note you recorded).
  "Three-minute limit with a countdown. If someone opens this inside Instagram, which blocks the
  microphone, we tell them exactly what to do." *(Optional: Force **In-app browser**.)*
- **Song:** paste `https://open.spotify.com/track/6dGnYIeXmHdcikdzNNDMm2` → the record appears with
  the cover. "Spotify or Apple Music, including short share links."
- Shortcut if time is tight: Demo Panel → **Load sample envelope** (Mira writing to Theo).

### 3 · Preview without spoiling it (≈ 30 s) · non-negotiable rule
- Portal → **Preview**. "Look at the frame: *this doesn't count as their first open.* You can
  replay the whole reveal as often as you like." **Replay reveal.**
- Switch to the admin tab → the unit is still **not opened**. "The real moment is protected."

### 4 · Seal & send (≈ 30 s) · proposed (O7)
- Portal → **Seal & send** → press and hold → the wax seal presses.
- "Until it's sealed, a curious friend who taps early just sees *'Your letter is still being
  written'*. Sealing arms the reveal. You can still add to it afterwards."
  *(Optional: Demo Panel → **Empty envelope** scenario to show that state.)*

### 5 · The first tap (≈ 60–90 s) · priority #3, the emotional core
- Demo Panel → **First tap** (simulates tapping the ceramic: a fresh page load on the NFC link).
- Let it breathe. Paper settles → the envelope rises → "Someone who misses you sent this." →
  **Tap to open** → the seal lifts, the flap opens, the letter rises, the stamps land one by one and
  get postmarked.
- "Nothing moves until they tap. Phones block sound without a gesture, and the tap makes it
  *their* moment. Only stamps with something inside appear."
- Open each world briefly: **Photos** (swipe, captions) · **Letter** (handwriting, any length) ·
  **Voice** (simple player) · **Song** (the record spins and the arm drops while it plays).

### 6 · Coming back (≈ 30 s) · priority #4
- Demo Panel → **Repeat visit**. "Every visit after the first opens calmly, straight to the
  envelope, no ceremony." Point at the small red **NEW** mark: "Mira changed the song since Theo last
  looked. The envelope keeps growing."

### 7 · Admin (≈ 60 s)
- Laptop, `/admin/dashboard`: "Every envelope from the factory run to the first tap."
- Search `SAUD-3K7M` → unit detail → the **timeline** shows claimed → sealed → opened, with the reveal
  recorded once. Point out **Email code** (Path B, the manual send for the first 300, with a preview),
  **Reset code** (keeps the envelope's contents), **Reset reveal**.
- **Batches** → **Generate 300** → preview → **Download CSV**: "This is the file for your NFC
  encoding run: one unique, random URL per ceramic, on *your* domain, never ours."

### 8 · Close (≈ 30 s)
- "Everything is tokenised: when your branding specialist delivers in December, new colours and
  fonts are a configuration change, and your stamp artwork drops into one file."
- Hand over to the questions: **`OPEN_QUESTIONS.md`**, starting with the ⏱ ones.

## Questions to settle in the meeting (in this order)
1. **O2 + AQ12** Domain on the chips (permanent), registrar, auto-renew. ⏱
2. **O3 + AQ2** Encoding run date; card printer + lead time. ⏱
3. **O9** Code length: settled, the agreed 4 characters (`SAUD-3K7M`).
4. **AQ1** Matching cards to ceramics at packing (unit number on card + base sticker). ⏱
5. **O7** Approve "Seal & send" and "still being written".
6. **O1** Where it's sold; checkout stays with the store; auto code emails later.
7. **O4** Stamp artwork date and format.
8. **O5, O6, O8, O10–O13, SQ1–SQ7, AQ3–AQ13**: quick yes/no on the recommended defaults.
9. **Cost correction:** ~$30–45/month at 300 units (not $10); ~$62–92 at 3,000.

## Not shown on purpose
Deferred by agreement, and deliberately not teased (D-014): video, drawing canvas, drag-to-reorder,
autosave, a custom animated audio player, automatic code emails at checkout, data export. Checkout
itself is open question O1. If asked: "Designed for, not built. It's in the architecture's
future-ready section."

## If something goes wrong
- Any odd state → Demo Panel → **Reset everything**, then the scenario button you need.
- A forced error left on → the DEMO badge shows a number; open the panel → **Clear all**.
- No sound → it's optional; the mute toggle is top-right on the recipient page.
- Spotify embed slow on venue Wi-Fi → it's the official player; the vinyl still shows the song.
