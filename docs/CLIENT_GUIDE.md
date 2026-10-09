# SAUDADE — CLIENT GUIDE (Source of Truth)

> This document consolidates everything the client (Zeya Liu) has stated, approved, or deferred
> across the Fiverr thread, the stamp reference sheet, and the submitted requirements form.
> It is the **primary context** for every designer, developer, and architect on this project.
> If anything in any other document conflicts with this guide, **this guide wins**.
> Items marked **[OPEN]** are not yet confirmed by the client — do not assume an answer.
> Items marked **[PROPOSED]** are team recommendations the client has not explicitly approved.

---

## 1. Project Snapshot

| Item                   | Detail                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Client                 | Zeya Liu (founder, Saudade)                                                                                                           |
| Product                | Ceramic keepsake envelope with an embedded NFC chip + a companion web app                                                             |
| Our contract           | Fiverr custom offer, US$1,000, 2 revision rounds, 2 months post-launch support                                                        |
| Hard launch deadline   | **21 November 2026**                                                                                                                  |
| Initial production run | 300 units, expected to scale (planning reference: ~3,000 units)                                                                       |
| Final branding         | Being produced by a branding specialist; expected ~2 months from late Sept (≈ early December, i.e. **after launch**)                  |
| Stamp artwork          | **Supplied by the client** — four original illustrations designed to match the heart stamp on the ceramic envelope. Not yet received. |

---

## 2. What Saudade Is (in the client's framing)

- _Saudade_ is a Portuguese word for a deep, tender longing for someone or something absent. The product is for **people who miss someone far away — no occasion needed.**
- The physical object is a small **ceramic envelope**. Its NFC tap zone is shaped like a **heart stamp**.
- **The physical object is the "envelope"; the digital experience is the "letter" inside it.**
- Before sending, the giver loads it with content. The recipient taps the envelope with their phone to reveal a personal collection.
- **The code never expires**, so more content can be added over time. The piece doubles as a desk ornament rather than something thrown away.
- Problem it solves: texts and social media get buried and aren't tangible. Saudade gives people something physical to keep, with a digital layer they can keep adding to.

### The feeling it must create

- Like receiving a **real, thoughtful letter**: warm, nostalgic, personal.
- The recipient page is **"the emotional payoff of the whole product"** and must feel like **a genuine discovery, not a dashboard.**
- It is **not** "one app with a settings menu". It is **"four small, different worlds living on one page"**, each with its own visual identity, united by a vintage postal aesthetic.

---

## 3. Visual Direction (client-specified)

- **References:** vintage postcards, hand-stamped typography, warm and imperfect textures.
- **Explicitly NOT:** clean, corporate, or tech-forward.
- **Palette:** warm, sun-bleached tones — terracotta, cream, dusty blues, greens, pinks, reds.
- **Recipient page metaphor:** an envelope covered in different vintage postage stamps. Each stamp is a content type, visually distinct, and tapping a stamp opens what's inside it.
- **Agreed details:** paper textures, postmarks, perforated edges.
- **Stamp reference sheet (her 27 Sept attachment, received by the team 9 Oct):** an album page of real vintage
  postage stamps in mixed sizes and orientations, each pictorial with one strong engraving ink or soft lithographic
  colour, a country name and denomination, white perforated margins and the odd postmark, with a pink heart stamp
  at the centre. Reference for look and feel only; nothing from it may be used (DECISIONS D-076).
- **Stamp artwork:** the client provides finished artwork for all stamps. We build around it. Until it arrives, use clearly marked, original placeholder stamps.
- **Branding is not final.** All colours, fonts, and motifs must be swappable (design tokens), because a reskin will follow launch.

---

## 4. Users & Permissions

| User                    | Who                                   | Can do                                                                                                                 | Account?                                        |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Sender** (gift-giver) | Paying customer who bought the piece  | Claim a unit with an activation code; upload, edit, and remove content on units they claimed — before or after gifting | No account or password. Private tokenized link. |
| **Recipient**           | Person who receives the ceramic piece | View content only (no edit access) by tapping the NFC chip                                                             | No login, no app, no download                   |
| **Admin**               | Zeya (plus developer)                 | Track orders and codes, support customers, manage content                                                              | Secure admin login                              |

There are no internal staff roles beyond the admin.

---

## 5. Client's Launch Priorities (in her order)

1. **Activation code system** — "the core mechanic the whole product depends on — nothing else matters if this doesn't work." Codes never expire.
2. **Sender upload portal** — Photos, Letter, Voice, Song.
3. **First-tap reveal animation** — **non-negotiable**; "the emotional core of the product, not a nice-to-have." Sender previews must **not** count as the first open.
4. **Recipient reveal page** — the experience after the first tap.
5. **Payment gateway / checkout flow** — the client lists this as non-negotiable but says it was **never confirmed** with us. **[OPEN — see §11]**
6. **Data backup & durability** — daily DB backups, durable storage, file versioning. Non-negotiable given "codes never expire".

---

## 6. Core Flows

### 6.1 Activation codes & delivery paths

- Each unit gets a **unique activation code**. Agreed format example: `SAUD-3K7M` — human-friendly, case-insensitive, no ambiguous characters (0/O, 1/I/L), easy to read off a printed card.
- **Path A, shipped to the buyer (default):** a printed code card goes in the box. The buyer enters the code on the site to claim the unit and get their private upload link.
- **Path B, shipped directly to the buyer's friend:** the buyer receives the code **digitally by email**, and **no card goes in the box**, so the friend can't see or change content before it's ready.
- For the first 300 units, the admin sends Path B codes **manually from the admin panel**. Automatic emailing at checkout is a later phase.
- Protection against code guessing (rate limiting / brute-force protection).
- Clear messages for invalid or already-claimed codes.

### 6.2 Sender portal

- After claiming: a **private link** with no account or password.
- Return any time to **edit, add, or remove** content, before or after the gift is given.
- **Save button** to store changes (autosave is deferred).
- Mobile-first; the entire flow must be fully usable on a phone.

### 6.3 The four stamps (content types at launch)

| Stamp         | Content          | Agreed limits & behaviour                                                                                                                                                                                                                                                  |
| ------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Photos** | Photo gallery    | Up to **15 photos**, compressed automatically for fast mobile loading. Visual cue from the brief: a snapshot tucked into the page, with a worn postcard border or photo-album corner mounts.                                                                               |
| **2. Letter** | Written note     | Styled as **real handwriting on stationery / aged paper**, not a plain text box. Must look good whether short or long.                                                                                                                                                     |
| **3. Voice**  | Voice message    | **Record in the browser** or **upload an audio file**, up to **3 minutes**. Re-record or replace any time. Stamp motif idea: vintage radio, gramophone, or a sound wave used as a postmark. A clean simple player at launch (the custom animated player skin is deferred). |
| **4. Song**   | Music dedication | Sender pastes a **Spotify or Apple Music link**. The reveal page shows a **rotating vintage vinyl record** with the song playing through the **official Spotify / Apple Music embed**. The client accepted that logged-out listeners only hear a ~30-second preview.       |

Each stamp uses the client-supplied stamp artwork.

### 6.4 First-tap reveal (non-negotiable)

- On the recipient's **first** tap, the envelope opens and the **stamps appear one by one**.
- **After that**, the page opens calmly, straight to the envelope.
- **The sender's preview does not count as the first open**, so the recipient always gets the real moment.

### 6.5 Recipient reveal page

- Opens from the NFC tap with no login, app, or download.
- Envelope-style layout built around the stamp artwork; warm vintage postal look.
- Each stamp opens its content in a clean, simple view.
- Sender edits appear automatically.
- Fast on mobile data; must work reliably on **iPhone (Safari)** and **Android (Chrome)**.
- Built to stay live **for years**.

### 6.6 Admin panel

- Secure admin login.
- List of all units with status. Agreed statuses: **unassigned, claimed, filled**. [PROPOSED additions: `sealed`, `revealed`.]
- Search by code or email.
- Email codes manually for gift orders.
- Reset a lost or compromised code.
- View or remove content for support cases.

### 6.7 NFC & unit provisioning

- 300 unique, non-sequential, non-guessable identifiers generated in one batch.
- **CSV with the exact URL for every unit**, ready for the client's NFC encoding run.
- Compatible with standard NTAG213/215 chips.
- Each unit is tied to a unique identifier programmed into its chip, linking to its content page.

---

## 7. Privacy & Security (agreed)

- Long, random URLs with no pattern between units.
- Pages hidden from search engines.
- Photos and audio served through **signed/private links**, not a public folder.
- Accepted trade-off: if a recipient forwards their link, it works ("the cost of 'no login, just tap'").
- An optional PIN was offered and **not requested**. Not in scope.

## 8. Durability & Backups (agreed)

- Database (letters, codes, unit status) backed up automatically **every day**.
- Photos and voice recordings in durable cloud storage.
- **File versioning** enabled, so deleted or replaced media can be recovered.
- "Full data export" (a download button) is deferred. Backups are **not** deferred.

## 9. Technical Foundation (agreed)

- **Next.js** with a **PostgreSQL** database and secure object storage (S3-compatible + CDN).
- Hosted in **accounts the client owns** (Vercel or Render discussed).
- Full TypeScript; clean, commented, documented code; ready to grow beyond 300 units.
- Full source code and repository ownership transferred to the client.
- The client has no stack preference.

### Ongoing cost expectations already communicated to the client

- ~$10–60/month at 300 units; ~$80–150/month at ~3,000 units. Paid directly by the client to providers.

## 10. Scope Boundaries

### Deferred to a later phase (do NOT build for launch)

- Drawing canvas stamp
- Video
- Autosave and live preview _(note: a sender "preview" view of the reveal page is still required for §6.4 logic — keep it simple)_
- Drag-to-reorder photos
- Custom animated audio player skin around the stamp motif
- Automatic code emails at checkout
- Full data export / download button

### Legal pages

- We build and style a Privacy Policy and Terms of Service page. **The wording comes from the client** (lawyer or a service like Termly).

### Support

- 2 months of post-launch support (bug fixes; small tweaks handled at our discretion).
- After that: maintenance in 3-month blocks at $150 (hosting/backups/code updates, bug fixes, small tweaks). New features are quoted separately.

### Planned future work

- **Rebrand reskin** (~early December): new colours, fonts, possibly motifs. The client will ask her branding specialist for web-ready fonts and SVG motifs.

## 11. Open Questions — must be confirmed with the client, not assumed

| #   | Question                                                                                                                                                                     | Why                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| O1  | **Payment / checkout:** where does the product get sold (Shopify, Stripe, other)? Is checkout part of this build or handled by her store?                                    | She lists it as non-negotiable; it is not in our agreed scope. |
| O2  | **Domain:** which domain will be encoded on the chips? Is it registered in her name with long-term auto-renew?                                                               | URLs are permanent once encoded.                               |
| O3  | **Encoding run date:** when does the factory need the URL CSV?                                                                                                               | Critical path for the launch.                                  |
| O4  | **Stamp artwork delivery date and formats** (SVG or transparent PNG @2x/@3x)                                                                                                 | Blocks the final reveal page.                                  |
| O5  | **Recipient access wording:** her form says recipients view "via their activation code". Confirm that recipients use the **NFC URL** and the activation code is sender-only. | Security model.                                                |
| O6  | Should the sender's email be captured at claim time for link recovery?                                                                                                       | Prevents lost edit access.                                     |
| O7  | Approval of the proposed "Seal & send" step and empty-envelope state.                                                                                                        | Protects the first-tap moment.                                 |
| O8  | Fallback QR code for phones without background NFC reading?                                                                                                                  | Older iPhones and Android devices with NFC turned off.         |

## 12. Client Quotes to Design By

- "The physical object is the 'envelope' — the digital experience is the 'letter' inside it."
- "It needs to feel like a genuine discovery, not a dashboard."
- "Four small, different worlds living on one page."
- "Warm, nostalgic, personal."
- "Not clean/corporate/tech-forward."
- "That first-tap moment is kind of the whole emotional point of the product."
- "Nothing else matters if [the activation code system] doesn't work."
