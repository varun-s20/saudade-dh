/**
 * AdminService over HTTP (ARCHITECTURE.md §6.5). Session = `__Host-saudade_admin` cookie set by
 * POST /api/admin/session; every mutating call sends `X-Saudade-CSRF: 1` (see http.ts).
 *
 * Production differences from the mock, by design:
 *   - Activation codes are stored as HMAC hashes. `Unit.code` comes back masked ("SAUD-····");
 *     plaintext exists only in the responses of generateBatch, resetCode and emailCode.
 *   - exportBatchCsv returns the FACTORY file (unit_no, slug, url, ndef_bytes). Codes cannot be
 *     re-exported; the card-printing CSV is the one-time output of generateBatch.
 *   - emailCode mints a fresh code (the plaintext is not stored), which also voids any card
 *     printed for that unit. Path B units never ship with a card, so nothing is lost.
 */
import type {
  AdminService,
  AdminSession,
  AdminStats,
  Batch,
  DeliveryPath,
  EmailMessage,
  ProvisionedRow,
  StampKind,
  UnitDetail,
  UnitListPage,
} from "@/lib/services/types";
import { fail, idempotencyKey, path, request } from "./http";

export const apiAdminService: AdminService = {
  /**
   * `otp` is the [PROPOSED] TOTP second factor. The server answers 401 { detail: "otp_required" }
   * when the password is right but the code is missing (see proposed types.ts change).
   */
  async signIn(email: string, password: string, otp?: string) {
    if (!email.trim() || !password) return fail("unauthorized", { detail: "missing credentials" });
    return request<AdminSession>({
      method: "POST",
      path: "/api/admin/session",
      auth: "admin",
      body: { email: email.trim().toLowerCase(), password, ...(otp ? { otp: otp.replace(/\s+/g, "") } : {}) },
    });
  },

  async signOut() {
    await request<void>({ method: "DELETE", path: "/api/admin/session", auth: "admin", expect: "empty" });
  },

  async getSession() {
    const res = await request<AdminSession>({ path: "/api/admin/session", auth: "admin" });
    return res.ok ? res.data : null;
  },

  getStats() {
    return request<AdminStats>({ path: "/api/admin/stats", auth: "admin" });
  },

  listUnits({ search, status, batchId, page, pageSize }) {
    return request<UnitListPage>({
      path: "/api/admin/units",
      auth: "admin",
      query: { search: search?.trim(), status: status === "all" ? undefined : status, batchId, page, pageSize },
    });
  },

  getUnit(unitId) {
    return request<UnitDetail>({ path: path`/api/admin/units/${unitId}`, auth: "admin" });
  },

  resetCode(unitId) {
    return request<{ code: string }>({ method: "POST", path: path`/api/admin/units/${unitId}/reset-code`, auth: "admin" });
  },

  resetReveal(unitId) {
    return request<void>({ method: "POST", path: path`/api/admin/units/${unitId}/reset-reveal`, auth: "admin", expect: "empty" });
  },

  emailCode(unitId, to) {
    return request<EmailMessage>({
      method: "POST",
      path: path`/api/admin/units/${unitId}/email-code`,
      auth: "admin",
      body: { to: to.trim().toLowerCase() },
      headers: { "idempotency-key": idempotencyKey() },
    });
  },

  setPath(unitId, deliveryPath: DeliveryPath) {
    return request<void>({ method: "PATCH", path: path`/api/admin/units/${unitId}`, auth: "admin", body: { path: deliveryPath }, expect: "empty" });
  },

  removeContent(unitId, kind: StampKind, photoId?: string) {
    return request<void>({
      method: "DELETE",
      path: path`/api/admin/units/${unitId}/contents/${kind}`,
      auth: "admin",
      query: { photoId },
      expect: "empty",
    });
  },

  listBatches() {
    return request<Batch[]>({ path: "/api/admin/batches", auth: "admin" });
  },

  /**
   * The provisioning ceremony. The response is the ONLY time the plaintext codes exist. If it is
   * lost, void the batch in the admin and generate again (nothing has been encoded yet).
   */
  generateBatch(count, label) {
    return request<{ batch: Batch; rows: ProvisionedRow[] }>({
      method: "POST",
      path: "/api/admin/batches",
      auth: "admin",
      body: { count: Math.floor(count), label: label.trim() },
      headers: { "idempotency-key": idempotencyKey() },
      timeoutMs: 60_000,
    });
  },

  exportBatchCsv(batchId) {
    return request<string>({
      path: path`/api/admin/batches/${batchId}/export.csv`,
      auth: "admin",
      expect: "text",
      headers: { accept: "text/csv" },
    });
  },
};
