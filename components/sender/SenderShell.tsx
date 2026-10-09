"use client";

/**
 * <SenderShell>: the frame around every sender screen (S7–S14). There is deliberately no
 * app/s/[token]/layout.tsx; each page renders this shell instead.
 *
 * - Compact header: back to the portal (editors) and the wordmark, which links to the portal home
 *   (never `/`: the sender's world is their envelope). Calm phone column, centred on desktop,
 *   paper background, no SaaS chrome.
 * - Unsaved-changes guard (S12). Editors report `dirty` with `useUnsavedGuard`. Then:
 *     · in-app links made with <GuardedLink> (and the header) ask "Leave without saving?"
 *     · the browser's Back button asks too: while dirty we keep one same-URL history entry on top
 *       (a "sentinel"); popping it opens the confirm instead of leaving
 *     · tab close / reload get the browser's own beforeunload prompt
 *   No autosave (deferred).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Stamp } from "@/components/stamps/Stamp";
import { Logo } from "@/components/ui/Logo";
import { STAMPS, WORLD_FILL } from "@/config/stamps";
import type { StampKind } from "@/lib/services/types";
import { IconBack } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import { senderPath } from "@/config/site";
import { SenderConfirm } from "./SenderConfirm";
import "./sender.css";

// ─── Unsaved guard ──────────────────────────────────────────────────────────

interface GuardApi {
  /** Editors report whether they hold unsaved changes, and how to throw them away. */
  report: (dirty: boolean, discard: () => void) => void;
  /** Returns true when the navigation was intercepted (a confirm is now showing). */
  intercept: (href: string) => boolean;
  /** Leave on purpose (after a remove): no confirm, and no stray history entry left behind. */
  leave: (href: string) => void;
}

const GuardContext = createContext<GuardApi | null>(null);

/** Register an editor's unsaved state with the surrounding shell. */
export function useUnsavedGuard(dirty: boolean, discard: () => void) {
  const guard = useContext(GuardContext);
  const discardRef = useRef(discard);
  useEffect(() => {
    discardRef.current = discard;
  });
  useEffect(() => {
    guard?.report(dirty, () => discardRef.current());
  }, [guard, dirty]);
}

/** Component form of useUnsavedGuard, for editors that render the shell themselves. */
export function UnsavedGuard({ dirty, onDiscard }: { dirty: boolean; onDiscard: () => void }) {
  useUnsavedGuard(dirty, onDiscard);
  return null;
}

/** Navigate away on purpose (the editor already threw its draft away). */
export function useLeave() {
  const guard = useContext(GuardContext);
  const router = useRouter();
  return useCallback((href: string) => (guard ? guard.leave(href) : router.push(href)), [guard, router]);
}

/** A next/link that asks before leaving an editor with unsaved changes. */
export function GuardedLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const guard = useContext(GuardContext);
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && guard?.intercept(href)) e.preventDefault();
      }}
    />
  );
}

type LeaveTarget = { kind: "href"; href: string } | { kind: "back" };

function useGuardState() {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const discardRef = useRef<() => void>(() => {});
  const dirtyRef = useRef(false);
  const [pending, setPending] = useState<LeaveTarget | null>(null);
  /** A same-URL history entry is on top of the editor's own entry. */
  const armed = useRef(false);
  /** Ignore the popstate we cause ourselves when consuming the sentinel. */
  const ignorePop = useRef(false);

  const report = useCallback((d: boolean, discard: () => void) => {
    discardRef.current = discard;
    dirtyRef.current = d;
    setDirty(d);
  }, []);

  const intercept = useCallback((href: string) => {
    if (!dirtyRef.current) return false;
    setPending({ kind: "href", href });
    return true;
  }, []);

  const leave = useCallback(
    (href: string) => {
      const wasArmed = armed.current;
      armed.current = false;
      dirtyRef.current = false;
      if (wasArmed) router.replace(href);
      else router.push(href);
    },
    [router],
  );

  // Arm the sentinel while dirty; consume it once clean again (after a save).
  useEffect(() => {
    if (dirty && !armed.current) {
      window.history.pushState(null, "", window.location.href);
      armed.current = true;
    } else if (!dirty && armed.current) {
      armed.current = false;
      ignorePop.current = true;
      window.history.back();
    }
  }, [dirty]);

  // Browser Back while dirty: the sentinel pops (same URL), so ask instead of leaving.
  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) {
        ignorePop.current = false;
        return;
      }
      if (!armed.current) return;
      armed.current = false;
      if (dirtyRef.current) setPending({ kind: "back" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Tab close / reload.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Activity: never come back to a stale confirm.
  useLayoutEffect(() => () => setPending(null), []);

  const keepEditing = () => {
    if (pending?.kind === "back" && dirtyRef.current && !armed.current) {
      window.history.pushState(null, "", window.location.href);
      armed.current = true;
    }
    setPending(null);
  };

  const discardAndLeave = () => {
    const target = pending;
    setPending(null);
    // Mark clean first so the sentinel effect doesn't also step back.
    const wasArmed = armed.current;
    armed.current = false;
    dirtyRef.current = false;
    discardRef.current();
    if (!target) return;
    if (target.kind === "back") {
      window.history.back();
    } else if (wasArmed) {
      // Replace the sentinel so history stays [..., editor, target].
      router.replace(target.href);
    } else {
      router.push(target.href);
    }
  };

  const api = useMemo<GuardApi>(() => ({ report, intercept, leave }), [report, intercept, leave]);
  return { api, pending, keepEditing, discardAndLeave };
}

// ─── Shell ──────────────────────────────────────────────────────────────────

export interface SenderShellProps {
  token: string;
  /** Editor title (h1). Omit on the portal home, which draws its own heading. */
  title?: string;
  children: ReactNode;
  /** Pinned bottom bar (Save, or the home's Preview / Seal). Rendered outside <main>. */
  dock?: ReactNode;
  /** Short line under the title (editor pages). */
  lede?: ReactNode;
  /** Editor pages: which stamp's world this is (colour field + stamp in the title card). */
  kind?: StampKind;
  /** "editor" = a comfortable writing column (default); "wide" = full page grid (portal home). */
  width?: "editor" | "wide";
  className?: string;
}

/** The postcard pairing: block capitals, with the last word written in the script hand. */
function paired(title: string): ReactNode {
  const i = title.lastIndexOf(" ");
  return i < 0 ? (
    title
  ) : (
    <>
      {title.slice(0, i)} <em>{title.slice(i + 1)}</em>
    </>
  );
}

const TABS = [
  { key: "home", label: "Envelope", dot: "var(--accent-red)" },
  { key: "photos", label: "Photos", dot: WORLD_FILL.photos },
  { key: "letter", label: "Letter", dot: WORLD_FILL.letter },
  { key: "voice", label: "Voice", dot: WORLD_FILL.voice },
  { key: "song", label: "Song", dot: WORLD_FILL.song },
] as const;

export function SenderShell({ token, title, lede, kind, children, dock, width = "editor", className }: SenderShellProps) {
  const home = senderPath(token);
  const guard = useGuardState();
  const pathname = usePathname();
  const tabHref = (k: (typeof TABS)[number]["key"]) => (k === "home" ? home : `${home}/${k}`);

  const guardLogo = (e: MouseEvent) => {
    if (guard.api.intercept(home)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <GuardContext.Provider value={guard.api}>
      <div className={cn("ss-page", dock ? "ss-page--docked" : null)}>
        <a href="#main" className="sr-only-focusable m-2 rounded-soft bg-paper-raised px-3 py-2 postal-label text-ink">
          Skip to content
        </a>
        <header className="ss-head">
          <div className="ss-wrap ss-wrap--wide flex items-center gap-3">
            {title ? (
              <GuardedLink href={home} className="ss-head__back md:hidden">
                <IconBack size={20} />
                <span>Your envelope</span>
              </GuardedLink>
            ) : null}
            <span className={cn(title ? "ml-auto md:ml-0" : "")} onClickCapture={guardLogo}>
              <Logo href={home} size="sm" />
            </span>
            <nav aria-label="Your envelope" className="ss-tabs ml-auto hidden md:flex">
              {TABS.map((t) => {
                const href = tabHref(t.key);
                const current = pathname === href;
                return (
                  <GuardedLink
                    key={t.key}
                    href={href}
                    className="ss-tabs__tab"
                    style={{ ["--dot" as string]: t.dot }}
                    aria-current={current ? "page" : undefined}
                  >
                    {t.label}
                  </GuardedLink>
                );
              })}
            </nav>
          </div>
        </header>
        <main id="main" className={cn("ss-main ss-wrap", width === "wide" && "ss-wrap--wide", className)}>
          {title && kind ? (
            <div className="ss-world" style={{ ["--world" as string]: WORLD_FILL[kind] }}>
              <div className="ss-world__scene">
                <div className="min-w-0">
                  <p className="eyebrow text-ink/75">{STAMPS[kind].denomination}</p>
                  <h1 className="ss-title ink-in">{paired(title)}</h1>
                  {lede ? <p className="ss-lede">{lede}</p> : null}
                </div>
                <div className="ss-world__stamp peel" aria-hidden>
                  <Stamp kind={kind} width={112} rotate={STAMPS[kind].place.rotate} postmark />
                </div>
              </div>
            </div>
          ) : title ? (
            <div className="ss-titlebar">
              <h1 className="ss-title ink-in">{paired(title)}</h1>
              {lede ? <p className="ss-lede">{lede}</p> : null}
            </div>
          ) : null}
          {children}
        </main>
        {dock}
      </div>
      <SenderConfirm
        open={guard.pending !== null}
        title="Leave without saving?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={guard.discardAndLeave}
        onCancel={guard.keepEditing}
        danger
      >
        You have changes that aren&apos;t saved yet. If you leave now, they won&apos;t go into the envelope.
      </SenderConfirm>
    </GuardContext.Provider>
  );
}
