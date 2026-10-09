"use client";

import { useParams } from "next/navigation";
import { senderPath } from "@/config/site";
import { useServiceQuery } from "@/lib/hooks/useServiceQuery";
import { services } from "@/lib/services";

/**
 * The sender's private token from the route. Reads params, so every screen that calls it must
 * render inside <Suspense> (README rule 2); the page.tsx files do that.
 */
export function useSenderToken(): string {
  const { token } = useParams<{ token: string }>();
  return token ?? "";
}

/**
 * Load the sender's envelope for the current token. Under Activity, a hidden route's effects
 * re-run when it is shown again, so returning to a screen quietly refetches (fresh stamps on the
 * portal home after an editor saved).
 */
export function useSenderEnvelope(token: string) {
  return useServiceQuery(() => services.content.getSenderEnvelope(token), [token]);
}

/** Portal paths for a token. */
export function senderLinks(token: string) {
  const home = senderPath(token);
  return {
    home,
    photos: `${home}/photos`,
    letter: `${home}/letter`,
    voice: `${home}/voice`,
    song: `${home}/song`,
    seal: `${home}/seal`,
    preview: `${home}/preview`,
  } as const;
}
