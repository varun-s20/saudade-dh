/**
 * Shared HTTP plumbing for the Phase 3 API services (NEXT_PUBLIC_DATA_SOURCE=api).
 * Endpoint contracts: docs/ARCHITECTURE.md §6 (REST API).
 *
 * Conventions the server guarantees:
 *   - JSON in, JSON out. Errors are `{ code: ServiceErrorCode, detail?, retryAfterSec? }`.
 *   - Sender calls carry `Authorization: Bearer <sender token>` (never in API paths or query
 *     strings, so tokens stay out of API access logs).
 *   - Admin calls ride the `__Host-saudade_admin` cookie (HttpOnly, Secure, SameSite=Strict) and
 *     must send `X-Saudade-CSRF: 1` on every non-GET (a custom header cannot be sent cross-site
 *     without a CORS preflight, which the API never approves).
 *   - Recipient calls carry nothing but the slug.
 */
import type { ServiceError, ServiceErrorCode, ServiceResult } from "@/lib/services/types";

/** Same origin by default; override for a split deployment. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 15_000;

const SERVICE_ERROR_CODES: ReadonlySet<ServiceErrorCode> = new Set<ServiceErrorCode>([
  "invalid_code",
  "already_claimed",
  "rate_limited",
  "not_found",
  "unauthorized",
  "upload_failed",
  "too_large",
  "too_long",
  "unsupported_link",
  "nothing_to_seal",
  "invalid_input",
  "challenge_required",
  "network",
]);

export const isServiceErrorCode = (v: unknown): v is ServiceErrorCode =>
  typeof v === "string" && SERVICE_ERROR_CODES.has(v as ServiceErrorCode);

/**
 * Fallback mapping when a response carries no recognisable `code` (proxy error page, platform
 * 413/504, etc.). The server's own body always wins.
 */
export function codeForStatus(status: number): ServiceErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404 || status === 410) return "not_found";
  if (status === 409) return "already_claimed";
  if (status === 413) return "too_large";
  if (status === 429) return "rate_limited";
  return "network";
}

export type Auth = { sender: string } | "admin" | "none";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path under API_BASE, e.g. "/api/claim". Build with `path()` to encode segments. */
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  auth?: Auth;
  /** "json" (default) parses the body; "text" returns it raw (CSV); "empty" ignores it. */
  expect?: "json" | "text" | "empty";
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Override the cookie policy (default: same-origin for admin calls, omitted otherwise). */
  credentials?: RequestCredentials;
}

export const ok = <T,>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = <T = never,>(code: ServiceErrorCode, extra: Omit<ServiceError, "code"> = {}): ServiceResult<T> => ({
  ok: false,
  error: { code, ...extra },
});

/** Encode each dynamic path segment: path`/api/admin/units/${id}`. */
export function path(strings: TemplateStringsArray, ...values: (string | number)[]): string {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ""), "");
}

function buildUrl(p: string, query?: RequestOptions["query"]): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return `${API_BASE}${p}${s ? `?${s}` : ""}`;
}

function retryAfterFrom(res: Response, body: Record<string, unknown> | null): number | undefined {
  if (typeof body?.retryAfterSec === "number") return body.retryAfterSec;
  const h = res.headers.get("retry-after");
  if (!h) return undefined;
  const n = Number(h);
  if (Number.isFinite(n)) return Math.max(0, Math.ceil(n));
  const at = Date.parse(h);
  return Number.isFinite(at) ? Math.max(0, Math.ceil((at - Date.now()) / 1000)) : undefined;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Turn a non-2xx response into a ServiceError. */
export async function toServiceError(res: Response): Promise<ServiceError> {
  const raw = await readJson(res).catch(() => null);
  const body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
  const code = isServiceErrorCode(body?.code) ? body.code : codeForStatus(res.status);
  const detail = typeof body?.detail === "string" ? body.detail : `HTTP ${res.status}`;
  const retryAfterSec = code === "rate_limited" ? retryAfterFrom(res, body) : undefined;
  return retryAfterSec === undefined ? { code, detail } : { code, detail, retryAfterSec };
}

/**
 * The one fetch wrapper every API service uses. Never throws: transport failures and timeouts
 * become `network`, HTTP errors are mapped to ServiceErrorCode.
 */
export async function request<T>(opts: RequestOptions): Promise<ServiceResult<T>> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const auth = opts.auth ?? "none";
  if (typeof auth === "object") headers.authorization = `Bearer ${auth.sender}`;
  if (auth === "admin" && method !== "GET") headers["x-saudade-csrf"] = "1";

  let res: Response;
  try {
    res = await fetch(buildUrl(opts.path, opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      // Admin session cookie is same-origin; sender/recipient calls don't need cookies (except
      // the reveal POST, which lets an admin's packing check be recognised: see reveal.ts).
      credentials: opts.credentials ?? (auth === "admin" ? "same-origin" : "omit"),
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    return fail("network", { detail: e instanceof Error ? e.name : "fetch failed" });
  }

  if (!res.ok) return { ok: false, error: await toServiceError(res) };

  const expect = opts.expect ?? "json";
  try {
    if (expect === "empty") return ok(undefined as T);
    if (expect === "text") return ok((await res.text()) as T);
    if (res.status === 204) return ok(undefined as T);
    return ok((await res.json()) as T);
  } catch {
    return fail("network", { detail: "malformed response body" });
  }
}

/**
 * PUT a blob straight to object storage (presigned URL) with real upload progress.
 * fetch() has no upload progress events in browsers, so this one uses XMLHttpRequest.
 */
export function putWithProgress(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
  timeoutMs = 120_000,
): Promise<ServiceResult<void>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = timeoutMs;
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      resolve(xhr.status >= 200 && xhr.status < 300 ? ok(undefined) : fail("upload_failed", { detail: `storage HTTP ${xhr.status}` }));
    xhr.onerror = () => resolve(fail("upload_failed", { detail: "network error during upload" }));
    xhr.ontimeout = () => resolve(fail("upload_failed", { detail: "upload timed out" }));
    xhr.onabort = () => resolve(fail("upload_failed", { detail: "upload aborted" }));
    xhr.send(blob);
  });
}

// ─── Client-side memory (same-origin localStorage, best effort) ─────────────

const SENDER_UNITS_KEY = "saudade.sender-units.v1";

/**
 * Remember which slugs this device holds a sender token for, so a sender who taps their own
 * ceramic (to test it) never uses up the recipient's first open: markRevealed() then sends the
 * token and the server records a `sender_excluded` event instead of a reveal.
 */
export function rememberSenderUnit(slug: string, token: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(SENDER_UNITS_KEY) ?? "{}") as Record<string, string>;
    map[slug] = token;
    localStorage.setItem(SENDER_UNITS_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable (private mode): the server-side checks still apply
  }
}

export function senderTokenForSlug(slug: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(SENDER_UNITS_KEY) ?? "{}") as Record<string, unknown>;
    const t = map[slug];
    return typeof t === "string" ? t : null;
  } catch {
    return null;
  }
}

/** Idempotency keys for POSTs that must not double-apply on retry (reveal, batch generation). */
export function idempotencyKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
