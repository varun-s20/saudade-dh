"use client";

import dynamic from "next/dynamic";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { dataSource } from "@/lib/services";
import { useDemo } from "@/lib/state/demo";

// Both are client-only and code-split: the Demo Panel never ships in the recipient's
// critical path unless the presenter has enabled it.
const Toaster = dynamic(() => import("@/components/ui/Toaster").then((m) => m.Toaster), { ssr: false });
const DemoPanel = dynamic(() => import("@/components/demo/DemoPanel").then((m) => m.DemoPanel), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const motion = useDemo((s) => s.motion);
  const demoEnabled = useDemo((s) => s.enabled);

  // ?demo=1 enables the presenter panel (?demo=0 disables). Read in an effect, not via
  // useSearchParams, so no route needs a Suspense boundary for it. The panel drives the in-browser
  // mock data, so it only exists when the app runs on mock data (never against the real backend).
  useEffect(() => {
    if (dataSource !== "mock") return;
    const flag = new URLSearchParams(window.location.search).get("demo");
    if (flag === "1") useDemo.getState().setEnabled(true);
    if (flag === "0") useDemo.getState().setEnabled(false);
  }, []);

  // Mirror the motion override onto <html> so CSS transitions respect it too.
  useEffect(() => {
    const el = document.documentElement;
    if (motion === "system") el.removeAttribute("data-motion");
    else el.setAttribute("data-motion", motion);
  }, [motion]);

  return (
    <MotionConfig reducedMotion={motion === "reduce" ? "always" : motion === "full" ? "never" : "user"}>
      {children}
      {hydrated && <Toaster />}
      {hydrated && demoEnabled && dataSource === "mock" && <DemoPanel />}
    </MotionConfig>
  );
}
