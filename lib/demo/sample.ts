/**
 * Sample demo content: a fictional sender "Mira" writing to "Theo", a close friend far away
 * (MASTER_BUILD_PROMPT §6.6). Photo, audio and song sources are recorded in docs/ASSETS.md.
 * Media ids prefixed "demo:" resolve to static files under /public/demo.
 */
import type { LetterContent, PhotosContent, SongContent, VoiceContent } from "@/lib/services/types";
import photoManifest from "@/public/demo/photos/manifest.json";
import waveform from "@/public/demo/voice/waveform.json";
import song from "@/public/demo/song.json";

export const SAMPLE_NAMES = { from: "Mira", to: "Theo" } as const;

export const samplePhotos: PhotosContent = {
  kind: "photos",
  items: photoManifest.map((p, i) => ({
    id: `sample_photo_${i + 1}`,
    mediaId: `demo:photos/${p.file}`,
    width: p.width,
    height: p.height,
    caption: p.caption,
    alt: p.alt,
  })),
};

export const sampleLetter: LetterContent = {
  kind: "letter",
  to: "Theo",
  body: [
    "It's raining here the way it used to on Thursdays, when we'd give up on the bus and walk the long way home instead. I keep catching myself saving things to tell you: a dog in a yellow raincoat, the bakery finally fixing its sign, a song in the corner shop that made me stand still in the cereal aisle.",
    "I know the time difference makes everything feel like a postcard that arrives late. So this is me sending one anyway.",
    "I've tucked in a few photos from the summer you visited. Look at the one on the pier. You're mid-sentence, as always. I recorded a little voice note too, because writing never quite sounds like me.",
    "Nothing's wrong. Nothing needs answering. I just missed you today, and I wanted it to be somewhere you could keep.",
    "Put this on your desk. Tap it when the flat feels too quiet.",
  ].join("\n\n"),
  signoff: "Always a short walk away, in the ways that count,",
  from: "Mira",
};

export const sampleVoice: VoiceContent = {
  kind: "voice",
  mediaId: "demo:voice/mira-voice.m4a",
  durationSec: waveform.durationSec,
  mime: "audio/mp4",
  peaks: waveform.peaks,
  source: "recorded",
};

export const sampleSong: SongContent = {
  kind: "song",
  provider: "spotify",
  url: song.spotify.url,
  trackId: song.spotify.trackId,
  title: song.spotify.title,
  artist: song.spotify.artist,
  artworkUrl: song.spotify.thumbnail,
  embedUrl: `https://open.spotify.com/embed/track/${song.spotify.trackId}?utm_source=saudade&theme=0`,
};

/** Apple Music variant of the sample song, for demonstrating the second provider. */
export const sampleSongApple: SongContent = {
  kind: "song",
  provider: "apple",
  url: song.appleMusic.url,
  trackId: String(song.appleMusic.trackId),
  albumId: String(song.appleMusic.albumId),
  storefront: song.appleMusic.storefront,
  title: song.appleMusic.title,
  artist: song.appleMusic.artist,
  artworkUrl: song.appleMusic.artwork.replace("100x100bb", "600x600bb"),
  durationMs: song.appleMusic.durationMs,
  embedUrl: song.appleMusic.embedUrl,
};
