"use client";

/**
 * Cloudflare Turnstile, the quiet "are you a person" check (ARCHITECTURE.md §9.2). Only shown on
 * the claim page while mass code-guessing has tripped the breaker; otherwise never loaded. The
 * script comes from challenges.cloudflare.com (allowed by the CSP in next.config.ts).
 */
import { useEffect, useRef } from "react";

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Turnstile({ siteKey, onToken, onError }: { siteKey: string; onToken: (token: string) => void; onError: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  // The widget keeps the callbacks it was rendered with; route them through refs to the latest.
  const handlers = useRef({ onToken, onError });
  useEffect(() => {
    handlers.current = { onToken, onError };
  });

  useEffect(() => {
    let id: string | null = null;
    let api: TurnstileApi | null = null;
    let alive = true;
    loadTurnstile()
      .then((t) => {
        if (!alive || !box.current) return;
        api = t;
        id = t.render(box.current, {
          sitekey: siteKey,
          action: "claim",
          callback: (token: string) => handlers.current.onToken(token),
          "error-callback": () => handlers.current.onError(),
          "expired-callback": () => handlers.current.onError(),
        });
      })
      .catch(() => handlers.current.onError());
    return () => {
      alive = false;
      if (api && id) api.remove(id);
    };
  }, [siteKey]);

  return <div ref={box} className="min-h-[65px]" />;
}
