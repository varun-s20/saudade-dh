"use client";

/**
 * <LiveWaveform>: the microphone's level, drawn on a canvas while recording (Web Audio
 * AnalyserNode). It also SAMPLES the level (LEVEL_RATE per second) into `levelsRef`, which the
 * editor turns into the 96 stored peaks when recording stops.
 *
 * Full motion: a rolling strip, newest sound at the right edge. Reduced motion: nothing scrolls;
 * bars fill in from the left across the 3-minute page, like ink on a line.
 * Colour comes from the canvas's CSS `color` (a token), so the drawing stays on-brand.
 */
import { useEffect, useRef, type RefObject } from "react";
import { LEVEL_RATE, VOICE_LIMIT_SEC, rmsLevel } from "./voice-audio";

const BAR = 3;
const GAP = 2;

export function LiveWaveform({
  analyser,
  levelsRef,
  reduced,
  className,
}: {
  analyser: AnalyserNode | null;
  levelsRef: RefObject<number[]>;
  reduced: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const buf = new Float32Array(analyser?.fftSize ?? 1024);
    const interval = 1000 / LEVEL_RATE;
    let last = performance.now();
    let frame = 0;
    let colour = getComputedStyle(canvas).color;
    let faint = colour;

    const resize = () => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      colour = getComputedStyle(canvas).color;
      faint = colour.startsWith("rgb(") ? colour.replace("rgb(", "rgba(").replace(")", ", 0.25)") : colour;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const levels = levelsRef.current;
      if (analyser && now - last >= interval) {
        // Catch up if a frame was late, so the time base stays honest.
        while (now - last >= interval) {
          last += interval;
          levels.push(rmsLevel(analyser, buf));
        }
      }
      const { width, height } = canvas.getBoundingClientRect();
      ctx2d.clearRect(0, 0, width, height);
      const mid = height / 2;
      ctx2d.fillStyle = faint;
      ctx2d.fillRect(0, mid - 0.5, width, 1);
      ctx2d.fillStyle = colour;
      const bars = Math.max(1, Math.floor((width + GAP) / (BAR + GAP)));
      const amp = (v: number) => Math.max(1.5, Math.min(1, Math.sqrt(v * 5)) * (height / 2 - 2));

      if (reduced) {
        // Fill across the whole 3:00: each bar is a slice of the time limit.
        const perBar = (VOICE_LIMIT_SEC * LEVEL_RATE) / bars;
        const filled = Math.min(bars, Math.ceil(levels.length / perBar));
        for (let i = 0; i < filled; i++) {
          const a = Math.floor(i * perBar);
          const b = Math.min(levels.length, Math.floor((i + 1) * perBar));
          let sum = 0;
          for (let j = a; j < b; j++) sum += levels[j];
          const h = amp(b > a ? sum / (b - a) : 0);
          ctx2d.fillRect(i * (BAR + GAP), mid - h, BAR, h * 2);
        }
      } else {
        // Rolling: one bar per sample, newest at the right.
        const start = Math.max(0, levels.length - bars);
        for (let i = start; i < levels.length; i++) {
          const x = width - (levels.length - i) * (BAR + GAP);
          const h = amp(levels[i]);
          ctx2d.fillRect(x, mid - h, BAR, h * 2);
        }
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [analyser, levelsRef, reduced]);

  return <canvas ref={canvasRef} className={className ?? "ss-wave"} aria-hidden />;
}
