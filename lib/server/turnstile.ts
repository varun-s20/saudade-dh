/**
 * Cloudflare Turnstile server-side check (ARCHITECTURE.md §9.2). Used only while the claim
 * breaker is on. Fails closed: if Cloudflare can't be reached, the claim waits rather than
 * letting guesses through during an attack.
 */
import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean; action?: string };
    return data.success === true;
  } catch {
    return false;
  }
}
