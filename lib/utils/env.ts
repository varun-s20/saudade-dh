/**
 * Client environment detection. Call only in effects or event handlers (never during render),
 * so server and client markup stay identical.
 */
import { isForced } from "@/lib/state/demo";

export type InAppBrowser =
  | "instagram"
  | "facebook"
  | "messenger"
  | "threads"
  | "whatsapp"
  | "tiktok"
  | "snapchat"
  | "linkedin"
  | "google"
  | "line"
  | "wechat"
  | null;

/**
 * Detect in-app browsers that commonly block the microphone. Demo Panel can force it.
 * Patterns follow the inapp-spy library (docs/RESEARCH.md §4). Telegram and Gmail have no
 * reliable UA token.
 */
export function detectInAppBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): InAppBrowser {
  if (isForced("in_app_browser")) return "instagram";
  if (/\bInstagram/i.test(ua)) return "instagram";
  if (/\bBarcelona/i.test(ua)) return "threads";
  if (/\bFB[\w_]+\/|\bFacebook/i.test(ua)) return /Messenger/i.test(ua) ? "messenger" : "facebook";
  if (/\b(WAiOS|WA4A)\/|WhatsApp/i.test(ua)) return "whatsapp";
  if (/musical_ly|Bytedance/i.test(ua)) return "tiktok";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/LinkedInApp/i.test(ua)) return "linkedin";
  if (/\bGSA\//i.test(ua)) return "google";
  if (/\bLine\//i.test(ua)) return "line";
  if (/\bMicroMessenger\//i.test(ua)) return "wechat";
  return null;
}

export const IN_APP_NAMES: Record<Exclude<InAppBrowser, null>, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  threads: "Threads",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  linkedin: "LinkedIn",
  google: "the Google app",
  line: "LINE",
  wechat: "WeChat",
};

export function isIOS(ua: string = navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
}

export function isAndroid(ua: string = navigator.userAgent): boolean {
  return /Android/i.test(ua);
}

/**
 * Best supported MediaRecorder mime: true AAC first (Safari), then Opus (Chrome/Firefox).
 * Always store the recorder's actual `mimeType`; Phase 3 transcodes everything to AAC/m4a.
 */
export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function canRecordAudio(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}
