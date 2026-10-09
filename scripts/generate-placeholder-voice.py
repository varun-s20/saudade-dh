"""Generate Saudade's placeholder 'voice note'.

Original, in-house synthesis (no samples, no recordings, no third-party material).
A soft, low-passed hum with slow pitch drift, shaped by syllable-rate amplitude
envelopes into phrases of 1-4 s separated by short pauses, over a faint room-tone
noise floor. It reads as a voice note on a waveform but contains no speech.

usage: python -I voice.py <out.wav> <waveform.json> <preview.png>
"""
import json
import sys
import wave

import numpy as np

SR = 44100
TOTAL = 68.0           # seconds
PEAK_DBFS = -12.0
SEED = 20261008
BUCKETS = 96

out_wav, out_json, out_png = sys.argv[1], sys.argv[2], sys.argv[3]
rng = np.random.default_rng(SEED)
N = int(TOTAL * SR)
t_axis = np.arange(N) / SR


def fft_filter(x, gain_fn):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * gain_fn(f), n=len(x))


def smooth(x, ms):
    k = max(1, int(SR * ms / 1000))
    kernel = np.hanning(k + 2)[1:-1]
    kernel /= kernel.sum()
    return np.convolve(x, kernel, mode="same")


# ---- 1. phrase schedule: 1-4 s phrases, 0.3-0.8 s pauses, occasional 1.0-1.6 s "sentence" breaks
segments = []
t = 0.8
while True:
    dur = rng.uniform(1.0, 4.0)
    if t + dur > TOTAL - 1.8:
        break
    segments.append((t, dur))
    pause = rng.uniform(1.0, 1.6) if rng.random() < 0.25 else rng.uniform(0.3, 0.8)
    t += dur + pause

# ---- 2. amplitude envelope (syllables ~120-320 ms, declining across each phrase)
env = np.zeros(N)
f0 = np.full(N, 200.0)
base_f0 = 200.0
for (start, dur) in segments:
    s0 = int(start * SR)
    pos = 0.0
    while pos < dur:
        syl = min(rng.uniform(0.12, 0.32), dur - pos)
        if syl < 0.06:
            break
        a = rng.uniform(0.45, 1.0) * (1.0 - 0.3 * pos / dur)
        n = int(syl * SR)
        shape = np.hanning(n) ** 0.6
        i0 = s0 + int(pos * SR)
        env[i0:i0 + n] = np.maximum(env[i0:i0 + n], a * shape[: len(env[i0:i0 + n])])
        pos += syl + (rng.uniform(0.02, 0.08) if rng.random() < 0.3 else 0.0)
    # pitch contour for the phrase: start offset, gentle declination, slow wander, light vibrato
    n = int(dur * SR)
    i = np.arange(n) / SR
    start_ratio = 1.0 + rng.uniform(-0.05, 0.08)
    decl = 1.0 - 0.10 * (i / dur)
    wander = np.cumsum(rng.normal(0, 1, n // 441 + 2))[: n // 441 + 2]
    wander = np.interp(np.arange(n), np.linspace(0, n, len(wander)), wander)
    wander = 0.03 * wander / (np.abs(wander).max() + 1e-9)
    vib = 0.004 * np.sin(2 * np.pi * 5.2 * i + rng.uniform(0, 6.28))
    f0[s0:s0 + n] = base_f0 * start_ratio * decl * (1 + wander + vib)

env = smooth(env, 25)
f0 = smooth(f0, 40)

# ---- 3. tone: soft harmonic hum, low-passed for warmth
phase = 2 * np.pi * np.cumsum(f0) / SR
tone = (np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase)
        + 0.05 * np.sin(4 * phase))
tone = fft_filter(tone, lambda f: 1.0 / (1.0 + (f / 1400.0) ** 4))
voice = tone * env

# faint breath texture, band-passed, following the envelope
breath = fft_filter(rng.normal(0, 1, N),
                    lambda f: ((f > 250) & (f < 3500)) * 1.0 / (1 + (f / 2500.0) ** 2))
breath /= np.abs(breath).max() + 1e-9
voice += 0.05 * breath * env ** 1.5

# normalise the voiced part to the target peak
peak = 10 ** (PEAK_DBFS / 20)
voice *= peak / np.abs(voice).max()

# ---- 4. room tone: soft pink-ish noise at roughly -56 dBFS RMS
room = fft_filter(rng.normal(0, 1, N),
                  lambda f: np.where(f > 20, 1.0 / np.sqrt(np.maximum(f, 1)), 0) / (1 + (f / 4000.0) ** 2))
room *= 10 ** (-56 / 20) / np.sqrt(np.mean(room ** 2))
audio = voice + room

# ---- 5. fades, final peak normalisation
fade_in, fade_out = int(0.4 * SR), int(1.5 * SR)
audio[:fade_in] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fade_in))
audio[-fade_out:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fade_out))
audio *= peak / np.abs(audio).max()

pcm = np.clip(np.round(audio * 32767), -32768, 32767).astype("<i2")
with wave.open(out_wav, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

# ---- 6. waveform.json: 96 buckets of RMS, normalised so the loudest bucket is 1
x = pcm.astype(np.float64) / 32768
edges = np.linspace(0, len(x), BUCKETS + 1).astype(int)
rms = np.array([np.sqrt(np.mean(x[a:b] ** 2)) for a, b in zip(edges[:-1], edges[1:])])
peaks = [round(float(v), 3) for v in rms / rms.max()]
with open(out_json, "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"durationSec": round(len(x) / SR, 3), "peaks": peaks}, fh)
    fh.write("\n")

# ---- 7. preview image (scratch only)
try:
    from PIL import Image, ImageDraw
    W, H = 1400, 360
    img = Image.new("RGB", (W, H), (250, 246, 238))
    d = ImageDraw.Draw(img)
    cols = np.linspace(0, len(x), W + 1).astype(int)
    for c in range(W):
        seg = x[cols[c]:cols[c + 1]]
        hi, lo = seg.max(), seg.min()
        d.line([(c, H / 4 - hi * H / 4 / peak * 0.95), (c, H / 4 - lo * H / 4 / peak * 0.95)], fill=(90, 60, 40))
    bw = W / BUCKETS
    for i, p in enumerate(peaks):
        d.rectangle([i * bw + 2, H - 10 - p * (H / 2 - 30), (i + 1) * bw - 2, H - 10], fill=(180, 90, 70))
    img.save(out_png)
except Exception as e:  # preview is optional
    print("preview skipped:", e)

active = sum(d for _, d in segments)
print(f"segments={len(segments)} voiced={active:.1f}s of {TOTAL}s "
      f"phrase range={min(d for _, d in segments):.2f}-{max(d for _, d in segments):.2f}s")
print(f"peak dBFS={20*np.log10(np.abs(x).max()):.2f} rms dBFS={20*np.log10(np.sqrt(np.mean(x**2))):.2f}")
print(f"f0 range in phrases={f0[env>0.05].min():.0f}-{f0[env>0.05].max():.0f} Hz")
