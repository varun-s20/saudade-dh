"use client";

/**
 * Resolve media ids to loadable URLs through `services.media.getUrl` (prototype: a static
 * /demo/... path for "demo:" ids or an object URL from IndexedDB; production: a short-lived signed
 * CDN URL). `undefined` = still resolving, `null` = missing.
 */
import { useEffect, useState } from "react";
import { services } from "@/lib/services";

export function useMediaUrls(ids: readonly string[]): Record<string, string | null | undefined> {
  const key = ids.join("|");
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let alive = true;
    const list = key ? key.split("|") : [];
    Promise.all(
      list.map(async (id) => {
        try {
          return [id, await services.media.getUrl(id, "display")] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((entries) => {
      if (alive) setUrls(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return urls;
}

export function useMediaUrl(id: string | null | undefined): string | null | undefined {
  const urls = useMediaUrls(id ? [id] : []);
  return id ? urls[id] : null;
}
