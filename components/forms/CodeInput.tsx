"use client";

/**
 * <CodeInput>: segmented activation-code entry: a printed "SAUD-" and one box per character
 * (site.codes.length). Each filled box looks hand-stamped (ink on a card, slightly askew).
 *
 * Behaviour
 * - Auto-uppercase. Characters outside the code alphabet are ignored.
 * - Ambiguous characters (0 O 1 I L) are refused at the keystroke with a gentle inline hint.
 * - Paste "saud3k7m", "SAUD-3K7M" or "3k7m" anywhere: fills every box. "SAUD-0000" → the hint.
 * - Backspace clears and steps back; ←/→/Home/End move; iOS one-time-code autofill works.
 * - Typing "SAUD" into the boxes is caught with a friendly note (the prefix is already there).
 * - `state` lets the claim page drive it: checking (read-only), error (shake), success (a
 *   postmark is pressed over the code). All motion has a still reduced-motion state.
 */
import { useLayoutEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { site } from "@/config/site";
import { codeBody, formatCode, isAmbiguousChar, isCodeChar } from "@/lib/parsing/codes";
import { cn } from "@/lib/utils/cn";
import { Postmark } from "@/components/paper/Postmark";
import { IconCheck, IconWarning } from "@/components/ui/icons";
import "@/components/ui/ui.css";
import "./forms.css";

export type CodeInputState = "idle" | "checking" | "error" | "success";

export interface CodeInputProps {
  /** The code body without the prefix, e.g. "3K7M" (uppercase, possibly partial). */
  value: string;
  onChange: (body: string) => void;
  /** Called with the canonical code ("SAUD-3K7M") whenever every box is filled. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  /** Plain error text from the claim attempt (invalid, already claimed, rate limited…). */
  error?: string;
  /** Id of the first box (a <label htmlFor={id}> focuses it). Other boxes get `${id}-2`… */
  id: string;
  /** Driven by the claim page. Default "idle". */
  state?: CodeInputState;
  /** Group label. Default "Activation code" (visually hidden unless `hideLabel` is false). */
  label?: ReactNode;
  hideLabel?: boolean;
  autoFocus?: boolean;
  checkingText?: string;
  successText?: string;
  className?: string;
}

export const AMBIGUOUS_HINT = "Codes never use 0, O, 1, I or L, so it might be a similar letter.";
const PREFIX_HINT = `The ${site.codes.prefix}- part is already there, so just type the ${site.codes.length} characters after it.`;
const TILTS = [-1.6, 1.1, -0.7, 1.6, -1.2, 0.8, -0.4, 1.3];

export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  error,
  id,
  state = "idle",
  label = "Activation code",
  hideLabel = true,
  autoFocus,
  checkingText = "Checking your code…",
  successText = "That's the one. Your envelope is ready.",
  className,
}: CodeInputProps) {
  const len = site.codes.length;
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // The latest code and the box focus is about to move to. Focus moves a frame after each
  // character; on a slow phone the next key can arrive first, and it belongs to that next box.
  const live = useRef("");
  const pending = useRef<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [nudge, setNudge] = useState<{ i: number; n: number } | null>(null);

  const body = value.toUpperCase().slice(0, len);
  useLayoutEffect(() => {
    live.current = body;
  }, [body]);
  const readOnly = state === "checking" || state === "success";
  const labelId = `${id}-label`;
  const msgId = `${id}-msg`;

  const focusBox = (i: number) => {
    pending.current = null;
    const el = refs.current[Math.max(0, Math.min(len - 1, i))];
    if (el) {
      el.focus();
      el.select();
    }
  };
  const focusSoon = (i: number) => {
    pending.current = Math.max(0, Math.min(len - 1, i));
    requestAnimationFrame(() => focusBox(i));
  };
  /** Report a new code, and remember it at once (before React re-renders). */
  const change = (next: string) => {
    live.current = next;
    onChange(next);
  };

  const refuse = (i: number, message: string) => {
    setHint(message);
    setNudge((n) => ({ i, n: (n?.n ?? 0) + 1 }));
  };

  const commit = (next: string, focusAt: number) => {
    if (next.length === len && next === site.codes.prefix.slice(0, len)) {
      refuse(0, PREFIX_HINT);
      change("");
      focusSoon(0);
      return;
    }
    change(next);
    if (next.length === len) onComplete?.(formatCode(next));
    focusSoon(Math.min(focusAt, len - 1));
  };

  /** Put typed/pasted text into the boxes starting at box `at`. */
  const ingest = (text: string, at: number) => {
    const cleaned = text.toUpperCase().replace(/[\s\-_.]/g, "");
    const chars = [...(cleaned.length > 1 ? codeBody(cleaned) : cleaned)];
    const ambiguous = chars.some(isAmbiguousChar);
    const valid = chars.filter(isCodeChar);
    if (ambiguous) refuse(at, AMBIGUOUS_HINT);
    else setHint(null);
    if (!valid.length) return;
    if (valid.length >= len) {
      commit(valid.slice(0, len).join(""), len - 1);
      return;
    }
    const cur = live.current;
    const start = Math.min(at, cur.length);
    const next = (cur.slice(0, start) + valid.join("") + cur.slice(start + valid.length)).slice(0, len);
    commit(next, start + valid.length);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, box: number) => {
    if (disabled || readOnly) return;
    const k = e.key;
    const i = pending.current ?? box;
    const body = live.current;
    switch (k) {
      case "Backspace":
        e.preventDefault();
        setHint(null);
        if (body[i]) {
          change(body.slice(0, i) + body.slice(i + 1));
          focusSoon(i);
        } else if (i > 0) {
          change(body.slice(0, i - 1) + body.slice(i));
          focusSoon(i - 1);
        }
        return;
      case "Delete":
        e.preventDefault();
        if (body[i]) change(body.slice(0, i) + body.slice(i + 1));
        return;
      case "ArrowLeft":
        e.preventDefault();
        focusBox(i - 1);
        return;
      case "ArrowRight":
        e.preventDefault();
        focusBox(Math.min(i + 1, body.length));
        return;
      case "Home":
        e.preventDefault();
        focusBox(0);
        return;
      case "End":
        e.preventDefault();
        focusBox(Math.min(body.length, len - 1));
        return;
    }
    if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (isAmbiguousChar(k)) return refuse(i, AMBIGUOUS_HINT);
      if (!isCodeChar(k)) return; // spaces, dashes, punctuation: quietly ignored
      ingest(k, i);
    }
  };

  // Mobile keyboards often report key "Unidentified": the change event is the source of truth.
  // The boxes are controlled, so anything we don't accept simply never appears.
  const onBoxChange = (e: ChangeEvent<HTMLInputElement>, box: number) => {
    if (disabled || readOnly) return;
    const i = pending.current ?? box;
    const body = live.current;
    const v = e.target.value;
    if (!v) {
      if (body[i]) change(body.slice(0, i) + body.slice(i + 1));
      return;
    }
    const existing = body[i] ?? "";
    let text = v;
    if (existing && v.length === 2) {
      const up = v.toUpperCase();
      text = up[0] === existing ? up.slice(1) : up.slice(0, 1);
    }
    ingest(text, i);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    e.preventDefault();
    if (disabled || readOnly) return;
    ingest(e.clipboardData.getData("text"), i);
  };

  const onFocus = (i: number) => {
    if (i > body.length) focusBox(body.length);
    else refs.current[i]?.select();
  };

  const tone = state === "checking" ? "neutral" : error ? "error" : hint ? "hint" : state === "success" ? "success" : null;

  return (
    <div className={cn("sd-code", className)} data-state={state} data-invalid={error ? "true" : undefined}>
      <span id={labelId} className={hideLabel ? "sr-only" : "postal-label text-ink-soft"}>
        {label}
        <span className="sr-only">, {site.codes.prefix} dash is already filled in</span>
      </span>
      <div className="sd-code__row" role="group" aria-labelledby={labelId} aria-describedby={msgId}>
        <span className="sd-code__prefix" aria-hidden>
          {site.codes.prefix}-
        </span>
        {Array.from({ length: len }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? id : `${id}-${i + 1}`}
            className="sd-code__box"
            value={body[i] ?? ""}
            data-filled={body[i] ? "true" : undefined}
            data-nudge={nudge?.i === i ? (nudge.n % 2 ? "a" : "b") : undefined}
            style={{ "--tilt": `${TILTS[i % TILTS.length]}deg` } as CSSProperties}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={i === len - 1 ? "go" : "next"}
            aria-label={`Character ${i + 1} of ${len}`}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            readOnly={readOnly}
            autoFocus={autoFocus && i === 0}
            onKeyDown={(e) => onKeyDown(e, i)}
            onChange={(e) => onBoxChange(e, i)}
            onPaste={(e) => onPaste(e, i)}
            onFocus={() => onFocus(i)}
          />
        ))}
        {state === "success" && (
          <span className="sd-code__stamp" aria-hidden>
            <Postmark variant="circle" place="RECEIVED" bottom="SAUDADE" ink="red" size={96} opacity={0.9} seed={42} />
          </span>
        )}
      </div>
      <p id={msgId} className="sd-code__msg" data-tone={tone ?? undefined} aria-live="polite">
        {tone === "neutral" && (
          <>
            <svg className="sd-ink__spin" viewBox="0 0 20 20" width="16" height="16" aria-hidden focusable="false">
              <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.2 2.4" opacity="0.45" />
              <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{checkingText}</span>
          </>
        )}
        {tone === "error" && (
          <>
            <IconWarning size={16} />
            <span>{error}</span>
          </>
        )}
        {tone === "hint" && <span>{hint}</span>}
        {tone === "success" && (
          <>
            <IconCheck size={16} strokeWidth={2.2} />
            <span>{successText}</span>
          </>
        )}
      </p>
    </div>
  );
}
