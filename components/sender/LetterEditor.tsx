"use client";

/**
 * S9 · Letter editor. The writing surface IS the stationery the recipient reads (WYSIWYG):
 * The pen face (Nanum Pen Script) in blue-black ink on ruled paper with a margin line, "Dear ___," at the top,
 * a sign-off and a signature at the foot. Explicit Save on the pinned slip; no autosave.
 *
 * Long letters on a phone: the textarea grows with the text (no inner scrollbar), the Save slip
 * rides above the keyboard, and a caret guard scrolls just enough to keep the line being written
 * above that slip.
 */
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { FieldCounter, StampedInput } from "@/components/forms/StampedInput";
import { StampedTextarea } from "@/components/forms/StampedTextarea";
import { PaperSheet } from "@/components/paper/PaperSheet";
import { STAMPS } from "@/config/stamps";
import { site } from "@/config/site";
import { services } from "@/lib/services";
import type { LetterContent, SenderEnvelope } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { SAVED_TOAST, saveErrorText } from "./copy";
import { RemoveStamp } from "./RemoveStamp";
import { SaveDock, type SaveTone } from "./SaveDock";
import { EnvelopeGate } from "./SenderStates";
import { SenderShell, UnsavedGuard } from "./SenderShell";
import { useSenderEnvelope, useSenderToken } from "./useSenderEnvelope";

const TITLE = STAMPS.letter.sender.editorTitle;
/** [PROPOSED] Sign-off length; config has no limit for it. Twice a name is plenty for "Always, and then some,". */
const SIGNOFF_MAX = site.limits.letterSignoffChars;
/** Counter appears from ~80% of the limit [PROPOSED]. */
const COUNTER_FROM = Math.round(site.limits.letterChars * 0.8);
const DEFAULT_SIGNOFF = "Always,";

interface Draft {
  to: string;
  body: string;
  signoff: string;
  from: string;
}

const toDraft = (c?: LetterContent): Draft =>
  c ? { to: c.to, body: c.body, signoff: c.signoff, from: c.from } : { to: "", body: "", signoff: DEFAULT_SIGNOFF, from: "" };

const same = (a: Draft, b: Draft) => a.to === b.to && a.body === b.body && a.signoff === b.signoff && a.from === b.from;

export function LetterEditor() {
  const token = useSenderToken();
  const q = useSenderEnvelope(token);
  if (q.status !== "success") {
    return (
      <SenderShell token={token} title={TITLE} kind="letter">
        <EnvelopeGate query={q} reload={() => q.reload()}>
          {() => null}
        </EnvelopeGate>
      </SenderShell>
    );
  }
  return <LetterBody token={token} env={q.data} refresh={() => q.reload(true)} />;
}

function LetterBody({ token, env, refresh }: { token: string; env: SenderEnvelope; refresh: () => void }) {
  const record = env.contents.letter;
  const [draft, setDraft] = useState<Draft>(() => toDraft(record?.content));
  const [baseline, setBaseline] = useState<Draft>(() => toDraft(record?.content));
  const [syncedVersion, setSyncedVersion] = useState(record?.version ?? 0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const dirty = !same(draft, baseline);

  // Saved elsewhere (another tab/device) while we were away and nothing is pending here: take it.
  const remoteVersion = record?.version ?? 0;
  if (remoteVersion !== syncedVersion && !dirty && !saving) {
    setSyncedVersion(remoteVersion);
    setDraft(toDraft(record?.content));
    setBaseline(toDraft(record?.content));
  }

  useCaretGuard(bodyRef);
  const toRef = useRef<HTMLInputElement>(null);
  const toMeasure = useRef<HTMLSpanElement>(null);
  // "Dear ___," without CSS field-sizing (Safari): size the name field to its text so the comma hugs it.
  useLayoutEffect(() => {
    const el = toRef.current;
    const m = toMeasure.current;
    if (!el || !m || (typeof CSS !== "undefined" && CSS.supports("field-sizing", "content"))) return;
    const fit = () => el.style.setProperty("width", `${Math.ceil(m.getBoundingClientRect().width) + 6}px`);
    fit();
    // The pen face may still be loading on first paint.
    void document.fonts?.ready.then(fit);
  }, [draft.to]);

  const set = (k: keyof Draft) => (value: string) => {
    setDraft((d) => ({ ...d, [k]: value }));
    setSaveError(null);
  };

  const chars = draft.body.length;
  const over = Math.max(0, chars - site.limits.letterChars);
  const empty = draft.body.trim().length === 0;
  const canSave = dirty && !empty && over === 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    const content: LetterContent = {
      kind: "letter",
      to: draft.to.trim(),
      body: draft.body.replace(/\s+$/, ""),
      signoff: draft.signoff.trim(),
      from: draft.from.trim(),
    };
    const res = await services.content.save(token, content);
    setSaving(false);
    if (!res.ok) {
      const msg = saveErrorText(res.error);
      setSaveError(msg);
      toast("Your letter didn't save", { tone: "error", body: msg });
      return;
    }
    const saved = toDraft(res.data.content);
    setDraft(saved);
    setBaseline(saved);
    setSyncedVersion(res.data.version);
    toast(SAVED_TOAST, { tone: "success", body: "Your letter is in the envelope." });
    refresh();
  };

  let status: string;
  let tone: SaveTone = "neutral";
  if (saving) {
    status = "Saving…";
    tone = "busy";
  } else if (saveError) {
    status = "Didn't save. Try again.";
    tone = "error";
  } else if (over > 0) {
    status = `${over} character${over === 1 ? "" : "s"} over the page`;
    tone = "error";
  } else if (empty && (dirty || record)) {
    status = record ? "Your letter is empty" : "Write a few words to save";
  } else if (dirty) {
    // Long letters: the counter at the top has scrolled away, so the slip says what's left.
    const left = site.limits.letterChars - chars;
    status = chars >= COUNTER_FROM ? `Unsaved · ${left} character${left === 1 ? "" : "s"} left` : "Unsaved changes";
    tone = "dirty";
  } else if (record) {
    status = "Saved";
    tone = "saved";
  } else {
    status = "Nothing to save yet";
  }

  return (
    <SenderShell token={token} title={TITLE} kind="letter" lede={<>This is the paper they&apos;ll read it on, in this same hand. Leave the name blank to skip &ldquo;Dear&rdquo;.</>} dock={<SaveDock status={status} tone={tone} canSave={canSave} saving={saving} onSave={save} />}>
      <UnsavedGuard dirty={dirty} onDiscard={() => setDraft(baseline)} />

      <PaperSheet as="section" aria-label="Writing paper" margin seed={9} className="ss-letter mt-5">
        {/* Measures "Dear ___" for browsers without CSS field-sizing (Safari), so the comma hugs the name. */}
        <span ref={toMeasure} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre font-hand text-[length:var(--text-letter)]">
          {draft.to || "their name"}
        </span>
        <StampedInput
          ref={toRef}
          className="ss-lf ss-lf--to"
          label="Who it's for (after “Dear”)"
          hideLabel
          font="hand"
          prefix="Dear"
          value={draft.to}
          onChange={(e) => set("to")(e.target.value)}
          placeholder="their name"
          maxLength={site.limits.letterNameChars}
          size={Math.max(9, draft.to.length + 1)}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="next"
        />

        <StampedTextarea
          ref={bodyRef}
          className="ss-lf ss-lf--body mt-2"
          label="Your letter"
          hideLabel
          font="hand"
          ruled
          autoGrow
          rows={7}
          value={draft.body}
          onChange={(e) => set("body")(e.target.value)}
          placeholder="Write it the way you'd say it…"
          counter={chars >= COUNTER_FROM ? <FieldCounter count={chars} max={site.limits.letterChars} /> : undefined}
          error={over > 0 ? `That's a little over the page. Trim ${over} character${over === 1 ? "" : "s"} to save it.` : null}
          autoCapitalize="sentences"
          spellCheck
        />

        {/* One line of meaning, but it wraps: a long sign-off on a phone stays readable instead of
            scrolling out of sight. Enter moves on rather than starting a new line. */}
        <StampedTextarea
          className="ss-lf mt-5"
          label="Sign-off"
          hideLabel
          font="hand"
          rows={1}
          autoGrow
          value={draft.signoff}
          onChange={(e) => set("signoff")(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={DEFAULT_SIGNOFF}
          maxLength={SIGNOFF_MAX}
          autoComplete="off"
          enterKeyHint="next"
        />
        <StampedInput
          className="ss-lf ss-lf--sig"
          label="Your name (signature)"
          hideLabel
          font="hand"
          value={draft.from}
          onChange={(e) => set("from")(e.target.value)}
          placeholder="your name"
          maxLength={site.limits.letterNameChars}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="done"
        />
      </PaperSheet>
      <p className="mt-3 text-sm leading-relaxed text-ink-faded">
        The name you sign with goes on the envelope too (&ldquo;from {draft.from.trim() || "you"}&rdquo;), so they know who it&apos;s from.
      </p>

      {record ? (
        <RemoveStamp
          token={token}
          kind="letter"
          status={env.unit.status}
          onRemoved={() => {
            const fresh = toDraft();
            setDraft(fresh);
            setBaseline(fresh);
          }}
        />
      ) : null}
    </SenderShell>
  );
}

// ─── Keep the caret above the Save slip ─────────────────────────────────────

const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "textIndent",
  "tabSize",
] as const;

/** Bottom of the caret line in viewport coordinates (mirror-div technique). */
function caretBottom(ta: HTMLTextAreaElement): number {
  const cs = window.getComputedStyle(ta);
  const mirror = document.createElement("div");
  for (const p of MIRROR_PROPS) mirror.style[p] = cs[p];
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    top: "0",
    left: "-9999px",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "normal",
  });
  mirror.textContent = ta.value.slice(0, ta.selectionEnd ?? ta.value.length);
  const mark = document.createElement("span");
  mark.textContent = "​";
  mirror.appendChild(mark);
  document.body.appendChild(mirror);
  const top = mark.offsetTop;
  const lineHeight = parseFloat(cs.lineHeight) || mark.offsetHeight;
  mirror.remove();
  const rect = ta.getBoundingClientRect();
  return rect.top + (parseFloat(cs.borderTopWidth) || 0) + top - ta.scrollTop + lineHeight;
}

function useCaretGuard(ref: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (document.activeElement !== ta) return;
        const slip = document.querySelector<HTMLElement>(".ss-dock__slip");
        const vv = window.visualViewport;
        const limit = (slip ? slip.getBoundingClientRect().top : vv ? vv.offsetTop + vv.height : window.innerHeight) - 12;
        const bottom = caretBottom(ta);
        if (bottom > limit) window.scrollBy({ top: bottom - limit, behavior: "instant" });
      });
    };
    const vv = window.visualViewport;
    ta.addEventListener("input", check);
    ta.addEventListener("focus", check);
    ta.addEventListener("click", check);
    ta.addEventListener("keyup", check);
    vv?.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      ta.removeEventListener("input", check);
      ta.removeEventListener("focus", check);
      ta.removeEventListener("click", check);
      ta.removeEventListener("keyup", check);
      vv?.removeEventListener("resize", check);
    };
  }, [ref]);
}
