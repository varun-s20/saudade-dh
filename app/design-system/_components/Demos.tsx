"use client";

/** Interactive specimens for the style guide. Demo state only; no services are touched. */
import { useEffect, useRef, useState } from "react";
import { InkButton, InkLink } from "@/components/ui/InkButton";
import { IconCheck, IconMail, IconPlus, IconTrash, IconUpload } from "@/components/ui/icons";
import { StampedInput, FieldCounter } from "@/components/forms/StampedInput";
import { StampedTextarea } from "@/components/forms/StampedTextarea";
import { CodeInput, type CodeInputState } from "@/components/forms/CodeInput";
import { UploadTile } from "@/components/forms/UploadTile";
import { ProgressStamp } from "@/components/ui/ProgressStamp";
import { PaperLoader } from "@/components/ui/PaperLoader";
import { toast } from "@/lib/state/toast";
import { site } from "@/config/site";
import { Cell, Grid, SubHead } from "./ds";

// ── Buttons ──────────────────────────────────────────────────────────────
export function ButtonsDemo() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = window.setTimeout(() => setBusy(false), 1800);
    return () => window.clearTimeout(t);
  }, [busy]);

  return (
    <>
      <SubHead note="Pills on a hard navy shadow (gumroad.com): hover lifts 2px onto a 5px shadow, a press lands it at scale .97 in 140ms, the arrow slides out and a twin slides in.">Variants</SubHead>
      <Grid className="sm:grid-cols-2 lg:grid-cols-3">
        <Cell label="primary" note="Post-box red · cream text">
          <InkButton arrow>Start filling</InkButton>
        </Cell>
        <Cell label="secondary" note="Linen face, ink outline">
          <InkButton variant="secondary">Preview</InkButton>
        </Cell>
        <Cell label="ink" note="Navy · on photos and sunsets, coral shadow">
          <InkButton variant="ink" arrow>
            How tapping works
          </InkButton>
        </Cell>
        <Cell label="paper" note="Cream on turquoise / navy bands, ochre shadow" bodyClassName="band-cobalt">
          <InkButton variant="paper" arrow>
            Claim your code
          </InkButton>
        </Cell>
        <Cell label="quiet" note="Underlined in red, still 44px tall">
          <InkButton variant="quiet" arrow>
            All help
          </InkButton>
        </Cell>
        <Cell label="danger" note="Removing things">
          <InkButton variant="danger" icon={<IconTrash size={18} />}>
            Remove
          </InkButton>
        </Cell>
      </Grid>

      <SubHead>States &amp; sizes</SubHead>
      <Grid className="sm:grid-cols-2 lg:grid-cols-3">
        <Cell label="lg + icon" className="col-span-2 sm:col-span-1">
          <InkButton size="lg" icon={<IconMail size={20} />}>
            Email it to me
          </InkButton>
        </Cell>
        <Cell label="loading" note="Tap it: keeps focus, announces “Saving…”" className="col-span-2 sm:col-span-1">
          <InkButton loading={busy} loadingLabel="Saving…" onClick={() => setBusy(true)} icon={<IconCheck size={18} />}>
            {busy ? "Saving" : "Save"}
          </InkButton>
        </Cell>
        <Cell label="disabled">
          <InkButton disabled>Seal &amp; send</InkButton>
        </Cell>
        <Cell label="secondary · disabled">
          <InkButton variant="secondary" disabled>
            Replay
          </InkButton>
        </Cell>
        <Cell label="InkLink" note="Same look, navigates">
          <InkLink href="/design-system/directions" variant="secondary">
            Directions
          </InkLink>
        </Cell>
        <Cell label="fullWidth · lg" className="col-span-2" bodyClassName="px-4">
          <div className="w-full max-w-[22rem]">
            <InkButton size="lg" fullWidth>
              Seal &amp; send
            </InkButton>
          </div>
        </Cell>
      </Grid>
    </>
  );
}

// ── Fields ───────────────────────────────────────────────────────────────
export function FieldsDemo() {
  const [to, setTo] = useState("Theo");
  const [email, setEmail] = useState("mira@");
  const [caption, setCaption] = useState("The pier where we said goodbye");
  const [letter, setLetter] = useState(
    "It's raining here the way it used to on Thursdays, when we'd give up on the bus and walk the long way home instead.",
  );
  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
      <div className="flex flex-col gap-8">
        <StampedInput label="Who is it for?" prefix="Dear" font="hand" value={to} onChange={(e) => setTo(e.target.value)} maxLength={site.limits.letterNameChars} />
        <StampedInput
          label="Your email"
          type="email"
          inputMode="email"
          autoComplete="email"
          font="ui"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint="Only for sending you your private link. Never shared."
          error={email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "That email doesn't look complete. Check the part after the @." : null}
        />
        <StampedInput
          label="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          counter={<FieldCounter count={caption.length} max={site.limits.photoCaptionChars} />}
          hint="Optional. Shown handwritten under the photo."
        />
        <StampedInput label="Disabled" value="SAUD-3K7M" disabled readOnly font="ui" />
      </div>
      <StampedTextarea
        label="Your letter"
        font="hand"
        ruled
        autoGrow
        rows={5}
        value={letter}
        onChange={(e) => setLetter(e.target.value)}
        counter={<FieldCounter count={letter.length} max={site.limits.letterChars} />}
        hint="What you see here is exactly what they'll see."
      />
    </div>
  );
}

// ── Code input ───────────────────────────────────────────────────────────
export function CodeInputDemo() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<CodeInputState>("idle");
  const [error, setError] = useState<string | undefined>();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onComplete = (code: string) => {
    setState("checking");
    setError(undefined);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (code === "SAUD-3K7M") setState("success");
      else {
        setState("error");
        setError(code === "SAUD-9PXR" ? "This code has already been claimed. If that was you, check your email for your private link." : "We couldn't find that code. Check the card and try again.");
      }
    }, 900);
  };

  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[1.2fr_1fr]">
      <div className="ds-cell p-5 sm:p-7">
        <label htmlFor="ds-code" className="postal-label mb-3 block text-ink-soft">
          Try it · Activation code
        </label>
        <CodeInput
          id="ds-code"
          value={value}
          onChange={(v) => {
            setValue(v);
            if (state !== "idle") setState("idle");
            setError(undefined);
          }}
          onComplete={onComplete}
          state={state}
          error={error}
        />
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-faded">
          Type <strong className="font-postal text-ink-soft">3K7M</strong> (valid), <strong className="font-postal text-ink-soft">9PXR</strong> (claimed), or press 0, O, 1, I or L. Paste{" "}
          <strong className="font-postal text-ink-soft">saud3k7m</strong> or <strong className="font-postal text-ink-soft">SAUD-0000</strong>.
        </p>
        {state !== "idle" && (
          <InkButton
            variant="quiet"
            onClick={() => {
              setValue("");
              setState("idle");
              setError(undefined);
            }}
          >
            Reset
          </InkButton>
        )}
      </div>
      <div className="flex flex-col gap-8">
        <Cell label="state: checking" bodyClassName="justify-start min-h-0">
          <CodeInput id="ds-code-checking" value="3K7M" onChange={() => {}} state="checking" />
        </Cell>
        <Cell label="state: error" bodyClassName="justify-start min-h-0">
          <CodeInput id="ds-code-error" value="9PXR" onChange={() => {}} state="error" error="This code has already been claimed." />
        </Cell>
        <Cell label="state: success (stamp press)" bodyClassName="justify-start min-h-0">
          <CodeInput id="ds-code-success" value="3K7M" onChange={() => {}} state="success" />
        </Cell>
      </div>
    </div>
  );
}

// ── Upload tiles ─────────────────────────────────────────────────────────
export function UploadDemo() {
  const [count, setCount] = useState(7);
  const max = site.limits.photos;
  return (
    <Grid className="lg:grid-cols-4">
      <Cell label={`idle · ${count} / ${max}`} note="Tap, click or Tab + Enter" bodyClassName="p-3">
        <UploadTile
          className="aspect-square w-full"
          accept="image/*"
          multiple
          onFiles={(f) => {
            setCount((c) => Math.min(max, c + f.length));
            toast(`${f.length === 1 ? "1 photo" : `${f.length} photos`} tucked in`, { tone: "success" });
          }}
          limitReached={count >= max}
          hint={`${max - count} more`}
        />
      </Cell>
      <Cell label="dragging over" note="Desktop drag-and-drop" bodyClassName="p-3">
        <UploadTile className="aspect-square w-full" onFiles={() => {}} dragging hint="Up to 15" />
      </Cell>
      <Cell label="limit reached" bodyClassName="p-3">
        <UploadTile className="aspect-square w-full" onFiles={() => {}} limitReached hint={`${max} / ${max}`} />
      </Cell>
      <Cell label="wide · voice upload" className="col-span-2 sm:col-span-3 lg:col-span-1" bodyClassName="p-3">
        <UploadTile className="w-full" onFiles={() => {}} accept="audio/*" label="Upload a recording" hint="Up to 3:00 · m4a, mp3, wav" icon={<IconUpload size={20} />} />
      </Cell>
    </Grid>
  );
}

// ── Progress, loader, toasts ─────────────────────────────────────────────
export function FeedbackDemo() {
  const [p, setP] = useState<number | null>(null);
  useEffect(() => {
    if (p === null || p >= 1) return;
    const t = window.setTimeout(() => setP((v) => Math.min(1, (v ?? 0) + 0.07)), 140);
    return () => window.clearTimeout(t);
  }, [p]);

  return (
    <>
      <SubHead note="Ticks fill clockwise; only opacity changes.">ProgressStamp</SubHead>
      <Grid className="lg:grid-cols-5">
        <Cell label="0">
          <ProgressStamp value={0} label="Compressing" />
        </Cell>
        <Cell label="0.35">
          <ProgressStamp value={0.35} label="Compressing" />
        </Cell>
        <Cell label="0.72 · terracotta">
          <ProgressStamp value={0.72} label="Uploading" ink="terracotta" />
        </Cell>
        <Cell label="done">
          <ProgressStamp value={1} label="Tucked in" ink="sage" />
        </Cell>
        <Cell label="indeterminate">
          <ProgressStamp label="Preparing" />
        </Cell>
      </Grid>
      <div className="mt-6 flex flex-wrap items-center gap-6">
        <ProgressStamp value={p ?? 0} label={p === null ? "Ready" : p >= 1 ? "Tucked in" : "Uploading"} size={72} />
        <InkButton variant="secondary" icon={<IconPlus size={18} />} onClick={() => setP(0)}>
          Simulate an upload
        </InkButton>
      </div>

      <SubHead>PaperLoader</SubHead>
      <Grid className="lg:grid-cols-3">
        <Cell label="default">
          <PaperLoader label="Opening the envelope…" />
        </Cell>
        <Cell label="small · no caption" note="Caption is still announced">
          <PaperLoader size={36} showLabel={false} label="Loading" />
        </Cell>
      </Grid>

      <SubHead note="Auto-dismiss; hover or focus pauses. Errors are assertive and plain.">Toasts</SubHead>
      <div className="flex flex-wrap gap-3">
        <InkButton variant="secondary" onClick={() => toast("Sealed with care", { tone: "success", body: "They'll see it next time they tap." })}>
          Success
        </InkButton>
        <InkButton variant="secondary" onClick={() => toast("Link copied")}>
          Neutral
        </InkButton>
        <InkButton
          variant="secondary"
          onClick={() => toast("That photo didn't upload", { tone: "error", body: "Check your connection and try again. Your other photos are safe." })}
        >
          Error
        </InkButton>
      </div>
    </>
  );
}
