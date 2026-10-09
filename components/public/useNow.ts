"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared, slowly ticking "now" (ms) for relative times ("5 min ago") without calling
 * Date.now() during render (Cache Components rule). Returns 0 on the server and during the
 * hydration render, so callers should treat 0 as "not known yet".
 */
const TICK_MS = 30_000;
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  if (!current) current = Date.now();
  return current;
}

const getServerSnapshot = () => 0;

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
