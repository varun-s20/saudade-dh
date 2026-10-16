/**
 * Server configuration, read lazily so `next build` never needs secrets. Every value comes from
 * the environment (`.env.local` locally, the host's env settings in staging/production); see
 * `.env.example` for the full list and docs/BACKEND.md for where each one comes from.
 */
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v.trim();
}

/** 32 random bytes, given as 64 hex characters. */
function key32(name: string): Buffer {
  const v = required(name);
  if (!/^[0-9a-f]{64}$/i.test(v)) throw new Error(`${name} must be 64 hex characters (32 bytes)`);
  return Buffer.from(v, "hex");
}

const optional = (name: string): string | null => process.env[name]?.trim() || null;

export const env = {
  /** Supabase → Project settings → Database → Connection pooling (transaction mode, port 6543). */
  databaseUrl: () => required("DATABASE_URL"),
  /** Supabase → Project settings → API → Project URL. */
  supabaseUrl: () => required("SUPABASE_URL").replace(/\/+$/, ""),
  /** Supabase → Project settings → API → service_role key. Server only, never NEXT_PUBLIC_. */
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  mediaBucket: () => process.env.SUPABASE_MEDIA_BUCKET?.trim() || "media",
  /**
   * HMAC pepper for activation codes (ARCHITECTURE.md §3.2). Losing it makes every unclaimed
   * printed card unclaimable, so it is escrowed by the client, never stored in the database.
   */
  codePepper: () => key32("CODE_PEPPER_V1"),
  /** Keys IP addresses for rate limits and abuse correlation; raw IPs are never stored. */
  ipHashKey: () => key32("IP_HASH_KEY"),
  /** Optional: transactional email via Resend. Without it, emails are logged, not delivered. */
  resendApiKey: () => process.env.RESEND_API_KEY?.trim() || null,
  emailFrom: () => process.env.EMAIL_FROM?.trim() || "Saudade <letters@saudade.example>",
  /** Optional: the public origin used in emailed links. Defaults to the request's own origin. */
  publicOrigin: () => process.env.PUBLIC_APP_ORIGIN?.trim().replace(/\/+$/, "") || null,
  /** Bearer secret Vercel Cron sends to /api/cron/*. Unset = the cron routes refuse every call. */
  cronSecret: () => optional("CRON_SECRET"),
  /** Cloudflare Turnstile secret (with NEXT_PUBLIC_TURNSTILE_SITE_KEY): the claim breaker's bot check. */
  turnstileSecret: () => optional("TURNSTILE_SECRET_KEY"),
  /** Optional ffmpeg binary override; by default the one bundled by the ffmpeg-static package. */
  ffmpegPath: () => optional("FFMPEG_PATH"),
  /** Deployed commit, for /api/health (Vercel sets VERCEL_GIT_COMMIT_SHA). */
  version: () => (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_VERSION ?? "dev").slice(0, 12),
};
