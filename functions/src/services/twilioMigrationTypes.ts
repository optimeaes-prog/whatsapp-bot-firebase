import type { TwilioTemplateNames } from "../types";

/**
 * Status of a Twilio sender migration job (org → new Twilio account).
 */
export type TwilioMigrationJobStatus =
  | "pending"
  | "templates_snapshotted"
  | "templates_submitted"
  | "awaiting_approval"
  | "complete"
  | "failed";

/**
 * Status of a single Twilio Content Template's WhatsApp approval.
 * Mirrors Twilio's `/v1/Content/{sid}/ApprovalRequests/whatsapp` shape, plus a
 * synthetic `not_submitted` for our pre-submission bookkeeping.
 */
export type TwilioTemplateApprovalStatus =
  | "not_submitted"
  | "received"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";

/**
 * Per-template state inside a migration job.
 *
 * Note: timestamps are stored as Firestore Timestamps in production; in code we
 * use `unknown` here to avoid pulling firebase-admin types into shared modules.
 */
export interface TwilioMigrationTemplateState {
  /** Original SID in the source Twilio account. */
  sourceSid: string;
  /** New SID in the destination Twilio account (set after creation). */
  newSid?: string;
  /** WhatsApp approval state for the new SID. */
  approvalStatus: TwilioTemplateApprovalStatus;
  /** Rejection reason as reported by WhatsApp, if any. */
  approvalRejectionReason?: string;
  /** Friendly name (preserved verbatim from source). */
  friendlyName: string;
  /** Template language (e.g. "es", "en"). */
  language: string;
  /**
   * Source template `variables` payload, snapshotted at first-run.
   * Used to recreate the template in the destination if the create step is
   * interrupted and resumed AFTER the source secret has been rotated
   * (relevant when sourceOrgId === targetOrgId).
   */
  sourceVariables?: Record<string, string>;
  /**
   * Source template `types` payload, snapshotted at first-run. See `sourceVariables`.
   */
  sourceTypes?: Record<string, unknown>;
  /** Which `TwilioTemplateNames` slot this template maps to, if any. */
  mappedSlot?: keyof TwilioTemplateNames;
  /** Whether the template is the 8-variable Proplead-style agentNotification. */
  is8VarAgentNotification?: boolean;
  submittedAt?: unknown;
  approvedAt?: unknown;
  lastPolledAt?: unknown;
}

export interface TwilioMigrationJob {
  status: TwilioMigrationJobStatus;
  targetOrgId: string;
  sourceOrgId: string;
  newAccountSid: string;
  newWhatsappNumber: string;
  /** Twilio sender resource SID (XE...) on the new account; needed to PATCH webhook. */
  newSenderSid?: string;
  /** Secret Manager resource name (without /versions suffix) holding the new auth token. */
  authTokenSecretName: string;
  createdBy: { uid: string; email?: string };
  createdAt: unknown;
  updatedAt: unknown;
  webhookConfigured: boolean;
  /** Snapshot of the previous botConfig.twilioConfig for one-click rollback. */
  previousTwilioConfig?: unknown;
  /** Map keyed by friendly_name::language (matches existing clone script's dedupe key). */
  templates: Record<string, TwilioMigrationTemplateState>;
  errors: Array<{ at: unknown; step: string; message: string }>;
}

/**
 * Map from a normalized friendly_name prefix → BotConfig.twilioTemplates slot.
 *
 * The runtime uses these named slots when sending. After approval lands, the
 * poller uses this table to write each new HX SID into the right slot in
 * `organizations/{orgId}/botConfig/config.twilioTemplates`.
 *
 * Patterns are matched against the friendly_name lowercased, with a trailing
 * `_<timestamp>` stripped, in declaration order (first match wins). Each entry
 * is a literal lowercase prefix; we strip a trailing timestamp suffix first,
 * then check `startsWith`.
 *
 * Templates whose names match none of these prefixes are still cloned and
 * approved but not auto-mapped; an admin can map them manually in the UI.
 */
export const TWILIO_TEMPLATE_SLOT_PREFIXES: ReadonlyArray<{
  prefix: string;
  slot: keyof TwilioTemplateNames;
}> = [
  { prefix: "agent_notification_8var", slot: "agentNotification" },
  { prefix: "agent_notification_legacy", slot: "agentNotificationLegacy" },
  { prefix: "agent_notification", slot: "agentNotification" },
  { prefix: "call_handoff_org_no_name_es", slot: "callHandoffOrgNoNameEs" },
  { prefix: "call_handoff_org_no_name_en", slot: "callHandoffOrgNoNameEn" },
  { prefix: "call_handoff_org_es", slot: "callHandoffOrgEs" },
  { prefix: "call_handoff_org_en", slot: "callHandoffOrgEn" },
  { prefix: "voice_optin_consent", slot: "voiceOptInConsent" },
  { prefix: "idealista_confirm_es", slot: "idealistaInitialEs" },
  { prefix: "idealista_confirm_en", slot: "idealistaInitialEn" },
  { prefix: "idealista_initial_es", slot: "idealistaInitialEs" },
  { prefix: "idealista_initial_en", slot: "idealistaInitialEn" },
  { prefix: "call_initial_es", slot: "idealistaInitialEs" },
  { prefix: "call_initial_en", slot: "idealistaInitialEn" },
];

/**
 * Resolve the BotConfig.twilioTemplates slot for a given friendly_name.
 * Returns undefined if no prefix matches.
 */
export function mapFriendlyNameToSlot(friendlyName: string): keyof TwilioTemplateNames | undefined {
  const normalized = friendlyName.trim().toLowerCase().replace(/_\d+$/, "");
  for (const { prefix, slot } of TWILIO_TEMPLATE_SLOT_PREFIXES) {
    if (normalized.startsWith(prefix)) return slot;
  }
  return undefined;
}

/**
 * Slots that must be populated before a migration job is considered `complete`.
 * Templates outside this set are nice-to-have; failures don't block completion.
 */
export const REQUIRED_TWILIO_TEMPLATE_SLOTS: ReadonlyArray<keyof TwilioTemplateNames> = [
  "idealistaInitialEs",
  "callHandoffOrgEs",
  "voiceOptInConsent",
];

/**
 * Stable Firestore collection name for migration jobs.
 */
export const TWILIO_MIGRATION_JOBS_COLLECTION = "twilioMigrationJobs";

/**
 * Stable database id for the realestate Firestore instance (matches existing usage in index.ts).
 */
export const REALESTATE_DB_ID = "realestate-whatsapp-bot";

/**
 * Max age of an in-flight migration job before the scheduled poller marks it `failed`.
 * WhatsApp approval rarely exceeds 24h; 72h is a generous ceiling.
 */
export const TWILIO_MIGRATION_MAX_AGE_MS = 72 * 60 * 60 * 1000;
