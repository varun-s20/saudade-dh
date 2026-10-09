"use client";

/**
 * Voice world (radio, sage): the wireless set comes alive while the voice plays (dial lamp,
 * tuning needle, speaker glow following the voice's loudness), above a clean, accessible player.
 */
import { useMotionValue } from "motion/react";
import { useRef, useState } from "react";
import type { VoiceContent } from "@/lib/services/types";
import { VoiceObject } from "@/components/media/VoiceObject";
import { useElementSize } from "@/components/envelope/useElementSize";
import { VoicePlayer, type VoiceStatus } from "./VoicePlayer";
import { useMediaUrl } from "./useMediaUrl";
import "./worlds.css";

export interface VoiceWorldProps {
  voice: VoiceContent;
  fromName?: string | null;
}

export function VoiceWorld({ voice, fromName }: VoiceWorldProps) {
  const src = useMediaUrl(voice.mediaId);
  const level = useMotionValue(0);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const columnRef = useRef<HTMLDivElement>(null);
  const { width } = useElementSize(columnRef);
  const radio = Math.round(Math.max(150, Math.min(240, width * 0.62)));
  const playing = status === "playing";

  return (
    <div className="wd-voice flex min-h-full flex-col items-center px-5 pt-6 pb-10" data-world="voice">
      <div ref={columnRef} className="flex w-full max-w-[26rem] flex-1 flex-col items-center">
        <div className="wd-voice__table relative flex w-full justify-center pt-2 pb-6">
          {width > 0 ? <VoiceObject playing={playing} level={level} size={radio} /> : <div className="h-60" />}
        </div>

        <p className="postal-label text-sage-ink" aria-hidden>
          {playing ? "On the air" : status === "paused" ? "Paused" : "Tuned in for you"}
        </p>
        <p className="mt-1 mb-6 text-center text-lg font-medium text-ink-soft">
          {fromName ? `${fromName} recorded this for you.` : "Recorded for you."}
        </p>

        <div className="wd-voice__card w-full rounded-card px-4 pt-4 pb-2 shadow-paper">
          <VoicePlayer voice={voice} src={src} fromName={fromName} level={level} onStatusChange={setStatus} />
        </div>
      </div>
    </div>
  );
}
