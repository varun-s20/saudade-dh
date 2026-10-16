/** UnitService over HTTP (ARCHITECTURE.md §6.1). Codes are normalised and hashed server-side. */
import type { ClaimResult, SenderEnvelope, UnitService } from "@/lib/services/types";
import { fail, ok, rememberSenderUnit, request } from "./http";
import { takeMediaUrls, type WithMediaUrls } from "./media";

/** Longest thing worth sending: "SAUD-XXXX-XXXX" plus stray spaces. Anything longer is invalid. */
const MAX_CODE_INPUT = 32;

export const apiUnitService: UnitService = {
  async claim(code, opts) {
    const input = code.trim();
    if (!input || input.length > MAX_CODE_INPUT) return fail("invalid_code");
    const res = await request<ClaimResult>({
      method: "POST",
      path: "/api/claim",
      body: { code: input, ...(opts?.challengeToken ? { turnstileToken: opts.challengeToken } : {}) },
    });
    if (res.ok) rememberSenderUnit(res.data.slug, res.data.token);
    return res;
  },

  async saveSenderEmail(token, email) {
    return request<void>({
      method: "PUT",
      path: "/api/sender/email",
      auth: { sender: token },
      body: { email: email.trim() },
      expect: "empty",
    });
  },

  /** 202 whether or not the email is known (no enumeration). Only rate limits and outages fail. */
  async recoverLink(email) {
    return request<void>({ method: "POST", path: "/api/recover", body: { email: email.trim() }, expect: "empty" });
  },

  async seal(token) {
    const res = await request<WithMediaUrls<SenderEnvelope>>({ method: "POST", path: "/api/sender/seal", auth: { sender: token } });
    return res.ok ? ok(takeMediaUrls(res.data)) : res;
  },
};
