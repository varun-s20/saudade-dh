"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during SSR/prerender and the hydration render, true afterwards. Gate anything that
 * reads localStorage-backed stores so server and client markup match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
