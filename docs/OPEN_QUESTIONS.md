# Open questions for the client

**Owner:** Product Manager · **Last updated:** 2026-10-08 · For the showcase meeting with Zeya Liu.

How to read this: every question has a **recommended default**. The prototype already uses that default
and labels it as an assumption, so nothing is blocked. A "yes" from Zeya confirms the default; a
different answer goes into `DECISIONS.md` and the revision log. Items marked ⏱ are on the **launch
critical path** (21 Nov 2026), because the ceramics are made before the software is finished.

## From the client guide (O1–O8)

| # | Question | Why it matters | Recommended default | In the prototype |
|---|---|---|---|---|
| **O1** | **Payment / checkout:** where is Saudade sold (Shopify, Stripe, other)? Is checkout part of this build, or handled by your store? | You listed it as non-negotiable, but it was never in our agreed scope. | Sell through your store (e.g. Shopify). We build a webhook for automatic code emails as a later phase. For the first 300, you email Path B codes from the admin panel. | Not built. Admin "Email code" covers Path B manually. |
| **O2** ⏱ | **Domain:** which domain goes on the chips? Is it registered in your name with long-term auto-renew? | Chip URLs are permanent once encoded. If the domain lapses, every envelope breaks. | A short custom domain in your name: renew 10 years ahead, registrar lock on, auto-renew on. Keep it to 41 characters or fewer so the NFC record stays small (see SQ5). | Placeholder `saudade.example` in `config/site.ts`. CSV generator uses it. |
| **O3** ⏱ | **Encoding run date:** when does the factory need the URL CSV? | It is the first hard dependency for the physical product. | We need the domain (O2) at least **5 working days** before that date to generate, verify, and test-encode a sample tag. | Batch generator + CSV download work today (admin → Batch). |
| **O4** | **Stamp artwork:** delivery date and formats? | It blocks the final look of the reveal page. | SVG preferred, otherwise transparent PNG at @2x and @3x, about 240×300 artboard per stamp, plus the heart stamp. | Original placeholder stamps marked "PLACEHOLDER — client artwork pending". Swap happens in one file. |
| **O5** | **Recipient access:** your form says recipients view "via their activation code". Please confirm recipients use the **NFC link** and the activation code is for the **sender only**. | Security: the code grants edit access, so a recipient must never need it. | Recipients only tap; the code stays with the sender. | Built this way. |
| **O6** | Should we ask for the sender's email when they claim, so they can recover their private link? | Without it, a lost link means a support request. | Yes, optional, with clear wording ("only used to send you this link"). | Asked on the claim-success screen. Recovery page works. |
| **O7** | Do you approve the proposed **"Seal & send"** step and the **"still being written"** state? | It protects the first-tap moment: if the friend taps before the sender is ready, they see a sealed envelope, and the reveal waits for them. | Yes to both. The reveal unlocks once the sender seals; they can keep editing afterwards. | Built. One switch (`requireSealBeforeReveal`) turns it off: if you prefer, a filled envelope reveals without sealing. |
| **O8** | A **fallback QR code** for phones without background NFC reading? | Older iPhones, and Android phones with NFC turned off. | Yes: a small QR on the code-free tap note in the box (see SQ1), pointing at the same `/t/{slug}` URL. | The help page mentions it; nothing else is built. |

## New questions from Phase 0 research and architecture

| # | Question | Why it matters | Recommended default | In the prototype |
|---|---|---|---|---|
| **O9** ⏱ | **Code length:** keep the agreed `SAUD-3K7M` (4 characters), or use `SAUD-3K7M-Q2XF` (8)? | 4 characters = ~923,000 possible codes. With 300 unclaimed units, 100 devices making 50 guesses a day would take over *some* stranger's envelope within a day about 80% of the time; at 3,000 units even one device succeeds within a month. Stricter rate limits would start locking out real buyers. 8 characters cuts a year-long attack on 3,000 units to under 1%. Must be decided **before cards are printed**. | 8 characters (`SAUD-3K7M-Q2XF`) for every production unit, including the launch batch. Cost: about 4 more characters to type. Analysis: `ARCHITECTURE.md` §3.3. | 4 characters, as agreed for the demo. `config/site.ts` → `codes.length` changes it. |
| **O10** | Do you approve **optional photo captions**, the letter's **"Dear ___" / sign-off fields**, and a **2,000-character letter limit**? | Small additions that make the stamps feel personal. The limit keeps letters readable on a phone. | Yes to all three. | Built and marked [PROPOSED]. |
| **O11** | Should a **"new" postmark** appear on stamps the sender has updated since the recipient's last visit? | "Codes never expire": senders add to it over time, and recipients should notice. | Yes, small and quiet. | Built. |
| **O12** | May the admin **reset the reveal** (so the next tap plays the opening again), e.g. after a support case or a regift? | Without it, a reveal spoiled by accident is lost for good. | Yes, admin-only, logged in the audit trail. | Built in admin unit detail. |
| **O13** | **Sound:** a subtle paper/seal sound during the reveal, after the recipient taps, with a mute button? | Adds tactility; some people dislike unexpected sound. | Yes, quiet, mute remembered on that phone. | Built (synthesised, no audio files). |
| **SQ1** | **Path B instructions:** with no code card in the box, how does the friend know to tap the heart? Can every box include a small "Tap the heart with your phone" note with **no code** on it (plus the QR from O8)? | The recipient may not realise the object is interactive. | Yes, a code-free note in every box. | n/a (print item). |
| **SQ2** | **Path B timing:** if the ceramic arrives before the sender has sealed it, is the "still being written" state acceptable, or should shipping wait until it's sealed? | Protects the first tap. | Accept "still being written"; the sender portal says so. | Built. |
| **SQ3** | **Apple Music vinyl:** Apple's player doesn't tell us when it's playing. Is a gently spinning record (not synced to playback) acceptable for Apple links? Spotify links sync properly. | Avoids licensing questions about playing Apple's preview in our own player. | Yes, unsynced spin for Apple, official embed only. | Built. |
| **SQ4** | **Song scope:** single songs only, or also albums, playlists, and podcasts? | The brief says "song", and the vinyl metaphor is one record. | Single songs only at launch; a friendly message for other links. | Built. |
| **SQ5** | **Domain length** (extends O2): keep the encoded domain at 41 characters or fewer, never a hosting-provider domain, auto-renewed for years. | The chip URL can never change. | As stated. | n/a |
| **SQ6** | Should the sender see that the envelope has been **opened** (status in their portal, no email)? | It's a lovely reciprocity moment. Notifications can come later. | Portal status only at launch. | Built ("Opened" status on the portal). |
| **SQ7** | May emails with the private link say to **open it in Safari or Chrome** for voice recording? | Email and social apps often block the microphone in their built-in browsers. | Yes, one plain line. | Built into the email copy. |
| **O14** | **Legal pages:** who supplies the Privacy Policy and Terms wording, and by when? | We style the pages; the words must come from you (lawyer or a service like Termly). | Text by 7 Nov 2026 so it ships with launch. | Styled templates with clearly marked placeholder text. |
| **O15** | **Admin users:** just you and the developer? Is two-factor sign-in acceptable? | Admin can see and remove content. | Two admin accounts, two-factor on (= AQ5). | Simulated login. |

## From the architecture review (AQ1–AQ13; details in `ARCHITECTURE.md` §18)

| # | Question | Why it matters | Recommended default |
|---|---|---|---|
| **AQ1** ⏱ | Who packs the boxes, and how is each **code card matched to its ceramic**? | A card in the wrong box means a sender's letter appears on a stranger's ceramic. | A unit number (e.g. `S-0042`) printed on the card **and** on a sticker under the ceramic; tap-check every box before sealing it. |
| **AQ2** ⏱ | Who prints the code cards, and what's their lead time? Can they print variable data from a spreadsheet? | The card print file and the chip URL file are produced at the same time. | Digital variable-data print; files delivered **22 Oct**. |
| **AQ3** | Which address should emails come from? | Deliverability and brand. | `letters@{your domain}` via Resend. |
| **AQ4** | A shared mailbox that owns all the service accounts? | Ownership survives staff changes. | `tech@{your domain}` with two-factor. |
| **AQ5** | Two-factor sign-in for the admin panel? | Admin can see, reset, and remove everything. | Yes, for both admins. |
| **AQ6** | An off-provider backup copy (Backblaze B2, about $0–1/month)? | Our storage provider (Cloudflare R2) has no built-in file versioning, so we keep versions ourselves plus a second copy elsewhere. | Yes. |
| **AQ7** | Where are most customers (US, EU, elsewhere)? | Decides where data is stored. | US East unless mostly EU. |
| **AQ8** | When the **sender** taps their own ceramic to test it, should the reveal play without using up the recipient's first open? | Senders will test before gifting. | Yes, with a small "only you see this; it won't count" note. |
| **AQ9** | Should "reset code" keep the envelope's contents and seal? | Support semantics. | Yes (prototype behaves this way). |
| **AQ10** | Keep removed photos/voice notes recoverable for 90 days, then delete? | Needed for the privacy policy wording. | 90 days. |
| **AQ11** ⏱ | At least 5 encoded sample ceramics in final glaze by **13 Nov**? | Real-device testing before launch. | Yes. |
| **AQ12** ⏱ | Domain registrar and term (extends O2)? | Chips are permanent. | Cloudflare Registrar, 10 years, auto-renew, registrar lock. |
| **AQ13** | Expected orders around Black Friday / December, and the share sent as gifts (Path B)? | Email plan and database sizing. | Upgrade the email plan for Nov–Dec if > 60 gift emails/day. |

## Correction to communicate: running costs

The client was told **~$10–60/month at 300 units**. The architecture review (prices checked
8 Oct 2026) puts it at **~$27–41/month**: hosting's free tier is non-commercial, so a $20/month plan is
the floor. At **3,000 units, ~$62–92/month** (up to ~$120 with every optional extra), within the
~$80–150 already communicated. **PM to restate the 300-unit range as ~$30–45/month** at the showcase.
Breakdown: `ARCHITECTURE.md` §12.
