/**
 * Route-handler plumbing for the REST API (ARCHITECTURE.md §6.0):
 *   - errors are `{ code: ServiceErrorCode, detail?, retryAfterSec? }` with the matching status;
 *   - every response is `Cache-Control: no-store` (except the media redirect);
 *   - JSON bodies are size-capped and validated with zod;
 *   - sender auth = `Authorization: Bearer <token>`; admin auth = session cookie + CSRF header.
 * The browser side of this contract is lib/services/api/http.ts.
 */
import "server-only";
import { connection, type NextRequest } from "next/server";
import { z } from "zod";
import type { ServiceErrorCode } from "@/lib/services/types";
import { sha256 } from "./crypto";
import { sql } from "./db";

const STATUS: Record<ServiceErrorCode, number> = {
  invalid_code: 422,
  already_claimed: 409,
  rate_limited: 429,
  not_found: 404,
  unauthorized: 401,
  upload_failed: 422,
  too_large: 413,
  too_long: 422,
  unsupported_link: 422,
  nothing_to_seal: 409,
  invalid_input: 400,
  network: 503,
};

export class ApiError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    readonly detail?: string,
    readonly retryAfterSec?: number,
    readonly status = STATUS[code],
  ) {
    super(detail ?? code);
  }
}

const NO_STORE = { "cache-control": "no-store" };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export const noContent = (headers: Record<string, string> = {}): Response => new Response(null, { status: 204, headers: { ...NO_STORE, ...headers } });
export const accepted = (): Response => new Response(null, { status: 202, headers: NO_STORE });

function errorResponse(e: ApiError): Response {
  const body: Record<string, unknown> = { code: e.code };
  if (e.detail) body.detail = e.detail;
  const headers: Record<string, string> = {};
  if (e.retryAfterSec !== undefined) {
    body.retryAfterSec = e.retryAfterSec;
    headers["retry-after"] = String(e.retryAfterSec);
  }
  return json(body, e.status, headers);
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/**
 * Wrap a route handler: maps ApiError / validation errors to the contract, and anything else to
 * `503 network` without leaking internals (the detail is logged server-side with a request id).
 */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    // Every API response depends on the request; never prerender a handler at build time.
    await connection();
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e);
      if (e instanceof z.ZodError) {
        const first = e.issues[0];
        return errorResponse(new ApiError("invalid_input", first ? `${first.path.join(".") || "body"}: ${first.message}` : "invalid body"));
      }
      const id = crypto.randomUUID().slice(0, 8);
      console.error(`[api ${id}] ${req.method} ${new URL(req.url).pathname}`, e);
      return errorResponse(new ApiError("network", `server error ${id}`, undefined, 503));
    }
  };
}

/** Parse a JSON body (≤ maxBytes) against a zod schema. */
export async function body<T>(req: NextRequest, schema: z.ZodType<T>, maxBytes = 64 * 1024): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError("too_large", "request body too large");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("invalid_input", "body is not JSON");
  }
  return schema.parse(raw);
}

/** Client IP as seen by the platform's proxy (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip"))?.trim() || "0.0.0.0";
}

/** Public origin for links in emails: PUBLIC_APP_ORIGIN, else the request's own origin. */
export function originOf(req: NextRequest, configured: string | null): string {
  if (configured) return configured;
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

// ─── Rate limits (fixed windows in Postgres; ARCHITECTURE.md §9.2) ───────────

/** Count one hit against `rule:subject` in a `windowSec` window; throws 429 once over `max`. */
export async function limit(rule: string, subject: string, windowSec: number, max: number): Promise<void> {
  const n = await hit(rule, subject, windowSec);
  if (n.count > max) throw new ApiError("rate_limited", rule, n.retryAfterSec);
}

/** Increment and return the count for the current window (no throw). */
export async function hit(rule: string, subject: string, windowSec: number): Promise<{ count: number; retryAfterSec: number }> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % windowSec);
  const key = `${rule}:${subject}:${start}`;
  const [row] = await sql()<{ count: number }[]>`
    insert into rate_limit_buckets (key, window_start, window_seconds, count, expires_at)
    values (${key}, to_timestamp(${start}), ${windowSec}, 1, to_timestamp(${start + windowSec}))
    on conflict (key) do update set count = rate_limit_buckets.count + 1
    returning count`;
  return { count: row.count, retryAfterSec: Math.max(1, start + windowSec - now) };
}

/** Read the count for the current window without incrementing. */
export async function peek(rule: string, subject: string, windowSec: number): Promise<{ count: number; retryAfterSec: number }> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (now % windowSec);
  const [row] = await sql()<{ count: number }[]>`select count from rate_limit_buckets where key = ${`${rule}:${subject}:${start}`}`;
  return { count: row?.count ?? 0, retryAfterSec: Math.max(1, start + windowSec - now) };
}

// ─── Sender auth ─────────────────────────────────────────────────────────────

export interface SenderAuth {
  unitId: string;
  /** The raw token from the header (needed only to rebuild the sender's own link). */
  token: string;
}

export function bearer(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  const m = h ? /^Bearer\s+([a-z2-7]{32})$/i.exec(h.trim()) : null;
  return m ? m[1].toLowerCase() : null;
}

/** Resolve the sender token to its unit. Unknown or revoked → 404 (the portal's "link doesn't work"). */
export async function requireSender(req: NextRequest): Promise<SenderAuth> {
  const token = bearer(req);
  if (!token) throw new ApiError("not_found", "missing or malformed sender token");
  const [row] = await sql()<{ unit_id: string; id: string }[]>`
    update sender_tokens set last_used_at = now()
    where token_hash = ${sha256(token)} and revoked_at is null
    returning unit_id, id`;
  if (!row) throw new ApiError("not_found", "unknown sender token");
  return { unitId: row.unit_id, token };
}

/** Same check without throwing (used to exclude a sender testing their own tap from the reveal). */
export async function senderUnitId(req: NextRequest): Promise<string | null> {
  const token = bearer(req);
  if (!token) return null;
  const [row] = await sql()<{ unit_id: string }[]>`select unit_id from sender_tokens where token_hash = ${sha256(token)} and revoked_at is null`;
  return row?.unit_id ?? null;
}
