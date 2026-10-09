# SAUDADE — RESEARCH (Phase 0)

| Item | Detail |
| --- | --- |
| Owner | UX Researcher |
| Status | Draft for Gate 0 |
| Date | 8 October 2026 (all web sources checked on this date) |
| Inputs | `CLIENT_GUIDE.md` (source of truth), `MASTER_BUILD_PROMPT.md` §4 |
| Feeds | `PRD.md`, `DIRECTIONS.md`, `MOTION_SPEC.md`, `ARCHITECTURE.md`, `OPEN_QUESTIONS.md`, `QA_CHECKLIST.md` |

**Verification labels used throughout**

- **[V] Verified**: read in a primary source (vendor docs, datasheet, release notes), or probed directly with a live HTTP request on 8 Oct 2026.
- **[P] Partly verified**: secondary source only (press coverage, community forum, third-party docs, search-result snippets).
- **[U] Not verified**: from team knowledge or inference. Treat as a hypothesis and confirm in device QA.

Where this document conflicts with `CLIENT_GUIDE.md`, the client guide wins. Anything that needs the client is
marked **Suggested new open question** and collected in §8.5.

---

## 1. Summary — findings that change what we design or build

1. **"Tap" really means two taps, on both platforms now.** iPhone XS and later show a banner on every new tag read, and the user has to tap it before the URL opens [V]. Android 16 sends http/https tags to `ACTION_VIEW` (the browser), and **Android 17 adds an "open link" notification that needs an explicit tap** [V]. All tap copy should say "hold your phone to the heart, then tap the notification". Our own "Tap to open" makes three taps in total, so the screen before it has to feel like part of the ceremony and not a hurdle.
2. **iOS will not read the tag at all in some common states.** This happens if the phone has not been unlocked since it restarted, the camera is open, Wallet/Apple Pay is in use, Airplane Mode is on, or another NFC session is running [V]. These go on `/help/tap` as a short troubleshooting list.
3. **NTAG213 has plenty of room.** It has 144 bytes of user memory [V]. With the `https://` prefix compressed to one byte (code `0x04`) [V] and 8 bytes of NDEF overhead, **136 bytes are left for `{domain}/t/{slug}`**. A 12-character slug uses `len(domain) + 23` bytes in total. Any sensible domain fits. Use one URI record only.
4. **Link previews come from users' own phones and pretend to be social crawlers.** Apple (iMessage, Mail, Notes, the share sheet) and Google Messages fetch from end-user devices. They send the `facebookexternalhit`/`Facebot`/`Twitterbot` tokens, so neither the IP address nor the user-agent can be trusted [P]. **A first open must never be recorded on GET.** Record it with a client-side POST after the human "Tap to open" and after the choreography finishes. Also serve neutral Open Graph tags, because the preview card itself can give the content away.
5. **Audio needs a user gesture everywhere.** An `AudioContext` created before a gesture starts `suspended` and must call `resume()` inside a gesture [V]. iOS needs a gesture for `play()` on media with sound [V]. Spotify warns that its iFrame API `play()` "might not be supported in all browsers" [V]. So the recipient always presses play on the song, and we never auto-start music.
6. **MediaRecorder formats now overlap, so we choose the order.** iOS Safari started with MP4/AAC only (default-on from iOS 14.3) [V]. **Safari 18.4 added WebM to MediaRecorder** [V], and Chrome 126+ can also record into MP4 [P]. `isTypeSupported` will return true for several types, so we list them in our preferred order, save the actual `recorder.mimeType`, and transcode to AAC/m4a on the server in Phase 3.
7. **Microphone access in in-app browsers is unreliable and hard to predict.** Reports cover LinkedIn, Instagram and Messenger on iOS [P]. We can detect most in-app browsers from user-agent tokens (`Instagram`, `FBAN`/`FBAV`/`FB_IAB`, `WAiOS`/`WA4A`, `musical_ly`/`Bytedance`, `LinkedInApp` …) [V]. The voice editor should spot this **before** the record button is tapped and offer "Open in Safari/Chrome" and "Upload a voice memo instead".
8. **Spotify oEmbed works directly from the browser.** It is CORS-enabled (`access-control-allow-origin: *`) and needs no key. It accepts `intl-xx` URLs, `?si=` URLs and `spotify:` URIs [V]. **It returns the title and artwork but no artist field** [V], so getting the artist needs a server call (Phase 3) or must be left out.
9. **Apple Music has no public playback events.** MusicKit needs a developer token (an ES256 JWT, valid for at most 6 months) [V], so the vinyl cannot follow the Apple embed's play state. `music.apple.com` pages send `X-Frame-Options: DENY`, so the URL has to be rewritten to `embed.music.apple.com` with the same path, keeping `?i=` [V]. The iTunes Lookup API is CORS-enabled and returns a 30-second `previewUrl` [V]. Using that file in our own player would need a licensing check, so this is a client question.
10. **Path B carries a hidden risk.** A friend can receive a ceramic with **no card and no instructions**, possibly before the sender has filled it. The "still being written" state and some kind of recipient-facing tap instruction (with no code on it) are essential. Suggested new open question.
11. **No competitor combines our three strengths.** TapKeeps does the work for the buyer (order form, then 3–5 business days) [P]. Yoto, Tonies and Lovebox need hardware and an app [V/P]. StoryWorth is email-driven over a year [P]. Saudade's edge is that the giver fills it themselves, the recipient needs no app, and the opening is a ceremony on an object that lasts. Every flow should protect that.
12. **Full-screen reveal on iOS: use `svh`, not `dvh`.** `dvh` resizes when the browser toolbars move and causes jank [V]. Add `overscroll-behavior: none` (supported in iOS Safari 16+) [P] and safe-area insets.

---

## 2. Competitor teardown

### 2.1 TapKeeps (Etsy NFC keepsakes) [P]

Source: TapKeeps Etsy shop listing as surfaced by search (https://www.etsy.com/shop/tapkeeps). The shop page itself was not fetched, so the details below come from listing text quoted in search results.

| Stage | Steps |
| --- | --- |
| Giver | Buys a listing on Etsy, then receives a link to a custom order form |
| Setup | On the order form, uploads up to **6 photos**, records a voice note, shares a song link and writes a message. **TapKeeps builds the private page and programs the keychain, "usually within 3–5 business days"**, then ships it |
| Recipient | "Tap your phone to the keychain and it opens instantly in your browser." Listed as working with iPhone XR and newer, and most Android phones made after 2019 |

- **Friction:** a person sits in the loop, so there is lead time and no live preview. We could not confirm whether givers can edit after the tag is programmed. Setup is a plain order form rather than a crafted experience.
- **Learn:** their content mix (photos, voice, song, message) is almost exactly our four stamps, which supports the client's choice. They put device compatibility on the listing itself.
- **Avoid:** making setup a done-for-you service. Saudade is self-serve, works the moment the code is claimed, and stays editable forever. That is the core difference and should show in the copy.

### 2.2 Bardstown Bourbon — "Bourbon Gifting Reimagined" (launched April 2026) [P]

Sources: https://thewhiskeywash.com/whiskey-news/bardstown-bourbon-launches-nfc-powered-gifting-program/ ;
https://www.businesswire.com/news/home/20260429141637/en/Bardstown-Bourbon-Company-Turns-Any-Bottle-into-a-Personalized-Gifting-Experience
(the press release returned HTTP 403, so we relied on secondary coverage).

| Stage | Steps |
| --- | --- |
| Giver | Picks up a free premium NFC sticker or medallion at retail, at events or at the distillery, or requests one by post via bardstownbourbon.com/gifting |
| Setup | Attaches it to **any bottle** and loads a custom message, photo or video. The platform is io.tt (connected packaging) and the label is by Eurostampa. **The exact loading flow (app or web, account or not, editable or not) is not described in any source we could reach.** |
| Recipient | Taps the medallion with a smartphone to "unlock" the content. No app is mentioned |

- **Friction (inferred, [U]):** the content's lifespan is tied to a brand campaign platform. A sticker can feel promotional.
- **Learn:** they put the tag in a premium **front** medallion rather than a back-label QR code. How the tag looks gives the object its status, which matches our heart-stamp tap zone. Press quote: "this platform lets consumers create something of their own."
- **Avoid:** anything that reads as marketing ("powered by", brand banners). Saudade's recipient page should show no platform branding at all.

### 2.3 Yoto — Make Your Own (MYO) cards [V]

Source: https://us.yotoplay.com/make-your-own

| Stage | Steps |
| --- | --- |
| Giver | Owns a Yoto Player or Mini (one blank card comes with every player; more can be bought) |
| Setup | Records in the app ("Record Audio") or uploads MP3/AAC/M4A at yotoplay.com/create. Builds a playlist with names and icons. Then: insert the card into the player, choose "Link To A Card" in the app, press LINK on the player, and wait for the record icon and green tick |
| Recipient | Puts the card in a Yoto Player. No account is needed to play; an account is needed to create |

- **Stated limits:** "100 tracks per card", "1 hour running time for any single track", "100MB maximum file size of any single track", "500MB maximum total file size". Cards can be re-linked and overwritten.
- **Friction:** both sides need the hardware. Linking needs the player in the room, which is hard for gifts sent far away.
- **Learn:** state numeric limits up front. Treat recording and uploading as equals. A clear "linked" confirmation (the green tick) is like our stamp-press on claim. One icon per track is a cousin of our stamp-per-content idea.
- **Avoid:** any hardware or app dependency on the recipient's side.

### 2.4 Tonies — Creative-Tonies (optional) [P]

Sources: https://tonies.com/pages/creative-tonies ; https://us.tonies.com/blogs/beyond-the-box/creative-tonies-101

| Stage | Steps |
| --- | --- |
| Giver | Buys a blank Creative-Tonie figure |
| Setup | Places it on a Toniebox to register it to the household (an audio prompt confirms it is ready). Records with the mic or uploads MP3/WAV in the mytonies app, **up to 90 minutes**. Can invite family to contribute |
| Recipient | Places the figure on a Toniebox |

- **Learn:** the audible "ready" confirmation. Letting others contribute is a possible future feature, out of scope now.
- **Avoid:** household-account models and a box that the recipient has to own.

### 2.5 Lovebox [P]

Sources: https://www.uncommongoods.com/blog/?p=64946 and retailer listings (e.g. https://bestbuy.ca/en-ca/product/the-pride-lovebox-heart-spinning-messenger/16163925). lovebox.love was not fetched.

| Stage | Steps |
| --- | --- |
| Giver | Buys the device |
| Setup | Plugs it in and connects it to Wi-Fi with a phone, then downloads the app. The box shows a **secret code** that pairs senders (no limit on how many). The sender sends text, photos, drawings or animations from the app |
| Recipient | **The heart spins when a message arrives.** They open the lid to see it on the screen. Spinning the heart back sends a "rain of hearts" to the sender's phone |

- **Friction:** Wi-Fi setup, an app for the sender, and a screen device that will age.
- **Learn:** a **physical signal that something is waiting** builds anticipation, and closing the loop with the sender feels good. Their pairing code works much like our activation code.
- **Avoid:** turning the recipient's object into a gadget that needs power, setup or updates. Ours is ceramic and inert, and that is its strength.

### 2.6 StoryWorth [P]

Sources: https://welcome.storyworth.com/?nav=true ; https://welcome.storyworth.com/gb/faq

| Stage | Steps |
| --- | --- |
| Giver | Buys a gift subscription and **chooses the date the gift email is sent** (it arrives early that morning) |
| Setup | Chooses, edits or writes the questions |
| Recipient (storyteller) | Gets a weekly prompt by email or text. Answers by replying to the email, on the web, or by asking for a phone call to record their voice. Answers are emailed to readers. After a year, the stories are bound into a book |

- **Friction:** a long time before anything comes back, and inbox fatigue.
- **Learn:** a **scheduled gift email** (a model for Path B: today the admin sends it by hand, later it could be scheduled). Replying straight from the email is very low effort. The digital work ends in a physical keepsake.
- **Avoid:** making the experience depend on email cadence. Saudade's content lives at the tap.

### 2.7 VidDay (optional) [P]

Sources: https://www.vidday.com/post/the-easy-way-to-make-a-collaborative-greeting-video-for-birthdays ; https://vidday.com/post/why-vidday

| Stage | Steps |
| --- | --- |
| Giver (organiser) | Creates an event and shares an invite link by text, email, Messenger or WhatsApp (template copy provided) |
| Setup | Contributors add clips, photos and text cards from the link (web app, no download). The organiser picks a theme and music, previews, and **pays only at the end** |
| Recipient | Receives the compiled montage |

- **Learn:** a web app with no download, preview before committing, and invite templates.
- **Avoid:** crowd-sourcing and compilation. Saudade is one voice, one envelope.

Paperless Post is treated as an inspiration reference in §3, not as a competitor.

### 2.8 Comparison

| Product | Physical object | Giver needs | Recipient needs | Content | Editable after gifting | Opening ceremony | Time to ready |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Saudade** | Ceramic envelope (NFC) | Code + browser, no account | NFC phone + browser | Photos (15), letter, voice (3 min), song | Yes, forever | First-tap reveal, then calm | Immediate |
| TapKeeps | Keychain (NFC) | Etsy order + form | NFC phone + browser | ≤6 photos, voice, song, message | Not confirmed | Not observed | 3–5 business days |
| Bardstown | Medallion sticker on a bottle | Sticker + io.tt flow (details unverified) | NFC phone | Message, photo, video | Unverified | Unverified | Unverified |
| Yoto MYO | Card | Account + app/web + player | Yoto player | Audio (100 tracks) | Yes (overwrite) | None, it just plays | Immediate |
| Creative-Tonie | Figure | App + Toniebox | Toniebox | Audio (90 min) | Yes | Figure on box | Immediate |
| Lovebox | Wi-Fi box with screen | App | Powered device on Wi-Fi | Text, photos, drawings | Not applicable (messages stream in) | Spinning heart + lid | Immediate |
| StoryWorth | Printed book (end of year) | Account | Email | Written/voice stories | Yes | Book delivery | About 1 year |
| VidDay | None | Web | Link | Group video | Until finalised | Video playback | Days |

---

## 3. Inspiration study (pattern-level, internal only)

> These are pattern notes. **We never copy layouts, art or copy.** They come from team familiarity and were
> not re-crawled site by site in this round. Screenshots for the internal board (§4.1 task 2) still need capturing,
> and each note should be checked against them.

| Group | Site | What to learn | What to avoid |
| --- | --- | --- | --- |
| Reveal & envelope ceremony | paperlesspost.com | Envelope-then-card sequence; the liner as a reward moment; pacing between beats | Long intros that you can't skip or that start before a tap |
| | greenvelope.com | Liner, stamp and seal treated as one system of parts | Wedding-template formality |
| | jacquielawson.com | Hand-drawn warmth; animation that tells a small story | Long, slow, music-on-load e-card feel |
| | punchbowl.com | A clear call to action after the envelope opens | Ads and upsells at the moment of reveal |
| | partiful.com | Confident, playful copy; a fast path to the content | Loud, trend-driven styling that will date |
| Stamps & postal language | slowly.app | Letters "travel" (delay as ritual); collecting stamps | Gamification and streaks |
| | postcrossing.com | Postcard IDs and the "registered on arrival" ritual; real postal vocabulary | A dense, community-forum UI |
| | postalmuseum.org | Real cancellation-mark anatomy (ring, date, place) as a grammar for our `<Postmark>` | Copying historic stamps or marks (golden rule 5) |
| Direct competitors | tapkeeps, bardstown, yoto, tonies, lovebox | See §2 | See §2 |
| Giver → recipient journeys | storyworth.com | Scheduled gift email; low-effort replies | A year-long wait for value |
| | remento.co | Voice-first prompts turned into a keepsake | Turning speech into polished text (we keep the raw voice) |
| | vidday.com | Preview before commit; invite templates | Many contributors, montage aesthetic |
| | tribute.co | Group-gift tone of voice | The "corporate card" feel |
| | auraframes.com | **Filling the gift before giving it**; opening a gift that is already full | Wi-Fi/app setup for the recipient |
| | skylightframe.com | Emailing content to an object | A device dashboard |
| Letters & handwriting | feltapp.com | Handwriting-style type looking natural on stationery | Script fonts that are hard to read |
| | futureme.org | A plain, sincere tone about the letter itself | A sparse, utilitarian interface |
| | letterloop.co | Gentle prompts that help someone start writing | A newsletter structure |
| | postable.com | Card-first preview of what the recipient will see | E-commerce clutter |
| Voice as an object | skinmotion.com | A sound wave as a visual, keepable mark (our voice postmark idea) | Biometric or technical framing |
| | hereafter.ai | A voice archive presented warmly, with clear playback | The "AI" and grief-tech tone |
| Song / vinyl | vinylmeplease.com | Record colour, label and sleeve as object design | Collector jargon and a shop feel |
| Aesthetic & craft benchmark | riflepaperco.com, papier.com, minted.com, sugarpaper.com, smockpaper.com | Paper colour, margins, letterpress depth, restraint | Floral overload; wedding-stationery clichés |
| | artifactuprising.com, milkbooks.com | Photo-mount and album craft; generous whitespace | Product-configurator UI |
| | polaroid.com | The snapshot frame as a recognisable object | Brand marks or the classic frame copied exactly |
| Interaction galleries | awwwards.com, godly.website | Paper physics, texture, type pairing | Heavy WebGL that breaks the 150 KB / 60 fps budget |
| | mobbin.com | Real redeem-code, upload and audio-recording flows (error states especially) | Generic SaaS patterns |
| | lottiefiles.com | Envelope-open timing references | Using stock Lottie art |

---

## 4. Platform constraints (verified, with sources)

### 4.1 iPhone background NFC reading

| Fact | Source | Implication for Saudade |
| --- | --- | --- |
| "iPhone XS and later support background tag reading." [V] Third parties also list the XR [P]. iPhone 7–X can only scan from an app, started manually [P] | https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading ; https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag213.html | Older iPhones need the QR fallback (O8). The help page should name the supported models in plain words |
| The system reads tags "only when the user's iPhone is in use" [V] | Apple (as above) | The screen must be awake. Copy: "Wake your phone first" |
| Not available when: the device has never been unlocked (since restart), a Core NFC session is running, Apple Pay Wallet is in use, the camera is in use, or Airplane Mode is on [V] | Apple (as above) | A troubleshooting list on `/help/tap`: close the camera, turn off Airplane Mode, unlock once after restarting |
| "The system displays a pop-up notification each time it reads a new tag. After the user taps the notification…" If locked, "the system prompts the user to unlock the phone" [V] | Apple (as above) | "Instant" means one tap on a banner. Every tap instruction (insert card, help page, empty state) has to say this |
| Looks for a well-known-type `"U"` URI record. **"If the NDEF message contains more than one URI record, the system uses the first one."** HTTP/HTTPS supported; custom URL schemes are not [V] | Apple (as above) | Encode one HTTPS URI record and nothing else |
| With no app linked to the URL, "the system opens the link in Safari" [V]. One user report (Feb 2026, iPhone 14 Pro) says that with Brave as the default browser, the banner read "Open Brave" and Brave opened without loading the link [P] | Apple (as above); https://community.brave.app/t/brave-ios-nfc-tag-support/649010 | The default browser may get the URL. QA should test iOS with Chrome as default. Help page: "If a blank browser opens, try again with Safari as your default, or scan the QR" |
| Where the NFC antenna sits (top edge on iPhone) [U] | Not verified this round | The illustration on `/help/tap` should show the top of the phone touching the heart. Confirm on devices |

### 4.2 Android NFC

| Fact | Source | Implication |
| --- | --- | --- |
| "Android-powered devices are usually looking for NFC tags when the screen is unlocked, unless NFC is disabled in the device's Settings menu." [V] | https://developer.android.com/develop/connectivity/nfc/nfc | Help copy: "NFC on, phone unlocked." NFC is off by default on some devices [U]; give the usual Settings path, but expect it to vary by maker |
| From Android 16, tags with `http://`/`https://` links trigger `ACTION_VIEW` instead of `ACTION_NDEF_DISCOVERED` [V] | Same | The URL goes to the default browser (or a verified link handler) |
| **From Android 17, scanning such a tag "surfaces an 'open link' notification, requiring explicit user interaction"** [V] | Same | Android now behaves like iOS. One tap-copy pattern fits both platforms |
| Custom Tab or full browser tab? Nothing documented found. `ACTION_VIEW` normally opens a normal tab in the default browser [U] | Not verified | QA: Chrome, Samsung Internet, and Firefox as default |
| Antenna position varies (often the middle of the back) [U] | Not verified | Help illustration: "slowly move the back of your phone over the heart" |

### 4.3 NTAG213 / NTAG215 capacity and URL budget

| Fact | Source |
| --- | --- |
| User memory: **NTAG213 144 bytes, NTAG215 504 bytes, NTAG216 888 bytes** (total EEPROM 180/540/924) [V] | NXP datasheet NTAG213/215/216: https://www.nxp.com/docs/en/data-sheet/NTAG213_215_216.pdf |
| Data retention 10 years, write endurance 100,000 cycles, field-programmable permanent read-only locking, optional password protection [V] | NXP datasheet |
| Optional ASCII mirrors: UID 14 bytes, NFC read counter 6 bytes, both together 21 bytes [V] | NXP datasheet, Table 12 |
| URI identifier codes: `0x01` = `http://www.`, `0x02` = `https://www.`, `0x03` = `http://`, **`0x04` = `https://`** [V] | https://docs.nordicsemi.com/r/bundle/nrf5_sdk_v17.1.0/page/group_nfc_uri_rec.html (per NFC Forum RTD-URI) |
| Rule of thumb: about 130 characters of URL fit on NTAG213 [P] | https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag213.html |

**Byte budget for `https://{domain}/t/{slug}` with a 12-character slug** (one short NDEF record):

| Part | Bytes |
| --- | --- |
| NDEF message TLV: tag `0x03` + 1 length byte | 2 |
| Record header `0xD1` (MB, ME, SR, TNF = well-known) | 1 |
| Type length + payload length | 2 |
| Type `"U"` | 1 |
| URI identifier code `0x04` (`https://`) | 1 |
| `{domain}` + `/t/` (3) + slug (12) | len(domain) + 15 |
| Terminator TLV `0xFE` | 1 |
| **Total** | **len(domain) + 23** |

- **Hard ceiling:** 144 − 8 = **136 bytes after `https://`**, so the domain could in theory be up to **121 characters**.
- **"Comfortable" target:** keep the whole NDEF message **≤ 64 bytes, i.e. the domain at most 41 characters**. That leaves 80 or more bytes spare, enough for a future UID+counter mirror (21 bytes) and a query key, with no reprint risk. Examples: `saudade.gift` → 35 bytes; `keepsaudade.com` → 38 bytes; `www.` domains should use code `0x02` so the `www.` costs nothing.
- **Entropy:** 12 base32 characters = 60 bits. That is fine for a non-guessable slug as long as `/t/*` is rate-limited.
- **Implications:** NTAG213 is enough, and NTAG215 adds nothing for this use. Lock tags permanently after encoding [V: locking supported]. Locking does not limit reads; the 100k figure is for writes. The URL can never change, so **domain renewal is a decades-long commitment** (extends O2).

### 4.4 Autoplay and Web Audio

| Fact | Source | Implication |
| --- | --- | --- |
| Chrome: "Muted autoplay is always allowed". Autoplay with sound needs a user interaction, a high Media Engagement Index score, or an installed PWA. Cross-origin iframes need delegation via permissions policy (`allow="autoplay"`) [V] | https://developer.chrome.com/blog/autoplay | The reveal starts silent. Any sound plays only after "Tap to open" |
| An `AudioContext` created before user interaction starts `suspended`. **Call `resume()` after a user gesture**, or create it only after interaction. Check the Promise returned by `.play()`, and never show a pause button when playback has not started [V] | Same | In the "Tap to open" handler, create/`resume()` the context and prime any `<audio>` **synchronously**. The UI follows real playback state |
| iOS (WebKit): `play()` needs a user gesture if the media has audio. Muted `<video>` may autoplay. `playsinline` for inline video [V] (2016 policy, still the baseline) | https://webkit.org/blog/6784/new-video-policies-for-ios/ | The voice player and the optional seal sound only start from a tap |
| Spotify iFrame API: `play()` "might not be supported in all browsers" because of autoplay policies [V] | https://developer.spotify.com/documentation/embeds/references/iframe-api | Never call `play()` on load. The recipient presses play in the embed, or we call `controller.play()` only inside a tap handler and fall back gracefully |
| The iOS hardware silent switch may mute Web Audio but not `<audio>` [U] | Not verified | The optional seal sound must never carry meaning. QA with silent mode on |

### 4.5 MediaRecorder (voice stamp)

| Fact | Source | Implication |
| --- | --- | --- |
| WebKit enabled MediaRecorder by default in Safari TP 105 and the iOS 14.3 beta. It records **MP4 with AAC** (and H.264 video). The post recommends `MediaRecorder.isTypeSupported` and reading `recorder.mimeType` [V] (23 Nov 2020) | https://webkit.org/blog/11353/mediarecorder-api/ | Treat iOS 14.3+ as the floor [P]; current iOS is far beyond it |
| **Safari 18.4 (31 Mar 2025): "Added WebM support to MediaRecorder"**, plus Ogg Opus/Vorbis playback on iOS 18.4 [V] | https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes.md | Safari 18.4+ may report true for `audio/webm;codecs=opus`. **Rank `audio/mp4` first** so iPhones keep producing AAC |
| Chrome records WebM/Opus. **Chrome 126 (June 2024) added the MP4 container** (Opus/PCM audio) [P] | https://addpipe.com/media-recorder-api-demo/ (via search summary) ; https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static | A plain `audio/mp4` on Chrome may mean Opus-in-MP4, and we have not verified that plays everywhere. Prefer an explicit codec string |
| Firefox: `isTypeSupported('audio/ogg;codecs=opus')` is true. `isTypeSupported` has been available in all browsers since about April 2021 [P] | MDN (as above) | Keep Ogg as a fallback |

**Recommended strategy (prototype and production):**

```ts
// Order = our preference, not the browser's. Save recorder.mimeType with the blob.
const AUDIO_MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2', // AAC: Safari; plays on every target
  'audio/webm;codecs=opus',     // Chrome / Android, Firefox, Safari 18.4+
  'audio/ogg;codecs=opus',      // Firefox
  'audio/mp4',                  // last resort (may be Opus-in-MP4 on Chrome 126+)
];
const mimeType = AUDIO_MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported?.(t)) ?? '';
```

- **Phase 2:** keep the blob and its real mime type in IndexedDB. If a demo crosses devices, test playback of a Chrome WebM recording on an iPhone running iOS older than 18.4 (expected to fail) [U].
- **Phase 3:** transcode everything to AAC/m4a on the server (already in `ARCHITECTURE.md` scope). Recipients should only ever be served m4a.
- **3:00 cap:** run our own timer and call `stop()` at 180 s. Show the countdown from 2:30.

### 4.6 In-app browsers (sender portal: voice recording)

**User-agent tokens** (regexes from the open-source `inapp-spy` library, `src/regexAppName.ts`) [V]:
https://raw.githubusercontent.com/shalanah/inapp-spy/main/src/regexAppName.ts

| App | Token / regex |
| --- | --- |
| Instagram | `/\bInstagram/i` |
| Facebook | `/\bFB[\w_]+\/\|\bFacebook/i` (matches `FBAN/`, `FBAV/`, `FB_IAB/`) |
| Messenger | `FB…/Messenger`, or `FB_IAB`/`FBAN` in the messenger rule |
| Threads | `/\bBarcelona/i` |
| WhatsApp | `/\b(WAiOS\|WA4A)\//i` |
| TikTok | `/musical_ly\|Bytedance/i` |
| LinkedIn | `/LinkedInApp/i` |
| Snapchat | `/Snapchat/i` |
| X / Twitter | `/\bTwitter/i` |
| Line | `/\bLine\//i` |
| WeChat | `/\bMicroMessenger\//i` |
| Google Search App | `/GSA/i` |
| Telegram | No UA token; client-side detection only |
| **Gmail** | **Not covered. We could not verify a Gmail in-app-browser UA token** [U] |

The library notes that detecting `SFSafariViewController` is experimental and "may return false positives". Source: https://github.com/shalanah/inapp-spy

| Fact | Source | Implication |
| --- | --- | --- |
| LinkedIn's iOS in-app browser (iOS 15.1+): `getUserMedia({audio:true})` fails with "The request is not allowed by the user agent…", while video-only works. No Apple response (2022) [P] | https://developer.apple.com/forums/thread/699479 | Expect mic failures in in-app browsers even when the camera works |
| Developers report Messenger and Instagram in-app browsers don't prompt for or allow the microphone [P] | https://forum.bubble.io/t/defeated-w-microphone-access-inappbrowser-fb-messenger-instagram-limits-access/104984 | Same |
| **Current (2026) behaviour per app and OS could not be verified** [U] | — | QA matrix: Instagram, WhatsApp, Gmail, Facebook on both platforms |
| On iOS, `x-safari-https://…` reportedly opens Safari (iOS 15, 17, 18; not 16). Instagram also has a "⋯ → Open in external browser" menu [P] | https://christiantietze.de/posts/2023/05/safari-for-mac-url-scheme/ ; https://link.boo/guides/open-instagram-link-in-safari | Offer a "Open in Safari" button that uses the scheme, with a copy-link fallback |
| On Android, an `intent://…#Intent;scheme=https;package=com.android.chrome;end` URL can hand off to Chrome [U] | Not verified this round | Offer "Open in Chrome" on Android with a copy-link fallback |

**Recommended UX (voice editor):**

1. On load, detect an in-app browser. If found, show a calm inline card **before** the record button: "Recording works best in Safari" (or Chrome), with a button to open it, "Copy link", and a one-line hint for that app ("Tap ⋯ then Open in browser").
2. Always keep **"Upload a voice memo instead"** visible. A file input with `accept="audio/*"` [U] still works where the mic does not.
3. Still let the user try. Catch `NotAllowedError` and `NotFoundError` and show the "mic denied" state with steps for that platform.
4. The emails that carry the private link (Path B, "Email it to me", `/recover`) are the main way senders end up in an in-app browser (e.g. the Gmail app) [U]. Add a short line in those emails: "For voice recording, open this in Safari or Chrome."

### 4.7 Spotify

**iFrame API** [V]: https://developer.spotify.com/documentation/embeds/references/iframe-api ;
https://developer.spotify.com/documentation/embeds/tutorials/using-the-iframe-api

| Item | Detail |
| --- | --- |
| Script | `<script src="https://open.spotify.com/embed/iframe-api/v1" async></script>`. A probe returned `200 text/javascript` [V] |
| Ready hook | `window.onSpotifyIframeApiReady = (IFrameAPI) => { … }` |
| Create | `IFrameAPI.createController(element, options, callback)`. Options: `uri` (e.g. `spotify:track:…`), `url` (wins over `uri`), `width`, `height` |
| Methods | `loadEntity(uriOrUrl, preferVideo, startAt)`, `loadUri(uri)` (legacy), `play()`, `pause()`, `resume()`, `togglePlay()`, `restart()`, `seek(seconds)`, `destroy()`, `addListener(event, cb)` |
| Events | `ready` (the embed can stream); `playback_started` → `playingURI`; **`playback_update` → `playingURI`, `isPaused`, `isBuffering`, `duration` (ms), `position` (ms)**. In Spotify's examples the payload sits under `e.data` [P] |

- **Vinyl sync:** spin when `!isPaused && !isBuffering`; ease to a stop on pause; drop the tonearm on the first `playback_started`; use `position/duration` for a subtle groove progress. **Never spin on click alone.**
- **Preview length:** logged-out listeners hear about 30 seconds and are then asked to log in. Logged-in users can get full playback; community reports tie this to desktop and Premium [P]. https://community.spotify.com/t5/Spotify-for-Developers/30-second-preview-showing-when-try-to-embed-playlist/m-p/5655484/highlight/true . On iPhone Safari, cookie partitioning will probably keep most recipients on the preview even if they use Spotify [U]. Keep the client-approved note and add an **"Open in Spotify"** link (`https://open.spotify.com/track/{id}`).
- WebKit fixed "the Spotify media player disappearing when rotating to landscape mode on iOS" in Safari 18.4 [V] (release notes above). Test landscape on older iOS.

**oEmbed** [V, probed 8 Oct 2026]: `GET https://open.spotify.com/oembed?url={encoded}`. Docs: https://developer.spotify.com/documentation/embeds/reference/oembed

- The response includes **`access-control-allow-origin: *`**, so it can be fetched from the browser without a key.
- Fields: `html` (iframe), `iframe_url`, `width`, `height`, `version`, `provider_name`, `provider_url`, `type: "rich"`, `title`, `thumbnail_url`, `thumbnail_width`, `thumbnail_height`.
- **There is no artist field. `title` is only the track name** (e.g. "Never Gonna Give You Up").
- Accepted in the probe: `open.spotify.com/intl-pt/track/{id}?si=…`, `spotify:track:{id}`, album and playlist URLs (all `200`).
- Iframe `allow` returned: `autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture`. CSP needs `frame-src https://open.spotify.com` and `script-src https://open.spotify.com`.
- Getting the artist needs the Spotify Web API with an access token, on the server [U, not fetched]. In Phase 2, show title and artwork only, and do not fake an artist.

**URL shapes to parse** (IDs observed as 22-character base62 [U]):

| Input | Normalise to |
| --- | --- |
| `https://open.spotify.com/track/{id}` (+ `?si=…`, `?utm_…`) | `spotify:track:{id}` |
| `https://open.spotify.com/intl-{xx}/track/{id}` | `spotify:track:{id}` |
| `https://open.spotify.com/embed/track/{id}` | `spotify:track:{id}` |
| `spotify:track:{id}` | as is |
| `album/`, `playlist/`, `episode/`, `show/`, `artist/` | Same pattern. **Recommend accepting `track` only at launch** (see §8.5) |
| `https://spotify.link/{code}`, `https://spoti.fi/{code}`, `link.tospotify.com/…` | Resolve on the server (below) |

**Short links** [P]: community reports say `spotify.link` is not a plain 301/302 (it may redirect in JavaScript). Two options: follow redirects with a HEAD/GET, or read `<meta property="og:url" content="https://open.spotify.com/track/…">` from the page the link lands on. Fetching it from the browser is blocked by CORS. Sources: https://community.spotify.com/t5/Spotify-for-Developers/How-to-see-through-shortened-https-spotify-link-links/m-p/5643368/highlight/true ;
https://community.spotify.com/t5/Spotify-for-Developers/Resolve-link-tospotify-com-to-ID/td-p/5051151
→ Build a Next.js route handler `/api/resolve-song` with a host allowlist, a 3-second timeout, a redirect cap, and an `og:url` fallback. **We did not test a real `spotify.link` in this round.**

### 4.8 Apple Music

| Fact | Source | Implication |
| --- | --- | --- |
| The embed host is `embed.music.apple.com` with the same storefront and path as `music.apple.com`, keeping `?i=`. Both `…/us/album/love-me-do/1440833098?i=1440833334` and `…/us/song/love-me-do/1440833334` returned `200` on the embed host [V probe] | https://allthings.how/how-to-embed-apple-music-playlists-albums-and-songs-on-a-webpage/ ; live probe | The parser rewrites the host and keeps the path and `?i=` |
| **`music.apple.com` sends `x-frame-options: DENY`** [V probe] | Live probe | Never put the share URL in an iframe directly |
| Apple's embed code uses `allow="autoplay *; encrypted-media *;"` and `sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"`, height 450 for albums and playlists [P]. Single-song height (about 175) [U] | allthings.how (as above) | Use the same attributes. CSP `frame-src https://embed.music.apple.com` |
| Non-subscribers hear about 30-second previews; signed-in subscribers get full playback [P] | https://microlink.io/tools/embed-url/apple-music | Same "30-second preview" note as for Spotify |
| **No public JS playback-event API for the embed found** [U]. MusicKit on the web and the Apple Music API need a **developer token: an ES256 JWT signed with a MusicKit private key, with Team ID `iss`, `exp` ≤ 15,777,000 s (6 months), optional `origin` claim** [V] | https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens | The vinyl cannot follow Apple playback. Avoid a key-rotation dependency for a page that must live for years |
| **iTunes Lookup** `https://itunes.apple.com/lookup?id={trackId}` returns `access-control-allow-origin: *` (content-type `text/javascript`). Fields include `trackName`, `artistName`, `collectionName`, `trackTimeMillis`, **`previewUrl`** (30-second `.m4a`), `trackViewUrl`, `artworkUrl100` [V probe] | Live probe | Fill the preview card (title, artist, artwork) without a key. Using `previewUrl` in our own `<audio>` would allow true vinyl sync but needs a licence and terms check → open question |

**URL shapes:** `music.apple.com/{cc}/album/{slug}/{albumId}?i={trackId}` (song inside an album; `trackViewUrl` adds `&uo=4`),
`music.apple.com/{cc}/song/{slug}/{songId}`, `music.apple.com/{cc}/album/{slug}/{albumId}` (whole album), and
`music.apple.com/{cc}/playlist/{slug}/pl.{id}`. Pass `country={cc}` to Lookup so the storefront matches [U].
**`apple.co/…` short links:** redirect behaviour not verified [U]. Resolve them with the same server route as Spotify short links.

**Apple vinyl behaviour (recommendation):** when the Song stamp opens, the record sits on the platter with the tonearm resting. A gentle "needle drop" plays as the sheet opens, then a slow ambient spin starts that never claims to be in sync. The client guide already says "spins on play for Apple". Because we cannot detect play inside a cross-origin iframe, "on play" has to mean "on open", and this needs PM sign-off.

### 4.9 Link-preview bots and first-open detection

| Platform | UA token(s) | Where the fetch comes from | Source |
| --- | --- | --- | --- |
| iMessage, Mail, Notes, share sheet (Apple) | Frozen Safari 9.0.1 UA + `facebookexternalhit/1.1 Facebot Twitterbot/1.0` | **End-user devices** (consumer ISP or iCloud Private Relay), when sharing **or receiving** | https://docs.centinelanalytica.com/crawlers/apple-link-preview [P] |
| Google Messages | `GoogleMessages` build token + `facebookexternalhit`, `Facebot`, `Twitterbot` | The user's Android device | https://docs.centinelanalytica.com/crawlers/google-messages-link-preview [P] |
| WhatsApp | `WhatsApp/2.x` ("easy to imitate") | Not stated | https://botcrawl.com/bots/whatsapp/ [P] |
| Facebook, Instagram, Messenger | `facebookexternalhit`, `Facebot` | Meta servers | https://www.temso.ai/bots/meta/facebookexternalhit [P] |
| Slack | `Slackbot-LinkExpanding` | Slack servers | https://botcrawl.com/bots/slackbot-linkexpanding [P] |
| Telegram | `TelegramBot (like TwitterBot)` | Telegram servers | Search summary only [P] |
| Discord | `Discordbot` | Discord servers | Search summary only [P] |
| X / Twitter | `Twitterbot` | X servers | Search summary only [P] |

**Implications (engineering contract):**

1. `GET /t/[slug]` has **no side effects**. It only reads state.
2. The reveal is recorded by a **client `POST /api/reveal`** that is sent **only after** (a) the human "Tap to open" gesture and (b) the choreography's `onComplete` (or Skip). Bots don't tap, so they can never trigger it.
3. A user-agent denylist is a **backstop for logs and analytics only**. It is not the guard.
4. Requests with a sender token (cookie or header) never record a reveal. The sender preview lives on its own route (`/s/[token]/preview`).
5. **Neutral Open Graph tags** on `/t/*`: a generic title such as "A letter is waiting for you", a generic image, and no names, photos or song. Add `X-Robots-Tag: noindex, nofollow` and `<meta name="robots" content="noindex">`.
6. If the POST fails (offline), mark it locally in `localStorage` and retry, so the same phone doesn't replay the reveal. The server still decides for other devices.

### 4.10 Reduced motion

| Fact | Source | Implication |
| --- | --- | --- |
| `prefers-reduced-motion: reduce` is set by **iOS: Settings > Accessibility > Motion > Reduce Motion**; **Android 9+: Settings > Accessibility > Remove animations**; plus macOS and Windows equivalents [V] | https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion | Every animation needs an alternative. The reveal becomes a crossfade with stamps fading in place (as in the master prompt) |
| Motion (Framer Motion) offers a reduced-motion hook and config [U, not fetched] | — | Use one source of truth (OS setting OR the Demo Panel toggle) wired into Motion's config |

### 4.11 iOS Safari quirks for a full-screen reveal

| Fact | Source | Implication |
| --- | --- | --- |
| `svh` = viewport with UI bars expanded; `lvh` = bars retracted; `dvh` changes with them. **`dvh` can cause layout shifts; prefer `svh` for full-height components.** Supported in Safari 15.4+, Chrome 108+, Firefox 101+ [V] | https://web.dev/blog/viewport-units | Reveal stage: `min-height: 100svh`, with `100vh` as a fallback. Do not use `dvh` on the animated stage |
| `overscroll-behavior` is fully supported in iOS Safari 16+ (behind a flag in 14.5–15.8) [P] | https://caniuse.com/css-overscroll-behavior | `overscroll-behavior: none` on the reveal container stops the rubber-band bounce during the choreography. Re-enable normal scroll on the Letter view |
| Safe areas: `viewport-fit=cover` + `env(safe-area-inset-*)` [U, not fetched] | https://developer.mozilla.org/en-US/docs/Web/CSS/env | Keep the envelope and "Tap to open" clear of the notch and home indicator |
| 3D performance: animate only `transform` and `opacity`; set `perspective` on the parent and `backface-visibility: hidden` on the flap; avoid animating `filter`, `box-shadow` and big blurs [U, standard practice] | — | Fake shadows with a pre-rendered layer whose opacity animates. Test on a mid-range Android phone at 60 fps |

---

## 5. User journeys

### 5.1 Sender — Path A (code card in the box)

| Stage | Doing | Thinking | Feeling | Opportunities |
| --- | --- | --- | --- | --- |
| Unbox | Opens the box; finds the ceramic and the code card | "How does this work?" | Delighted, a bit unsure | Card: three steps, the URL, a big code in a typewriter font |
| Claim | Types the URL and enters `SAUD-3K7M` | "Did I type it right? 0 or O?" | Careful | Segmented `<CodeInput>` that auto-uppercases, maps ambiguous characters and handles paste; a stamp-press on success |
| Save link | Sees "Your envelope is yours" | "I have no account, so how do I come back?" | Slightly anxious | **Email it to me** (O6), Copy link; a clear note that the link is the key |
| Fill | Adds photos, letter, voice, song | "What will they actually see?" | Absorbed, emotional | WYSIWYG stationery; counters (7 / 15, 2:31 / 3:00); per-stamp Save with an unsaved-changes guard |
| Record voice | Taps record | "Is it recording? Do I sound OK?" | Self-conscious | Live waveform, re-record, upload instead; spots in-app browsers first |
| Song | Pastes a link from the Spotify or Music app | "Did it pick the right song?" | Hopeful | Instant parse → artwork + title + vinyl; honest 30-second note |
| Preview | Opens Preview | "Will this ruin their first open?" | Worried | Frame: "Preview — this doesn't count as their first open"; Replay reveal |
| Seal & send | Presses the wax seal (O7) | "Can I still change things?" | Ceremony, relief | "You can keep editing after sealing"; explains the next tap |
| Give | Hands over or posts the ceramic | "Will they know to tap it?" | Nervous anticipation | A printable or digital "how to open" note for the recipient |
| Later | Comes back months later to add content | "Where's my link?" | Fond; maybe frustrated | `/recover` by email; a "new" postmark on updated stamps |

### 5.2 Sender — Path B (code sent by email, ceramic shipped to the friend)

| Stage | Doing | Thinking | Feeling | Opportunities |
| --- | --- | --- | --- | --- |
| Purchase | Orders, shipping to the friend | "When can I fill it?" | Excited | Order confirmation sets expectations: "Your code arrives by email within X" (admin sends it by hand) |
| Wait | Waits for the admin's email | "Has it been sent? Spam?" | Impatient | Sender domain with SPF/DKIM/DMARC; a clear subject line |
| Open email | Taps the link in the Gmail or Mail app | — | — | **This is where in-app browsers come in.** The email gives the URL and the code as text, plus "Open in Safari/Chrome for voice recording" |
| Claim + fill | Same as Path A | "Will it get there before I finish?" | **Time pressure** | Portal shows "Your envelope may arrive before you seal it. They'll see 'still being written'." |
| Seal | Seals | "Have they tapped yet?" | Anticipation | Unit status shown to the sender: draft / sealed / opened (master prompt §6.3 item 7) |

### 5.3 Recipient

| Stage | Doing | Thinking | Feeling | Opportunities |
| --- | --- | --- | --- | --- |
| Receive | Unboxes the ceramic (Path B: **no card**) | "Pretty. What is it?" | Curious, maybe confused | **Tap instruction for the recipient, with no code on it** (Suggested new open question) |
| First tap | Holds the phone to the heart; a banner appears; taps it | "Did it work?" | Uncertain, then surprised | Heart-stamp art suggests "tap here"; help page covers the banner |
| Threshold | The envelope settles; "Someone who misses you sent this." | "Who?" | Anticipation | Calm, beautiful, one action: **Tap to open**. That tap also unlocks audio |
| Reveal | Flap, liner, letter rises, stamps land one by one | — | Moved | Skip after 1.5 s; reduced-motion crossfade; only filled stamps appear |
| Explore | Opens each stamp's world | "Can I keep this?" | Intimate | Each world feels different; the letter is readable in sunlight; voice player is accessible |
| Repeat visit | Taps again, days or months later | "Is there anything new?" | Comforted | Calm open straight to the envelope; a "new" postmark on changed stamps [PROPOSED] |
| Early tap | Taps before the sender has sealed | "Is it broken?" | Disappointed | Sealed envelope: "Your letter is still being written", with a soft postmark date. **No reveal is used up** |
| Can't tap | Older iPhone, or Android with NFC off | "Nothing happens" | Frustrated, silently | QR fallback (O8) and a printed help URL |

---

## 6. Top 15 patterns to adopt

1. **Honest two-step tap copy**: "Hold your phone to the heart, then tap the notification." Both platforms now ask for a confirmation tap. → `/help/tap`, the recipient instruction note, the empty and not-found states.
2. **A threshold screen with a single "Tap to open"**. It is the audio-unlock gesture and lets the recipient choose the moment. → First-tap reveal.
3. **Record the reveal after completion, by client POST, never on GET**. Bots and previews can then never use up the moment. → `/t/[slug]`, `RevealService`.
4. **Skip after 1.5 s plus a reduced-motion crossfade**. Respects people re-watching and the OS setting. → Reveal, `MOTION_SPEC.md`.
5. **Show only filled stamps** in the reveal and the envelope. An empty slot reads as missing love. → Reveal, Envelope.
6. **A "still being written" sealed state that doesn't use up the reveal**. Path B makes early taps likely. → Empty envelope state.
7. **Envelope fill-state as progress** (outline, then stamp, then postmark) instead of a progress bar. It is the letter metaphor, not a form. → Portal home.
8. **WYSIWYG stationery for the letter** (what you write is what they see). → Letter editor + Letter view.
9. **Limits stated up front with live counters** (Yoto-style clarity). Avoids surprise errors. → Photos (7 / 15), Voice (2:31 / 3:00), Letter.
10. **Record or upload as equals for voice, with in-app-browser detection first**. The mic is unreliable in webviews. → Voice editor.
11. **Paste, parse instantly, confirm with artwork and title** for songs, with the 30-second note and "Open in Spotify / Apple Music". Builds confidence and is honest about previews. → Song editor, Song view.
12. **Vinyl driven by real playback events** (Spotify `playback_update`). Apple gets an ambient spin that makes no sync claim. → Song view.
13. **A sender preview inside a clear frame** ("doesn't count as their first open") with Replay. Lets the sender check without anxiety. → `/s/[token]/preview`.
14. **"Your link is your key" moment at claim**: email-to-self and copy, with the risk explained once. There are no accounts, so recovery has to be designed in. → `/claim/success`, `/recover`.
15. **Neutral link previews + noindex** on recipient URLs. A forwarded link should not leak names or photos. → `/t/*` metadata, headers.

---

## 7. Ten anti-patterns to avoid

1. **Marking the reveal "seen" on page load or any GET.** iMessage and Google Messages fetch from users' devices with crawler-like user-agents, so the moment would be used up before a human sees it.
2. **Autoplaying sound or music.** Browsers block it (Chrome, iOS) and it breaks the quiet ceremony. A broken `play()` also leaves the UI out of step with what is actually playing.
3. **Long intros you can't skip (e-card style).** These are lovely once and tiring on every later visit. Repeat visits must open calmly.
4. **Needing an app, account, Wi-Fi setup or device on the recipient's side** (Lovebox, Yoto, Tonies). This is our main edge; every added step loses it.
5. **A person in the loop for content** (TapKeeps' 3–5 days). Saudade has to work the moment the code is claimed, and edits have to be live.
6. **A dashboard or feed layout for the recipient** (cards in a grid, settings menu, tabs). The client named this explicitly: "a discovery, not a dashboard."
7. **A vinyl that spins when nothing is playing**, or a pause button shown before playback has started. This is fake feedback, and Chrome's guidance warns against it directly.
8. **`100vh`/`dvh` on the animated reveal stage.** It clips content on iOS or janks as the toolbars move. Use `svh`.
9. **A dead record button inside an in-app browser.** The user hits a permission error with no way out. Detect early and offer Safari/Chrome or upload.
10. **Long or provider URLs, extra NDEF records, or unlocked tags.** These waste capacity, can break iOS (only the first URI record is read), allow tampering, or tie a permanent object to a hosting vendor's domain.

---

## 8. Implications and recommendations for the team

### 8.1 Design

- Design `/help/tap` around **two taps** (ceramic, then notification), with separate iPhone and Android panels, a troubleshooting list (camera open, Airplane Mode, not unlocked since restart, NFC off), and the QR fallback (O8).
- Design a **recipient tap note with no code on it** for Path B (copy plus a small illustration). See §8.5.
- Voice editor states: default, recording, recorded, **in-app browser warning**, **mic denied**, upload, too long. All reachable from the Demo Panel.
- Song editor states: empty, parsing, matched (artwork + title; artist only when known), unsupported link, short link resolving, region-unavailable [U].
- Write every "30-second preview" mention in the warm voice, once per screen, never as an error.
- Neutral Open Graph card art for `/t/*`: a sealed envelope with no personal content.

### 8.2 Motion

- The threshold "Tap to open" is a **designed beat**, not a gate: a heart-seal glow and a gentle idle loop that stops after a few cycles.
- In the tap handler, before anything visual: `audioContext.resume()`, and prime `<audio>` elements if a seal sound is used.
- Fire the reveal POST from `onComplete` of the final stamp-press (or from Skip). Never from mount.
- The vinyl uses a single spin state machine: `idle → needleDrop → spinning ⇄ easingStop`. Spotify drives it from `playback_update`; Apple uses ambient mode only.
- Use `svh` stage sizing, `overscroll-behavior: none` during the reveal, a 3D flap with `perspective`/`backface-visibility`, and shadows faked with opacity.
- Reduced motion: crossfade only; stamps fade in place; no `rotateX` and no overshoot; the vinyl does not spin (use a static groove highlight).

### 8.3 Engineering

- **NFC/URL:** one short NDEF URI record, prefix `0x04` (or `0x02` for `www.`), total ≤ 64 bytes as a target. CSV column `url` must exactly match what the chip encodes. Include a byte-count column in the batch CSV to catch problems early.
- **First-open contract:** GET has no side effects; reveal via `POST /api/reveal {slug, completedAt}` with an idempotency key; sender-token holders excluded; a UA denylist for logs only; `noindex` everywhere on `/t/*`.
- **Recorder:** use the candidate list in §4.5; save `recorder.mimeType`; Phase 3 transcodes to AAC m4a; enforce 180 s on the client; catch `NotAllowedError`/`NotFoundError`.
- **In-app browser detection:** port the `inapp-spy` regex set (or use the library, licence permitting [U]) into `/lib/utils/inAppBrowser.ts`, plus open-in-browser handoffs (`x-safari-https://` on iOS, `intent://` on Android [U]) with copy-link fallbacks.
- **Song parsing (`/lib/parsing/song.ts`):** normalise Spotify URL, intl, embed and URI forms to `spotify:track:{id}`. Rewrite Apple `music.apple.com` → `embed.music.apple.com`, keeping `?i=`. Resolve short links through a server route (`/api/resolve-song`, allowlisted hosts, 3 s timeout). Fetch metadata from the browser with Spotify oEmbed (CORS ok) and iTunes Lookup (CORS ok). Store provider, id, title, artist (if known) and artwork so the stamp still renders if a track disappears (as in `ARCHITECTURE.md`).
- **Spotify controller:** load `https://open.spotify.com/embed/iframe-api/v1` only when the Song view opens (performance budget). Call `destroy()` on close.
- **CSP:** `frame-src https://open.spotify.com https://embed.music.apple.com`; `script-src https://open.spotify.com`; `connect-src https://open.spotify.com https://itunes.apple.com`; `img-src` for Spotify and mzstatic artwork CDNs.

### 8.4 PM

- Add device-matrix rows to `QA_CHECKLIST.md`: iPhone with **Chrome as default browser** (NFC handoff), Android 16 and 17 (NFC notification), iOS older than 18.4 playing a Chrome-recorded WebM in the Phase 2 demo, and in-app browsers (Instagram, WhatsApp, Gmail, Facebook, LinkedIn) for the voice editor.
- Log in `DECISIONS.md`: "Apple Music vinyl is ambient (not synced)" and "Spotify artist omitted in Phase 2 (oEmbed has no artist)", unless the client chooses otherwise.
- Use the competitor positioning in the showcase script: **self-filled, no app on either side, ceremony, forever.**

### 8.5 Suggested new open questions (for `OPEN_QUESTIONS.md`)

| # | Suggested new open question | Why | Recommended default |
| --- | --- | --- | --- |
| SQ1 | **Path B recipient instructions:** with no code card in the box, how does the friend know to tap the heart? Can the box include a small "Tap the heart with your phone" note with **no code** (plus a QR fallback, tied to O8)? | The recipient may not know the object is interactive | Yes: a code-free instruction note in every box |
| SQ2 | **Path B timing:** if the ceramic arrives before the sender has sealed it, is the "still being written" state acceptable, or should shipping wait until the unit is sealed? | Protects the first-tap moment (O7) | Accept the "still being written" state; tell the sender in the portal |
| SQ3 | **Apple Music vinyl:** accept an ambient (unsynced) spin for Apple links, or check licensing for playing Apple's 30-second `previewUrl` in our own player? | No public event API for the Apple embed | Ambient spin, official embed only |
| SQ4 | **Song scope:** accept only single tracks (and album links with `?i=`), or also albums, playlists and podcast episodes? | The client brief says "song"; whole albums or playlists change the vinyl metaphor | Tracks only at launch; friendly error otherwise |
| SQ5 | **Domain length and permanence** (extends O2): keep the encoded domain at 41 characters or fewer, no provider domain, and auto-renew for decades | Chip URLs can never change | Short custom domain, multi-year renewal, registrar lock |
| SQ6 | **Sender "opened" signal:** should the sender see that the envelope has been opened (status in the portal only, no email)? | A Lovebox-style reciprocity loop adds a lot of emotional value | Portal status only (already PROPOSED); no notifications at launch |
| SQ7 | **Recovery email wording:** may the private-link emails tell senders to open the link in Safari or Chrome for voice recording? | In-app browsers in email apps can block the mic | Yes, one plain line |

---

## 9. Could not verify (carry into QA)

- The exact flow Bardstown/io.tt uses to load content, and whether content can be edited (the press release returned 403).
- Whether TapKeeps lets buyers edit after programming.
- Microphone behaviour in **current** (2026) Instagram, Facebook, WhatsApp and Gmail in-app browsers on iOS and Android. A Gmail in-app UA token.
- Whether Android opens NFC URLs in a Custom Tab or a normal tab, and how Chrome, Samsung Internet and Firefox differ as defaults.
- How iOS hands an NFC URL to a non-Safari default browser (only one 2026 Brave report).
- `spotify.link`, `spoti.fi` and `apple.co` redirect mechanics on a live link. Spotify ID format (22-character base62) as a formal rule.
- Any postMessage or event API on `embed.music.apple.com`. The exact single-song embed height.
- Whether Spotify iFrame API events fire reliably in iOS Safari, and what logged-in Spotify users actually hear in the iOS Safari embed.
- Playback of Opus-in-MP4 (Chrome 126+ `audio/mp4`) on iOS Safari.
- iOS silent-switch effect on Web Audio. iPhone and Android antenna positions. Motion's reduced-motion API details.

## 10. Source index

- Apple Core NFC background reading: https://developer.apple.com/documentation/corenfc/adding-support-for-background-tag-reading
- Android NFC basics: https://developer.android.com/develop/connectivity/nfc/nfc
- NXP NTAG213/215/216 datasheet: https://www.nxp.com/docs/en/data-sheet/NTAG213_215_216.pdf
- URI identifier codes: https://docs.nordicsemi.com/r/bundle/nrf5_sdk_v17.1.0/page/group_nfc_uri_rec.html
- NTAG213 practical capacity: https://www.wakdev.com/en/knowledge-base/nfc-chips/nxp-ntag213.html
- Brave iOS NFC report: https://community.brave.app/t/brave-ios-nfc-tag-support/649010
- Chrome autoplay: https://developer.chrome.com/blog/autoplay
- WebKit iOS video/audio policy: https://webkit.org/blog/6784/new-video-policies-for-ios/
- WebKit MediaRecorder: https://webkit.org/blog/11353/mediarecorder-api/
- Safari 18.4 release notes: https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes.md
- MDN isTypeSupported: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
- addpipe MediaRecorder demo: https://addpipe.com/media-recorder-api-demo/
- inapp-spy: https://github.com/shalanah/inapp-spy ; https://raw.githubusercontent.com/shalanah/inapp-spy/main/src/regexAppName.ts
- Apple forums (in-app mic): https://developer.apple.com/forums/thread/699479
- Bubble forum (in-app mic): https://forum.bubble.io/t/defeated-w-microphone-access-inappbrowser-fb-messenger-instagram-limits-access/104984
- x-safari-https: https://christiantietze.de/posts/2023/05/safari-for-mac-url-scheme/ ; https://link.boo/guides/open-instagram-link-in-safari
- Spotify iFrame API: https://developer.spotify.com/documentation/embeds/references/iframe-api ; https://developer.spotify.com/documentation/embeds/tutorials/using-the-iframe-api
- Spotify oEmbed: https://developer.spotify.com/documentation/embeds/reference/oembed
- Spotify community (previews, short links): https://community.spotify.com/t5/Spotify-for-Developers/30-second-preview-showing-when-try-to-embed-playlist/m-p/5655484/highlight/true ; https://community.spotify.com/t5/Spotify-for-Developers/How-to-see-through-shortened-https-spotify-link-links/m-p/5643368/highlight/true ; https://community.spotify.com/t5/Spotify-for-Developers/Resolve-link-tospotify-com-to-ID/td-p/5051151
- Apple Music embed: https://allthings.how/how-to-embed-apple-music-playlists-albums-and-songs-on-a-webpage/ ; https://microlink.io/tools/embed-url/apple-music
- Apple Music developer token: https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens
- Link-preview fetchers: https://docs.centinelanalytica.com/crawlers/apple-link-preview ; https://docs.centinelanalytica.com/crawlers/google-messages-link-preview ; https://botcrawl.com/bots/whatsapp/ ; https://botcrawl.com/bots/slackbot-linkexpanding ; https://www.temso.ai/bots/meta/facebookexternalhit
- Reduced motion: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- Viewport units: https://web.dev/blog/viewport-units
- overscroll-behavior: https://caniuse.com/css-overscroll-behavior
- Competitors: https://www.etsy.com/shop/tapkeeps ; https://thewhiskeywash.com/whiskey-news/bardstown-bourbon-launches-nfc-powered-gifting-program/ ; https://us.yotoplay.com/make-your-own ; https://tonies.com/pages/creative-tonies ; https://us.tonies.com/blogs/beyond-the-box/creative-tonies-101 ; https://www.uncommongoods.com/blog/?p=64946 ; https://welcome.storyworth.com/gb/faq ; https://www.vidday.com/post/the-easy-way-to-make-a-collaborative-greeting-video-for-birthdays
- Live probes (8 Oct 2026): `open.spotify.com/oembed` (CORS, URL shapes), `open.spotify.com/embed/iframe-api/v1`, `itunes.apple.com/lookup` (CORS, fields), `embed.music.apple.com` and `music.apple.com` (status, `x-frame-options`).
