"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServiceError, ServiceResult } from "@/lib/services/types";

export type QueryState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: ServiceError };

const toState = <T,>(res: ServiceResult<T>): QueryState<T> =>
  res.ok ? { status: "success", data: res.data } : { status: "error", error: res.error };

/**
 * Run a service call on mount (and when `deps` change). Returns state + `reload()` + `setData()`
 * for optimistic updates after a mutation.
 *
 *   const q = useServiceQuery(() => services.content.getSenderEnvelope(token), [token]);
 */
export function useServiceQuery<T>(fn: () => Promise<ServiceResult<T>>, deps: readonly unknown[]) {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const fnRef = useRef(fn);
  const run = useRef(0);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    const id = ++run.current;
    void fnRef.current().then((res) => {
      if (id === run.current) setState(toState(res));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  /** Re-fetch. `quiet` keeps the current data on screen while loading. */
  const reload = useCallback(async (quiet = false) => {
    const id = ++run.current;
    if (!quiet) setState({ status: "loading" });
    const res = await fnRef.current();
    if (id === run.current) setState(toState(res));
  }, []);

  const setData = useCallback((data: T) => setState({ status: "success", data }), []);

  return { ...state, reload, setData } as QueryState<T> & { reload: (quiet?: boolean) => Promise<void>; setData: (d: T) => void };
}
