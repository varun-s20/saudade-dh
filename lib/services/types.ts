/**
 * Domain types and service contracts.
 *
 * Every screen talks to data ONLY through the interfaces below (obtained from
 * `lib/services/index.ts`). Phase 2 ships mock implementations (lib/services/mock/*) backed by
 * localStorage + IndexedDB with realistic latency and injectable errors. Phase 3 replaces them
 * with API implementations (lib/services/api/*) with zero UI changes. See docs/ARCHITECTURE.md.
 *
 * Rule: no `any` in this file.
 */

// ─── Core enums ────────────────────────────────────────────────────────────

export type StampKind = "photos" | "letter" | "voice" | "song";
export const STAMP_KINDS: readonly StampKind[] = ["photos", "letter", "voice", "song"] as const;

/**
 * Unit lifecycle. Client-agreed: unassigned, claimed, filled. [PROPOSED]: assigned, sealed, revealed.
 *   unassigned → assigned(path A|B) → claimed → filled → sealed → revealed
 * Admin transitions (reset code, reset reveal) are recorded in the audit log.
 */
export type UnitStatus = "unassigned" | "assigned" | "claimed" | "filled" | "sealed" | "revealed";
export const UNIT_STATUSES: readonly UnitStatus[] = [
  "unassigned",
  "assigned",
  "claimed",
  "filled",
  "sealed",
  "revealed",
] as const;

/** A = printed code card in the box. B = code emailed to the buyer, no card (gift shipped direct). */
export type DeliveryPath = "A" | "B";

/** ISO-8601 timestamp string. */
export type ISODate = string;

// ─── Results & errors ──────────────────────────────────────────────────────

export type ServiceErrorCode =
  | "invalid_code" // malformed or unknown activation code
  | "already_claimed"
  | "rate_limited"
  | "not_found"
  | "unauthorized"
  | "upload_failed"
  | "too_large"
  | "too_long"
  | "unsupported_link"
  | "nothing_to_seal"
  | "invalid_input" // request failed validation (bad email, oversized field…)
  | "challenge_required" // claim: guessing at scale tripped the breaker; pass a bot check, then retry
  | "network";

export interface ServiceError {
  code: ServiceErrorCode;
  /** Developer-facing detail. UI copy lives in the components, keyed by `code`. */
  detail?: string;
  /** For rate_limited: seconds until the next attempt is allowed. */
  retryAfterSec?: number;
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

// ─── Units ─────────────────────────────────────────────────────────────────

export interface Unit {
  id: string;
  /**
   * Human-friendly unit number printed on the code card and a base sticker, e.g. "S-0042", so
   * packing can match card ↔ ceramic (ARCHITECTURE.md, AQ1). Not secret.
   */
  unitNo: string;
  /**
   * Activation code, e.g. SAUD-3K7M. Prototype stores it plain; production stores only an
   * HMAC hash and the API returns it masked ("SAUD-····") except at generation / reset time.
   */
  code: string;
  /** When the current code was redeemed. A reset issues a fresh, unredeemed code. */
  codeRedeemedAt: ISODate | null;
  /** NFC slug, encoded on the chip as https://{domain}/t/{slug}. */
  slug: string;
  status: UnitStatus;
  path: DeliveryPath | null;
  batchId: string;
  senderEmail: string | null;
  /** Private edit token. Prototype stores it plain; production stores a hash only. */
  senderToken: string | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  claimedAt: ISODate | null;
  sealedAt: ISODate | null;
  revealedAt: ISODate | null;
  codeEmailedAt: ISODate | null;
  codeEmailedTo: string | null;
}

// ─── Content (the four stamps) ─────────────────────────────────────────────

export interface PhotoItem {
  id: string;
  mediaId: string;
  width: number;
  height: number;
  /** [PROPOSED] Optional caption, ≤ site.limits.photoCaptionChars. */
  caption?: string;
  /** Alt text for screen readers. Defaults to the caption or "Photo n of m". */
  alt?: string;
}

export interface PhotosContent {
  kind: "photos";
  items: PhotoItem[];
}

export interface LetterContent {
  kind: "letter";
  /** [PROPOSED] "Dear ___" name. Empty string = no salutation line. */
  to: string;
  body: string;
  /** [PROPOSED] Sign-off line, e.g. "Always,". */
  signoff: string;
  /** [PROPOSED] Signature name. Also used to name the sender on the recipient page. */
  from: string;
}

export interface VoiceContent {
  kind: "voice";
  mediaId: string;
  durationSec: number;
  mime: string;
  /** Normalised 0..1 amplitude buckets for drawing the waveform (96 buckets). */
  peaks: number[];
  source: "recorded" | "uploaded";
}

export type SongProvider = "spotify" | "apple";

export interface SongContent {
  kind: "song";
  provider: SongProvider;
  /** The canonical link the sender pasted (after short-link resolution). */
  url: string;
  trackId: string;
  /** Apple Music only: album id and storefront (e.g. "us"), needed for the embed URL. */
  albumId?: string;
  storefront?: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs?: number;
  /** Official embed URL (open.spotify.com/embed/... or embed.music.apple.com/...). */
  embedUrl: string;
  /** Set by the daily provider check if the track disappears; the stamp degrades gracefully. */
  unavailable?: boolean;
}

export type StampContent = PhotosContent | LetterContent | VoiceContent | SongContent;
export type ContentOf<K extends StampKind> = Extract<StampContent, { kind: K }>;

export interface ContentRecord<K extends StampKind = StampKind> {
  unitId: string;
  kind: K;
  content: ContentOf<K>;
  version: number;
  updatedAt: ISODate;
}

export type ContentMap = { [K in StampKind]?: ContentRecord<K> };

// ─── Views returned to screens ─────────────────────────────────────────────

/** What the sender portal needs. Never exposes the activation code after claim. */
export interface SenderEnvelope {
  unit: Pick<Unit, "id" | "slug" | "status" | "senderEmail" | "claimedAt" | "sealedAt" | "revealedAt" | "updatedAt">;
  contents: ContentMap;
}

/** What the recipient page needs. No code, no token, no email. */
export interface RecipientEnvelope {
  slug: string;
  status: UnitStatus;
  sealedAt: ISODate | null;
  revealedAt: ISODate | null;
  contents: ContentMap;
}

/**
 * How the recipient route should present itself. Derived by `resolveRecipientMode`
 * (lib/recipient-mode.ts) from the envelope + site config; previews force a mode.
 */
export type RecipientMode = "first_tap" | "repeat" | "empty" | "not_found";

export interface ClaimResult {
  token: string;
  slug: string;
  /** Path the sender should be sent to next, e.g. /claim/success?t=… */
  senderUrl: string;
}

// ─── Media ─────────────────────────────────────────────────────────────────

export type MediaKind = "photo" | "voice";

export interface MediaMeta {
  kind: MediaKind;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface MediaRecord extends MediaMeta {
  id: string;
  unitId: string;
  createdAt: ISODate;
}

export type UploadProgress = (fraction: number) => void;

// ─── Reveal ────────────────────────────────────────────────────────────────

export interface RevealEvent {
  id: string;
  unitId: string;
  at: ISODate;
  /** Whether the recipient skipped the choreography (still counts as revealed). */
  skipped: boolean;
  reducedMotion: boolean;
  userAgent: string;
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export interface AdminSession {
  email: string;
  signedInAt: ISODate;
}

export type AuditAction =
  | "unit.created"
  | "unit.claimed"
  | "unit.code_reset"
  | "unit.code_emailed"
  | "unit.path_set"
  | "unit.sealed"
  | "unit.revealed"
  | "unit.reveal_reset"
  | "content.saved"
  | "content.removed"
  | "content.removed_by_admin"
  | "content.restored"
  | "batch.generated"
  | "batch.encoded"
  | "batch.voided"
  | "unit.token_issued"
  | "unit.tokens_revoked"
  | "unit.reveal_excluded"
  | "media.rejected"
  | "admin.signed_in"
  | "admin.signed_out"
  | "admin.sign_in_failed"
  // Written by scripts/admin-user.mjs (actor "system").
  | "admin.created"
  | "admin.password_reset"
  | "admin.disabled"
  | "admin.enabled"
  | "system.breaker_tripped";

export interface AuditEntry {
  id: string;
  unitId: string | null;
  action: AuditAction;
  actor: "sender" | "recipient" | "admin" | "system";
  at: ISODate;
  detail?: string;
}

/** An audit entry labelled with its unit, for activity feeds. */
export interface AdminActivity extends AuditEntry {
  unitNo: string | null;
  code: string | null;
}

export interface AdminStats {
  total: number;
  byStatus: Record<UnitStatus, number>;
  revealedLast7Days: number;
  recent: AdminActivity[];
}

export interface UnitListQuery {
  /** Matches code (case-insensitive, with or without dash), slug, or sender email. */
  search?: string;
  status?: UnitStatus | "all";
  batchId?: string;
  page?: number;
  pageSize?: number;
}

export interface UnitListPage {
  items: Unit[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * One saved version of a stamp (every save is a new version; removing keeps history). Lets the
 * admin put back a stamp a sender removed or replaced by mistake (CLIENT_GUIDE §8, versioning).
 */
export interface ContentVersion {
  kind: StampKind;
  version: number;
  savedBy: "sender" | "admin";
  savedAt: ISODate;
  /** Set when a newer version replaced this one. */
  supersededAt: ISODate | null;
  /** Set when the stamp was removed while this was its current version. */
  removedAt: ISODate | null;
  /** What the recipient sees right now. */
  current: boolean;
  /** One plain line: "6 photos", "Letter, 412 characters", "Voice note, 1:12", "Song: Title · Artist". */
  summary: string;
  /** False when a file it needs has already been deleted for good (after 90 days). */
  restorable: boolean;
}

export interface UnitDetail {
  unit: Unit;
  contents: ContentMap;
  audit: AuditEntry[];
  reveals: RevealEvent[];
  /** Newest first. */
  history: ContentVersion[];
}

/**
 * generated → encoded (the factory wrote and locked the chips; permanent) or void (the CSV was
 * lost before encoding: its codes stop working). An encoded batch can never be voided.
 */
export type BatchStatus = "generated" | "encoded" | "void";

export interface Batch {
  id: string;
  label: string;
  createdAt: ISODate;
  count: number;
  status: BatchStatus;
  /** The domain written on this batch's chips; its factory CSV always uses this one. */
  chipDomain: string;
  encodedAt: ISODate | null;
  /** Units in the batch whose code has been redeemed (a batch with any can't be voided). */
  claimedCount: number;
}

export interface ProvisionedRow {
  unitNo: string;
  code: string;
  slug: string;
  url: string;
}

// ─── Email ─────────────────────────────────────────────────────────────────

export type EmailTemplate = "sender_link" | "recover_link" | "gift_code";

export interface EmailMessage {
  id: string;
  template: EmailTemplate;
  to: string;
  subject: string;
  /** Plain-text body; the demo email preview renders this on paper. */
  text: string;
  /** Primary link in the email, if any (sender link / magic link). */
  link?: string;
  /** Activation code for gift_code emails. */
  code?: string;
  sentAt: ISODate;
}

// ─── Service interfaces ────────────────────────────────────────────────────

export interface UnitService {
  /**
   * Claim a unit with its activation code (case-insensitive, dash optional). Rate limited. When
   * guessing at scale trips the breaker it fails with `challenge_required`: show the bot check
   * and call again with its token.
   */
  claim(code: string, opts?: { challengeToken?: string }): Promise<ServiceResult<ClaimResult>>;
  /** [O6] Attach an email to a claimed unit for link recovery. */
  saveSenderEmail(token: string, email: string): Promise<ServiceResult<void>>;
  /**
   * Request the private link again. Always resolves ok (no account enumeration);
   * if the email matches units, a recover_link email is sent.
   */
  recoverLink(email: string): Promise<ServiceResult<void>>;
  /** [PROPOSED O7] Arm the first-tap reveal. Fails with nothing_to_seal if no content. */
  seal(token: string): Promise<ServiceResult<SenderEnvelope>>;
}

export interface ContentService {
  getSenderEnvelope(token: string): Promise<ServiceResult<SenderEnvelope>>;
  /**
   * Turn a pasted Spotify / Apple Music link (incl. short links) into a SongContent with title,
   * artist and artwork. Errors: unsupported_link (not a music link, or not a single track),
   * not_found (track does not exist), network.
   */
  resolveSong(link: string): Promise<ServiceResult<SongContent>>;
  /** Explicit save (no autosave). Bumps version; recomputes unit status (claimed ⇄ filled). */
  save<K extends StampKind>(token: string, content: ContentOf<K>): Promise<ServiceResult<ContentRecord<K>>>;
  remove(token: string, kind: StampKind): Promise<ServiceResult<SenderEnvelope>>;
}

export interface MediaService {
  /**
   * Upload an already-processed blob (photos are compressed client-side first).
   * Reports progress 0..1. Production: presigned PUT to R2, then server validation.
   */
  upload(token: string, blob: Blob, meta: MediaMeta, onProgress?: UploadProgress): Promise<ServiceResult<MediaRecord>>;
  /**
   * Resolve a media id to a URL the browser can load.
   * Prototype: object URL from IndexedDB, or a static /demo/... path for "demo:" ids.
   * Production: short-lived signed CDN URL.
   */
  getUrl(mediaId: string, variant?: "thumb" | "display"): Promise<string | null>;
  remove(token: string, mediaId: string): Promise<ServiceResult<void>>;
}

export interface RevealService {
  getEnvelope(slug: string): Promise<ServiceResult<RecipientEnvelope>>;
  /**
   * Record the first open. Call ONLY after the choreography completes or is skipped, on the
   * recipient route, never on page load, never from the sender preview. Idempotent.
   */
  markRevealed(slug: string, info: { skipped: boolean; reducedMotion: boolean }): Promise<ServiceResult<void>>;
}

export interface AdminService {
  signIn(email: string, password: string): Promise<ServiceResult<AdminSession>>;
  signOut(): Promise<void>;
  getSession(): Promise<AdminSession | null>;
  getStats(): Promise<ServiceResult<AdminStats>>;
  listUnits(query: UnitListQuery): Promise<ServiceResult<UnitListPage>>;
  getUnit(unitId: string): Promise<ServiceResult<UnitDetail>>;
  /** Issue a fresh activation code (old one stops working). Content and slug are untouched. */
  resetCode(unitId: string): Promise<ServiceResult<{ code: string }>>;
  /** [PROPOSED] Make the next recipient open play the first-tap reveal again. */
  resetReveal(unitId: string): Promise<ServiceResult<void>>;
  /** Path B: email the activation code to the buyer (manual send for the first 300 units). */
  emailCode(unitId: string, to: string): Promise<ServiceResult<EmailMessage>>;
  setPath(unitId: string, path: DeliveryPath): Promise<ServiceResult<void>>;
  removeContent(unitId: string, kind: StampKind, photoId?: string): Promise<ServiceResult<void>>;
  /** Make an earlier version of a stamp current again (saved as a new version; logged). */
  restoreContent(unitId: string, kind: StampKind, version: number): Promise<ServiceResult<void>>;
  /** Batches, newest first, void ones included. */
  listBatches(): Promise<ServiceResult<Batch[]>>;
  /** Generate `count` units with unique, random, non-sequential codes and slugs. */
  generateBatch(count: number, label: string): Promise<ServiceResult<{ batch: Batch; rows: ProvisionedRow[] }>>;
  exportBatchCsv(batchId: string): Promise<ServiceResult<string>>;
  /** The factory has written and locked the chips. Permanent: the batch can never be voided after. */
  markBatchEncoded(batchId: string): Promise<ServiceResult<Batch>>;
  /** The CSV was lost before encoding: its codes stop working. Refused once encoded or claimed. */
  voidBatch(batchId: string): Promise<ServiceResult<Batch>>;
}

export interface EmailService {
  send(message: Omit<EmailMessage, "id" | "sentAt">): Promise<ServiceResult<EmailMessage>>;
  /** Demo/dev only: messages "sent" so far, newest first (lets the presenter open the email). */
  outbox(): Promise<EmailMessage[]>;
}

export interface Services {
  units: UnitService;
  content: ContentService;
  media: MediaService;
  reveal: RevealService;
  admin: AdminService;
  email: EmailService;
}
