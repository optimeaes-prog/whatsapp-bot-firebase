import * as admin from "firebase-admin";
import axios from "axios";
import crypto from "crypto";
import JSZip from "jszip";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { SendMessageSchema, SendMassMessageSchema, NewLeadSchema } from "./schemas";
import { sendEmailToUser } from "./services/emailService";
import { runDailyFollowUpDigest } from "./services/followUpDigestService";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import {
  AuditAction,
  AuditEntityType,
  CloudApiTemplateNames,
  BotConfig,
  ConversationState,
  HistoryItem,
  InboundMessage,
  LeadRow,
  LeadSummary,
  ListingRow,
  OperationType,
  PendingItem,
  TwilioTemplateNames,
} from "./types";
import { organizationDisplayNameFromOrgDoc } from "./utils/organizationDisplayName";
import { clientIpKey, enforceRateLimit } from "./utils/rateLimit";
import { verifyCloudTasksOidc } from "./utils/cloudTasksAuth";
import {
  fetchListingByCode,
  fetchListingGlobally,
  findLeadByChatId,
  findLeadDocForChat,
  findLeadByPhone,
  findOrgIdByChatId,
  updateLeadChatInfo,
  updateLeadStatus,
  createPendingCallLead,
  updateLeadListingByChatId,
  appendConversationRow,

   getActiveStyle,
   getBotConfig,
   getConversationByChatId,
  getConversationByPhoneAndListing,
  upsertConversation,
  addPendingMessage,
  updateBufferTask,
  getPendingMessagesAndClear,
  getConversationsForFollowUp,
  ignoreChat,
  isChatIgnored,
  getAlertCountSince,
  markLeadAsResponded,
  ensureInboundWhatsAppConsentByChatId,
  setLeadConsentByLeadId,
  setLeadConsentByChatId,
  recordCallHandoffEvent,
  getResponseRateStats,
  getAllLeadsWithChatId,
  updateLeadAnalysis,
  upsertCallIntent,
  updateCloudApiTemplates,
  getGlobalMessagingPolicy,
  updateGlobalMessagingPolicy,
  setPlatformDefaultProvider,
  getOrganizationMessagingProvider,
  agentScopeFromListingSnapshotData,
  syncAgentScopeUidForListingCodeFromListingDoc,
  getListingAgentScopeUid,
  syncAssignedAgentUidForListingCode,
  reconcileAllListingAgentScopesInOrg,
} from "./services/firestore";
import { PENDING_LISTING_TAG, tagsAfterListingResolved } from "./services/leadSelection";
import { resolveQualifiedLeadNotificationRecipients } from "./services/qualifiedLeadNotificationTargets";
import { sendIdealistaOptInSms } from "./services/smsOptIn";
import {
  sendTextMessage,
  sendBinaryConfirmPrompt,
  sendInitialTemplateMessage,
  sendAgentNotificationMessage,
  sendReturningLeadMessage,
  getActiveProvider as getActiveProviderFn,
  getEffectiveProviderForOrg,
  invalidateProviderCache,
} from "./services/messagingProvider";
import { createContentTemplate, createVoiceCall, fetchContentTemplate, getOrgTwilioAuthToken, renderTwilioTemplateBody } from "./services/twilioClient";
import { resolveOrgIdByVoiceNumber, composeListingFoundMessage, normalizeVoiceE164 } from "./services/inboundVoicePerOrg";
import {
  checkCloudApiHealth,
  createMessageTemplate as createCloudApiMessageTemplate,
  getCloudApiCredentials,
  parseCloudApiWebhook,
  invalidateCloudApiCredentialsCache,
  type CreateTemplateComponent,
} from "./services/cloudApiClient";
import {
  classifyConfirmDeny,
  resolveListingWithAgent,
  generateAssistantResponse,
  generateFollowUpDraft,
  summarizeLeadDetails,
  extractClientName,
  translateTextToBritishEnglish,
  checkLeadPassesFilters,
  resolveReplyLanguageWithAgent,
} from "./services/openaiClient";
import { scheduleBufferTask, scheduleImmediateHttpTask, BUFFER_DELAY_SECONDS, REGION } from "./shared";
import {
  forceCompleteMigration,
  pollAllInFlightMigrations,
  pollMigration,
  retryMigrationStep,
  startMigration,
  submitMigrationTemplates,
} from "./services/twilioMigration";
import { TWILIO_MIGRATION_JOBS_COLLECTION } from "./services/twilioMigrationTypes";
import { sendAlert, sendHealthReport } from "./services/alertService";
import { isOptOutMessage, applyOptOut } from "./services/optOut";
import { ALERT_CATALOG } from "./services/alertCatalog";
import { syncConversations, retryFailedMessages, queueFailedMessage } from "./services/conversationSyncService";
import { ADMIN_TEMPLATE_TOKEN, OPENAI_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID, TWILIO_PARTNER_SOLUTION_ID, TWILIO_VERIFY_SERVICE_SID, PROPLEAD_TEMPLATE_SOURCE_ORG, STRIPE_PRICE_TOPUP_40_CONVS, TWILIO_API_KEY, TWILIO_API_SECRET, META_APP_ID, META_APP_SECRET, META_FB_LOGIN_CONFIG_ID, META_VERIFY_TOKEN, ELEVENLABS_KEY, MAKE_WEBHOOK_SHARED_SECRET } from "./secrets";
import {
  startVerification as twilioVerifyStart,
  checkVerification as twilioVerifyCheck,
  isTwilioVerifyRateLimited,
  twilioVerifyErrorMessage,
} from "./services/twilioVerify";
import {
  normalizeToE164,
  upsertPendingNumber,
  markVerified as markNotificationNumberVerified,
  incrementVerificationAttempts,
  getNumber as getNotificationNumber,
  deleteNumber as deleteNotificationNumberDoc,
} from "./services/notificationNumbersService";
import { EMAIL_UNSUBSCRIBE_SECRET } from "./emailUnsubscribeParams";
import { APP_BASE_URL } from "./appConfig";
import { emailPreferencesApiHandler, emailUnsubscribeHandler } from "./emailPreferenceEndpoints";
import {
  INACTIVE_LEADS_SECRET,
  INACTIVITY_ALERT_DRY_RUN,
  INACTIVITY_ALERT_ONLY_ORG,
  TWILIO_TEMPLATE_SID_INACTIVE_LEADS,
} from "./inactiveLeadsParams";
import { inactiveLeadsApiHandler } from "./inactiveLeadsEndpoints";
import { catalogApiHandler } from "./catalogEndpoints";
import { buildCatalogUrl, getOrCreateCatalogCode } from "./services/catalogLinks";
import { runDailyInactiveLeadsAlert } from "./services/inactiveLeadsAlertService";
import {
  exchangeCodeForToken,
  storeAccessTokenInSecretManager,
  persistCloudApiConfigForOrg,
  fetchDisplayPhoneNumber,
  fetchPhoneNumberWaba,
} from "./services/embeddedSignup";
import { onboardTwilioTechProviderSender } from "./services/twilioOnboarding";
import { buildAvatarPublicUrl, getAssistantAvatarById } from "./services/assistantAvatars";
import {
  addOrgConversations,
  addOrgConversationsForPaymentIntentOnce,
  deductOrgConversationForInitialOutboundOnce,
  deductOrgConversationOnce,
  getOrgAutoRechargeSettingsForApi,
  getOrgConversationBalance,
  getOrgStripeCustomerId,
  mergeOrgStripeBillingFields,
  saveOrgAutoRechargeSettings,
} from "./services/billingService";
import { getAuditLogs as getAuditLogsFromService, recordLeadChange, recordConversationChange, recordListingChange, recordSystemAction } from "./services/auditService";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  extractBillingFromCheckoutSession,
  getConversationPackages,
  constructWebhookEvent,
  createBillingPortalSession as createBillingPortalSessionService,
  previewSubscriptionProration,
  updateExistingSubscription,
} from "./services/stripeService";
import {
  getOrgSubscription,
  setOrgSubscription,
  grantSubscriptionConversations,
  PLAN_BASE_CONVERSATIONS,
  calculateProratedConversations,
  getMaxListingNotificationNumbers,
  getMaxActiveListings,
} from "./services/subscriptionService";
import type { SubscriptionPlanId } from "./types";
import {
  extractPhoneFromChatId,
  getChatIdVariants,
  ensureTimestampMillis,
  isSpanishPhoneNumber,
  normalizeToCanonicalChatId,
} from "./utils";
import { normalizeForSearch } from "./utils/addressNormalize";
import { getActiveOrgId, requestContext } from "./services/requestContext";
import { sendInvitationNotification, sendNewSignupAlert, sendPaymentFailedNotification, sendWelcomeNotification } from "./services/emailService";
import { generateSpeechMp3 } from "./services/elevenLabsClient";
// Initialize Firebase Admin
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Firestore settings must be applied exactly once and before any Firestore use.
// Do it at process startup to avoid "Firestore has already been initialized" errors.
(() => {
  const FIRESTORE_DATABASE_ID = "realestate-whatsapp-bot";
  try {
    getFirestore(admin.app(), FIRESTORE_DATABASE_ID).settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // If another module already configured settings in this process, don't crash the function.
    console.warn("[firestore] settings() already applied or Firestore already used:", e);
  }
})();

// REGION is now imported from ./shared

// Organisation identifier (removed global static getActiveOrgId() for multi-tenancy)
// const getActiveOrgId() = getActiveOrgId(); 

// Config params
const NOTIFICATION_NUMBER = defineString("NOTIFICATION_NUMBER");
// VOICE_AUDIO_1_URL was retired by the bilingual language menu below. The old greeting asked
// for the caller's name, which no part of the TwiML ever recorded, and the menu now opens the
// call. The audio file itself is still in public/voice/ if the wording is ever wanted back.
// A6c — idealista confirm template removed; cold Idealista leads now receive an
// SMS opt-in link (Meta Business Messaging Policy requires prior consent before
// sending a marketing template).
// Language menu, played as the first thing on every inbound call: greets, tells Spanish
// speakers to wait, and tells English speakers to press 1. One bilingual file — the Spanish
// voice reads both sentences — so nothing can drift out of sync between the two halves.
const VOICE_AUDIO_LANG_MENU_URL = defineString("VOICE_AUDIO_LANG_MENU_URL");
// Public URL for the second voice prompt (DTMF 1 opt-in). Served from Firebase Hosting.
const VOICE_AUDIO_2_OPTIN_URL = defineString("VOICE_AUDIO_2_OPTIN_URL");
const VOICE_AUDIO_2_OPTIN_EN_URL = defineString("VOICE_AUDIO_2_OPTIN_EN_URL");
// Public URL for the post-DTMF confirmation locución ("Gracias…"). Generated with the same
// approved ElevenLabs voice as the greeting/opt-in prompts so the whole inbound call is one voice.
const VOICE_AUDIO_3_URL = defineString("VOICE_AUDIO_3_URL");
const VOICE_AUDIO_3_EN_URL = defineString("VOICE_AUDIO_3_EN_URL");
const PROPLEAD_INTAKE_ORG_ID = defineString("PROPLEAD_INTAKE_ORG_ID");
const VOICE_CONSENT_SCRIPT_VERSION = defineString("VOICE_CONSENT_SCRIPT_VERSION");
const OUTBOUND_CALLER_NUMBER = defineString("OUTBOUND_CALLER_NUMBER");
const OUTBOUND_AUDIO_BUCKET = defineString("OUTBOUND_AUDIO_BUCKET");

const LEAD_QUALIFIED_MARKER = "[LEAD_CUALIFICADO]";
const LEAD_NOT_INTERESTED_MARKER = "[LEAD_NO_INTERESADO]";

const CALL_PENDING_LISTING_CODE = "__pending__";

const SUBSCRIPTION_BASE_PRICES: Record<string, number> = {
  free: 0,
  plus: 19,
  pro: 69,
  pro_plus: 99,
};

const PLAN_RANKS: Record<string, number> = {
  free: 0,
  plus: 1,
  pro: 2,
  pro_plus: 3,
};

type OrgTemplateSnapshot = {
  cloudApiTemplates: CloudApiTemplateNames;
  twilioTemplates: TwilioTemplateNames;
};

async function getOrgTemplateSnapshot(orgId: string): Promise<OrgTemplateSnapshot> {
  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const snap = await db.doc(`organizations/${orgId}/botConfig/config`).get();
  const data = (snap.data() || {}) as {
    cloudApiConfig?: { templates?: CloudApiTemplateNames };
    twilioTemplates?: TwilioTemplateNames;
  };
  return {
    cloudApiTemplates: { ...(data.cloudApiConfig?.templates || {}) },
    twilioTemplates: { ...(data.twilioTemplates || {}) },
  };
}

function requireTemplate(value: string | undefined, message: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(message);
  return normalized;
}

function getGcpProjectId(): string {
  const envProject =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;
  if (envProject) return envProject;
  const appProjectId = admin.app().options.projectId;
  if (appProjectId) return appProjectId;
  throw new Error("Could not determine GCP project ID");
}

async function getAgentNotificationTemplateSid(orgId: string): Promise<string | undefined> {
  const { twilioTemplates } = await getOrgTemplateSnapshot(orgId);
  const sid = twilioTemplates.agentNotification;
  const normalized = typeof sid === "string" ? sid.trim() : "";
  return normalized || undefined;
}

/**
 * Twilio Content SIDs that are Proplead's 8-var ({{1}}..{{8}}) qualified-lead templates.
 *
 * Legacy fallback: predates per-org `agentNotificationIs8Var` flag. Kept for backwards
 * compat with orgs whose botConfig wasn't updated by the sender-migration flow.
 * Prefer reading `BotConfig.twilioTemplates.agentNotificationIs8Var` going forward.
 */
const TWILIO_AGENT_NOTIFICATION_8VAR_CONTENT_SIDS = new Set(
  [
    "HX0f65d74044e27ae2f344b28eabad2776",
    "HX553ad04854fe0627b4f521e8c0fe6cdd",
    // proplead_lead_cualificado_v2 — property name moved into the header line.
    "HXc1ca5be1e544485e5962372147eed31b",
  ].map((s) => s.trim().toUpperCase())
);

/**
 * Decides if a given `agentNotification` SID should be rendered with 8-var variables.
 *
 * Source of truth (in order):
 *  1. Per-org `BotConfig.twilioTemplates.agentNotificationIs8Var` flag (preferred).
 *  2. Legacy hardcoded whitelist (for orgs migrated before the flag existed).
 */
function isProplead8VarAgentNotification(params: {
  sid: string | undefined;
  is8VarFlag?: boolean;
}): boolean {
  if (params.is8VarFlag === true) return true;
  return TWILIO_AGENT_NOTIFICATION_8VAR_CONTENT_SIDS.has(String(params.sid || "").trim().toUpperCase());
}

/**
 * Template for unstructured agent alerts (quick qualification, call flow).
 * Uses `agentNotificationLegacy` when set; otherwise `agentNotification` unless it is an 8-var Proplead SID.
 */
async function getAgentNotificationTemplateSidForCompactAlert(orgId: string): Promise<string | undefined> {
  const { twilioTemplates } = await getOrgTemplateSnapshot(orgId);
  const legacy = typeof twilioTemplates.agentNotificationLegacy === "string"
    ? twilioTemplates.agentNotificationLegacy.trim()
    : "";
  if (legacy) return legacy;
  const primary = typeof twilioTemplates.agentNotification === "string"
    ? twilioTemplates.agentNotification.trim()
    : "";
  if (!primary) return undefined;
  if (isProplead8VarAgentNotification({ sid: primary, is8VarFlag: twilioTemplates.agentNotificationIs8Var })) {
    console.warn(
      "[twilio] agentNotification is Proplead 8-var; set twilioTemplates.agentNotificationLegacy for quick-qual/call-flow alerts"
    );
    return undefined;
  }
  return primary;
}

/**
 * Variables de la plantilla que se manda nada más colgar (la del "pulse 1").
 *
 * En el flujo per-org esa plantilla lleva el enlace al catálogo de la agencia,
 * y lo que viaja como variable es solo el código:
 * `https://proplead.io/anuncios/{{1}}`. Se pasa el código y no la URL entera
 * para que el dominio quede fijo dentro del texto aprobado.
 *
 * `orgId` vacío = intake global: ahí todavía no se sabe de qué agencia es el
 * lead, así que su plantilla sigue siendo la de siempre, sin variables. Pasarle
 * variables de más a una plantilla que no las usa es inofensivo, pero acuñarle
 * un código de catálogo a la organización de intake no tendría sentido.
 */
async function resolveVoiceOptInTemplateVariables(orgId: string): Promise<Record<string, string>> {
  if (!orgId) return {};
  try {
    return { "1": await getOrCreateCatalogCode(orgId) };
  } catch (error) {
    // Sin código se manda igualmente: el lead acaba de dar su permiso por
    // teléfono y quedarse sin ningún mensaje es peor que uno con el enlace roto.
    console.error("No se pudo resolver el código del catálogo para la plantilla inicial", error);
    return {};
  }
}

/**
 * Plantilla que se manda nada más colgar, en el idioma del lead.
 *
 * En inglés solo si la agencia tiene esa plantilla puesta; si no, se le manda la
 * castellana, que es lo que ha hecho siempre. Así una agencia sin plantilla
 * inglesa sigue funcionando igual el día que se despliegue esto.
 */
async function getVoiceOptInTemplateSid(
  orgId: string,
  language: InitialLanguage = "es"
): Promise<string> {
  const { twilioTemplates } = await getOrgTemplateSnapshot(orgId);
  const englishSid = language === "en" ? (twilioTemplates.voiceOptInConsentEn || "").trim() : "";
  const sid = englishSid || twilioTemplates.voiceOptInConsent || "HX8da52518b4b16392cffdd1f89dd49b55";
  return requireTemplate(
    sid,
    "Twilio voice opt-in template missing for intake org (voiceOptInConsent)"
  );
}

function buildTwiml(xmlBody: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${xmlBody}\n</Response>`;
}

/** Language of an inbound call. "es" is the default — the caller reaches it by waiting. */
type InboundCallLanguage = "es" | "en";

function parseInboundCallLanguage(value: unknown): InboundCallLanguage {
  return value === "en" ? "en" : "es";
}

/**
 * The consent step, in the caller's chosen language: play the opt-in prompt and gather one
 * digit. Pressing 1 lands on voiceGatherCallback, which records consent and sends the
 * WhatsApp template; pressing nothing ends the call having sent nothing.
 *
 * `gatherUrl` already carries a query string, so the language rides along on it — that's how
 * voiceGatherCallback knows which confirmation locución to play back.
 *
 * The English audio falls back to the Spanish one when its URL is not configured: a caller
 * hearing the wrong language is a far better failure than an empty <Play> breaking the call.
 */
function buildConsentGatherTwiml(params: { language: InboundCallLanguage; gatherUrl: string }): string {
  const optInAudio =
    (params.language === "en" ? VOICE_AUDIO_2_OPTIN_EN_URL.value() : "") || VOICE_AUDIO_2_OPTIN_URL.value();
  const gatherUrl = `${params.gatherUrl}&lang=${params.language}`;
  return [
    `<Gather numDigits="1" timeout="6" action="${twimlEscape(gatherUrl)}" method="POST">`,
    `  <Play>${twimlEscape(optInAudio)}</Play>`,
    `</Gather>`,
    // Fallback: no digit pressed → hang up without sending anything (no consent).
    `<Hangup/>`,
  ].join("\n");
}

// Allowlist of browser origins that may call our authenticated HTTP functions.
// Webhooks and intake endpoints set cors: false. Public marketing/billing
// endpoints (e.g., getPackages) may keep cors: true.
const WEB_CLIENT_CORS: (string | RegExp)[] = [
  "https://proplead.io",
  "https://www.proplead.io",
  "https://real-estate-idealista-bot.web.app",
  "https://real-estate-idealista-bot.firebaseapp.com",
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

async function checkAndRecordRateLimit(opts: {
  bucket: string;
  key: string;
  windowMs: number;
}): Promise<boolean> {
  const DATABASE_ID = "realestate-whatsapp-bot";
  const db = getFirestore(admin.app(), DATABASE_ID);
  const safeKey = opts.key.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
  const docRef = db.collection("rateLimits").doc(`${opts.bucket}__${safeKey}`);
  const now = Date.now();
  try {
    const snap = await docRef.get();
    const lastAt = snap.exists ? (snap.data()?.lastAt as number | undefined) : undefined;
    if (typeof lastAt === "number" && now - lastAt < opts.windowMs) {
      return false;
    }
    await docRef.set({ lastAt: now, bucket: opts.bucket, key: opts.key }, { merge: true });
    return true;
  } catch (error) {
    console.warn(`Rate limit check failed for ${opts.bucket}:${safeKey}; allowing request:`, error);
    return true;
  }
}

function reconstructRequestUrl(req: { headers: Record<string, string | string[] | undefined>; originalUrl: string }): string {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || "https";
  const hostHeader = req.headers["host"];
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  return `${proto}://${host}${req.originalUrl}`;
}

function verifyTwilioSignature(
  authToken: string,
  signatureHeader: string | undefined,
  fullUrl: string,
  body: Record<string, unknown> | undefined
): boolean {
  if (!authToken || !signatureHeader) return false;
  const params = body && typeof body === "object" ? body : {};
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const key of sortedKeys) {
    const value = params[key];
    data += key + (value == null ? "" : String(value));
  }
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Twilio signs each webhook over the EXACT callback URL configured on the
 * sender, which varies across this fleet:
 *   - Some senders point at the Cloud Run URL (https://<svc>.a.run.app) —
 *     Twilio appends "/" and signs that. reconstructRequestUrl reproduces it
 *     because the request hits Cloud Run directly (host = run.app, path = "/").
 *   - Others point at the public function URL
 *     (https://<region>-<project>.cloudfunctions.net/twilioWebhook). Google
 *     proxies that to Cloud Run, rewriting host + stripping the function path,
 *     so reconstructRequestUrl yields the run.app form and can NEVER match the
 *     cloudfunctions.net string Twilio signed.
 * To verify regardless of how the sender was configured, we try the
 * reconstructed URL plus the canonical public function URL.
 */
function twilioSignedUrlCandidates(req: { headers: Record<string, string | string[] | undefined>; originalUrl: string }): string[] {
  const reconstructed = reconstructRequestUrl(req);
  const canonical = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/twilioWebhook`;
  return Array.from(new Set([reconstructed, canonical]));
}

/** True if the signature matches for ANY of the candidate URLs. */
function verifyTwilioSignatureAnyUrl(
  authToken: string,
  signatureHeader: string | undefined,
  urls: string[],
  body: Record<string, unknown> | undefined
): boolean {
  return urls.some((u) => verifyTwilioSignature(authToken, signatureHeader, u, body));
}

async function resolveOrgIdFromToken(authHeader?: string): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  
  const DATABASE_ID = "realestate-whatsapp-bot";
  const userDoc = await getFirestore(admin.app(), DATABASE_ID).collection("users").doc(uid).get();
  const orgId = userDoc.data()?.orgId;
  
  if (!orgId) {
    throw new Error("Organization not found for user");
  }
  return orgId;
}

async function resolveUserContextFromToken(authHeader?: string): Promise<{
  uid: string;
  orgId: string;
  role: string;
  email: string;
}> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : "";
  const DATABASE_ID = "realestate-whatsapp-bot";
  const userRef = getFirestore(admin.app(), DATABASE_ID).collection("users").doc(uid);
  const userDoc = await userRef.get();
  const data = userDoc.data() || {};
  const orgId = typeof data.orgId === "string" ? data.orgId : "";
  const role = typeof data.role === "string" ? data.role : "";

  if (!orgId && role !== "super_admin") throw new Error("Organization not found for user");
  return { uid, orgId, role, email };
}

async function resolveAuthIdentityFromToken(authHeader?: string): Promise<{ uid: string; email: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : "";
  return { uid, email };
}

const ALLOWED_CONSENT_SOURCES = new Set([
  "idealista_form",
  "agency_website",
  "phone_call",
  "in_person",
  "inbound_whatsapp",
] as const);

function normalizeConsentLanguage(value: unknown): "es" | "en" {
  return value === "en" ? "en" : "es";
}

function twimlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const MADRID_TIMEZONE = "Europe/Madrid";
const OUTBOUND_CALL_BUSINESS_START_HOUR = 9;
const OUTBOUND_CALL_BUSINESS_END_HOUR = 22;
const OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT = "7QQzpAyzlKTVrRzQJmTE";
const OUTBOUND_CALLER_NUMBER_DEFAULT = "+34911676990";
const OUTBOUND_AUDIO_BUCKET_DEFAULT = "real-estate-idealista-bot-outbound-voice";
const OUTBOUND_AUDIO_MAX_GENERATION_ATTEMPTS = 2;
const OUTBOUND_AUDIO_PREFLIGHT_TTL_MS = 5 * 60 * 1000;

let outboundAudioPreflightCache: { ok: boolean; checkedAt: number; bucket: string; reason?: string } | null = null;

type MadridTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const madridPartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MADRID_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

function getMadridTimeParts(date: Date): MadridTimeParts {
  const map: Record<string, string> = {};
  for (const part of madridPartsFormatter.formatToParts(date)) {
    if (part.type === "literal") continue;
    map[part.type] = part.value;
  }
  const weekdayRaw = map.weekday || "";
  const weekday = weekdayRaw === "Mon" ? 1 :
    weekdayRaw === "Tue" ? 2 :
      weekdayRaw === "Wed" ? 3 :
        weekdayRaw === "Thu" ? 4 :
          weekdayRaw === "Fri" ? 5 :
            weekdayRaw === "Sat" ? 6 : 7;
  return {
    year: Number(map.year || 0),
    month: Number(map.month || 0),
    day: Number(map.day || 0),
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
    weekday,
  };
}

function isMadridBusinessSlot(date: Date): boolean {
  const p = getMadridTimeParts(date);
  const isWeekday = p.weekday >= 1 && p.weekday <= 5;
  const inHours = p.hour >= OUTBOUND_CALL_BUSINESS_START_HOUR && p.hour < OUTBOUND_CALL_BUSINESS_END_HOUR;
  return isWeekday && inHours;
}

function alignToMadridBusinessSlot(date: Date): Date {
  const next = new Date(date.getTime());
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    if (isMadridBusinessSlot(next)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  return next;
}

function nextBusinessDaySameTimeFromReference(reference: Date): Date {
  const ref = getMadridTimeParts(reference);
  const candidate = new Date(reference.getTime() + 24 * 60 * 60 * 1000);
  for (let i = 0; i < 60 * 24 * 10; i += 1) {
    const p = getMadridTimeParts(candidate);
    if (
      p.weekday >= 1 &&
      p.weekday <= 5 &&
      p.hour === ref.hour &&
      p.minute === ref.minute &&
      p.hour >= OUTBOUND_CALL_BUSINESS_START_HOUR &&
      p.hour < OUTBOUND_CALL_BUSINESS_END_HOUR
    ) {
      return candidate;
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return alignToMadridBusinessSlot(candidate);
}

function normalizeE164Phone(phoneRaw: string): string {
  const digits = String(phoneRaw || "").replace(/[^\d+]/g, "").replace(/^\+?/, "");
  return digits ? `+${digits}` : "";
}

function formatOperationForSpeech(operationType?: OperationType): string {
  return operationType === "Alquiler" ? "alquiler" : "venta";
}

function formatPriceForSpeech(price?: string): string {
  const parsed = Number(String(price || "").replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return "precio no especificado";
  const rounded = Math.round(parsed);
  return `${rounded.toLocaleString("es-ES")} euros`;
}

function formatLocationForSpeech(params: { street?: string; city?: string; address?: string }): string {
  const street = typeof params.street === "string" ? params.street.trim() : "";
  const city = typeof params.city === "string" ? params.city.trim() : "";
  const address = typeof params.address === "string" ? params.address.trim() : "";
  if (street && city) return `${street}, ${city}`;
  if (street) return street;
  if (city) return city;
  if (address) return address;
  return "ubicación no especificada";
}

function buildOutboundConsentSpeechEs(params: {
  leadName?: string;
  assistantName: string;
  operationType?: OperationType;
  price?: string;
  street?: string;
  city?: string;
  address?: string;
}): string {
  const saludoNombre = params.leadName ? ` ${params.leadName}` : "";
  const operation = formatOperationForSpeech(params.operationType);
  const priceText = formatPriceForSpeech(params.price);
  const locationText = formatLocationForSpeech({
    street: params.street,
    city: params.city,
    address: params.address,
  });
  return [
    `¡Hola${saludoNombre}! Soy ${params.assistantName}, el asistente de tu agencia inmobiliaria, encantado.`,
    `Te llamo porque te has interesado en una vivienda en ${operation} en ${locationText} por ${priceText}.`,
    "Actualmente solo resolvemos dudas y agendamos visitas por WhatsApp.",
    "¿Estas de acuerdo en que nuestro equipo siga la conversación y te contacte por esta vía?",
    "Si estas de acuerdo, por favor pulsa 1. De lo contrario, por favor cuelgue.",
    "¡Un saludo!",
  ].join(" ");
}

function secureCompare(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function normalizeE164FromTwilio(from: unknown): string {
  const raw = typeof from === "string" ? from.trim() : "";
  if (!raw) return "";
  // Twilio Voice 'From' is like +34911...
  return raw.startsWith("+") ? raw.slice(1) : raw;
}

function extractListingCodeFromText(text: string): string | null {
  const t = text || "";
  // Idealista URL
  const urlMatch = t.match(/idealista\.com\/inmueble\/(\d{6,12})/i);
  if (urlMatch?.[1]) return urlMatch[1];
  // Any long-ish digit group (common idealista ids)
  const digitMatch = t.match(/\b(\d{6,12})\b/);
  return digitMatch?.[1] || null;
}

function extractPriceFromText(text: string): number | undefined {
  const t = (text || "").toLowerCase();
  const kMatch = t.match(/\b(\d+(?:[.,]\d+)?)\s*k\b/);
  if (kMatch?.[1]) {
    const v = Number(kMatch[1].replace(",", "."));
    if (Number.isFinite(v)) return Math.round(v * 1000);
  }
  const mMatch = t.match(/\b(\d+(?:[.,]\d+)?)\s*m\b/);
  if (mMatch?.[1]) {
    const v = Number(mMatch[1].replace(",", "."));
    if (Number.isFinite(v)) return Math.round(v * 1_000_000);
  }
  const plain = t.match(/\b(\d{4,9})\b/);
  if (!plain?.[1]) return undefined;
  const n = Number(plain[1]);
  return Number.isFinite(n) ? n : undefined;
}

type ListingCandidate = {
  listingCode: string;
  orgId?: string;
  description?: string;
  address?: string;
  price?: string | number;
  link?: string;
  confidence: number;
};

const MIN_CANDIDATE_CONFIDENCE = 0.4;
const AUTO_ACCEPT_CONFIDENCE = 0.9;

/**
 * Cuántas veces se le vuelve a preguntar al lead por su vivienda antes de
 * pasárselo a la agencia.
 *
 * Uno: el primer mensaje ya lleva el enlace al catálogo, así que quien no lo
 * resuelve a la segunda no lo va a resolver a la tercera; insistir solo alarga
 * la conversación antes de que le llame una persona. Antes eran dos.
 */
const MAX_LISTING_LOOKUP_RETRIES = 1;
const MAX_AI_SHORTLIST = 120;
const MAX_RETURNED_CANDIDATES = 30;

/**
 * Qué se le contesta al lead cuando no se ha podido identificar la vivienda.
 *
 * Con `catalogUrl` se le manda el catálogo desde el PRIMER fallo: pedirle otra
 * vez la referencia a quien ya ha demostrado que no la tiene a mano es lo que
 * hace que se pierdan leads. En la página busca la suya y copia la referencia
 * con un botón.
 *
 * Sin `catalogUrl` (flujo de intake global, donde todavía no se sabe de qué
 * agencia es el lead) se manda el mensaje de siempre.
 */
function buildRetryListingLookupMessage(
  attempt: number,
  language: InitialLanguage,
  catalogUrl?: string
): string {
  if (language === "en") {
    if (catalogUrl) {
      return compactMessage([
        attempt <= 1
          ? "Sorry, I couldn't identify the property from that."
          : "I still can't find it with those details.",
        "",
        "Here are all our listings 👇",
        catalogUrl,
        "",
        "Find yours, copy the reference number with the button and paste it here.",
        "",
        "If you prefer, tell me the street or the approximate price.",
      ]);
    }
    const header = attempt <= 1
      ? "Okay, I still can't locate it with that information."
      : "I still can't identify it with enough confidence.";
    return compactMessage([
      header,
      "Can you share another detail so I can find it?",
      "",
      "You can send:",
      "1) Listing reference number (9 digits, starts with 1)",
      "2) Street or area",
      "3) Approximate price",
      "4) Or the listing link",
    ]);
  }
  if (catalogUrl) {
    return compactMessage([
      attempt <= 1
        ? "Perdona, no he conseguido identificar la vivienda con esos datos."
        : "Sigo sin localizarla con esos datos.",
      "",
      "Aquí tienes todos nuestros anuncios 👇",
      catalogUrl,
      "",
      "Busca la tuya, copia el número de referencia con el botón y pégamelo aquí.",
      "",
      "Si lo prefieres, dime la calle o el precio aproximado.",
    ]);
  }
  const header = attempt <= 1
    ? "Vale, aún no lo localizo con esos datos."
    : "Sigo sin localizarlo con seguridad.";
  return compactMessage([
    header,
    "¿Me puedes dar otro dato para encontrarlo?",
    "",
    "Puedes enviar:",
    "1) Número de referencia (9 dígitos, empieza por 1)",
    "2) Calle o zona",
    "3) Precio aproximado",
    "4) O el enlace al anuncio",
  ]);
}

/**
 * Enlace al catálogo de la agencia para los reintentos del flujo de llamada.
 *
 * Solo tiene sentido en el flujo per-org: en el de intake global la
 * organización activa es la de Proplead y todavía no se sabe de qué agencia es
 * el lead — justo lo que se le está preguntando —, así que no hay catálogo que
 * enseñarle.
 *
 * Si falla, se devuelve undefined y el bot manda el mensaje de siempre: quedarse
 * sin responder por no poder montar un enlace sería mucho peor.
 */
async function resolveCallCatalogUrl(state: ConversationState): Promise<string | undefined> {
  if (state.callFlowMode !== "per_org") return undefined;
  const orgId = getActiveOrgId();
  if (!orgId) return undefined;
  try {
    const code = await getOrCreateCatalogCode(orgId);
    return buildCatalogUrl(APP_BASE_URL.value(), code);
  } catch (error) {
    console.warn("No se pudo resolver el catálogo de la agencia", error);
    return undefined;
  }
}

/**
 * Cuánto dura el "standby" de un lead sin cualificar: mientras siga dentro de esta
 * ventana, cambiarle de vivienda se le pregunta en vez de darlo por hecho.
 */
const LISTING_SWITCH_CONFIRM_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * ¿Hay que preguntar antes de mover a este lead a otra vivienda?
 *
 * Solo en un caso: el anuncio que tiene ahora sigue en el aire —"No cualificado",
 * que es el estado con el que nace toda fila— y han pasado menos de 48 horas desde
 * el último mensaje. Ahí no se sabe si el lead se ha equivocado de referencia o si
 * de verdad quiere cambiar, y preguntarlo cuesta un mensaje.
 *
 * Cualificado, Rechazado y Sin respuesta se cambian solos: ese anuncio ya está
 * cerrado para él, así que la referencia nueva es lo único que hay sobre la mesa.
 * Pasadas las 48 horas, también: la conversación anterior ya se enfrió.
 */
async function shouldAskBeforeSwitchingListing(params: {
  chatId: string;
  previousListingCode: string;
  lastMessageBeforeNowMs: number;
  nowMs: number;
}): Promise<boolean> {
  if (params.nowMs - params.lastMessageBeforeNowMs > LISTING_SWITCH_CONFIRM_WINDOW_MS) return false;
  try {
    const doc = await findLeadDocForChat(params.chatId, params.previousListingCode);
    const status = doc?.data()?.qualificationStatus;
    // Sin fila que consultar se cambia sin preguntar: es lo mismo que hace hoy y no
    // deja al lead esperando por una pregunta que no podemos fundamentar.
    return status === "not_qualified";
  } catch (error) {
    console.warn("No se pudo leer el estado del lead para decidir el cambio de anuncio", error);
    return false;
  }
}

/**
 * Cuándo escribió el lead por última vez ANTES de los mensajes que se están
 * procesando ahora. Es el reloj de las 48 horas.
 *
 * Cuentan solo los mensajes del lead, no los nuestros. Cada llamada deja en el
 * historial la plantilla que le mandamos, con la hora de ese momento: contando
 * también los nuestros, el reloj se reiniciaba en cada llamada y la ventana no se
 * cerraba nunca — justo el caso en el que hay que cambiar de vivienda sin
 * preguntar es el del lead que lleva días sin decir nada y vuelve a llamar.
 *
 * Y sin contar el mensaje que acaba de llegar, que si no la ventana estaría
 * siempre abierta.
 */
function lastLeadMessageBeforeBatchMs(history: HistoryItem[], batch: PendingItem[]): number {
  const oldestInBatch = batch.reduce((min, m) => Math.min(min, m.timestamp || 0), Number.MAX_SAFE_INTEGER);
  let last = 0;
  for (const item of history || []) {
    if (item?.role !== "user") continue;
    const at = item?.timestamp || 0;
    if (at < oldestInBatch && at > last) last = at;
  }
  return last;
}

/** "Estabas preguntando por X. ¿Te paso a Y?" */
function buildListingSwitchQuestion(params: {
  previousDescription: string;
  nextDescription: string;
  language: InitialLanguage;
}): string {
  if (params.language === "en") {
    return compactMessage([
      `You were asking about ${params.previousDescription}.`,
      "",
      `Do you want to switch to ${params.nextDescription}?`,
      "",
      "Reply YES to switch, or NO to carry on with the first one.",
    ]);
  }
  return compactMessage([
    `Estabas preguntando por ${params.previousDescription}.`,
    "",
    `¿Quieres que pasemos a ${params.nextDescription}?`,
    "",
    "Responde SÍ para cambiar, o NO para seguir con la primera.",
  ]);
}

/**
 * ¿Está el lead nombrando OTRA vivienda en mitad de una conversación que ya tiene una?
 *
 * Se exige una referencia de Idealista de verdad: el enlace, o nueve dígitos que
 * empiecen por 1. `extractListingCodeFromText` acepta cualquier grupo de 6 a 12
 * dígitos, y en plena cualificación el lead escribe números constantemente — su
 * teléfono, sin ir más lejos, que en España tiene nueve dígitos y empieza por 6 o 7.
 * Con la regla suelta, decir "mi móvil es 622053377" le habría cambiado de piso.
 *
 * Y además tiene que existir: si no, el lead se iría de la cualificación a un
 * "no encuentro ese anuncio" por haber escrito un número cualquiera.
 */
async function mentionsADifferentListing(params: {
  text: string;
  currentListingCode?: string;
}): Promise<boolean> {
  const current = (params.currentListingCode || "").trim();
  if (!current || current === CALL_PENDING_LISTING_CODE) return false;

  const text = params.text || "";
  const fromUrl = text.match(/idealista\.com\/inmueble\/(\d{6,12})/i)?.[1];
  const fromDigits = text.match(/\b(1\d{8})\b/)?.[1];
  const code = fromUrl || fromDigits;
  if (!code || code === current) return false;

  try {
    return Boolean(await fetchListingByCode(code));
  } catch (error) {
    console.warn("No se pudo comprobar si la referencia mencionada existe", error);
    return false;
  }
}

/**
 * Borra de verdad `pendingListingSwitch` del documento.
 *
 * Escribir `undefined` no vale: el cliente de Firestore va con
 * `ignoreUndefinedProperties`, así que la clave se ignora y el valor anterior se
 * queda ahí. Con la pregunta de cambio ya resuelta, dejar la vivienda candidata
 * escrita solo sirve para despistar a quien lea la conversación después.
 */
async function clearPendingListingSwitch(chatId: string): Promise<void> {
  try {
    const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
    await db
      .doc(`organizations/${getActiveOrgId()}/conversations/${normalizeToCanonicalChatId(chatId)}`)
      .update({ pendingListingSwitch: admin.firestore.FieldValue.delete() });
  } catch (error) {
    // Que no se pueda limpiar no debe cortar la conversación.
    console.warn("No se pudo limpiar pendingListingSwitch", error);
  }
}

/** Cuando decide quedarse con la vivienda que ya tenía. */
function buildListingSwitchKeptMessage(language: InitialLanguage): string {
  return language === "en"
    ? "Understood — we'll carry on with the first property."
    : "Entendido, seguimos con la primera vivienda.";
}

/** Cómo se nombra una vivienda dentro de esas preguntas: dirección si la hay, si no la referencia. */
function describeListingForLead(listing: { description?: string; address?: string; listingCode: string }): string {
  const address = (listing.address || "").trim();
  const description = (listing.description || "").trim();
  return address || description || `ref. ${listing.listingCode}`;
}

function buildConfirmListingMessage(candidate: ListingCandidate, language: InitialLanguage): string {
  if (language === "en") {
    return compactMessage([
      "Great, I think I found it.",
      candidate.link ? `Link: ${candidate.link}` : "",
      "",
      "Is this the property you're contacting us about?",
    ]);
  }
  return compactMessage([
    "Estupendo, creo que ya lo tengo.",
    candidate.link ? `Link: ${candidate.link}` : "",
    "",
    "¿Es esta la vivienda por la que nos contactas?",
  ]);
}

function buildCallNamePrompt(language: "es" | "en", capturedName?: string): string {
  const cleaned = (capturedName || "").trim();
  if (cleaned) {
    return language === "en"
      ? `Quick check before passing you to the agent's assistant: is your name ${cleaned}?`
      : `Antes de pasarte con el asistente del agente, ¿me confirmas si tu nombre es ${cleaned}?`;
  }
  return language === "en"
    ? "Before connecting you with the agent's assistant, what's your name?"
    : "Antes de conectarte con el asistente del agente, ¿cómo te llamas?";
}

// 3 hours in seconds. After this delay, if the lead hasn't replied to the
// name prompt, processCallNameTimeout fires the cross-org handoff anyway
// using the no-name template variant.
const CALL_NAME_TIMEOUT_SECONDS = 3 * 60 * 60;

function sanitizeLeadNameFromMessage(text: string): string | undefined {
  const raw = (text || "").trim();
  if (!raw) return undefined;
  const stripped = raw
    .replace(/^(me\s+llamo|soy|mi\s+nombre\s+es|i'?m|i\s+am|my\s+name\s+is)\s+/i, "")
    .replace(/[.!?,]+$/g, "")
    .trim();
  if (!stripped) return undefined;
  if (stripped.length > 60) return undefined;
  if (!/[a-záéíóúñü]/i.test(stripped)) return undefined;
  // Reject pure confirm/deny tokens
  const lowered = stripped.toLowerCase();
  if (["si", "sí", "yes", "y", "no", "nop", "none", "ninguno", "ninguna", "ok", "vale"].includes(lowered)) return undefined;
  // Title-case each token
  return stripped
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((tok) => tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase())
    .join(" ");
}

async function resolveListingFromBufferedText(params: {
  operationType?: OperationType;
  text: string;
  orgId?: string;
  includeAllOrgs?: boolean;
}): Promise<
  | { kind: "match"; candidate: ListingCandidate; candidates: ListingCandidate[] }
  | { kind: "candidates"; candidates: ListingCandidate[] }
  | { kind: "none" }
> {
  const DATABASE_ID = "realestate-whatsapp-bot";
  const db = getFirestore(admin.app(), DATABASE_ID);
  const combinedText = params.text || "";
  const directCode = extractListingCodeFromText(combinedText);
  if (directCode) {
    const direct = await fetchListingGlobally(directCode);
    if (direct && (params.includeAllOrgs !== false || !params.orgId || direct.orgId === params.orgId)) {
      return {
        kind: "match",
        candidate: {
          listingCode: direct.data.listingCode,
          orgId: direct.orgId,
          description: direct.data.description,
          address: direct.data.address || direct.data.street,
          price: direct.data.price,
          link: direct.data.link,
          confidence: 1,
        },
        candidates: [
          {
            listingCode: direct.data.listingCode,
            orgId: direct.orgId,
            description: direct.data.description,
            address: direct.data.address || direct.data.street,
            price: direct.data.price,
            link: direct.data.link,
            confidence: 1,
          },
        ],
      };
    }
  }

  const snap = await db.collectionGroup("listings").limit(1200).get();
  const includeAllOrgs = params.includeAllOrgs !== false;
  const activeListings = snap.docs.map((doc) => {
    const data = doc.data();
    const orgId = doc.ref.path.split("/")[1] || "";
    return {
      orgId,
      listingCode: data.listingCode || "",
      operationType: data.operationType as OperationType | undefined,
      description: data.description || "",
      address: data.address || "",
      street: data.street || "",
      city: data.city || "",
      province: data.province || "",
      price: data.price,
      link: data.link || "",
      isActive: data.isActive !== false,
      full: data as ListingRow,
    };
  }).filter((row) => row.orgId && row.listingCode && row.isActive && (includeAllOrgs || !params.orgId || row.orgId === params.orgId));
  const operationFilteredListings = params.operationType
    ? activeListings.filter((row) => row.operationType === params.operationType)
    : activeListings;
  if (!operationFilteredListings.length) return { kind: "none" };

  const normalize = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const textNorm = normalize(combinedText);
  const textTokens = new Set((textNorm.match(/[a-z0-9]+/g) || []).filter((t) => t.length >= 2));
  const extractedPrice = extractPriceFromText(combinedText);
  const extractedCode = extractListingCodeFromText(combinedText);
  const parsePrice = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return undefined;
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const lexicalScore = (row: (typeof operationFilteredListings)[number]): number => {
    if (!textNorm) return 0;
    const combined = normalize(
      [
        row.listingCode,
        row.description || "",
        row.address || "",
        row.street || "",
        row.city || "",
        row.province || "",
      ].join(" ")
    );
    if (!combined) return 0;
    if (extractedCode && row.listingCode === extractedCode) return 1;
    let hits = 0;
    for (const token of textTokens) {
      if (combined.includes(token)) hits += 1;
    }
    const tokenScore = textTokens.size > 0 ? hits / textTokens.size : 0;
    const priceVal = parsePrice(row.price);
    let priceScore = 0;
    if (extractedPrice && priceVal && extractedPrice > 0) {
      const relDiff = Math.abs(priceVal - extractedPrice) / extractedPrice;
      priceScore = Math.max(0, 1 - relDiff);
    }
    return Math.min(1, tokenScore * 0.8 + priceScore * 0.2);
  };

  const preRanked = operationFilteredListings
    .map((row) => ({ row, det: lexicalScore(row) }))
    .sort((a, b) => b.det - a.det);
  const aiShortlist = preRanked.slice(0, MAX_AI_SHORTLIST).map((item) => item.row);

  const decision = await resolveListingWithAgent({
    bufferText: combinedText,
    activeListings: aiShortlist.map((row) => ({
      listingCode: row.listingCode,
      operationType: row.operationType,
      description: row.description,
      address: row.address,
      street: row.street,
      city: row.city,
      province: row.province,
      price: row.price,
      link: row.link,
    })),
    operationType: params.operationType,
  });
  console.log("Listing agent decision", {
    kind: decision.kind,
    confidence: decision.confidence,
    reason: decision.reason,
    topCandidates: decision.candidates?.slice(0, 3) || [],
    operationType: params.operationType || "unknown",
    listingCount: operationFilteredListings.length,
    aiShortlistCount: aiShortlist.length,
  });

  const aiConfidenceByCode = new Map<string, number>();
  for (const c of decision.candidates || []) {
    const conf = Number.isFinite(c.confidence) ? c.confidence : 0;
    aiConfidenceByCode.set(c.listingCode, Math.max(0, Math.min(1, conf)));
  }

  const candidates = preRanked
    .slice(0, Math.max(MAX_RETURNED_CANDIDATES, MAX_AI_SHORTLIST))
    .map(({ row, det }) => {
      const ai = aiConfidenceByCode.get(row.listingCode) ?? 0;
      // Blend to keep AI as the dominant signal while still scoring broad candidates cheaply.
      const blended = ai > 0
        ? (ai * 0.8 + det * 0.2)
        : (det * 0.55);
      return {
        listingCode: row.listingCode,
        orgId: row.orgId,
        description: row.description,
        address: row.address || row.street,
        price: row.price,
        link: row.link,
        confidence: Math.max(0, Math.min(1, blended)),
      } as ListingCandidate;
    })
    .filter((candidate) => candidate.confidence >= MIN_CANDIDATE_CONFIDENCE)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, MAX_RETURNED_CANDIDATES);

  if (candidates.length === 0) return { kind: "none" };

  if (decision.kind === "match") {
    const matched = candidates.find((candidate) => candidate.listingCode === decision.listingCode);
    if (matched) return { kind: "match", candidate: matched, candidates };
  }

  if (candidates.length === 1) {
    return { kind: "match", candidate: candidates[0], candidates };
  }

  if (decision.kind === "ambiguous" || decision.kind === "match") {
    return { kind: "candidates", candidates };
  }

  if (decision.kind === "none" && candidates.length > 0) {
    return { kind: "candidates", candidates };
  }

  return { kind: "none" };
}

function buildCallInitialWhatsAppMessageEs(agentName?: string): string {
  const who = agentName ? ` de ${agentName}` : "";
  return [
    `¡Hola! Soy el asistente virtual${who}. Acabamos de hablar por teléfono.`,
    "Para localizar el anuncio, ¿me indicas por favor cuál es?",
    "Me puedes pasar:",
    "1) El número de referencia (9 dígitos, empieza por 1)",
    "2) La calle o zona",
    "3) El precio",
    "4) O pegar directamente el enlace al anuncio",
  ].join("\n\n");
}

function buildListingNotFoundFallback(agentName: string | undefined, language: InitialLanguage): string {
  if (language === "en") {
    const who = agentName ? ` to ${agentName}` : "";
    return `Okay, I can't find it in my system right now, but no worries. I'll send your contact${who} so they can call you as soon as possible.`;
  }
  const who = agentName ? ` a ${agentName}` : "";
  return `Vale, parece que no lo encuentro en mi sistema, pero no te preocupes. Le enviaré tu contacto${who} para que te llame lo antes posible.`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractStripeId(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  return typeof rec.id === "string" ? rec.id : "";
}

const BULLET_SYMBOL = "•";
const NO_DATA_LABEL = "Sin datos";
/**
 * Header copy for the qualified-lead alert when we could not resolve the property.
 * The approved template renders {{3}} inline ("Nuevo lead cualificado de *{{3}}* ✅"),
 * so a bare "Sin datos" would read as a broken sentence there.
 */
const UNKNOWN_PROPERTY_LABEL = "propiedad sin identificar";
const SUMMARY_EMPTY_TOKENS = new Set(["SINDATOS", "NODATOS", "UNKNOWN", "NA", "N/A", "NOINFO", "NOHAYDATOS"]);

async function getFeaturesForLanguage(features: string, language: InitialLanguage): Promise<string> {
  if (language !== "en") return features;
  try {
    return await translateTextToBritishEnglish(features);
  } catch (error) {
    console.warn("Failed to translate features", error);
    return features;
  }
}

type InitialLanguage = "es" | "en";

// In-memory conversation state (for active conversations).
// IMPORTANT: keys MUST be scoped by active orgId so two organizations sharing the
// same canonical chatId (e.g. WABA shared between intake + owner orgs) don't leak
// state across orgs.
const conversationStates = new Map<string, ConversationState>();

function conversationStateCacheKey(chatId: string): string {
  return `${getActiveOrgId() || "__no_org__"}:${chatId}`;
}

function getCachedConversationState(chatId: string): ConversationState | undefined {
  return conversationStates.get(conversationStateCacheKey(chatId));
}

function setCachedConversationState(chatId: string, state: ConversationState): void {
  conversationStates.set(conversationStateCacheKey(chatId), state);
}

type EnsureConversationStateOptions = {
  /**
   * History is mutated by multiple Cloud Run services. A warm instance cache can be
   * stale relative to Firestore, so write paths must opt into a fresh read first.
   */
  preferFresh?: boolean;
};

// Initial language resolving
function resolveInitialLanguage(phone?: string): InitialLanguage {
  return isSpanishPhoneNumber(phone) ? "es" : "en";
}

const SPANISH_LANGUAGE_TOKENS = new Set([
  "hola", "gracias", "vale", "anuncio", "vivienda", "calle", "zona", "precio", "ninguna", "ninguno",
  "si", "sí", "quiero", "interesado", "interesada", "referencia", "enlace", "correcto", "es",
]);
const ENGLISH_LANGUAGE_TOKENS = new Set([
  "hello", "thanks", "thank", "listing", "property", "street", "area", "price", "none",
  "yes", "no", "link", "reference", "correct", "interested", "not",
]);

export function isLikelySpanishReply(text: string): boolean {
  const lowered = text.toLowerCase();
  if (!/[a-záéíóúñü]/i.test(lowered)) return false;
  if (/[¿¡ñáéíóúü]/i.test(lowered)) return true;
  const words = lowered.match(/[a-záéíóúñü]+/gi) || [];
  if (words.length === 0) return false;
  let esScore = 0;
  let enScore = 0;
  for (const rawWord of words) {
    const word = rawWord.trim();
    if (!word) continue;
    if (SPANISH_LANGUAGE_TOKENS.has(word)) esScore += 1;
    if (ENGLISH_LANGUAGE_TOKENS.has(word)) enScore += 1;
  }
  return esScore > 0 && esScore >= enScore;
}

export function isLikelyEnglishReply(text: string): boolean {
  const lowered = text.toLowerCase();
  if (!/[a-z]/i.test(lowered)) return false;
  // Any Spanish-specific character → not English.
  if (/[¿¡ñáéíóúü]/i.test(lowered)) return false;
  const words = lowered.match(/[a-z]+/gi) || [];
  if (words.length === 0) return false;
  let esScore = 0;
  let enScore = 0;
  for (const rawWord of words) {
    const word = rawWord.trim();
    if (!word) continue;
    if (SPANISH_LANGUAGE_TOKENS.has(word)) esScore += 1;
    if (ENGLISH_LANGUAGE_TOKENS.has(word)) enScore += 1;
  }
  return enScore > 0 && enScore > esScore;
}

export function resolveReplyLanguageFromMessages(messages: PendingItem[], fallback: InitialLanguage): InitialLanguage {
  // Require POSITIVE evidence to switch languages. Short ambiguous replies (e.g. a name like
  // "Jorge") used to trip the old logic into returning "en" simply because `isLikelySpanishReply`
  // couldn't confidently classify them as Spanish. Now we only switch when we see clear signal.
  let sawSpanish = false;
  let sawEnglish = false;
  for (const message of messages) {
    const text = (message.text || "").trim();
    if (!/[a-záéíóúñü]/i.test(text)) continue;
    if (isLikelySpanishReply(text)) {
      sawSpanish = true;
    } else if (isLikelyEnglishReply(text)) {
      sawEnglish = true;
    }
  }
  if (sawSpanish && !sawEnglish) return "es";
  if (sawEnglish && !sawSpanish) return "en";
  return fallback;
}

function cleanFeature(line: string): string {
  return line.replace(/^[\u2022•*-]+\s*/u, "").trim();
}

function splitByCommaOutsideParentheses(text: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let buffer = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      const segment = buffer.trim();
      if (segment) segments.push(segment);
      buffer = "";
      continue;
    }
    buffer += char;
  }
  const finalSegment = buffer.trim();
  if (finalSegment) segments.push(finalSegment);
  return segments;
}

function splitFeatures(features: string): string[] {
  const normalized = features.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const newlineSplit = normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (newlineSplit.length > 1) return newlineSplit;
  const semicolonSplit = normalized.split(/;\s*/).map((s) => s.trim()).filter(Boolean);
  if (semicolonSplit.length > 1) return semicolonSplit;
  const commaSplit = splitByCommaOutsideParentheses(normalized);
  if (commaSplit.length > 1) return commaSplit;
  return [normalized];
}

function sanitizeSummaryValue(value?: string | number | boolean): string | number | boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/\s+/g, "").toUpperCase();
  if (SUMMARY_EMPTY_TOKENS.has(normalized)) return undefined;
  return trimmed;
}

function pickSummaryValue<T extends string | number | boolean>(...candidates: (T | undefined)[]): T | undefined {
  for (const candidate of candidates) {
    const sanitized = sanitizeSummaryValue(candidate);
    if (sanitized !== undefined) return sanitized as T;
  }
  return undefined;
}

function buildQualifiedLeadMessage(state: ConversationState, summary?: LeadSummary): string {
  const lines = ["Lead cualificado ✅", `Teléfono: ${state.phone}`];
  const resolvedName = pickSummaryValue(summary?.name, state.name);
  lines.push(`Nombre: ${resolvedName ?? NO_DATA_LABEL}`);
  if (state.description) lines.push(`Propiedad: ${state.description}`);
  lines.push(`Operación: ${state.operationType}`);

  if (state.operationType === "Alquiler") {
    lines.push(`Personas: ${pickSummaryValue(summary?.people) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.income) !== undefined ? pickSummaryValue(summary?.income) + " €/mes" : NO_DATA_LABEL}`);
    
    const petsVal = pickSummaryValue(summary?.pets);
    lines.push(`Mascotas: ${petsVal === true ? "Sí" : petsVal === false ? "No" : NO_DATA_LABEL}`);
    
    lines.push(`Fechas: ${pickSummaryValue(summary?.dates) ?? NO_DATA_LABEL}`);
  } else {
    lines.push(`Forma de pago: ${pickSummaryValue(summary?.paymentMethod) ?? NO_DATA_LABEL}`);
    lines.push(`Ingresos: ${pickSummaryValue(summary?.income) !== undefined ? pickSummaryValue(summary?.income) + " €/mes" : NO_DATA_LABEL}`);
  }

  lines.push(`Disponibilidad visita: ${pickSummaryValue(summary?.visitAvailability) ?? NO_DATA_LABEL}`);
  const notesValue = pickSummaryValue(summary?.notes);
  if (notesValue) lines.push(`Notas: ${notesValue}`);

  return lines.join("\n");
}

function formatFeaturesList(features: string, language: InitialLanguage): string {
  const items = splitFeatures(features).map(cleanFeature).filter(Boolean);
  if (items.length === 0) {
    if (!features.trim()) {
      return language === "en"
        ? `${BULLET_SYMBOL} Property details are not available at the moment`
        : `${BULLET_SYMBOL} Información no disponible por el momento`;
    }
    const fallback = cleanFeature(features);
    return fallback ? `${BULLET_SYMBOL} ${fallback}` : "";
  }
  return items.map((item) => `${BULLET_SYMBOL} ${item}`).join("\n");
}

function compactMessage(lines: string[]): string {
  const normalized: string[] = [];
  for (const line of lines) {
    if (line === "" && normalized[normalized.length - 1] === "") continue;
    normalized.push(line);
  }
  while (normalized[0] === "") normalized.shift();
  while (normalized[normalized.length - 1] === "") normalized.pop();
  return normalized.join("\n");
}

function extractQualifiedSummaryField(summaryText: string, label: string): string | undefined {
  const trimmedSummary = summaryText.trim();
  if (!trimmedSummary) return undefined;
  const prefix = `${label}:`;
  for (const rawLine of trimmedSummary.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const value = line.slice(prefix.length).trim();
    if (!value || value === NO_DATA_LABEL) return undefined;
    return value;
  }
  return undefined;
}

function buildPropleadAgentNotificationTwilioVariables(params: {
  templateSid: string | undefined;
  /** Per-org flag from BotConfig.twilioTemplates.agentNotificationIs8Var (preferred over SID whitelist). */
  is8VarFlag?: boolean;
  after: Record<string, unknown> | undefined;
  listingDescription: string;
}): Record<string, string> | null {
  if (!isProplead8VarAgentNotification({ sid: params.templateSid, is8VarFlag: params.is8VarFlag })) return null;

  const after = params.after || {};
  const summary = typeof after.conversationSummary === "string" ? after.conversationSummary : "";

  const name =
    (typeof after.name === "string" && after.name.trim()) ||
    extractQualifiedSummaryField(summary, "Nombre") ||
    NO_DATA_LABEL;

  const phoneDigitsField = typeof after.phone === "string" ? after.phone.replace(/\D/g, "") : "";
  const phoneDigitsSummary = extractQualifiedSummaryField(summary, "Teléfono")?.replace(/\D/g, "") || "";
  const phoneDigits = phoneDigitsField || phoneDigitsSummary;
  const phone = phoneDigits ? `+${phoneDigits.replace(/^\+/, "")}` : NO_DATA_LABEL;

  const listingDesc = (params.listingDescription || "").trim();
  const propFromSummary = extractQualifiedSummaryField(summary, "Propiedad");
  const listingCode = typeof after.listingCode === "string" ? after.listingCode.trim() : "";
  const property =
    listingDesc ||
    propFromSummary ||
    (listingCode ? `Anuncio ${listingCode}` : UNKNOWN_PROPERTY_LABEL);

  const operation =
    (typeof after.operationType === "string" && after.operationType) ||
    extractQualifiedSummaryField(summary, "Operación") ||
    NO_DATA_LABEL;

  const payment =
    (after.paymentMethod === "Contado" || after.paymentMethod === "Hipoteca")
      ? String(after.paymentMethod)
      : extractQualifiedSummaryField(summary, "Forma de pago") ||
        NO_DATA_LABEL;

  let incomeStr = NO_DATA_LABEL;
  if (typeof after.income === "number" && Number.isFinite(after.income)) {
    incomeStr = `${after.income} €/mes`;
  } else {
    const inc = extractQualifiedSummaryField(summary, "Ingresos");
    if (inc) incomeStr = inc;
  }

  const visit =
    (typeof after.visitAvailability === "string" && after.visitAvailability.trim()) ||
    extractQualifiedSummaryField(summary, "Disponibilidad visita") ||
    NO_DATA_LABEL;

  const baseNotes =
    (typeof after.notes === "string" && after.notes.trim()) ||
    extractQualifiedSummaryField(summary, "Notas") ||
    NO_DATA_LABEL;

  // Si el lead viene de otra vivienda, se dice en las notas. Es texto libre dentro
  // de la plantilla ya aprobada ({{8}}), así que no hace falta pasar por Meta otra
  // vez — y sin esta línea el agente ve aparecer un lead sobre una vivienda que no
  // había pedido, sin saber que es el mismo de antes.
  const previousListingCode =
    typeof after.previousListingCode === "string" ? after.previousListingCode.trim() : "";
  const previousLine = previousListingCode
    ? `Antes preguntaba por la referencia ${previousListingCode}.`
    : "";
  const notes = previousLine
    ? (baseNotes === NO_DATA_LABEL ? previousLine : `${baseNotes}\n${previousLine}`)
    : baseNotes;

  return {
    "1": name,
    "2": phone,
    "3": property.slice(0, 1200),
    "4": operation,
    "5": payment,
    "6": incomeStr,
    "7": visit,
    "8": notes.slice(0, 1200),
  };
}

/**
 * Mirrors the approved 8-var WhatsApp template copy for the free-form (24h window open) path.
 *
 * The property ({{3}}) leads the first line on purpose: WhatsApp collapses long messages behind
 * "Read more" but never folds the opening line, so agents see which listing the lead came from
 * without tapping. It is therefore not repeated further down.
 */
function renderPropleadAgentNotificationBody(vars: Record<string, string>): string {
  return [
    `Nuevo lead cualificado de *${vars["3"] || UNKNOWN_PROPERTY_LABEL}* ✅`,
    "",
    `Tu nuevo lead se llama *${vars["1"] || NO_DATA_LABEL}* y su teléfono es *${vars["2"] || NO_DATA_LABEL}*.`,
    `La operación es *${vars["4"] || NO_DATA_LABEL}* y la forma de pago prevista *${vars["5"] || NO_DATA_LABEL}*.`,
    `Sus ingresos: *${vars["6"] || NO_DATA_LABEL}*.`,
    `Su disponibilidad para visitar es: *${vars["7"] || NO_DATA_LABEL}*.`,
    `Notas adicionales: *${vars["8"] || NO_DATA_LABEL}*.`,
    "",
    "— Marcos, Proplead",
  ].join("\n");
}

function buildQualifiedLeadFallbackNotificationBody(after: Record<string, unknown> | undefined): string {
  const summary = typeof after?.conversationSummary === "string" ? after.conversationSummary.trim() : "";
  if (summary) return summary;

  return compactMessage([
    "Lead cualificado ✅",
    `Teléfono: ${after?.phone || "N/D"}`,
    `Nombre: ${after?.name || "Sin nombre"}`,
    after?.listingCode ? `Anuncio: ${after.listingCode}` : "",
  ]);
}

function buildQualifiedLeadAgentNotificationPayload(params: {
  templateSid: string | undefined;
  /** Per-org flag from BotConfig.twilioTemplates.agentNotificationIs8Var. */
  is8VarFlag?: boolean;
  after: Record<string, unknown> | undefined;
  listingDescription: string;
}): {
  body: string;
  twilioTemplateVariables?: Record<string, string>;
} {
  const fallbackBody = buildQualifiedLeadFallbackNotificationBody(params.after);
  const propleadVars = buildPropleadAgentNotificationTwilioVariables(params);
  if (!propleadVars) return { body: fallbackBody };

  return {
    body: renderPropleadAgentNotificationBody(propleadVars),
    twilioTemplateVariables: propleadVars,
  };
}

function composeInitialMessages(
  operationType: OperationType,
  link: string,
  features: string,
  options?: { language?: InitialLanguage }
): string[] {
  const language = options?.language ?? "es";
  const isSale = operationType === "Venta";
  const formattedFeatures = formatFeaturesList(features, language);

  if (language === "en") {
    const propertyContext = isSale ? "for sale" : "for rent";
    const message = compactMessage([
      "Hi, I'm Paco Granados' virtual assistant, it's a pleasure to help you.",
      "",
      `You've shown interest in this property ${propertyContext} 👇`,
      "",
      link,
      "",
      "Just to confirm, have you reviewed the property highlights?",
      "",
      formattedFeatures,
    ]);
    return [message];
  }

  const propertyContext = isSale ? "en venta" : "en alquiler";
  const message = compactMessage([
    "Hola, soy el colaborador virtual de Paco Granados, un placer atenderte.",
    "",
    `Te has interesado en esta vivienda ${propertyContext}👇`,
    "",
    link,
    "",
    "Por confirmar, ¿has visto las características?",
    "",
    formattedFeatures,
  ]);
  return [message];
}

type ParsedAssistantResponse = {
  cleanMessage: string;
  qualificationStatus: boolean | undefined;
};

function parseAssistantResponse(rawMessage: string): ParsedAssistantResponse {
  const trimmed = rawMessage.trim();
  if (trimmed.includes(LEAD_QUALIFIED_MARKER)) {
    return { cleanMessage: trimmed.replace(LEAD_QUALIFIED_MARKER, "").trim(), qualificationStatus: true };
  }
  if (trimmed.includes(LEAD_NOT_INTERESTED_MARKER)) {
    return { cleanMessage: trimmed.replace(LEAD_NOT_INTERESTED_MARKER, "").trim(), qualificationStatus: false };
  }
  return { cleanMessage: trimmed, qualificationStatus: undefined };
}

function extractInboundMessages(body: unknown): InboundMessage[] {
  if (!body || typeof body !== "object") return [];
  const candidate = body as Record<string, unknown>;

  // Check if it's a Twilio payload (form-urlencoded usually results in top-level fields)
  if (candidate.SmsSid && candidate.From) {
    const from = String(candidate.From);
    const bodyText = String(candidate.Body || "");
    const buttonText = typeof candidate.ButtonText === "string" ? candidate.ButtonText.trim() : "";
    if (!buttonText && !bodyText.trim()) return [];
    // Prefer visible button label so language inference matches the template locale (payload ids like confirm_yes read as English).
    const normalizedText = buttonText || bodyText;
    const waId = candidate.WaId ? String(candidate.WaId) : extractPhoneFromChatId(from);
    
    // Canonical format for Twilio WhatsApp is whatsapp:+123456789
    // We want to normalize it to our internal format 123456789@s.whatsapp.net
    const phone = waId;
    const chatId = normalizeToCanonicalChatId(phone);
    
    const timestampValue = candidate.Timestamp ? Date.parse(String(candidate.Timestamp)) : Date.now();

    return [{
      chatId,
      phone,
      text: normalizedText,
      timestamp: ensureTimestampMillis(timestampValue),
    }];
  }

  const messagesField = candidate.messages;
  const rawMessages: unknown[] = Array.isArray(messagesField)
    ? messagesField
    : Array.isArray(candidate.message)
      ? [candidate.message]
      : [];

  const result: InboundMessage[] = [];
  for (const raw of rawMessages) {
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Record<string, unknown>;
    if (msg.from_me === true) continue;
    const from = typeof msg.from === "string" ? msg.from : typeof msg.sender === "string" ? msg.sender : "";
    const chatId = typeof msg.chat_id === "string" ? msg.chat_id : typeof msg.chatId === "string" ? msg.chatId : "";
    const text =
      typeof msg.text === "string"
        ? msg.text
        : typeof (msg.text as Record<string, unknown>)?.body === "string"
          ? ((msg.text as Record<string, unknown>).body as string)
          : typeof (msg.link_preview as Record<string, unknown>)?.body === "string"
            ? ((msg.link_preview as Record<string, unknown>).body as string)
          : typeof msg.body === "string"
            ? msg.body
            : "";
    const timestampValue = typeof msg.timestamp === "number" ? msg.timestamp : Number.parseInt(msg.timestamp as string, 10);
    const timestamp = ensureTimestampMillis(Number.isFinite(timestampValue) ? timestampValue : Date.now());
    if (!chatId || !text) continue;
    result.push({ chatId, phone: from, text, timestamp });
  }
  return result;
}

/**
 * Cross-org handoff (and older bugs) could persist qualification convos without
 * listing-derived fields. Merge from the org listing row once and persist so
 * the qualification prompt always has link/address/features/etc.
 */
async function hydrateConversationListingFieldsIfNeeded(conv: ConversationState): Promise<ConversationState> {
  const listingCode = conv.listingCode;
  if (!listingCode || listingCode === CALL_PENDING_LISTING_CODE) return conv;
  const hasLink = Boolean(String(conv.link || "").trim());
  const hasFeaturesField = conv.features !== undefined;
  if (hasLink && hasFeaturesField) return conv;

  const listing = await fetchListingByCode(listingCode);
  if (!listing) return conv;

  const language: InitialLanguage = conv.language === "en" ? "en" : "es";
  const featuresText = await getFeaturesForLanguage(listing.features, language);

  const merged: ConversationState = {
    ...conv,
    link: hasLink ? conv.link : listing.link,
    address: conv.address || listing.address,
    features: hasFeaturesField ? conv.features : featuresText,
    idealistaDescription: conv.idealistaDescription ?? listing.idealistaDescription ?? "",
    rentalSubtype: conv.rentalSubtype ?? listing.rentalSubtype,
    profitabilityReportAvailable: conv.profitabilityReportAvailable ?? listing.profitabilityReportAvailable ?? false,
    profitabilityReport: conv.profitabilityReport ?? listing.profitabilityReport ?? "",
    description: conv.description || listing.description,
    operationType: conv.operationType || listing.operationType,
  };

  const changed =
    merged.link !== conv.link ||
    merged.address !== conv.address ||
    merged.features !== conv.features ||
    merged.idealistaDescription !== conv.idealistaDescription ||
    merged.rentalSubtype !== conv.rentalSubtype ||
    merged.profitabilityReportAvailable !== conv.profitabilityReportAvailable ||
    merged.profitabilityReport !== conv.profitabilityReport ||
    merged.description !== conv.description ||
    merged.operationType !== conv.operationType;

  if (changed && merged.chatId) {
    await upsertConversation(merged.chatId, {
      link: merged.link,
      address: merged.address,
      features: merged.features,
      idealistaDescription: merged.idealistaDescription,
      rentalSubtype: merged.rentalSubtype,
      profitabilityReportAvailable: merged.profitabilityReportAvailable,
      profitabilityReport: merged.profitabilityReport,
      description: merged.description,
      operationType: merged.operationType,
    });
  }

  return merged;
}

export async function ensureConversationState(
  chatId: string,
  phoneHint?: string,
  options: EnsureConversationStateOptions = {}
): Promise<ConversationState | undefined> {
  // Get all possible chatId variants (handles @c.us vs @s.whatsapp.net)
  const chatIdVariants = getChatIdVariants(chatId);

  // Check in-memory first (try all variants)
  if (!options.preferFresh) {
    for (const variant of chatIdVariants) {
      const existing = getCachedConversationState(variant);
      if (existing) {
        const hydrated = await hydrateConversationListingFieldsIfNeeded(existing);
        setCachedConversationState(variant, hydrated);
        // Also store under the incoming chatId for future lookups
        if (variant !== chatId) setCachedConversationState(chatId, hydrated);
        return hydrated;
      }
    }
  }

  // Check Firestore (try all variants)
  for (const variant of chatIdVariants) {
    const savedConv = await getConversationByChatId(variant);
    // Essential: only use saved conversation if it's "complete" (has a phone)
    if (savedConv && savedConv.phone) {
      // Migration: Add tags if missing
      if (!savedConv.tags || savedConv.tags.length === 0) {
        if (savedConv.listingCode) {
          savedConv.type = "lead";
          savedConv.tags = ["lead"];
        } else {
          savedConv.type = "non-lead";
          savedConv.tags = ["non-lead"];
        }
      }
      if (!savedConv.language) {
        savedConv.language = resolveInitialLanguage(savedConv.phone);
      }
      // Defensive normalization: conversations created by the cross-org handoff (or other
      // partial-merge writes) may lack `history`/`pendingUserMessages`. Without this, the
      // inbound webhook crashes with `Cannot read properties of undefined (reading 'push')`.
      if (!Array.isArray(savedConv.history)) {
        savedConv.history = [];
      }
      if (!Array.isArray(savedConv.pendingUserMessages)) {
        savedConv.pendingUserMessages = [];
      }
      const hydrated = await hydrateConversationListingFieldsIfNeeded(savedConv);
      setCachedConversationState(chatId, hydrated);
      return hydrated;
    }
  }

  // Try to rebuild from lead (try all variants)
  let lead = null;
  for (const variant of chatIdVariants) {
    lead = await findLeadByChatId(variant);
    if (lead) break;
  }
  if (!lead) {
    // Final fallback: Try by raw phone number (best for fragmented IDs)
    const phone = extractPhoneFromChatId(chatId);
    lead = await findLeadByPhone(phone);
  }

  const phone = phoneHint ?? lead?.phone ?? extractPhoneFromChatId(chatId);

  if (!lead) {
    // Treat as non-lead user
    const nonLeadState: ConversationState = {
      phone,
      chatId,
      history: [],
      pendingUserMessages: [],
      isFinished: false,
      botDisabled: false,
      type: "non-lead",
      tags: ["non-lead"],
      language: resolveInitialLanguage(phone),
    };
    setCachedConversationState(chatId, nonLeadState);
    return nonLeadState;
  }

  // Special case: lead exists but listing is not resolved yet (call→WhatsApp handoff)
  if (lead.listingCode === CALL_PENDING_LISTING_CODE) {
    const initialLanguage = resolveInitialLanguage(phone);
    const pendingState: ConversationState = {
      phone,
      listingCode: CALL_PENDING_LISTING_CODE,
      chatId: lead.chatId || chatId,
      operationType: lead.operationType,
      history: [],
      pendingUserMessages: [],
      isFinished: false,
      type: "lead",
      tags: ["lead", "call", PENDING_LISTING_TAG],
      flowStep: "call_listing_collect",
      language: initialLanguage,
      botDisabled: false,
      name: lead.name,
      // Safety net: this rebuild branch only runs when the conversation doc is absent
      // (normally createPendingCallLead writes it). Carry the per-org marker from the
      // lead so the call gate still routes through the in-place flow.
      callFlowMode: lead.callFlowMode,
    };
    setCachedConversationState(chatId, pendingState);
    if (pendingState.chatId !== chatId) setCachedConversationState(pendingState.chatId, pendingState);
    return pendingState;
  }

  const listing = await fetchListingByCode(lead.listingCode);
  if (!listing) {
    // If lead exists but listing doesn't, we still treat as non-lead or just return undefined?
    // User said "cuando se reciba un mensaje de un numero que no sea un lead". 
    // If the listing is missing, it's an edge case. Let's treat it as non-lead too but maybe with an alert.
    const errorState: ConversationState = {
      phone,
      chatId: lead.chatId || chatId,
      history: [],
      pendingUserMessages: [],
      isFinished: false,
      botDisabled: false,
      type: "non-lead",
      tags: ["non-lead", "missing-listing"],
      language: resolveInitialLanguage(phone),
    };
    setCachedConversationState(chatId, errorState);
    return errorState;
  }

  const initialLanguage = resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listing.features, initialLanguage);
  const initialMessages = composeInitialMessages(listing.operationType, listing.link, featuresText, {
    language: initialLanguage,
  });

  const initialHistory: HistoryItem[] = initialMessages.map((message, index) => ({
    role: "assistant",
    text: message,
    timestamp: Date.now() + index,
  }));

  const state: ConversationState = {
    phone,
    listingCode: listing.listingCode,
    chatId: lead.chatId || chatId, // Use lead's stored chatId as canonical
    operationType: listing.operationType,
    description: listing.description,
    link: listing.link,
    address: listing.address,
    features: featuresText,
    profitabilityReportAvailable: listing.profitabilityReportAvailable,
    profitabilityReport: listing.profitabilityReport,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
    type: "lead",
    tags: ["lead"],
    language: initialLanguage,
    name: lead.name,
  };

  // Cache under both the requested chatId and the canonical one
  setCachedConversationState(chatId, state);
  if (state.chatId !== chatId) setCachedConversationState(state.chatId, state);
  return state;
}

/**
 * Bills the destination org for a cross-org call handoff. Two credits:
 *   1. The Proplead global-intake send that started the conversation
 *      (idempotency key: `intakeOutboundCreditsDeducted`).
 *   2. The destination org's own first template send during the handoff
 *      (idempotency key: `initialOutboundCreditsDeducted`).
 * Each charge is independently idempotent per (orgId, chatId) and runs in its
 * own try/catch so an insufficient-balance failure on one does not skip the
 * other, and a billing failure never blocks an already-delivered message.
 */
async function chargeDestinationOrgForHandoff(
  targetOrgId: string,
  chatId: string,
  providerLabel: "twilio" | "cloud_api"
): Promise<void> {
  try {
    await deductOrgConversationOnce(
      targetOrgId,
      chatId,
      "intakeOutboundCreditsDeducted",
      "Proplead intake send (cross-org handoff)"
    );
  } catch (err) {
    console.error("[credits] post-send deduction failed", {
      site: `executeCrossOrgCallHandoff:${providerLabel}:intake`,
      orgId: targetOrgId,
      chatId,
      err,
    });
  }
  try {
    await deductOrgConversationOnce(
      targetOrgId,
      chatId,
      "initialOutboundCreditsDeducted",
      `Cross-org call handoff (${providerLabel === "twilio" ? "Twilio" : "Cloud API"})`
    );
  } catch (err) {
    console.error("[credits] post-send deduction failed", {
      site: `executeCrossOrgCallHandoff:${providerLabel}:handoff`,
      orgId: targetOrgId,
      chatId,
      err,
    });
  }
}

/**
 * Execute the cross-org call handoff against the target org.
 * Lives at file scope so the 3h `processCallNameTimeout` task can call it
 * without re-entering processBufferedMessages.
 */
async function executeCrossOrgCallHandoff(
  state: ConversationState,
  params: {
    listing: ListingRow;
    targetOrgId: string;
    sourceOrgId: string;
    correlationId: string;
    initialLanguage: InitialLanguage;
    leadName?: string;
    useLeadName?: boolean;
    reason: string;
  }
): Promise<void> {
  const { listing, targetOrgId, sourceOrgId, correlationId, initialLanguage, reason } = params;
  const useNameFlag = params.useLeadName !== false;
  const candidateName = (params.leadName || state.name || "").trim();
  const leadName: string | undefined = useNameFlag && candidateName ? candidateName : undefined;
  const targetLanguage: "es" | "en" = initialLanguage === "en" ? "en" : "es";
  const featuresForHandoff = state.features || (await getFeaturesForLanguage(listing.features, initialLanguage));
  const formattedFeatures = formatFeaturesList(featuresForHandoff || "", targetLanguage)
    .replace(/\s*\n\s*/g, " · ")
    .slice(0, 900);

  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const inheritedConsent = async () => {
    const sourceLeadDoc = await findLeadDocForChat(
      state.chatId,
      undefined,
      db.collection(`organizations/${sourceOrgId}/leads`)
    );
    const sourceConsent = sourceLeadDoc?.data()?.consent as
      | { source?: string; proofUrl?: string; proofType?: "twilio_call_sid" | "twilio_recording_sid" | "wa_inbound"; consentScriptVersion?: string; dtmfDigit?: "1" }
      | undefined;
    const proofUrl = sourceConsent?.proofUrl || undefined;
    return {
      capturedAt: admin.firestore.Timestamp.now(),
      source: "phone_call" as const,
      language: targetLanguage,
      proofUrl,
      proofType: sourceConsent?.proofType || "twilio_call_sid",
      consentScriptVersion: sourceConsent?.consentScriptVersion || VOICE_CONSENT_SCRIPT_VERSION.value() || "v1",
      dtmfDigit: sourceConsent?.dtmfDigit || "1",
    };
  };
  const handoffConsent = await inheritedConsent();

  const handoffTransitionMessage = targetLanguage === "en"
    ? `Great. ${listing.agentName || "the agent"}'s assistant will message you now to help with any questions and, if you want, coordinate a viewing.`
    : `Estupendo. El asistente de tu agente ${listing.agentName || ""} te escribirá ahora para ayudarte con cualquier duda y, si quieres, coordinar una visita.`;
  try {
    await sendTextMessage({
      to: state.phone,
      chatId: state.chatId,
      body: handoffTransitionMessage.replace(/\s+/g, " ").trim(),
    });
  } catch (error) {
    console.warn("Failed to send handoff transition message", error);
  }

  await recordCallHandoffEvent({
    sourceOrgId,
    correlationId,
    chatId: state.chatId,
    phone: state.phone,
    language: initialLanguage,
    status: "pending",
    targetOrgId,
    matchedListingCode: listing.listingCode,
    reason,
  });

  await requestContext.run({ orgId: targetOrgId }, async () => {
    const targetConfig = await getBotConfig();
    const targetAvatarName =
      (typeof targetConfig.assistantAvatarName === "string" && targetConfig.assistantAvatarName.trim())
        ? targetConfig.assistantAvatarName.trim()
        : (typeof targetConfig.cloudApiConfig?.assistantAvatarName === "string" && targetConfig.cloudApiConfig.assistantAvatarName.trim()
          ? targetConfig.cloudApiConfig.assistantAvatarName.trim()
          : (targetLanguage === "en" ? "the agent's assistant" : "el asistente"));
    const targetOrgName =
      (typeof targetConfig.orgName === "string" && targetConfig.orgName.trim())
        ? targetConfig.orgName.trim()
        : (targetLanguage === "en" ? "our team" : "nuestro equipo");
    const targetListingLink = listing.link || "";

    console.log("AGENT_DEBUG", JSON.stringify({
      runId: "post-fix",
      hypothesisId: "BFix",
      location: "functions/src/index.ts:executeCrossOrgCallHandoff.context",
      message: "cross-org handoff context resolved",
      data: {
        chatId: state.chatId,
        targetOrgId,
        sourceOrgId,
        targetLanguage,
        hasLeadName: Boolean(leadName),
        targetAvatarName,
        targetOrgName,
        listingCode: listing.listingCode,
      },
      timestamp: Date.now(),
    }));

    await updateLeadChatInfo({
      phone: state.phone,
      listingCode: listing.listingCode,
      chatId: state.chatId,
      operationType: listing.operationType,
      name: leadName,
      tags: ["lead", "call", "handoff"],
      qualificationStatus: "not_qualified",
    });
    await setLeadConsentByChatId({
      chatId: state.chatId,
      phone: state.phone,
      listingCode: listing.listingCode,
      operationType: listing.operationType,
      consent: handoffConsent,
    });
    const targetLeadDoc = await findLeadDocForChat(
      state.chatId,
      listing.listingCode,
      db.collection(`organizations/${targetOrgId}/leads`)
    );
    if (targetLeadDoc) {
      await targetLeadDoc.ref.set(
        { leadSource: "call", listingResolutionStatus: "resolved" },
        { merge: true }
      );
    }

    // The exact message body the recipient will see. We populate this in each
    // provider branch and persist it to the destination org's history so the
    // conversation log mirrors what the user actually received.
    let handoffOutboundBody = "";

    // Shared template variables (same shape across providers).
    const handoffVariables: Record<string, string> = leadName
      ? {
        "1": leadName,
        "2": targetAvatarName,
        "3": targetOrgName,
        "4": targetListingLink,
        "5": formattedFeatures,
      }
      : {
        "2": targetAvatarName,
        "3": targetOrgName,
        "4": targetListingLink,
        "5": formattedFeatures,
      };

    const provider = await getActiveProviderFn();
    if (provider === "twilio") {
      const { twilioTemplates } = await getOrgTemplateSnapshot(targetOrgId);
      const templateSid = targetLanguage === "en"
        ? requireTemplate(
          leadName ? twilioTemplates.callHandoffOrgEn : twilioTemplates.callHandoffOrgNoNameEn,
          "Twilio call handoff template missing for org (callHandoffOrgEn / callHandoffOrgNoNameEn)"
        )
        : requireTemplate(
          leadName ? twilioTemplates.callHandoffOrgEs : twilioTemplates.callHandoffOrgNoNameEs,
          "Twilio call handoff template missing for org (callHandoffOrgEs / callHandoffOrgNoNameEs)"
        );
      // Fetch the real template body from Twilio Content API so the history entry
      // is byte-identical to what the recipient sees. Best-effort: a fetch failure
      // mustn't abort the handoff — we fall back to an empty body and continue.
      try {
        const template = await fetchContentTemplate(templateSid, targetOrgId);
        handoffOutboundBody = renderTwilioTemplateBody(template, handoffVariables);
      } catch (error) {
        console.warn("Failed to fetch Twilio template body for history seeding; continuing", {
          templateSid, targetOrgId, error: error instanceof Error ? error.message : String(error),
        });
      }
      await sendInitialTemplateMessage({
        to: state.phone,
        chatId: state.chatId,
        language: targetLanguage,
        variables: handoffVariables,
        templateSid,
        skipEligibilityGate: true,
      });
      await chargeDestinationOrgForHandoff(targetOrgId, state.chatId, "twilio");
    } else if (provider === "cloud_api") {
      const creds = await getCloudApiCredentials();
      const namedKey = targetLanguage === "en" ? creds.templates?.callHandoffOrgEn : creds.templates?.callHandoffOrgEs;
      const noNameKey = targetLanguage === "en"
        ? (creds.templates as { callHandoffOrgNoNameEn?: string })?.callHandoffOrgNoNameEn
        : (creds.templates as { callHandoffOrgNoNameEs?: string })?.callHandoffOrgNoNameEs;
      const templateName = requireTemplate(
        leadName ? namedKey : noNameKey,
        `Cloud API handoff template missing for org (${leadName ? "named" : "no-name"} ${targetLanguage})`
      );
      await sendInitialTemplateMessage({
        to: state.phone,
        chatId: state.chatId,
        language: targetLanguage,
        variables: handoffVariables,
        templateName,
        skipEligibilityGate: true,
      });
      // TODO: Cloud API templates live in WhatsApp Business Manager; fetching the
      // exact rendered body requires the Graph API. Until that's wired up, the
      // history entry will be empty for Cloud API sends (the message still
      // arrives correctly; only the in-app history mirror is missing).
      await chargeDestinationOrgForHandoff(targetOrgId, state.chatId, "cloud_api");
    } else {
      // No template provider configured: send a plain text equivalent.
      handoffOutboundBody = compactMessage([
        `Hola${leadName ? `, ${leadName}` : ""}.`,
        `Soy ${targetAvatarName}, el asistente virtual de ${targetOrgName}.`,
        "Entiendo que te has interesado en esta vivienda:",
        targetListingLink,
        "",
        "¿Has visto las características?",
        formattedFeatures,
        "",
        "Si quieres dejar de recibir estos mensajes, escribe STOP en cualquier momento.",
      ]);
      await sendTextMessage({
        to: state.phone,
        chatId: state.chatId,
        body: handoffOutboundBody,
      });
    }

    // Keep the owner-org conversation open in qualification so subsequent replies
    // are processed by the owner-org bot, not the source intake.
    // Hydrate listing-derived fields so the qualification prompt has full
    // context (link/address/features/description/profitability) and does not
    // regress to generic discovery questions.
    // Also seed history with the handoff message we just sent — without this, the bot
    // has no record of the outbound message and treats the user's reply as out-of-context.
    const existingTargetConv = await getConversationByChatId(state.chatId);
    const existingHistory = (existingTargetConv?.history && Array.isArray(existingTargetConv.history))
      ? existingTargetConv.history
      : [];
    // Only append the assistant entry when we have the exact rendered body. If the
    // template fetch failed (Twilio) or isn't implemented yet (Cloud API), leave the
    // history alone rather than seeding it with a fabricated approximation.
    const seededHistory = handoffOutboundBody
      ? [...existingHistory, { role: "assistant" as const, text: handoffOutboundBody, timestamp: Date.now() }]
      : existingHistory;
    const baseUpsert: Record<string, unknown> = {
      phone: state.phone,
      chatId: state.chatId,
      listingCode: listing.listingCode,
      operationType: listing.operationType,
      link: listing.link,
      address: listing.address,
      features: featuresForHandoff,
      idealistaDescription: listing.idealistaDescription || "",
      rentalSubtype: listing.rentalSubtype,
      profitabilityReportAvailable: listing.profitabilityReportAvailable,
      profitabilityReport: listing.profitabilityReport,
      type: "lead",
      isFinished: false,
      tags: ["lead", "call", "handoff"],
      flowStep: "qualification",
      language: targetLanguage,
      name: leadName ?? undefined,
      history: seededHistory,
      pendingUserMessages: existingTargetConv?.pendingUserMessages || [],
    };
    await upsertConversation(state.chatId, baseUpsert);
  });

  if (state.name === undefined && leadName) state.name = leadName;
  state.isFinished = true;
  state.tags = Array.from(new Set([...(state.tags || []), "handoff-transferred"]));
  if (state.handoff) {
    state.handoff = { ...state.handoff, status: "transferred" };
  }
  await upsertConversation(state.chatId, {
    isFinished: true,
    flowStep: "closed",
    tags: state.tags,
    name: leadName ?? undefined,
    pendingNameConfirmation: undefined,
    handoff: state.handoff
      ? ({ ...state.handoff, transferredAt: admin.firestore.FieldValue.serverTimestamp() } as ConversationState["handoff"])
      : undefined,
  });
  await recordCallHandoffEvent({
    sourceOrgId,
    correlationId,
    chatId: state.chatId,
    phone: state.phone,
    language: initialLanguage,
    status: "transferred",
    targetOrgId,
    matchedListingCode: listing.listingCode,
    reason,
  });
}

async function recordAssistantHistoryMessage(
  state: ConversationState,
  text: string,
  extra: Partial<ConversationState> = {}
): Promise<void> {
  const body = text.trim();
  if (!body) return;
  if (!state.history) state.history = [];
  state.history.push({ role: "assistant", text: body, timestamp: Date.now() });
  await upsertConversation(state.chatId, {
    ...extra,
    history: state.history,
  });
}

async function sendAssistantTextAndRecord(
  state: ConversationState,
  body: string,
  extra: Partial<ConversationState> = {}
): Promise<void> {
  const text = body.trim();
  await sendTextMessage({ to: state.phone, chatId: state.chatId, body: text });
  await recordAssistantHistoryMessage(state, text, extra);
}

async function sendAssistantBinaryPromptAndRecord(
  state: ConversationState,
  language: "es" | "en",
  body: string,
  extra: Partial<ConversationState> = {}
): Promise<void> {
  const text = body.trim();
  await sendBinaryConfirmPrompt({ to: state.phone, chatId: state.chatId, language, body: text });
  await recordAssistantHistoryMessage(state, text, extra);
}

/**
 * Process multiple buffered messages at once
 * This combines all pending messages into the history before generating a response
 */
async function processBufferedMessages(state: ConversationState, messages: PendingItem[]): Promise<void> {
  if (state.isFinished) {
    console.log("Conversation already finished, ignoring", state.chatId);
    return;
  }

  // If no new messages, we only continue if the last message in history is from user (manual trigger)
  if (messages.length === 0) {
    const lastItem = state.history?.[state.history.length - 1];
    if (!lastItem || lastItem.role !== "user") {
      console.log("No messages to process and last message not from user for", state.chatId);
      return;
    }
    console.log("Manual bot trigger for", state.chatId);
  }

  // Ensure history exists
  if (!state.history) {
    state.history = [];
  }

  // Sort messages by timestamp to maintain order
  const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

  // Add only missing user messages to history (webhooks may have already persisted them)
  const existingUserKeys = new Set(
    (state.history || [])
      .filter((h) => h?.role === "user")
      .map((h) => `${h.timestamp}:${h.text}`)
  );
  for (const msg of sortedMessages) {
    const key = `${msg.timestamp}:${msg.text}`;
    if (existingUserKeys.has(key)) continue;
    state.history.push({ role: "user", text: msg.text, timestamp: msg.timestamp });
    existingUserKeys.add(key);
  }

  console.log(`Processing ${sortedMessages.length} buffered message(s) for ${state.chatId}`);

  // Decide which language to reply in. We ask a cheap model (gpt-4o-mini) to look at the
  // recent conversation plus the new messages and decide, with a STICKY policy: keep the
  // established language unless the lead clearly switched. If the model call fails for any
  // reason we fall back to the old token heuristic so a reply is never blocked.
  const fallbackLanguage: InitialLanguage = state.language || resolveInitialLanguage(state.phone);
  let inferredLanguage: InitialLanguage = fallbackLanguage;
  /**
   * Un mensaje sin una sola letra —una referencia de nueve dígitos, por ejemplo—
   * no dice nada del idioma de nadie. Se le preguntaba igual al modelo, que leía
   * una conversación llena de plantillas en castellano y cambiaba el idioma que
   * el caller acababa de elegir por teclado. Ahora, sin letras no se toca: se
   * mantiene lo decidido y encima nos ahorramos la llamada.
   */
  const carriesLanguageSignal = sortedMessages.some((m) => /[a-záéíóúñü]/i.test(m.text || ""));
  if (carriesLanguageSignal) {
    try {
      inferredLanguage = await resolveReplyLanguageWithAgent({
        history: state.history,
        newMessages: sortedMessages.map((m) => m.text),
        currentLanguage: fallbackLanguage,
      });
    } catch (err) {
      console.warn("language router failed, falling back to token heuristic", err);
      inferredLanguage = resolveReplyLanguageFromMessages(sortedMessages, fallbackLanguage);
    }
  }
  if (state.language !== inferredLanguage) {
    state.language = inferredLanguage;
    await upsertConversation(state.chatId, { language: inferredLanguage });
  }

  // Mark lead as responded if there are user messages
  if (sortedMessages.length > 0) {
    await markLeadAsResponded(state.chatId, state.listingCode);
    const firstInbound = sortedMessages[0];
    const created = await ensureInboundWhatsAppConsentByChatId({
      chatId: state.chatId,
      language: state.language || "es",
      proofUrl: `wa_inbound:${state.chatId}:${firstInbound.timestamp}`,
      listingCode: state.listingCode,
    });
    if (created) {
      await recordSystemAction("lead", created.leadId, "consent_auto_captured", {
        source: "inbound_whatsapp",
        chatId: state.chatId,
        timestamp: firstInbound.timestamp,
      });
    }
  }

  // Try to extract client name if not known
  if (!state.name) {
    try {
      const detectedName = await extractClientName(state.history);
      if (detectedName) {
        state.name = detectedName;
        // Update lead with the detected name
        try {
          await updateLeadStatus({
            chatId: state.chatId,
            name: detectedName,
            qualificationStatus: "not_qualified",
            listingCode: state.listingCode,
          });
        } catch (error) {
          console.warn("Failed to update lead with name", error);
        }
      }
    } catch (error) {
      console.warn("Failed to extract client name", error);
    }
  }

  const sendCrossOrgCallHandoff = (params: Parameters<typeof executeCrossOrgCallHandoff>[1]) =>
    executeCrossOrgCallHandoff(state, params);

  const applyListingToStateAndPersist = async (listing: ListingRow, targetOrgId: string): Promise<void> => {
    const sourceOrgId = getActiveOrgId();

    // ¿Viene de otra vivienda? Entonces esto es un cambio, no una primera
    // identificación, y hay que decidir si se le pregunta antes.
    const previousListingCode = (state.listingCode || "").trim();
    const isListingSwitch =
      !!previousListingCode &&
      previousListingCode !== CALL_PENDING_LISTING_CODE &&
      previousListingCode !== listing.listingCode;

    if (isListingSwitch) {
      const switchLanguage: InitialLanguage = state.language || resolveInitialLanguage(state.phone);
      const askFirst = await shouldAskBeforeSwitchingListing({
        chatId: state.chatId,
        previousListingCode,
        lastMessageBeforeNowMs: lastLeadMessageBeforeBatchMs(state.history || [], sortedMessages),
        nowMs: Date.now(),
      });

      if (askFirst) {
        state.flowStep = "call_listing_switch_confirm";
        state.pendingListingSwitch = {
          listingCode: listing.listingCode,
          orgId: targetOrgId,
          description: listing.description,
          address: listing.address,
        };
        await upsertConversation(state.chatId, {
          flowStep: "call_listing_switch_confirm",
          pendingListingSwitch: state.pendingListingSwitch,
        });
        const previous = await fetchListingByCode(previousListingCode).catch(() => null);
        await sendAssistantTextAndRecord(
          state,
          buildListingSwitchQuestion({
            previousDescription: describeListingForLead(
              previous || { description: state.description, address: state.address, listingCode: previousListingCode }
            ),
            nextDescription: describeListingForLead(listing),
            language: switchLanguage,
          })
        );
        return;
      }

      // Cambio directo: se deja constancia de dónde venía para el aviso al agente.
      state.previousListingCode = previousListingCode;
    }

    // Per-org calls are handled IN PLACE in the org that received the call — never a handoff,
    // even though they carry the "call" tag. (Without this guard the `|| includes("call")`
    // term below would force every call down the legacy name-collect + handoff path.)
    const isPerOrgCall = state.callFlowMode === "per_org";
    const isCrossOrgCallHandoff = !isPerOrgCall && (targetOrgId !== sourceOrgId || (state.tags || []).includes("call"));
    const correlationId = `handoff_${state.chatId}_${Date.now()}`;
    const initialLanguage = state.language || resolveInitialLanguage(state.phone);
    const featuresText = await getFeaturesForLanguage(listing.features, initialLanguage);

    state.pendingListingSwitch = undefined;
    await clearPendingListingSwitch(state.chatId);
    state.listingCode = listing.listingCode;
    state.operationType = listing.operationType;
    state.description = listing.description;
    state.link = listing.link;
    state.address = listing.address;
    state.features = featuresText;
    state.idealistaDescription = listing.idealistaDescription || "";
    state.rentalSubtype = listing.rentalSubtype;
    state.profitabilityReportAvailable = listing.profitabilityReportAvailable;
    state.profitabilityReport = listing.profitabilityReport;
    state.type = "lead";
    // La vivienda ya está identificada: la marca de "pendiente" deja de ser cierta.
    state.tags = tagsAfterListingResolved(state.tags);
    state.language = initialLanguage;
    if (isCrossOrgCallHandoff) {
      state.handoff = {
        correlationId,
        sourceOrgId,
        targetOrgId,
        matchedListingCode: listing.listingCode,
        language: initialLanguage,
        phone: state.phone,
        status: "pending",
      };
    } else {
      state.handoff = undefined;
    }

    const nextFlowStep: ConversationState["flowStep"] = isCrossOrgCallHandoff
      ? (state.name && state.name.trim() ? "call_name_confirm" : "call_name_collect")
      : "qualification";

    await upsertConversation(state.chatId, {
      listingCode: listing.listingCode,
      operationType: listing.operationType,
      description: listing.description,
      link: listing.link,
      address: listing.address,
      features: featuresText,
      idealistaDescription: listing.idealistaDescription || "",
      rentalSubtype: listing.rentalSubtype,
      profitabilityReportAvailable: listing.profitabilityReportAvailable,
      profitabilityReport: listing.profitabilityReport,
      tags: state.tags,
      type: "lead",
      language: initialLanguage,
      flowStep: nextFlowStep,
      pendingListingCandidate: undefined,
      pendingListingCandidates: undefined,
      ...(state.previousListingCode ? { previousListingCode: state.previousListingCode } : {}),
      listingResolveAttempts: state.listingResolveAttempts || 0,
      handoff: state.handoff || undefined,
    });

    await updateLeadListingByChatId({
      chatId: state.chatId,
      phone: state.phone,
      listingCode: listing.listingCode,
      operationType: listing.operationType,
      name: state.name,
      listingResolutionStatus: "resolved",
      previousListingCode: state.previousListingCode,
      tags: state.tags,
    });

    if (!isCrossOrgCallHandoff) {
      const config = await getBotConfig();
      const avatarName = resolveConfiguredAssistantName(config);
      const agentName =
        listing.agentName ||
        config.orgName ||
        (initialLanguage === "en" ? "our team" : "nuestro equipo");
      // Per-org call: the opt-in template already greeted the lead, so we skip the
      // "Hola, soy X..." intro and send the lighter "ya lo he encontrado" continuation
      // straight into the normal qualification flow (which asks the name in PASO 1).
      const introMessage = isPerOrgCall
        ? composeListingFoundMessage({
          language: initialLanguage === "en" ? "en" : "es",
          link: listing.link || state.link || "",
          features: formatFeaturesList(featuresText || "", initialLanguage),
          leadName: state.name,
        })
        : initialLanguage === "en"
        ? compactMessage([
          `Hello${state.name ? ` ${state.name}` : ""}.`,
          `I'm ${avatarName}, the virtual assistant for ${agentName}. It's a pleasure to help you.`,
          "",
          "Have you seen the property highlights?",
          formatFeaturesList(featuresText || "", "en"),
        ])
        : compactMessage([
          `Hola${state.name ? ` ${state.name}` : ""}.`,
          `Soy ${avatarName}, el asistente virtual de ${agentName}, un placer ayudarte.`,
          "",
          "¿Has visto las características de la vivienda?",
          formatFeaturesList(featuresText || "", "es"),
        ]);
      await sendAssistantTextAndRecord(state, introMessage, {
        flowStep: "qualification",
      });
      state.flowStep = "qualification";
      return;
    }

    // Quick qualification toggle: if enabled, notify agent immediately and stop (no name flow).
    if (listing.quickQualificationEnabled) {
      await recordCallHandoffEvent({
        sourceOrgId,
        correlationId,
        chatId: state.chatId,
        phone: state.phone,
        language: initialLanguage,
        status: "pending",
        targetOrgId,
        matchedListingCode: listing.listingCode,
        reason: "listing_confirmed_user",
      });
      const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
      const botCfg = await getBotConfig();
      const agentNums = await resolveQualifiedLeadNotificationRecipients({
        orgId: getActiveOrgId(),
        botConfig: botCfg,
        envNotificationFallback: NOTIFICATION_NUMBER.value(),
        listing,
        db,
      });
      const agentMsg = compactMessage([
        "Nuevo interés (cualificación rápida).",
        `Nombre: ${state.name || "Sin nombre"}`,
        `Tel: +${state.phone}`,
        `Anuncio: ${listing.description} (ID ${listing.listingCode})`,
        listing.link ? `Link: ${listing.link}` : "",
      ]);
      const templateSid = await getAgentNotificationTemplateSidForCompactAlert(getActiveOrgId());
      for (const num of agentNums) {
        try {
          await sendAgentNotificationMessage({
            to: num,
            body: agentMsg,
            templateSid,
            context: `quick-qualification:${state.chatId}`,
          });
        } catch (error) {
          console.error("Failed to send quick-qualification notification", error);
        }
      }

      state.isFinished = true;
      state.tags = Array.from(new Set([...(state.tags || []), "needs-human", "quick-qualification"]));
      await updateLeadStatus({
        chatId: state.chatId,
        name: state.name,
        qualificationStatus: "not_qualified",
        listingCode: state.listingCode,
      });
      await upsertConversation(state.chatId, {
        isFinished: true,
        tags: state.tags,
      });
      await recordCallHandoffEvent({
        sourceOrgId,
        correlationId,
        chatId: state.chatId,
        phone: state.phone,
        language: initialLanguage,
        status: "failed",
        targetOrgId,
        matchedListingCode: listing.listingCode,
        reason: "quick_qualification_enabled",
      });
      return;
    }

    // Cross-org call handoff: pause to confirm/collect lead name before sending the
    // owner-org template. Schedule a 3h timeout to proceed without a name if the lead
    // never replies.
    const capturedName = (state.name || "").trim();
    const deadlineAtMs = Date.now() + CALL_NAME_TIMEOUT_SECONDS * 1000;
    let timeoutTaskName: string | undefined;
    try {
      const processCallNameTimeoutUrl = `https://${REGION}-${process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT}.cloudfunctions.net/processCallNameTimeout`;
      const scheduled = await scheduleImmediateHttpTask({
        url: processCallNameTimeoutUrl,
        payload: { chatId: state.chatId, orgId: sourceOrgId, deadlineAtMs },
        taskPrefix: "call-name-timeout",
        taskId: state.chatId,
        delaySeconds: CALL_NAME_TIMEOUT_SECONDS,
      });
      timeoutTaskName = scheduled.taskName;
    } catch (error) {
      console.warn("Failed to schedule call-name timeout task", error);
    }

    state.flowStep = capturedName ? "call_name_confirm" : "call_name_collect";
    state.pendingNameConfirmation = {
      capturedName: capturedName || undefined,
      listingCode: listing.listingCode,
      targetOrgId,
      sourceOrgId,
      correlationId,
      deadlineAtMs,
      timeoutTaskName,
    };
    await upsertConversation(state.chatId, {
      flowStep: state.flowStep,
      pendingNameConfirmation: state.pendingNameConfirmation,
    });

    const namePrompt = buildCallNamePrompt(initialLanguage, capturedName);
    await sendAssistantTextAndRecord(state, namePrompt);

    console.log("AGENT_DEBUG", JSON.stringify({
      runId: "post-fix",
      hypothesisId: "BFix",
      location: "functions/src/index.ts:applyListingToStateAndPersist.nameFlowStarted",
      message: "name confirmation flow initiated",
      data: {
        chatId: state.chatId,
        flowStep: state.flowStep,
        capturedName: capturedName || null,
        targetOrgId,
        sourceOrgId,
        timeoutTaskName: timeoutTaskName || null,
      },
      timestamp: Date.now(),
    }));

    await recordCallHandoffEvent({
      sourceOrgId,
      correlationId,
      chatId: state.chatId,
      phone: state.phone,
      language: initialLanguage,
      status: "pending",
      targetOrgId,
      matchedListingCode: listing.listingCode,
      reason: capturedName ? "awaiting_name_confirmation" : "awaiting_name_collection",
    });
  };

  // Cross-org call name-confirmation flow: runs after listing is confirmed and before
  // the owner-org template is sent. The user sees a prompt asking to confirm the
  // captured name (or to provide one) so the handoff template can address them properly.
  if (
    (state.flowStep === "call_name_confirm" || state.flowStep === "call_name_collect") &&
    state.pendingNameConfirmation &&
    state.handoff?.targetOrgId
  ) {
    const lastUserText = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].text : "";
    const language: InitialLanguage = state.language || resolveInitialLanguage(state.phone);
    const pending = state.pendingNameConfirmation;
    const captured = (pending.capturedName || "").trim();

    const failHandoff = async (reason: string, error: unknown) => {
      console.error("AGENT_DEBUG", JSON.stringify({
        runId: "post-fix",
        hypothesisId: "BFix",
        location: "functions/src/index.ts:processBufferedMessages.callNameFlow.failure",
        message: "cross-org handoff failed during name flow",
        data: { chatId: state.chatId, reason, error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now(),
      }));
      try {
        await sendAlert(
          "Cross-org call handoff failed",
          `Cross-org call handoff failed during ${reason} for chatId ${state.chatId}`,
          { chatId: state.chatId, sourceOrgId: pending.sourceOrgId, targetOrgId: pending.targetOrgId, listingCode: pending.listingCode }
        );
      } catch {}
    };

    const runHandoff = async (leadName?: string): Promise<boolean> => {
      try {
        const listing = await fetchListingGlobally(pending.listingCode);
        if (!listing) {
          await failHandoff("listing_lookup", new Error(`Listing ${pending.listingCode} not found at handoff time`));
          return false;
        }
        await sendCrossOrgCallHandoff({
          listing: listing.data,
          targetOrgId: pending.targetOrgId,
          sourceOrgId: pending.sourceOrgId,
          correlationId: pending.correlationId,
          initialLanguage: language,
          leadName,
          reason: leadName ? "name_confirmed" : "name_timeout_or_skipped",
        });
        return true;
      } catch (error) {
        await failHandoff("handoff_send", error);
        return false;
      }
    };

    if (state.flowStep === "call_name_confirm") {
      const normalized = normalizeForSearch(lastUserText);
      const isYes = ["confirm_yes", "si", "sí", "yes", "y", "ok", "vale"].includes(normalized);
      const isNo = ["confirm_no", "no", "nop", "none", "ninguno", "ninguna"].includes(normalized);
      const providedName = sanitizeLeadNameFromMessage(lastUserText);

      if (isYes && captured) {
        const ok = await runHandoff(captured);
        if (!ok) {
          await sendAssistantTextAndRecord(state, language === "en" ? "Sorry, we hit an issue. The agent will follow up shortly." : "Disculpa, ha habido un problema. El agente te contactará en breve.");
        }
        return;
      }

      if (providedName && providedName.toLowerCase() !== captured.toLowerCase()) {
        const ok = await runHandoff(providedName);
        if (!ok) {
          await sendAssistantTextAndRecord(state, language === "en" ? "Sorry, we hit an issue. The agent will follow up shortly." : "Disculpa, ha habido un problema. El agente te contactará en breve.");
        }
        return;
      }

      if (isNo) {
        state.flowStep = "call_name_collect";
        state.pendingNameConfirmation = { ...pending, capturedName: undefined };
        await upsertConversation(state.chatId, {
          flowStep: "call_name_collect",
          pendingNameConfirmation: state.pendingNameConfirmation,
        });
        await sendAssistantTextAndRecord(state, buildCallNamePrompt(language, undefined));
        return;
      }

      // Unclear → ask again.
      await sendAssistantTextAndRecord(state, buildCallNamePrompt(language, captured));
      return;
    }

    if (state.flowStep === "call_name_collect") {
      const providedName = sanitizeLeadNameFromMessage(lastUserText);
      if (providedName) {
        const ok = await runHandoff(providedName);
        if (!ok) {
          await sendAssistantTextAndRecord(state, language === "en" ? "Sorry, we hit an issue. The agent will follow up shortly." : "Disculpa, ha habido un problema. El agente te contactará en breve.");
        }
        return;
      }
      // Could not extract a name; ask again succinctly.
      await sendAssistantTextAndRecord(state, buildCallNamePrompt(language, undefined));
      return;
    }
  }

  // Deterministic listing resolution & confirmation before enabling AI flow. Scoped to
  // call-tagged conversations only: missing listingCode for non-call leads must NOT
  // route through this branch, otherwise unrelated conversations get pulled into the
  // call resolution path and may cross orgs. The very first inbound after voice opt-in
  // arrives with `flowStep` undefined and `listingCode === CALL_PENDING_LISTING_CODE`,
  // so we treat that case as the implicit "collect" entry point.
  // #region agent log
  console.error("AGENT_DEBUG", JSON.stringify({
    runId: "post-fix",
    hypothesisId: "D",
    location: "functions/src/index.ts:processBufferedMessages.callGate",
    message: "evaluating deterministic call flow gate",
    data: {
      chatId: state.chatId,
      tags: state.tags || null,
      flowStep: state.flowStep || null,
      listingCode: state.listingCode || null,
      handoffStatus: state.handoff?.status || null,
    },
    timestamp: Date.now(),
  }));
  // #endregion
  /**
   * El lead ya tiene vivienda pero nombra otra referencia sin haber vuelto a llamar.
   *
   * Se mira solo la referencia explícita (nueve dígitos o el enlace de Idealista),
   * que es justo lo que se le pide: en mitad de la cualificación va a contestar con
   * números —personas, ingresos, fechas— y buscar vivienda en cada uno de ellos
   * acabaría cambiándole de piso por decir que gana 1.200 €.
   */
  const mentionsAnotherListing = await mentionsADifferentListing({
    text: sortedMessages.map((m) => m.text).join("\n"),
    currentListingCode: state.listingCode,
  });

  if (
    (state.tags || []).includes("call") &&
    (state.flowStep === "call_listing_collect" ||
      state.flowStep === "call_listing_confirm" ||
      state.flowStep === "call_listing_switch_confirm" ||
      state.listingCode === CALL_PENDING_LISTING_CODE ||
      mentionsAnotherListing)
  ) {
    const callFlowLanguage: InitialLanguage = state.language || resolveInitialLanguage(state.phone);
    const currentStep = state.flowStep || "call_listing_collect";
    const combinedText = sortedMessages.map((m) => m.text).join("\n");
    const lastUserText = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].text : "";

    const attempt = typeof state.listingResolveAttempts === "number" ? state.listingResolveAttempts : 0;

    const notifyAgentAndClose = async (reason: string, extra?: string) => {
      const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
      const botCfg = await getBotConfig();
      const agentNums = await resolveQualifiedLeadNotificationRecipients({
        orgId: getActiveOrgId(),
        botConfig: botCfg,
        envNotificationFallback: NOTIFICATION_NUMBER.value(),
        listing: null,
        db,
      });
      const agentMsg = compactMessage([
        reason,
        `Nombre: ${state.name || "Sin nombre"}`,
        `Tel: +${state.phone}`,
        state.pendingListingCandidate?.listingCode ? `Candidato: ${state.pendingListingCandidate.listingCode}` : "",
        state.pendingListingCandidate?.link ? `Link candidato: ${state.pendingListingCandidate.link}` : "",
        extra ? `Texto: ${extra}` : "",
        `ChatId: ${state.chatId}`,
      ]);
      const templateSid = await getAgentNotificationTemplateSidForCompactAlert(getActiveOrgId());
      for (const num of agentNums) {
        try {
          await sendAgentNotificationMessage({
            to: num,
            body: agentMsg,
            templateSid,
            context: `call-flow:${state.chatId}`,
          });
        } catch (error) {
          console.error("Failed to notify agent (call flow)", error);
        }
      }
      state.isFinished = true;
      state.tags = Array.from(new Set([...(state.tags || []), "needs-human"]));
      await upsertConversation(state.chatId, { isFinished: true, tags: state.tags, flowStep: "closed" });
    };

    /**
     * Se acabaron los intentos: se le dice al lead que le llamará la agencia y
     * se cierra la conversación con el aviso al agente.
     *
     * Estaba escrito dos veces (una por cada punto en el que el bot se rinde) y
     * solo una de las dos respetaba el límite de intentos. Con el límite en uno
     * esa diferencia se nota, así que ahora las dos salidas pasan por aquí.
     */
    const handOverToAgency = async (reason: string) => {
      await sendAssistantTextAndRecord(state, buildListingNotFoundFallback(undefined, callFlowLanguage));
      state.tags = Array.from(new Set([...(state.tags || []), "listing-not-found"]));
      await updateLeadListingByChatId({
        chatId: state.chatId,
        phone: state.phone,
        listingCode: CALL_PENDING_LISTING_CODE,
        operationType: state.operationType,
        name: state.name,
        listingResolutionStatus: "failed",
        tags: state.tags,
      });
      await notifyAgentAndClose(reason, combinedText);
    };

    try {
      const classifyBinaryDecision = async (text: string, candidate: ListingCandidate): Promise<"confirm" | "deny" | "unclear"> => {
        const normalized = normalizeForSearch(text);
        if (
          normalized === "confirm_yes" ||
          normalized === "si" ||
          normalized === "sí" ||
          normalized === "yes" ||
          normalized === "y"
        ) return "confirm";
        if (
          normalized === "confirm_no" ||
          normalized === "no" ||
          normalized === "nop" ||
          normalized === "none" ||
          normalized === "ninguna" ||
          normalized === "ninguno"
        ) return "deny";
        return classifyConfirmDeny({
          userText: text,
          promptContext: `Candidato: ${candidate.description || ""} (ID ${candidate.listingCode})\nLink: ${candidate.link || ""}`.trim(),
        });
      };

      const queue = state.pendingListingQueue || [];
      const queueIndex = Math.max(0, state.pendingListingQueueIndex || 0);

      // "Estabas preguntando por X, ¿te paso a Y?" — la respuesta llega aquí.
      if (currentStep === "call_listing_switch_confirm" && state.pendingListingSwitch?.listingCode) {
        const pending = state.pendingListingSwitch;
        const decision = await classifyBinaryDecision(lastUserText, {
          listingCode: pending.listingCode,
          orgId: pending.orgId,
          description: pending.description,
          address: pending.address,
        } as ListingCandidate);

        if (decision === "confirm") {
          const listing = await fetchListingGlobally(pending.listingCode);
          state.pendingListingSwitch = undefined;
          if (listing) {
            // El cambio ya está confirmado: se aplica sin volver a preguntar.
            state.previousListingCode = state.listingCode;
            state.listingCode = CALL_PENDING_LISTING_CODE;
            await applyListingToStateAndPersist(listing.data, pending.orgId || listing.orgId);
            return;
          }
          // La vivienda ha desaparecido entre la pregunta y la respuesta: se queda
          // donde estaba, que es mejor que dejarlo sin ninguna.
          state.flowStep = "qualification";
          await clearPendingListingSwitch(state.chatId);
          await upsertConversation(state.chatId, { flowStep: "qualification" });
          await sendAssistantTextAndRecord(
            state,
            buildListingNotFoundFallback(undefined, callFlowLanguage)
          );
          return;
        }

        if (decision === "deny") {
          // Se queda con la que ya tenía.
          state.pendingListingSwitch = undefined;
          state.flowStep = "qualification";
          await clearPendingListingSwitch(state.chatId);
          await upsertConversation(state.chatId, { flowStep: "qualification" });
          await sendAssistantTextAndRecord(state, buildListingSwitchKeptMessage(callFlowLanguage));
          return;
        }

        // Ni sí ni no: se repregunta una vez y, si sigue sin estar claro, se queda
        // con la vivienda actual, que es lo reversible — el lead siempre puede
        // volver a mandar la referencia.
        const switchAttempt = (state.listingResolveAttempts || 0) + 1;
        state.listingResolveAttempts = switchAttempt;
        if (switchAttempt <= MAX_LISTING_LOOKUP_RETRIES) {
          await upsertConversation(state.chatId, { listingResolveAttempts: switchAttempt });
          await sendAssistantTextAndRecord(
            state,
            buildListingSwitchQuestion({
              previousDescription: describeListingForLead({
                description: state.description,
                address: state.address,
                listingCode: state.listingCode || "",
              }),
              nextDescription: describeListingForLead({
                description: pending.description,
                address: pending.address,
                listingCode: pending.listingCode,
              }),
              language: callFlowLanguage,
            })
          );
          return;
        }
        state.pendingListingSwitch = undefined;
        state.flowStep = "qualification";
        await clearPendingListingSwitch(state.chatId);
        await upsertConversation(state.chatId, {
          flowStep: "qualification",
          listingResolveAttempts: 0,
        });
        await sendAssistantTextAndRecord(state, buildListingSwitchKeptMessage(callFlowLanguage));
        return;
      }

      if (currentStep === "call_listing_confirm" && queue.length > 0) {
        const candidate = queue[queueIndex];
        if (!candidate?.listingCode) {
          state.flowStep = "call_listing_collect";
          state.pendingListingQueue = undefined;
          state.pendingListingQueueIndex = undefined;
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_collect",
            pendingListingQueue: undefined,
            pendingListingQueueIndex: undefined,
          });
          return;
        }

        const decision = await classifyBinaryDecision(lastUserText, candidate);
        if (decision === "confirm") {
          const listing = await fetchListingGlobally(candidate.listingCode);
          if (!listing) {
            const nextAttempt = attempt + 1;
            state.listingResolveAttempts = nextAttempt;
            state.flowStep = "call_listing_collect";
            state.pendingListingCandidate = undefined;
            state.pendingListingQueue = undefined;
            state.pendingListingQueueIndex = undefined;
            await upsertConversation(state.chatId, {
              flowStep: "call_listing_collect",
              listingResolveAttempts: nextAttempt,
              pendingListingCandidate: undefined,
              pendingListingQueue: undefined,
              pendingListingQueueIndex: undefined,
            });
            if (nextAttempt > MAX_LISTING_LOOKUP_RETRIES) {
              await handOverToAgency("Nuevo lead (el anuncio confirmado ya no existe).");
              return;
            }
            await sendAssistantTextAndRecord(
              state,
              buildRetryListingLookupMessage(nextAttempt, callFlowLanguage, await resolveCallCatalogUrl(state))
            );
            return;
          }
          await applyListingToStateAndPersist(listing.data, candidate.orgId || listing.orgId);
          return;
        }

        if (decision === "deny") {
          const nextIndex = queueIndex + 1;
          state.rejectedListingCodes = Array.from(new Set([...(state.rejectedListingCodes || []), candidate.listingCode]));
          if (nextIndex < queue.length) {
            const nextCandidate = queue[nextIndex];
            state.pendingListingQueueIndex = nextIndex;
            state.pendingListingCandidate = nextCandidate;
            await upsertConversation(state.chatId, {
              flowStep: "call_listing_confirm",
              pendingListingQueueIndex: nextIndex,
              pendingListingCandidate: nextCandidate,
              rejectedListingCodes: state.rejectedListingCodes,
            });
            await sendAssistantBinaryPromptAndRecord(state, callFlowLanguage, buildConfirmListingMessage(nextCandidate, callFlowLanguage));
            return;
          }

          await handOverToAgency("Nuevo lead (sin coincidencias confirmadas tras ranking AI).");
          return;
        }

          await sendAssistantBinaryPromptAndRecord(
            state,
            callFlowLanguage,
            callFlowLanguage === "en"
              ? "Is this the correct property?"
              : "¿Es correcta esta vivienda?"
          );
        return;
      }

      // Default (collect): always attempt to resolve listing from buffered text.
      if (sortedMessages.length > 0) {
        // Per-org call: the org is already known (resolved from the dialed number), so search
        // ONLY this org's listings. Legacy call flow searches across all orgs for the handoff.
        const isPerOrgCall = state.callFlowMode === "per_org";
        const res = await resolveListingFromBufferedText({
          operationType: state.operationType,
          text: combinedText,
          orgId: getActiveOrgId(),
          includeAllOrgs: (state.tags || []).includes("call") && !isPerOrgCall,
        });

        if (res.kind === "match") {
          const candidate = res.candidate;
          if ((candidate.confidence || 0) >= AUTO_ACCEPT_CONFIDENCE) {
            const listing = await fetchListingGlobally(candidate.listingCode);
            if (listing) {
              await applyListingToStateAndPersist(listing.data, candidate.orgId || listing.orgId);
              return;
            }
          }

          state.pendingListingCandidate = candidate;
          state.pendingListingQueue = [candidate];
          state.pendingListingQueueIndex = 0;
          state.pendingListingCandidates = undefined;
          state.flowStep = "call_listing_confirm";
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_confirm",
            pendingListingCandidate: candidate,
            pendingListingQueue: [candidate],
            pendingListingQueueIndex: 0,
            pendingListingCandidates: undefined,
            listingResolveAttempts: attempt,
          });
          await sendAssistantBinaryPromptAndRecord(state, callFlowLanguage, buildConfirmListingMessage(candidate, callFlowLanguage));
          return;
        }

        if (res.kind === "candidates") {
          const queueCandidates = res.candidates.slice(0, 5);
          const firstCandidate = queueCandidates[0];
          if (!firstCandidate) return;
          if (queueCandidates.length === 1 && (firstCandidate.confidence || 0) >= AUTO_ACCEPT_CONFIDENCE) {
            const listing = await fetchListingGlobally(firstCandidate.listingCode);
            if (listing) {
              await applyListingToStateAndPersist(listing.data, firstCandidate.orgId || listing.orgId);
              return;
            }
          }

          state.pendingListingQueue = queueCandidates;
          state.pendingListingQueueIndex = 0;
          state.pendingListingCandidate = firstCandidate;
          state.pendingListingCandidates = undefined;
          state.flowStep = "call_listing_confirm";
          await upsertConversation(state.chatId, {
            flowStep: "call_listing_confirm",
            pendingListingQueue: queueCandidates,
            pendingListingQueueIndex: 0,
            pendingListingCandidate: firstCandidate,
            pendingListingCandidates: undefined,
            listingResolveAttempts: attempt,
          });
          await sendAssistantBinaryPromptAndRecord(state, callFlowLanguage, buildConfirmListingMessage(firstCandidate, callFlowLanguage));
          return;
        }

        // none → un reintento y, si sigue sin salir, a la agencia
        const nextAttempt = attempt + 1;
        state.listingResolveAttempts = nextAttempt;
        await upsertConversation(state.chatId, {
          flowStep: "call_listing_collect",
          listingResolveAttempts: nextAttempt,
        });
        if (nextAttempt <= MAX_LISTING_LOOKUP_RETRIES) {
          await sendAssistantTextAndRecord(
            state,
            buildRetryListingLookupMessage(nextAttempt, callFlowLanguage, await resolveCallCatalogUrl(state))
          );
          return;
        }

        await handOverToAgency("Nuevo lead (no se pudo encontrar el anuncio).");
        return;
      }
    } catch (error) {
      console.error("Call listing resolution flow failed", error);
      console.error("AGENT_DEBUG", JSON.stringify({
        runId: "post-fix",
        hypothesisId: "BFix",
        location: "functions/src/index.ts:processBufferedMessages.callFlow.catch",
        message: "deterministic call flow failed; aborting to avoid AI fallback",
        data: {
          chatId: state.chatId,
          flowStep: state.flowStep || null,
          listingCode: state.listingCode || null,
          handoffStatus: state.handoff?.status || null,
          targetOrgId: state.handoff?.targetOrgId || null,
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: Date.now(),
      }));
      try {
        await sendAlert("Call handoff flow failed", `Deterministic call/listing/name flow failed for chatId ${state.chatId}; aborting to avoid AI fallback.`, { chatId: state.chatId, flowStep: state.flowStep || null, listingCode: state.listingCode || null, error: error instanceof Error ? error.message : String(error) });
      } catch {}
      return;
    }
  }

  // Save conversation snapshot with all messages
  await appendConversationRow({
    phone: state.phone,
    chatId: state.chatId,
    listingCode: state.listingCode,
    history: state.history,
    name: state.name,
    qualified: state.qualificationStatus,
    isFinished: state.isFinished,
  });

  // Non-lead / unknown numbers: never use OpenAI; botDisabled is only for manual agent toggle in Proplead.
  if (state.type === "non-lead") {
    console.log("Non-lead conversation, skipping AI response", state.chatId);
    return;
  }

  // Agent turned off assistant from Proplead
  if (state.botDisabled) {
    console.log("Bot is disabled for this conversation, skipping response generation", state.chatId);
    return;
  }

  // Get active style and generate response
  const style = await getActiveStyle();
  let rawAssistantReply: string;
  try {
    rawAssistantReply = await generateAssistantResponse(state.history, state, style);
  } catch (error) {
    console.error("OpenAI call failed", error);
    return;
  }

  if (!rawAssistantReply.trim()) {
    console.warn("Assistant reply empty, skipping send");
    return;
  }

  // Parse response
  const { cleanMessage, qualificationStatus } = parseAssistantResponse(rawAssistantReply);
  if (!cleanMessage) {
    console.warn("Clean message empty after parsing");
    return;
  }

  // Send message
  try {
    await sendTextMessage({ to: state.phone, body: cleanMessage, chatId: state.chatId });
  } catch (error) {
    console.error("Failed to send message, queuing for retry", error);
    // Queue the failed message for retry
    await queueFailedMessage(
      state.chatId,
      state.phone,
      cleanMessage,
      error instanceof Error ? error.message : String(error)
    );
    // Still add to history so we don't lose the AI's response
    state.history.push({
      role: "assistant",
      text: cleanMessage,
      timestamp: Date.now(),
    });
    // Save the updated history even though send failed
    await appendConversationRow({
      phone: state.phone,
      chatId: state.chatId,
      listingCode: state.listingCode,
      history: state.history,
      name: state.name,
      qualified: state.qualificationStatus,
      isFinished: state.isFinished,
    });
    return;
  }

  if (qualificationStatus !== undefined) {
    state.qualificationStatus = qualificationStatus;
  }

  // Save updated conversation
  await recordAssistantHistoryMessage(state, cleanMessage, {
    phone: state.phone,
    listingCode: state.listingCode,
    name: state.name,
    qualificationStatus: state.qualificationStatus,
    isFinished: qualificationStatus !== undefined,
  });

  // Handle qualification
  if (qualificationStatus !== undefined) {
    state.isFinished = true;

    if (qualificationStatus) {
      let leadSummary: LeadSummary | undefined;
      try {
        leadSummary = await summarizeLeadDetails(state);
      } catch (error) {
        console.error("Error generating lead summary", error);
      }

      const notificationBody = buildQualifiedLeadMessage(state, leadSummary);

      // Update lead status to qualified — leads is now the single SOT
      try {
        const resolvedName = pickSummaryValue(leadSummary?.name, state.name);
        await updateLeadStatus({
          chatId: state.chatId,
          name: resolvedName,
          qualificationStatus: "qualified",
          pets: leadSummary?.pets,
          income: leadSummary?.income,
          paymentMethod: leadSummary?.paymentMethod,
          notes: leadSummary?.notes,
          conversationSummary: notificationBody,
          listingCode: state.listingCode,
        });
        console.log("Lead status updated to qualified", state.chatId);
      } catch (error) {
        console.error("Error updating lead status", error);
      }
    } else {
      // Update lead status to rejected (not interested)
      try {
        await updateLeadStatus({
          chatId: state.chatId,
          name: state.name,
          qualificationStatus: "rejected",
          listingCode: state.listingCode,
        });
        console.log("Lead status updated to rejected", state.chatId);
      } catch (error) {
        console.error("Error updating lead status", error);
      }
    }
  }
}

// ==================== HTTP FUNCTIONS ====================


export const webhook = onRequest(
  { cors: true, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET] },
  async (req, res) => {
  try {
    // Handle GET requests (webhook verification)
    if (req.method === "GET") {
      console.log("Webhook verification request received");
      res.status(200).json({ status: "ok", message: "Webhook is ready" });
      return;
    }

    // Handle POST requests (actual messages)
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Require a valid X-Twilio-Signature on every POST. Without this anyone on
    // the internet could inject fake inbound messages and trigger bot replies
    // (OpenAI + Twilio cost per request). Twilio's signature is computed over
    // the form-urlencoded body; for JSON callers Twilio omits the signature.
    const twilioSig = req.header("x-twilio-signature") || "";
    const signedUrls = twilioSignedUrlCandidates(req);
    const signedBody = (req.body && typeof req.body === "object")
      ? (req.body as Record<string, unknown>)
      : {};
    // Orgs onboarded as Twilio Tech Provider live on per-org subaccounts, and
    // Twilio signs those webhooks with the subaccount auth token — the master
    // TWILIO_AUTH_TOKEN can never match them. Try the master token first
    // (cheap, no Firestore reads), then the token of the org that owns the
    // destination number. Each is checked against every candidate URL (see
    // twilioSignedUrlCandidates) so either callback configuration verifies.
    let signatureValid = verifyTwilioSignatureAnyUrl(TWILIO_AUTH_TOKEN.value(), twilioSig, signedUrls, signedBody);
    let signatureOrgId: string | undefined;
    if (!signatureValid && twilioSig) {
      signatureOrgId = await resolveOrgIdByTwilioToNumber(req.body?.To);
      if (signatureOrgId) {
        const orgAuthToken = await getOrgTwilioAuthToken(signatureOrgId);
        if (orgAuthToken) {
          signatureValid = verifyTwilioSignatureAnyUrl(orgAuthToken, twilioSig, signedUrls, signedBody);
        }
      }
    }
    if (!signatureValid) {
      console.warn("webhook: invalid or missing X-Twilio-Signature", {
        to: typeof req.body?.To === "string" ? req.body.To : undefined,
        resolvedOrgId: signatureOrgId,
      });
      res.status(401).send("Unauthorized");
      return;
    }

    const inboundMessages = extractInboundMessages(req.body);
    if (inboundMessages.length === 0) {
      console.log("No valid messages found in request");
      res.status(200).json({ received: false, message: "No messages to process" });
      return;
    }

    console.log(`Buffering ${inboundMessages.length} message(s)`);

    // Group messages by chatId
    const messagesByChatId = new Map<string, InboundMessage[]>();
    for (const msg of inboundMessages) {
      const existing = messagesByChatId.get(msg.chatId) || [];
      existing.push(msg);
      messagesByChatId.set(msg.chatId, existing);
    }

    // Process each conversation
    await Promise.all(
      Array.from(messagesByChatId.entries()).map(async ([chatId, messages]) => {
        try {
          // Tiered organization resolution. We no longer accept orgId from
          // request query/body — those were attacker-controllable before
          // signature verification, and even with the signature check
          // letting Twilio (or any signed caller) pin org via JSON body is
          // weaker than deriving it from the destination number Twilio
          // assigned to the org.
          //   1. Twilio destination number (`To`) — owns the inbound for that org
          //   2. Recency-based lookup by chatId across all organizations
          const twilioToOrgId = signatureOrgId ?? await resolveOrgIdByTwilioToNumber(req.body?.To);
          let orgId: string | undefined = twilioToOrgId;
          if (!orgId) {
            orgId = await findOrgIdByChatId(chatId) || undefined;
          }

          if (twilioToOrgId) {
            console.log(`Resolved orgId via Twilio To=${req.body?.To} for chatId ${chatId}: ${twilioToOrgId}`);
          } else if (orgId) {
            console.log(`Resolved orgId via chatId lookup for chatId ${chatId}: ${orgId}`);
          } else {
            console.warn(`Could not resolve organization for chatId ${chatId}`);
          }

          if (!orgId) {
            console.warn(`Skipping inbound message for ${chatId}: could not resolve orgId`);
            await sendAlert(
              "Inbound message without org",
              "No se pudo resolver la organización para un mensaje entrante. Mensaje no procesado para evitar escritura en tenant incorrecto.",
              { chatId, phone: messages[0]?.phone || "", sampleText: messages[0]?.text || "" }
            );
            return;
          }

          await requestContext.run({ orgId }, async () => {
            // Filter out ignored chats (must run within org context)
            if (await isChatIgnored(chatId)) {
                console.log(`Chat ${chatId} is ignored in org ${orgId}, skipping.`);
                return;
            }
            if (messages.some((m) => isOptOutMessage(m.text))) {
              await applyOptOut({ orgId, chatId, phone: messages[0].phone });
              return;
            }

            // Ensure we have a valid conversation state
            const state = await ensureConversationState(chatId, messages[0].phone, { preferFresh: true });
            if (!state) {
              console.warn("Could not reconstruct conversation state", chatId, "in org", orgId);
              await sendAlert("Estado no encontrado", `No se pudo reconstruir el estado para el chat: ${chatId}. Es posible que no haya un lead asociado o los datos del anuncio no existan.`, { chatId, phone: messages[0].phone, orgId });
              return;
            }

            // If conversation is finished, skip buffering
            if (state.isFinished) {
              console.log("Conversation already finished, skipping buffer", chatId);
              return;
            }

            const canonicalChatId = state.chatId;

            // Add messages to pending buffer in Firestore (always using canonical ID)
            for (const msg of messages) {
              await addPendingMessage(canonicalChatId, {
                text: msg.text,
                timestamp: msg.timestamp,
              });
            }

            // Persist inbound messages to conversation history immediately (UI realtime),
            // while still keeping the buffer for delayed bot processing.
            const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
            const existingKeys = new Set(
              (state.history || [])
                .filter((h) => h?.role === "user")
                .map((h) => `${h.timestamp}:${h.text}`)
            );
            for (const msg of sorted) {
              const key = `${msg.timestamp}:${msg.text}`;
              if (existingKeys.has(key)) continue;
              state.history.push({ role: "user", text: msg.text, timestamp: msg.timestamp });
              existingKeys.add(key);
            }
            // Include type/tags/phone so non-lead inbounds get the right
            // category written to Firestore on first contact (otherwise the
            // UI filter at Conversations.tsx:416 treats them as leads because
            // `conv.tags?.includes("non-lead")` is undefined).
            await upsertConversation(canonicalChatId, {
              history: state.history,
              type: state.type,
              tags: state.tags,
              phone: state.phone,
              language: state.language,
            });

            // Mirror inbound on lead metadata immediately (hasResponse + implicit consent).
            if (sorted.length > 0) {
              await markLeadAsResponded(canonicalChatId, state.listingCode);
              const firstInbound = sorted[0];
              const created = await ensureInboundWhatsAppConsentByChatId({
                chatId: canonicalChatId,
                language: state.language || "es",
                proofUrl: `wa_inbound:${canonicalChatId}:${firstInbound.timestamp}`,
                listingCode: state.listingCode,
              });
              if (created) {
                await recordSystemAction("lead", created.leadId, "consent_auto_captured", {
                  source: "inbound_whatsapp",
                  chatId: canonicalChatId,
                  timestamp: firstInbound.timestamp,
                });
              }
            }

            const processUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/processBuffer`;
            const { taskName, scheduledTime } = await scheduleBufferTask(canonicalChatId, processUrl, state.pendingTaskName, orgId);

            // Update conversation with task info
            await updateBufferTask(canonicalChatId, taskName, scheduledTime);

            console.log(`Buffered ${messages.length} message(s) for ${canonicalChatId} (via ${chatId}), will process at ${new Date(scheduledTime).toISOString()} (Org: ${orgId})`);
          });
        } catch (error) {
          console.error("Error buffering messages for", chatId, error);
          await sendAlert("Webhook Error", `Error al bufferear mensajes para ${chatId}`, {
            error: error instanceof Error ? error.message : String(error),
            chatId
          });
        }
      })
    );

    res.status(200).json({
      received: true,
      buffered: true,
      count: inboundMessages.length,
      bufferDelaySeconds: BUFFER_DELAY_SECONDS,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    await sendAlert("Fatal Webhook Error", "Error crítico en el webhook principal", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
  }
}
);

/**
 * Dedicated webhook for Twilio messages
 * Twilio sends form-urlencoded data we can handle in the same logic
 */
export const twilioWebhook = webhook;

/**
 * App-wide WhatsApp Cloud API webhook.
 *
 * Single URL Meta subscribes at the app level (not per-org). No query params.
 * Resolves org by looking up `entry[].id` (= wabaId) in the `wabaIndex` collection,
 * which is populated during Embedded Signup (see persistCloudApiConfigForOrg).
 *
 * GET: verification handshake against the global META_VERIFY_TOKEN secret.
 * POST: verify X-Hub-Signature-256 (HMAC-SHA256 over rawBody with META_APP_SECRET),
 *       then fan out each entry to its owning org and buffer messages.
 */
export const whatsappWebhook = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET, META_VERIFY_TOKEN] },
  async (req, res) => {
    try {
      if (req.method === "GET") {
        const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : "";
        const verifyToken =
          typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : "";
        const challenge =
          typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : "";
        if (mode !== "subscribe" || verifyToken !== META_VERIFY_TOKEN.value()) {
          res.status(403).send("Forbidden");
          return;
        }
        res.set("Content-Type", "text/plain");
        res.status(200).send(challenge);
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const signatureHeader = req.header("x-hub-signature-256") || "";
      const rawBody: Buffer | undefined = (req as unknown as { rawBody?: Buffer }).rawBody;
      if (!rawBody || !signatureHeader.startsWith("sha256=")) {
        res.status(401).send("Unauthorized");
        return;
      }
      const expected =
        "sha256=" +
        crypto.createHmac("sha256", META_APP_SECRET.value()).update(rawBody).digest("hex");
      const sigBuf = Buffer.from(signatureHeader);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn("whatsappWebhook signature mismatch");
        res.status(401).send("Unauthorized");
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      const body = req.body as
        | { entry?: Array<{ id?: string; changes?: Array<{ field?: string; value?: { metadata?: { phone_number_id?: string } } }> }> }
        | undefined;
      const entries = Array.isArray(body?.entry) ? body!.entry! : [];
      if (entries.length === 0) {
        res.status(200).json({ received: true, buffered: false });
        return;
      }

      // Group changes by Cloud API phone_number_id. Two orgs may share a single
      // wabaId but each owns its own phone_number_id; routing only by wabaId would
      // pick the wrong org. We therefore prefer phoneNumberIndex/{phoneNumberId}
      // first and only fall back to wabaIndex/{wabaId} for older payloads where
      // metadata.phone_number_id is missing.
      const changesByPhoneNumberId = new Map<
        string,
        { wabaId?: string; entry: { id?: string; changes: NonNullable<NonNullable<typeof entries[number]["changes"]>> } }
      >();
      const entriesWithoutPhoneId: Array<typeof entries[number]> = [];
      for (const entry of entries) {
        const wabaId = entry?.id;
        const changes = Array.isArray(entry?.changes) ? entry!.changes! : [];
        let matched = false;
        for (const change of changes) {
          const phoneNumberId = change?.value?.metadata?.phone_number_id;
          if (!phoneNumberId) continue;
          matched = true;
          const existing = changesByPhoneNumberId.get(phoneNumberId);
          if (existing) {
            existing.entry.changes.push(change);
          } else {
            changesByPhoneNumberId.set(phoneNumberId, {
              wabaId,
              entry: { id: wabaId, changes: [change] },
            });
          }
        }
        if (!matched) entriesWithoutPhoneId.push(entry);
      }

      const resolveOrgFromIndices = async (phoneNumberId: string | undefined, wabaId: string | undefined): Promise<string | undefined> => {
        if (phoneNumberId) {
          const phoneIdx = await db.doc(`phoneNumberIndex/${phoneNumberId}`).get();
          const orgFromPhone = phoneIdx.exists ? (phoneIdx.data()?.orgId as string | undefined) : undefined;
          if (orgFromPhone) return orgFromPhone;
        }
        if (wabaId) {
          const wabaIdx = await db.doc(`wabaIndex/${wabaId}`).get();
          const orgFromWaba = wabaIdx.exists ? (wabaIdx.data()?.orgId as string | undefined) : undefined;
          if (orgFromWaba) return orgFromWaba;
        }
        return undefined;
      };

      const groupedDispatch = await Promise.all(
        Array.from(changesByPhoneNumberId.entries()).map(async ([phoneNumberId, group]) => {
          const orgId = await resolveOrgFromIndices(phoneNumberId, group.wabaId);
          if (!orgId) {
            console.error(
              `whatsappWebhook: no org mapping for phoneNumberId=${phoneNumberId} (wabaId=${group.wabaId || "?"}). ` +
              "Ensure Embedded Signup/manual Cloud API config has persisted phoneNumberIndex/wabaIndex."
            );
            return;
          }
          const effective = await getEffectiveProviderForOrg(orgId);
          if (effective.provider !== "cloud_api") {
            console.log(
              `whatsappWebhook: ignoring inbound for org ${orgId} (provider=${effective.provider}, source=${effective.source})`
            );
            return;
          }
          const inboundMessages = parseCloudApiWebhook(
            { entry: [group.entry] },
            normalizeToCanonicalChatId,
            ensureTimestampMillis
          );
          if (inboundMessages.length === 0) return;
          await dispatchCloudApiInbound(orgId, inboundMessages);
        })
      );
      void groupedDispatch;

      // Legacy path: entries without metadata.phone_number_id fall back to wabaIndex.
      await Promise.all(
        entriesWithoutPhoneId.map(async (entry) => {
          const wabaId = entry?.id;
          if (!wabaId) return;
          const orgId = await resolveOrgFromIndices(undefined, wabaId);
          if (!orgId) {
            console.error(
              `whatsappWebhook: no org mapping for wabaId=${wabaId}. ` +
              "Ensure Embedded Signup/manual Cloud API config has persisted wabaIndex."
            );
            return;
          }

          // Hybrid model: keep Meta subscription active, but only process Cloud API inbound
          // when the org's effective provider is Cloud API. This avoids cross-provider routing.
          const effective = await getEffectiveProviderForOrg(orgId);
          if (effective.provider !== "cloud_api") {
            console.log(
              `whatsappWebhook: ignoring inbound for org ${orgId} (provider=${effective.provider}, source=${effective.source})`
            );
            return;
          }

          const inboundMessages = parseCloudApiWebhook(
            { entry: [entry] },
            normalizeToCanonicalChatId,
            ensureTimestampMillis
          );
          if (inboundMessages.length === 0) return;
          await dispatchCloudApiInbound(orgId, inboundMessages);
        })
      );

      res.status(200).json({ received: true });
    } catch (error) {
      console.error("whatsappWebhook fatal error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

async function resolveOrgIdByTwilioToNumber(toRaw: unknown): Promise<string | undefined> {
  if (typeof toRaw !== "string" || !toRaw.trim()) return undefined;
  const normalized = toRaw.trim().toLowerCase();
  const variants = new Set<string>([normalized]);
  // Twilio sends `whatsapp:+34686076497`; also try the bare E.164 form for robustness.
  const bare = normalized.replace(/^whatsapp:/, "");
  variants.add(bare);
  variants.add(`whatsapp:${bare}`);

  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  const orgsSnap = await db.collection("organizations").get();
  for (const orgDoc of orgsSnap.docs) {
    const cfgSnap = await db.doc(`organizations/${orgDoc.id}/botConfig/config`).get();
    if (!cfgSnap.exists) continue;
    const cfg = cfgSnap.data() as Partial<BotConfig> | undefined;
    const candidates = [
      cfg?.twilioConfig?.whatsappNumber,
      // Also accept bare digits if someone stored them without the `whatsapp:` prefix.
    ].filter((v): v is string => typeof v === "string" && v.trim().length > 0)
     .map((v) => v.trim().toLowerCase());
    for (const candidate of candidates) {
      if (variants.has(candidate)) return orgDoc.id;
      if (variants.has(candidate.replace(/^whatsapp:/, ""))) return orgDoc.id;
    }
  }
  return undefined;
}

async function dispatchCloudApiInbound(orgId: string, inboundMessages: Array<{ chatId: string; phone: string; text: string; timestamp: number }>): Promise<void> {
  const messagesByChatId = new Map<string, InboundMessage[]>();
  for (const msg of inboundMessages) {
    const existing = messagesByChatId.get(msg.chatId) || [];
    existing.push({ chatId: msg.chatId, phone: msg.phone, text: msg.text, timestamp: msg.timestamp });
    messagesByChatId.set(msg.chatId, existing);
  }

  await requestContext.run({ orgId }, async () => {
    await Promise.all(
      Array.from(messagesByChatId.entries()).map(async ([chatId, messages]) => {
        try {
          if (await isChatIgnored(chatId)) return;
          if (messages.some((m) => isOptOutMessage(m.text))) {
            await applyOptOut({ orgId, chatId, phone: messages[0].phone });
            return;
          }
          const state = await ensureConversationState(chatId, messages[0].phone, { preferFresh: true });
          if (!state) {
            console.warn("whatsappWebhook: could not reconstruct state for", chatId, "org", orgId);
            return;
          }
          if (state.isFinished) return;
          const canonicalChatId = state.chatId;
          for (const msg of messages) {
            await addPendingMessage(canonicalChatId, { text: msg.text, timestamp: msg.timestamp });
          }

          const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
          const existingKeys = new Set(
            (state.history || [])
              .filter((h) => h?.role === "user")
              .map((h) => `${h.timestamp}:${h.text}`)
          );
          for (const msg of sorted) {
            const key = `${msg.timestamp}:${msg.text}`;
            if (existingKeys.has(key)) continue;
            state.history.push({ role: "user", text: msg.text, timestamp: msg.timestamp });
            existingKeys.add(key);
          }
          // See twilioWebhook above: persist type/tags/phone so non-lead
          // inbounds land in the correct UI category on first contact.
          await upsertConversation(canonicalChatId, {
            history: state.history,
            type: state.type,
            tags: state.tags,
            phone: state.phone,
            language: state.language,
          });

          if (sorted.length > 0) {
            await markLeadAsResponded(canonicalChatId, state.listingCode);
            const firstInbound = sorted[0];
            const created = await ensureInboundWhatsAppConsentByChatId({
              chatId: canonicalChatId,
              language: state.language || "es",
              proofUrl: `wa_inbound:${canonicalChatId}:${firstInbound.timestamp}`,
              listingCode: state.listingCode,
            });
            if (created) {
              await recordSystemAction("lead", created.leadId, "consent_auto_captured", {
                source: "inbound_whatsapp",
                chatId: canonicalChatId,
                timestamp: firstInbound.timestamp,
              });
            }
          }

          const processUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/processBuffer`;
          const { taskName, scheduledTime } = await scheduleBufferTask(
            canonicalChatId,
            processUrl,
            state.pendingTaskName,
            orgId
          );
          await updateBufferTask(canonicalChatId, taskName, scheduledTime);
        } catch (err) {
          console.error("whatsappWebhook buffering error", chatId, err);
        }
      })
    );
  });
}

/**
 * Twilio Voice webhook for call→WhatsApp handoff (A6d — DTMF opt-in gate).
 *
 * Configure your Twilio phone number "A CALL COMES IN" to point to this function's URL.
 *
 * Flow:
 * - Play the language menu (greeting + "para continuar en español, espere / press 1 for English")
 * - <Gather numDigits="1" action=voiceLanguageCallback>
 *   - DTMF 1 → English; voiceLanguageCallback returns the English consent step
 *   - timeout → Spanish; the Gather simply falls through to the Spanish consent step below,
 *     which is exactly what "espere" promises the caller
 * - Consent step: Play audio2_optin ("…por favor pulse 1")
 * - <Gather numDigits="1" action=voiceGatherCallback>
 *   - DTMF 1 → consent captured, template sent by voiceGatherCallback
 *   - timeout / hangup → no consent, no template
 */
export const voiceWebhook = onRequest({ cors: false, region: REGION, secrets: [TWILIO_AUTH_TOKEN] }, async (req, res) => {
  try {
    const signature = req.header("x-twilio-signature") || "";
    const fullUrl = reconstructRequestUrl(req);
    const body = (req.body && typeof req.body === "object") ? (req.body as Record<string, unknown>) : {};

    // Resolve the destination org from the dialed (To) number. Dedicated voice numbers
    // may live on per-org Twilio SUBACCOUNTS, which sign webhooks with the subaccount
    // auth token — the master TWILIO_AUTH_TOKEN can never match those. Verify with the
    // master token first (cheap), then fall back to the resolved org's subaccount token.
    // (Mirrors the WhatsApp webhook dual-token pattern at ~3040.)
    const voiceOrgId = await resolveOrgIdByVoiceNumber(body.To);
    let signatureValid = verifyTwilioSignature(TWILIO_AUTH_TOKEN.value(), signature, fullUrl, body);
    if (!signatureValid && signature && voiceOrgId) {
      const orgAuthToken = await getOrgTwilioAuthToken(voiceOrgId);
      if (orgAuthToken) {
        signatureValid = verifyTwilioSignature(orgAuthToken, signature, fullUrl, body);
      }
    }
    if (!signatureValid) {
      console.warn("voiceWebhook: invalid or missing X-Twilio-Signature");
      res.status(401).send("Unauthorized");
      return;
    }

    const callSid = typeof body.CallSid === "string" ? body.CallSid : "";
    const fromPhone = normalizeE164FromTwilio(body.From);

    if (!fromPhone) {
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Say>Invalid caller.</Say><Hangup/>`));
      return;
    }

    const langMenu = VOICE_AUDIO_LANG_MENU_URL.value();
    const audio2 = VOICE_AUDIO_2_OPTIN_URL.value();
    if (!langMenu || !audio2) {
      console.error("VOICE_AUDIO_LANG_MENU_URL / VOICE_AUDIO_2_OPTIN_URL not configured");
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Say>Audio not configured.</Say><Hangup/>`));
      return;
    }

    const chatId = normalizeToCanonicalChatId(fromPhone);

    // Per-org flow gate: only when the dialed number maps to an org AND that org has
    // inboundVoicePerOrgEnabled. Otherwise fall back to the legacy global-intake flow.
    let perOrgEnabled = false;
    if (voiceOrgId) {
      try {
        const cfgDb = getFirestore(admin.app(), "realestate-whatsapp-bot");
        const cfgSnap = await cfgDb.doc(`organizations/${voiceOrgId}/botConfig/config`).get();
        perOrgEnabled = cfgSnap.exists && (cfgSnap.data() as Partial<BotConfig> | undefined)?.inboundVoicePerOrgEnabled === true;
      } catch (error) {
        console.warn("voiceWebhook: failed reading per-org voice flag; using legacy flow", error);
      }
    }
    const useNewFlow = !!voiceOrgId && perOrgEnabled;
    if (voiceOrgId && !perOrgEnabled) {
      console.warn(`voiceWebhook: dialed number maps to org ${voiceOrgId} but inboundVoicePerOrgEnabled is off; using legacy intake flow`);
    }

    // Both callbacks (language menu and consent) need the same call identity, so the query
    // string is built once and reused. voiceLanguageCallback passes its own copy straight
    // through to voiceGatherCallback, which keeps the two steps in the same call context.
    let callbackQuery =
      `?phone=${encodeURIComponent(fromPhone)}&chatId=${encodeURIComponent(chatId)}&callSid=${encodeURIComponent(callSid)}`;
    if (useNewFlow && voiceOrgId) {
      callbackQuery += `&orgId=${encodeURIComponent(voiceOrgId)}&callFlowMode=per_org`;
    }
    const functionsBaseUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net`;
    const gatherUrl = `${functionsBaseUrl}/voiceGatherCallback${callbackQuery}`;
    const languageUrl = `${functionsBaseUrl}/voiceLanguageCallback${callbackQuery}`;

    // Initialize the pending call lead BEFORE responding. On Cloud Functions Gen 2 (Cloud Run),
    // setImmediate background work is CPU-throttled and runs late — late enough that it can race
    // with a subsequent inbound WhatsApp reply and clobber pendingUserMessages, breaking the flow
    // for repeat callers. Twilio allows up to 15s for a TwiML response, plenty of time for these
    // tiny Firestore writes.
    try {
      if (useNewFlow && voiceOrgId) {
        // NEW per-org flow: create the pending lead/conversation directly in the destination
        // org (resolved from the dialed number). No global intake, no later handoff.
        await requestContext.run({ orgId: voiceOrgId }, async () => {
          if (callSid) {
            await upsertCallIntent({ callSid, fromPhone, capturedName: undefined, callFlowMode: "per_org" });
          }
          await createPendingCallLead({ phone: fromPhone, chatId, callFlowMode: "per_org" });
        });
      } else {
        // LEGACY flow: pin to the global intake org; resolution + handoff happen later.
        const intakeOrgId = PROPLEAD_INTAKE_ORG_ID.value();
        if (!intakeOrgId) {
          console.error("voiceWebhook: PROPLEAD_INTAKE_ORG_ID is not configured");
        } else {
          await requestContext.run({ orgId: intakeOrgId }, async () => {
            if (callSid) {
              await upsertCallIntent({ callSid, fromPhone, capturedName: undefined });
            }
            await createPendingCallLead({ phone: fromPhone, chatId });
          });
        }
      }
    } catch (error) {
      console.error("voiceWebhook failed initializing pending call lead", error);
      // Fall through and still respond so the caller hears something.
    }

    res.set("Content-Type", "text/xml");
    res.status(200).send(
      buildTwiml(
        [
          // Language menu — one bilingual recording, inside the Gather so the line is
          // listening from the instant the call connects.
          `<Gather numDigits="1" timeout="4" action="${twimlEscape(languageUrl)}" method="POST">`,
          // Twilio can clip the opening moment of a <Play> when the call has only just
          // connected, which swallows the first word of the greeting. A beat of silence
          // first. It goes INSIDE the Gather on purpose: outside it, the line was not yet
          // collecting digits and a caller who pressed straight away — which is what people
          // do — lost the keypress and landed in Spanish without knowing why.
          `  <Pause length="1"/>`,
          // The timeout below runs from the END of the audio, not the start of the call, so it
          // is silence the caller waits through; a keypress during the recording itself ends
          // the Gather immediately.
          `  <Play>${twimlEscape(langMenu)}</Play>`,
          `</Gather>`,
          // No digit → the Gather times out and execution simply continues here, so waiting
          // lands the caller in Spanish without a second round-trip. Pressing 1 abandons the
          // rest of this document and hands over to voiceLanguageCallback instead.
          buildConsentGatherTwiml({ language: "es", gatherUrl }),
        ].join("\n")
      )
    );
  } catch (error) {
    console.error("voiceWebhook error", error);
    res.set("Content-Type", "text/xml");
    res.status(200).send(buildTwiml(`<Say>Error.</Say><Hangup/>`));
  }
});

/**
 * Twilio <Gather> callback for the language menu. DTMF 1 = English; any other digit
 * continues in Spanish, the same place waiting would have led to — a mis-key should never
 * cost the caller the call.
 *
 * Choosing English is also written onto the conversation, so the WhatsApp thread that
 * follows the call speaks the language the caller just asked for. Without it the language
 * is guessed from the phone prefix (resolveInitialLanguage), which gets every English
 * speaker holding a Spanish number wrong. Waiting writes nothing: silence is not a
 * statement about language, so the existing guess stands.
 */
export const voiceLanguageCallback = onRequest(
  { cors: false, region: REGION, secrets: [TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    try {
      const signature = req.header("x-twilio-signature") || "";
      // Gen 2 Cloud Functions (Cloud Run) strip the function path from req.originalUrl,
      // so we re-add /voiceLanguageCallback to match the URL Twilio used to sign.
      const queryIdx = (req.originalUrl || "").indexOf("?");
      const queryString = queryIdx >= 0 ? (req.originalUrl || "").substring(queryIdx) : "";
      const signedUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/voiceLanguageCallback${queryString}`;
      const body = (req.body && typeof req.body === "object") ? (req.body as Record<string, unknown>) : {};

      // Same dual-token check as voiceWebhook / voiceGatherCallback: a per-org voice number
      // may live on a subaccount, which signs with its own auth token.
      const queryOrgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
      let signatureValid = verifyTwilioSignature(TWILIO_AUTH_TOKEN.value(), signature, signedUrl, body);
      if (!signatureValid && signature && queryOrgId) {
        const orgAuthToken = await getOrgTwilioAuthToken(queryOrgId);
        if (orgAuthToken) {
          signatureValid = verifyTwilioSignature(orgAuthToken, signature, signedUrl, body);
        }
      }
      if (!signatureValid) {
        console.warn("voiceLanguageCallback: invalid or missing X-Twilio-Signature");
        res.status(401).send("Unauthorized");
        return;
      }

      const digits = typeof body.Digits === "string" ? body.Digits.trim() : "";
      const language: InboundCallLanguage = digits === "1" ? "en" : "es";

      // Aquí no se guarda nada. La elección viaja en la URL del siguiente <Gather>
      // y la escribe voiceGatherCallback, que es el paso por el que pasan las dos
      // ramas: la de quien pulsa 1 y la de quien deja que salte el castellano.
      // Antes se escribía aquí, y solo el inglés, que es justo lo que dejaba
      // conversaciones marcadas en inglés para siempre.

      // Hand the caller to the consent step in their language, reusing this request's query
      // string so voiceGatherCallback sees the same phone / chatId / callSid / org.
      const gatherUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/voiceGatherCallback${queryString}`;
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(buildConsentGatherTwiml({ language, gatherUrl })));
    } catch (error) {
      console.error("voiceLanguageCallback error", error);
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Hangup/>`));
    }
  }
);

/**
 * Twilio <Gather> callback: if the caller pressed "1", we record explicit consent
 * and send the approved Twilio marketing template. Any other input (or timeout)
 * results in a clean hangup with no message sent.
 *
 * Consent record: { source: "phone_call", proofUrl: callSid, capturedAt: now }.
 */
export const voiceGatherCallback = onRequest(
  { cors: false, region: REGION, secrets: [TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    try {
      const signature = req.header("x-twilio-signature") || "";
      // Gen 2 Cloud Functions (Cloud Run) strip the function path from req.originalUrl,
      // so we re-add /voiceGatherCallback to match the URL Twilio used to sign.
      const queryIdx = (req.originalUrl || "").indexOf("?");
      const queryString = queryIdx >= 0 ? (req.originalUrl || "").substring(queryIdx) : "";
      const signedUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/voiceGatherCallback${queryString}`;
      const body = (req.body && typeof req.body === "object") ? (req.body as Record<string, unknown>) : {};

      // Per-org flow passes orgId + callFlowMode in the (signed) gather URL. The org's
      // dedicated voice number may live on a subaccount, so verify with the master token
      // first, then the resolved org's subaccount token (same dual-token pattern as voiceWebhook).
      const queryOrgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
      const isPerOrgGather = req.query.callFlowMode === "per_org" && !!queryOrgId;
      let signatureValid = verifyTwilioSignature(TWILIO_AUTH_TOKEN.value(), signature, signedUrl, body);
      if (!signatureValid && signature && queryOrgId) {
        const orgAuthToken = await getOrgTwilioAuthToken(queryOrgId);
        if (orgAuthToken) {
          signatureValid = verifyTwilioSignature(orgAuthToken, signature, signedUrl, body);
        }
      }
      if (!signatureValid) {
        console.warn("voiceGatherCallback: invalid or missing X-Twilio-Signature");
        res.status(401).send("Unauthorized");
        return;
      }

      const digits = typeof body.Digits === "string" ? body.Digits.trim() : "";
      const phone =
        (typeof req.query.phone === "string" && req.query.phone) ||
        normalizeE164FromTwilio(body.From) ||
        "";
      const chatId =
        (typeof req.query.chatId === "string" && req.query.chatId) ||
        (phone ? normalizeToCanonicalChatId(phone) : "");
      const callSid =
        (typeof req.query.callSid === "string" && req.query.callSid) ||
        (typeof body.CallSid === "string" ? body.CallSid : "");

      /**
       * Idioma decidido DURANTE esta llamada. `lang` lo pone el TwiML del paso de
       * consentimiento: "en" si el caller pulsó 1 en el menú, "es" si dejó pasar el
       * menú. Es una decisión deliberada, así que manda sobre el prefijo del
       * teléfono — un número español puede querer inglés, y al revés.
       */
      const callLanguage = parseInboundCallLanguage(req.query.lang);

      res.set("Content-Type", "text/xml");
      if (digits !== "1" || !phone || !chatId) {
        res.status(200).send(buildTwiml(`<Hangup/>`));
        return;
      }

      // Do the work BEFORE responding. On Cloud Functions Gen 2 (Cloud Run), background
      // work scheduled with setImmediate after res.send() runs with throttled CPU and is
      // not guaranteed to complete before the container shuts down. Twilio allows up to
      // 15s for a TwiML response — plenty for one Firestore write + one Twilio API call.
      try {
        // Per-org flow runs in the destination org (resolved from the dialed number) and
        // charges it ONE credit — there's no handoff to defer billing to. Legacy flow runs
        // in the global intake org and defers billing to the cross-org handoff.
        const orgId = isPerOrgGather ? queryOrgId : PROPLEAD_INTAKE_ORG_ID.value();
        if (!orgId) {
          console.warn("voiceGatherCallback: no org resolved (PROPLEAD_INTAKE_ORG_ID not configured)");
        } else {
          await requestContext.run({ orgId }, async () => {
            await recordVoiceConsent({ phone, chatId, callSid });
            // La elección de la llamada es también la del chat, y se guarda SIEMPRE,
            // en los dos idiomas. Antes solo se escribía al elegir inglés, así que
            // una vez marcada una conversación en inglés no había forma de volver:
            // esperar a que saltara el castellano no escribía nada y la marca vieja
            // seguía ahí llamada tras llamada. Guardándolo siempre, cada llamada
            // vuelve a decidir.
            await upsertConversation(chatId, { language: callLanguage });
            const templateSid = await getVoiceOptInTemplateSid(orgId, callLanguage);
            const sendResult = await sendInitialTemplateMessage({
              to: phone,
              chatId,
              language: callLanguage,
              variables: await resolveVoiceOptInTemplateVariables(isPerOrgGather ? orgId : ""),
              templateSid,
            });

            if (isPerOrgGather) {
              // Per-org: charge the destination org once for the opt-in send. Idempotent on
              // (orgId, chatId) via the `initialOutboundCreditsDeducted` flag, so Twilio retries
              // never double-charge. Wrapped so a billing failure can't break the TwiML response.
              try {
                await deductOrgConversationOnce(
                  orgId,
                  chatId,
                  "initialOutboundCreditsDeducted",
                  "Inbound voice opt-in (per-org)"
                );
              } catch (billingErr) {
                console.error("[credits] per-org voice opt-in deduction failed", { orgId, chatId, billingErr });
              }
            }
            // Legacy: no credit deduction here. Billing is DEFERRED — executeCrossOrgCallHandoff
            // charges the destination org 2 credits (idempotency keys `intakeOutboundCreditsDeducted`
            // and `initialOutboundCreditsDeducted`).

            // Persist the ACTUAL message Twilio rendered/sent (not a hardcoded
            // placeholder) into the conversation history so it shows up in the
            // UI and the exported transcript. Runs in the resolved org context.
            const deliveredText = sendResult.deliveredText?.trim();
            if (deliveredText) {
              const existing = await getConversationByChatId(chatId);
              const history = existing?.history ? [...existing.history] : [];
              history.push({ role: "assistant", text: deliveredText, timestamp: Date.now() });
              await upsertConversation(chatId, { history });
            }
          });
        }
      } catch (err) {
        console.error("voiceGatherCallback work error:", err);
        // Fall through and still respond so the call ends gracefully.
      }

      // Confirmation locución (#3), in the language chosen at the menu and carried here on the
      // gather URL. Each language uses its own approved ElevenLabs voice, so the caller hears
      // the same person who read them the opt-in prompt. Falls back to the old Twilio Polly
      // voice only if the URL is not configured.
      const audio3 = (callLanguage === "en" ? VOICE_AUDIO_3_EN_URL.value() : "") || VOICE_AUDIO_3_URL.value();
      res.status(200).send(
        buildTwiml(
          audio3
            ? `<Play>${twimlEscape(audio3)}</Play><Hangup/>`
            : callLanguage === "en"
              ? `<Say voice="Polly.Amy-Neural" language="en-GB">Thank you. You will receive a WhatsApp message shortly.</Say><Hangup/>`
              : `<Say voice="Polly.Lucia-Neural" language="es-ES">Gracias. En breve recibirá un mensaje por WhatsApp.</Say><Hangup/>`
        )
      );
    } catch (error) {
      console.error("voiceGatherCallback error", error);
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml(`<Hangup/>`));
    }
  }
);

/**
 * Write consent proof on the lead doc after DTMF 1. Idempotent.
 */
async function recordVoiceConsent(params: {
  phone: string;
  chatId: string;
  callSid: string;
}): Promise<void> {
  const orgId = getActiveOrgId();
  if (!orgId) return;
  const phoneDigits = params.phone.replace(/[^0-9]/g, "");
  const consent = {
    capturedAt: admin.firestore.Timestamp.now(),
    source: "phone_call" as const,
    proofUrl: params.callSid || undefined,
    language: "es" as const,
    proofType: "twilio_call_sid" as const,
    consentScriptVersion: VOICE_CONSENT_SCRIPT_VERSION.value() || "v1",
    dtmfDigit: "1" as const,
  };
  // Goes through the shared path on purpose. This used to look the lead up by
  // phone alone and, on a miss, create a row with a random document id — the one
  // place in the codebase that did, and a row nothing else could ever find again.
  await setLeadConsentByChatId({
    chatId: params.chatId,
    phone: phoneDigits,
    listingCode: "__pending__",
    consent,
  });
}

/**
 * Cloud Tasks target: sends the post-call WhatsApp message (Spanish).
 * Required because voice webhook must respond immediately to avoid awkward pauses/cut audio.
 */
export const sendCallHandoffMessage = onRequest({ cors: true, region: REGION, secrets: [TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const chatId = typeof req.body?.chatId === "string" ? req.body.chatId.trim() : "";
  const agentName = typeof req.body?.agentName === "string" ? req.body.agentName.trim() : "Paco Granados";

  if (!phone) {
    res.status(400).json({ error: "phone is required" });
    return;
  }

  const resolvedChatId = chatId || normalizeToCanonicalChatId(phone);

  try {
    const orgId = PROPLEAD_INTAKE_ORG_ID.value();
    if (!orgId) {
      console.error("sendCallHandoffMessage: PROPLEAD_INTAKE_ORG_ID is not configured");
      res.status(500).json({ ok: false, error: "intake org not configured" });
      return;
    }

    // No credit deduction in this handler: all sends run in the Proplead intake org,
    // before the destination org is known. Billing for this intake message is DEFERRED —
    // executeCrossOrgCallHandoff later charges the destination org 2 credits (1 for this
    // intake send, idempotency key `intakeOutboundCreditsDeducted`; 1 for the org's own
    // first template, idempotency key `initialOutboundCreditsDeducted`).
    await requestContext.run({ orgId }, async () => {
      const provider = await getActiveProviderFn();
      if (provider === "twilio") {
        const templateSid = await getVoiceOptInTemplateSid(orgId);
        await sendInitialTemplateMessage({
          to: phone,
          chatId: resolvedChatId,
          language: "es",
          variables: { "1": agentName },
          templateSid,
        });
      } else if (provider === "cloud_api") {
        const creds = await getCloudApiCredentials();
        const templateName = requireTemplate(
          creds.templates?.callHandoffOrgEs,
          "Cloud API call handoff template missing for intake org (callHandoffOrgEs)"
        );
        await sendInitialTemplateMessage({
          to: phone,
          chatId: resolvedChatId,
          language: "es",
          variables: { "1": agentName, "2": agentName, "3": "" },
          templateName,
        });
      } else {
        await sendTextMessage({
          to: phone,
          chatId: resolvedChatId,
          body: buildCallInitialWhatsAppMessageEs(agentName),
        });
      }
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("sendCallHandoffMessage failed", error);
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Process buffered messages - called by Cloud Tasks after buffer delay expires
 */
export const processBuffer = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET] }, async (req, res) => {
  try {
    // Only accept POST from Cloud Tasks
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Verify Cloud Tasks OIDC bearer token. Without this, any internet
    // caller can POST `{ orgId, chatId }` and drive OpenAI/Twilio spend in
    // an arbitrary tenant (the legacy code only logged a warning).
    if (process.env.FUNCTIONS_EMULATOR !== "true") {
      // Buffer tasks are created with this cloudfunctions.net URL, which becomes
      // the token's `aud`. Pass it explicitly because the function (on Cloud Run)
      // cannot reconstruct it from the proxied request.
      const v = await verifyCloudTasksOidc(req, {
        expectedAudiences: [`https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/processBuffer`],
      });
      if (!v.ok) {
        console.warn("processBuffer: rejecting non-Cloud-Tasks request:", v.reason);
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    const taskName = req.headers["x-cloudtasks-taskname"];
    const queueName = req.headers["x-cloudtasks-queuename"];
    console.log(`processBuffer called by task: ${taskName} from queue: ${queueName}`);

    const { chatId, orgId } = req.body as { chatId?: string; orgId?: string };

    if (!chatId) {
      console.error("No chatId provided in request body");
      res.status(400).json({ error: "chatId is required" });
      return;
    }

    const resolvedOrgId = orgId;
    if (!resolvedOrgId) {
      console.error(`Missing orgId in processBuffer for chatId ${chatId}`);
      await sendAlert(
        "ProcessBuffer missing org",
        "Falta orgId al procesar el buffer. Se omite el procesamiento para evitar datos cruzados.",
        { chatId, incomingOrgId: orgId || null }
      );
      res.status(400).json({ processed: false, reason: "org_missing", chatId });
      return;
    }

    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      console.log(`Processing buffered messages for chatId: ${chatId} (Org: ${resolvedOrgId})`);

      // Get pending messages and clear them atomically
      const pendingMessages = await getPendingMessagesAndClear(chatId);

      if (pendingMessages.length === 0) {
        console.log(`No pending messages for ${chatId}, possibly already processed`);
        res.status(200).json({ processed: false, reason: "No pending messages" });
        return;
      }

      console.log(`Found ${pendingMessages.length} pending message(s) to process for ${chatId}`);

      // Get conversation state
      const state = await ensureConversationState(chatId, undefined, { preferFresh: true });
      if (!state) {
        console.error(`Could not get conversation state for ${chatId} in org ${resolvedOrgId}`);
        res.status(404).json({ error: "Conversation not found" });
        return;
      }

      // Process all buffered messages at once
      await processBufferedMessages(state, pendingMessages);

      // Update in-memory cache (org-scoped)
      setCachedConversationState(chatId, state);

      console.log(`Successfully processed ${pendingMessages.length} message(s) for ${chatId}`);

      res.status(200).json({
        processed: true,
        messageCount: pendingMessages.length,
        chatId,
      });
    });
  } catch (error) {
    console.error("processBuffer error:", error);
    await sendAlert("ProcessBuffer Error", `Error al procesar buffer de mensajes`, {
      error: error instanceof Error ? error.message : String(error)
    });
    // Return 500 so Cloud Tasks can retry if configured
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * 3h timeout handler for the cross-org call handoff name flow.
 * Cloud Task created in applyListingToStateAndPersist invokes this after the delay.
 * If the lead never replied to the name prompt, fire the cross-org handoff anyway
 * using the no-name template variant.
 */
export const processCallNameTimeout = onRequest(
  { cors: true, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const { chatId, orgId } = (req.body || {}) as { chatId?: string; orgId?: string };
      if (!chatId || !orgId) {
        console.warn("processCallNameTimeout missing chatId/orgId", req.body);
        res.status(400).json({ error: "chatId and orgId required" });
        return;
      }

      console.log(`processCallNameTimeout invoked for chatId=${chatId} org=${orgId}`);

      await requestContext.run({ orgId }, async () => {
        const state = await ensureConversationState(chatId);
        if (!state) {
          console.log("processCallNameTimeout: state not found, skipping", chatId);
          res.status(200).json({ skipped: true, reason: "state_not_found" });
          return;
        }
        // Idempotency: only proceed if still in name-pending state.
        const stillPending =
          (state.flowStep === "call_name_confirm" || state.flowStep === "call_name_collect") &&
          !!state.pendingNameConfirmation &&
          state.handoff?.status === "pending";
        if (!stillPending) {
          console.log("processCallNameTimeout: not pending anymore, skipping", {
            chatId,
            flowStep: state.flowStep,
            handoffStatus: state.handoff?.status,
          });
          res.status(200).json({ skipped: true, reason: "no_longer_pending" });
          return;
        }

        const pending = state.pendingNameConfirmation!;
        const listing = await fetchListingGlobally(pending.listingCode);
        if (!listing) {
          console.warn("processCallNameTimeout: listing not found", pending.listingCode);
          await sendAlert(
            "Call handoff timeout failed",
            `Listing ${pending.listingCode} not found at timeout for chatId ${chatId}`,
            { chatId, listingCode: pending.listingCode }
          );
          res.status(200).json({ skipped: true, reason: "listing_missing" });
          return;
        }

        try {
          await sendCrossOrgCallHandoff(state, {
            listing: listing.data,
            targetOrgId: pending.targetOrgId,
            sourceOrgId: pending.sourceOrgId,
            correlationId: pending.correlationId,
            initialLanguage: state.language || resolveInitialLanguage(state.phone),
            useLeadName: false,
            reason: "name_timeout_3h",
          });
          console.log("AGENT_DEBUG", JSON.stringify({
            runId: "post-fix",
            hypothesisId: "BFix",
            location: "functions/src/index.ts:processCallNameTimeout.handoffSent",
            message: "no-name handoff sent after 3h timeout",
            data: { chatId, sourceOrgId: pending.sourceOrgId, targetOrgId: pending.targetOrgId, listingCode: pending.listingCode },
            timestamp: Date.now(),
          }));
          res.status(200).json({ ok: true });
        } catch (error) {
          console.error("processCallNameTimeout handoff failed", error);
          await sendAlert(
            "Call handoff timeout failed",
            `Cross-org handoff failed at 3h timeout for chatId ${chatId}`,
            { chatId, error: error instanceof Error ? error.message : String(error) }
          );
          res.status(500).json({ error: "handoff_failed" });
        }
      });
    } catch (error) {
      console.error("processCallNameTimeout error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// File-scope alias so callers outside processBufferedMessages can invoke the helper.
async function sendCrossOrgCallHandoff(
  state: ConversationState,
  params: Parameters<typeof executeCrossOrgCallHandoff>[1]
): Promise<void> {
  return executeCrossOrgCallHandoff(state, params);
}

/**
 * Shared WhatsApp onboarding after a listing is resolved (Idealista webhook / newLead).
 * Same Twilio template flow as legacy newLead. No credit deduction (disabled until re-enabled).
 */
export async function runNewLeadMessagingPipeline(params: {
  phone: string;
  listingCode: string;
  listingData: ListingRow;
  leadTags: string[];
  leadName?: string;
  skipEligibilityGate?: boolean;
}): Promise<
  | { ok: true; chatId: string; initialHistory: HistoryItem[]; featuresText: string }
  | { ok: false; kind: "send_failed"; chatId: string; details: string; initialHistory: HistoryItem[]; featuresText: string }
> {
  const { phone, listingCode, listingData, leadTags } = params;
  const providedLeadName = (params.leadName || "").trim();

  const initialLanguage = resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listingData.features, initialLanguage);
  const initialMessages = composeInitialMessages(listingData.operationType, listingData.link, featuresText, {
    language: initialLanguage,
  });

  let chatId: string = normalizeToCanonicalChatId(phone);
  const listingAddress =
    [listingData.street, listingData.address].filter(Boolean).join(", ").trim() || listingData.address;

  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      name: providedLeadName || undefined,
      tags: leadTags,
    });
  } catch (error) {
    console.warn("Failed to create preliminary lead record", error);
  }

  const initialHistory: HistoryItem[] = [];

  try {
    const provider = await getActiveProviderFn();
    if (provider === "twilio" || provider === "cloud_api") {
      const agentName = listingData.agentName || "Paco";
      const formattedFeatures = formatFeaturesList(featuresText, initialLanguage);
      const sanitizedFeatures = formattedFeatures.replace(/\n/g, " | ");

      // Resolve provider template by language (per-org only, no global fallback).
      let twilioTemplateSid: string | undefined;
      let cloudApiTemplateName: string | undefined;
      let usingLegacyVoiceOutboundTemplate = false;
      let usingLegacyIdealistaConfirmOldTemplate = false;
      if (provider === "twilio") {
        const { twilioTemplates } = await getOrgTemplateSnapshot(getActiveOrgId());
        const legacyIdealistaConfirmEsOld =
          (twilioTemplates as unknown as { idealista_confirm_es_old?: string })
            .idealista_confirm_es_old;
        const legacyIdealistaConfirmEnOld =
          (twilioTemplates as unknown as { idealista_confirm_en_old?: string })
            .idealista_confirm_en_old;
        const legacyVoiceOutboundEs =
          (twilioTemplates as unknown as { voice_lead_initial_outbound_contact_es?: string })
            .voice_lead_initial_outbound_contact_es;
        const legacyVoiceOutboundEn =
          (twilioTemplates as unknown as { voice_lead_initial_outbound_contact_en?: string })
            .voice_lead_initial_outbound_contact_en;
        if (initialLanguage === "en") {
          // For legacy newLead behavior, prefer explicit *_old templates when present.
          // Those templates are 4-variable confirms: leadName, assistantName, agentName, listingLink.
          if (params.skipEligibilityGate && legacyIdealistaConfirmEnOld) {
            usingLegacyIdealistaConfirmOldTemplate = true;
          }
          usingLegacyVoiceOutboundTemplate = !usingLegacyIdealistaConfirmOldTemplate &&
            !twilioTemplates.idealistaInitialEn &&
            Boolean(legacyVoiceOutboundEn);
          twilioTemplateSid = requireTemplate(
            (usingLegacyIdealistaConfirmOldTemplate ? legacyIdealistaConfirmEnOld : undefined) ||
            twilioTemplates.idealistaInitialEn ||
            legacyVoiceOutboundEn,
            "Missing Twilio template SID (idealistaInitialEn) in org botConfig.twilioTemplates"
          );
        } else {
          if (params.skipEligibilityGate && legacyIdealistaConfirmEsOld) {
            usingLegacyIdealistaConfirmOldTemplate = true;
          }
          usingLegacyVoiceOutboundTemplate = !usingLegacyIdealistaConfirmOldTemplate &&
            !twilioTemplates.idealistaInitialEs &&
            Boolean(legacyVoiceOutboundEs);
          twilioTemplateSid = requireTemplate(
            (usingLegacyIdealistaConfirmOldTemplate ? legacyIdealistaConfirmEsOld : undefined) ||
            twilioTemplates.idealistaInitialEs ||
            legacyVoiceOutboundEs,
            "Missing Twilio template SID (idealistaInitialEs) in org botConfig.twilioTemplates"
          );
        }
      } else if (provider === "cloud_api") {
        const creds = await getCloudApiCredentials();
        cloudApiTemplateName =
          initialLanguage === "en"
            ? requireTemplate(
              creds.templates?.idealistaInitialEn,
              "Missing Cloud API template name (idealistaInitialEn) in org cloudApiConfig.templates"
            )
            : requireTemplate(
              creds.templates?.idealistaInitialEs,
              "Missing Cloud API template name (idealistaInitialEs) in org cloudApiConfig.templates"
            );
      }

      const resolvedLeadName = providedLeadName || "Hola";
      const resolvedAssistantName = await resolveAssistantNameForOrg();
      const twilioVariables: Record<string, string> = usingLegacyVoiceOutboundTemplate
        ? {
            // Legacy voice outbound templates usually expect 5 ordered variables.
            "1": resolvedLeadName,
            "2": resolvedAssistantName,
            "3": agentName,
            "4": listingData.link || "",
            "5": sanitizedFeatures,
          }
        : usingLegacyIdealistaConfirmOldTemplate
          ? {
              // Custom legacy idealista_confirm_*_old templates expect 4 ordered variables.
              "1": resolvedLeadName,
              "2": resolvedAssistantName,
              "3": agentName,
              "4": listingData.link || "",
            }
        : {
            // Standard idealista_initial template expects 3 ordered variables.
            "1": agentName,
            "2": listingData.link,
            "3": sanitizedFeatures,
          };

      const result = await sendInitialTemplateMessage({
        to: phone,
        chatId,
        language: initialLanguage,
        variables: provider === "twilio" ? twilioVariables : {
          "1": agentName,
          "2": listingData.link,
          "3": sanitizedFeatures,
        },
        mediaUrl: "https://real-estate-idealista-bot.web.app/idealista.jpg",
        templateSid: twilioTemplateSid,
        templateName: cloudApiTemplateName,
        skipEligibilityGate: params.skipEligibilityGate,
      });

      if (result.chatId && result.chatId !== chatId) {
        chatId = result.chatId;
      }

      try {
        await deductOrgConversationForInitialOutboundOnce(
          getActiveOrgId(),
          chatId,
          "Idealista new lead"
        );
      } catch (err) {
        console.error("[credits] post-send deduction failed", {
          site: "idealistaNewLead",
          orgId: getActiveOrgId(),
          chatId,
          err,
        });
      }

      const deliveredText = typeof result.deliveredText === "string" ? result.deliveredText.trim() : "";
      if (deliveredText) {
        initialHistory.push({
          role: "assistant",
          text: deliveredText,
          timestamp: Date.now(),
        });
      } else {
        console.warn("Template sent but provider did not return delivered text; skipping synthetic history mirror", {
          provider,
          chatId,
          messageId: result.messageId,
        });
      }
    } else {
      for (let i = 0; i < initialMessages.length; i += 1) {
        const body = initialMessages[i];
        const result = await sendTextMessage({ to: phone, body, chatId });

        if (result.chatId && result.chatId !== chatId) {
          chatId = result.chatId;
        }

        initialHistory.push({
          role: "assistant",
          text: body,
          timestamp: Date.now() + i,
        });
      }
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    const state: ConversationState = {
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      description: listingData.description,
      link: listingData.link,
      address: listingAddress,
      features: featuresText,
      profitabilityReportAvailable: listingData.profitabilityReportAvailable,
      profitabilityReport: listingData.profitabilityReport,
      history: initialHistory,
      pendingUserMessages: [],
      isFinished: false,
      tags: leadTags,
      recordings: [],
    };

    await upsertConversation(chatId, { ...state, type: "lead" });
    setCachedConversationState(chatId, state);

    return { ok: false, kind: "send_failed", chatId, details, initialHistory, featuresText };
  }

  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      name: providedLeadName || undefined,
      tags: leadTags,
    });
  } catch (error) {
    console.error("Error updating lead with final chatId", error);
  }

  const state: ConversationState = {
    phone,
    listingCode,
    chatId,
    operationType: listingData.operationType,
    description: listingData.description,
    link: listingData.link,
    address: listingAddress,
    features: featuresText,
    profitabilityReportAvailable: listingData.profitabilityReportAvailable,
    profitabilityReport: listingData.profitabilityReport,
    history: initialHistory,
    pendingUserMessages: [],
    isFinished: false,
    tags: leadTags,
    recordings: [],
  };

  setCachedConversationState(chatId, { ...state, type: "lead" });
  await upsertConversation(chatId, { ...state, tags: leadTags, type: "lead" });

  return { ok: true, chatId, initialHistory, featuresText };
}

async function runIdealistaConfirmPipeline(params: {
  phone: string;
  listingCode: string;
  listingData: ListingRow;
  leadTags: string[];
  leadName?: string;
  language?: "es" | "en";
  orgId?: string;
}): Promise<
  | { ok: true; chatId: string; initialHistory: HistoryItem[]; featuresText: string }
  | { ok: false; kind: "send_failed"; chatId: string; details: string; initialHistory: HistoryItem[]; featuresText: string }
> {
  const { phone, listingCode, listingData, leadTags, leadName, language, orgId } = params;
  const initialLanguage = language || resolveInitialLanguage(phone);
  const featuresText = await getFeaturesForLanguage(listingData.features, initialLanguage);

  const chatId: string = normalizeToCanonicalChatId(phone);
  const listingAddress =
    [listingData.street, listingData.address].filter(Boolean).join(", ").trim() || listingData.address;

  // A6c — Idealista leads are cold by definition: no recorded WhatsApp opt-in.
  // Meta Business Messaging Policy + GDPR require prior consent before sending a
  // marketing template, regardless of provider (Cloud API or Twilio). So we send
  // an SMS with a wa.me link; the lead's click → first inbound WhatsApp message
  // opens the 24h session window (implicit consent).
  try {
    await updateLeadChatInfo({
      phone,
      listingCode,
      chatId,
      operationType: listingData.operationType,
      name: leadName,
      tags: leadTags,
      qualificationStatus: "not_qualified",
    });
  } catch (error) {
    console.warn("Failed to create preliminary lead record (idealista confirm)", error);
  }

  const state: ConversationState = {
    phone,
    listingCode,
    chatId,
    operationType: listingData.operationType,
    description: listingData.description,
    link: listingData.link,
    address: listingAddress,
    features: featuresText,
    profitabilityReportAvailable: listingData.profitabilityReportAvailable,
    profitabilityReport: listingData.profitabilityReport,
    history: [],
    pendingUserMessages: [],
    isFinished: false,
    tags: leadTags,
    recordings: [],
    flowStep: "call_listing_collect",
    botDisabled: false,
    name: leadName,
  };
  setCachedConversationState(chatId, { ...state, type: "lead" });
  await upsertConversation(chatId, {
    ...state,
    type: "lead",
    idealistaDescription: listingData.idealistaDescription || "",
    rentalSubtype: listingData.rentalSubtype,
  });

  try {
    const phoneDigits = phone.replace(/[^0-9]/g, "");
    const phoneE164 = phone.startsWith("+") ? phone : `+${phoneDigits}`;
    await sendIdealistaOptInSms({
      phoneE164,
      name: leadName || "",
      listingCode,
      orgId,
      baseDomain: initialLanguage === "en" ? undefined : undefined, // reserved for future i18n
    });
    return { ok: true, chatId, initialHistory: [], featuresText };
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error(`runIdealistaConfirmPipeline SMS opt-in failed for ${phone}: ${details}`, error);
    return { ok: false, kind: "send_failed", chatId, details, initialHistory: [], featuresText };
  }
}

// Legacy template-based Idealista confirm flow removed. Prior to Meta App Review
// the bot sent a WhatsApp template directly to cold Idealista leads. This violated
// the Business Messaging Policy's opt-in requirement. The path above now sends an
// SMS opt-in link instead; the lead's first inbound WhatsApp message opens the 24h
// window and implicit consent, after which the conversational flow proceeds normally.

type OutboundCallOutcome =
  | "consent_captured"
  | "no_answer"
  | "busy"
  | "voicemail"
  | "wrong_key_or_timeout"
  | "hangup_before_consent"
  | "failed";

async function getLeadDocByChatId(
  chatId: string,
  listingCode?: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const orgId = getActiveOrgId();
  if (!orgId) return null;
  return findLeadDocForChat(chatId, listingCode);
}

function resolveConfiguredAssistantName(config: BotConfig): string {
  const configuredName = config.cloudApiConfig?.assistantAvatarName;
  if (typeof configuredName === "string" && configuredName.trim()) {
    return configuredName.trim();
  }
  return "Marcos";
}

async function resolveAssistantNameForOrg(): Promise<string> {
  const config = await getBotConfig();
  return resolveConfiguredAssistantName(config);
}

function getOutboundAudioBucketName(): string {
  const configured = (OUTBOUND_AUDIO_BUCKET.value() || "").trim();
  return configured || OUTBOUND_AUDIO_BUCKET_DEFAULT;
}

async function assertOutboundAudioBucketWritable(bucketName: string): Promise<void> {
  const cache = outboundAudioPreflightCache;
  const now = Date.now();
  if (
    cache &&
    cache.bucket === bucketName &&
    now - cache.checkedAt < OUTBOUND_AUDIO_PREFLIGHT_TTL_MS &&
    cache.ok
  ) {
    return;
  }

  const bucket = admin.storage().bucket(bucketName);
  const probePath = `voice-outbound/_preflight/${now}.txt`;
  const probeFile = bucket.file(probePath);
  try {
    await probeFile.save("ok", { resumable: false, contentType: "text/plain" });
    await probeFile.delete().catch(() => undefined);
    outboundAudioPreflightCache = { ok: true, checkedAt: now, bucket: bucketName };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    outboundAudioPreflightCache = { ok: false, checkedAt: now, bucket: bucketName, reason };
    throw new Error(
      `[outbound-audio-preflight] bucket ${bucketName} is not writable by runtime service account: ${reason}`
    );
  }
}

async function ensureOutboundAudioForLead(params: {
  chatId: string;
  leadName?: string;
  listingData: ListingRow;
}): Promise<{ audioUrl: string; sourceText: string; voiceId: string }> {
  const state = await getConversationByChatId(params.chatId);
  const existingAudio = state?.outboundCallAudio;
  if (existingAudio?.status === "ready" && existingAudio.audioUrl && existingAudio.voiceId) {
    return {
      audioUrl: existingAudio.audioUrl,
      sourceText: existingAudio.sourceText || "",
      voiceId: existingAudio.voiceId,
    };
  }

  const elevenLabsKey = ELEVENLABS_KEY.value();
  if (!elevenLabsKey) {
    throw new Error("11LABS_KEY secret is empty or inaccessible. Verify Secret Manager permissions.");
  }
  const assistantName = await resolveAssistantNameForOrg();
  const sourceText = buildOutboundConsentSpeechEs({
    leadName: params.leadName,
    assistantName,
    operationType: params.listingData.operationType,
    price: params.listingData.price,
    street: params.listingData.street,
    city: params.listingData.city,
    address: params.listingData.address,
  });
  // Locked by product decision: always use the approved ElevenLabs voice.
  const voiceId = OUTBOUND_ELEVENLABS_VOICE_ID_DEFAULT;
  const orgId = getActiveOrgId();
  if (!orgId) throw new Error("No active org while generating outbound audio");
  const bucketName = getOutboundAudioBucketName();
  await assertOutboundAudioBucketWritable(bucketName);
  const bucket = admin.storage().bucket(bucketName);
  const filePath = `voice-outbound/${orgId}/${params.chatId}.mp3`;
  let audioUrl = "";
  let retryAttempts = 0;
  let failureReason = "";
  for (let attempt = 1; attempt <= OUTBOUND_AUDIO_MAX_GENERATION_ATTEMPTS; attempt += 1) {
    retryAttempts = attempt;
    try {
      console.log("[outbound-audio] generation attempt", {
        phase: "tts_generate",
        retry_attempt: attempt,
        orgId,
        chatId: params.chatId,
        bucket: bucketName,
      });
      const file = bucket.file(filePath);
      const audioMp3 = await generateSpeechMp3({
        apiKey: elevenLabsKey,
        voiceId,
        text: sourceText,
      });
      console.log("[outbound-audio] upload attempt", {
        phase: "bucket_upload",
        retry_attempt: attempt,
        orgId,
        chatId: params.chatId,
        bucket: bucketName,
      });
      await file.save(audioMp3, {
        resumable: false,
        contentType: "audio/mpeg",
        metadata: {
          cacheControl: "public,max-age=3600",
        },
      });
      const [signedUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      audioUrl = signedUrl;
      break;
    } catch (error) {
      failureReason = error instanceof Error ? error.message : String(error);
      console.warn("[outbound-audio] attempt failed", {
        phase: "tts_or_upload_failed",
        retry_attempt: attempt,
        orgId,
        chatId: params.chatId,
        failureReason,
      });
      if (attempt < OUTBOUND_AUDIO_MAX_GENERATION_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  await upsertConversation(params.chatId, {
    outboundCallAudio: {
      provider: "elevenlabs",
      voiceId,
      status: audioUrl ? "ready" : "failed_after_retries",
      audioUrl: audioUrl || undefined,
      generatedAt: Date.now(),
      sourceText,
      failureReason: audioUrl ? undefined : failureReason || "unknown",
      retryAttempts,
    },
  } as Partial<ConversationState>);

  return { audioUrl, sourceText, voiceId };
}

function computeRetrySchedule(params: {
  outcome: OutboundCallOutcome;
  state?: ConversationState;
}): { shouldRetry: boolean; nextAttemptAt?: number; finishedReason?: string } {
  const consent = params.state?.outboundCallConsent || {};
  const now = new Date();
  const firstAttemptAt = consent.firstAttemptAt ? new Date(consent.firstAttemptAt) : now;

  if (params.outcome === "consent_captured") {
    return { shouldRetry: false, finishedReason: "consent_captured" };
  }
  if (params.outcome === "failed") {
    return { shouldRetry: false, finishedReason: "failed" };
  }

  if (params.outcome === "no_answer" || params.outcome === "busy" || params.outcome === "voicemail") {
    const count = Number(consent.noAnswerRetryCount || 0);
    if (count >= 3) return { shouldRetry: false, finishedReason: "max_no_answer_retries" };
    const baseDate = new Date();
    if (count === 0) baseDate.setHours(baseDate.getHours() + 1);
    if (count === 1) baseDate.setHours(baseDate.getHours() + 4);
    if (count === 2) {
      const next = nextBusinessDaySameTimeFromReference(firstAttemptAt);
      return { shouldRetry: true, nextAttemptAt: next.getTime() };
    }
    return { shouldRetry: true, nextAttemptAt: alignToMadridBusinessSlot(baseDate).getTime() };
  }

  if (params.outcome === "wrong_key_or_timeout") {
    const count = Number(consent.wrongKeyRetryCount || 0);
    if (count >= 2) return { shouldRetry: false, finishedReason: "max_wrong_key_retries" };
    const baseDate = new Date();
    if (count === 0) baseDate.setMinutes(baseDate.getMinutes() + 5);
    if (count === 1) baseDate.setHours(baseDate.getHours() + 1);
    return { shouldRetry: true, nextAttemptAt: alignToMadridBusinessSlot(baseDate).getTime() };
  }

  if (params.outcome === "hangup_before_consent") {
    const count = Number(consent.hangupRetryCount || 0);
    if (count >= 1) return { shouldRetry: false, finishedReason: "max_hangup_retries" };
    const next = nextBusinessDaySameTimeFromReference(firstAttemptAt);
    return { shouldRetry: true, nextAttemptAt: next.getTime() };
  }

  return { shouldRetry: false, finishedReason: "unsupported_outcome" };
}

async function scheduleOutboundRetry(params: {
  orgId: string;
  chatId: string;
  phone: string;
  listingCode: string;
  leadName?: string;
  nextAttemptAt: number;
}): Promise<void> {
  const delaySeconds = Math.max(0, Math.floor((params.nextAttemptAt - Date.now()) / 1000));
  const retryUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/outboundCallRetryTask`;
  await scheduleImmediateHttpTask({
    url: retryUrl,
    payload: {
      orgId: params.orgId,
      chatId: params.chatId,
      phone: params.phone,
      listingCode: params.listingCode,
      leadName: params.leadName || "",
    },
    taskPrefix: "outbound-retry",
    taskId: `${params.orgId}-${params.chatId}-${params.nextAttemptAt}`,
    delaySeconds,
  });
}

async function placeIdealistaOutboundConsentCall(params: {
  orgId: string;
  phone: string;
  listingCode: string;
  leadName?: string;
}): Promise<{ chatId: string; callSid: string }> {
  const normalizedPhone = normalizeE164Phone(params.phone);
  if (!normalizedPhone) throw new Error("telefono is invalid");
  const chatId = normalizeToCanonicalChatId(normalizedPhone);
  const listingData = await fetchListingByCode(params.listingCode);
  if (!listingData) throw new Error("Anuncio no encontrado");

  await updateLeadChatInfo({
    phone: normalizedPhone,
    listingCode: params.listingCode,
    chatId,
    operationType: listingData.operationType,
    name: params.leadName,
    qualificationStatus: "not_qualified",
    tags: ["lead", "idealista-call-outbound"],
  });

  const leadDoc = await getLeadDocByChatId(chatId);
  if (leadDoc) {
    await leadDoc.ref.set(
      {
        leadSource: "idealista_call_outbound",
        listingResolutionStatus: "resolved",
      },
      { merge: true }
    );
  }

  const existing = await getConversationByChatId(chatId);
  const firstAttemptAt = existing?.outboundCallConsent?.firstAttemptAt || Date.now();
  const firstAttemptDate = new Date(firstAttemptAt);
  const firstAttemptParts = getMadridTimeParts(firstAttemptDate);
  const audio = await ensureOutboundAudioForLead({
    chatId,
    leadName: params.leadName,
    listingData,
  });

  await upsertConversation(chatId, {
    phone: normalizedPhone,
    listingCode: params.listingCode,
    operationType: listingData.operationType,
    name: params.leadName,
    isFinished: false,
    type: "lead",
    tags: Array.from(new Set([...(existing?.tags || []), "lead", "idealista-call-outbound"])),
    language: "es",
    outboundCallConsent: {
      attemptCount: Number(existing?.outboundCallConsent?.attemptCount || 0) + 1,
      noAnswerRetryCount: Number(existing?.outboundCallConsent?.noAnswerRetryCount || 0),
      wrongKeyRetryCount: Number(existing?.outboundCallConsent?.wrongKeyRetryCount || 0),
      hangupRetryCount: Number(existing?.outboundCallConsent?.hangupRetryCount || 0),
      consentCaptured: existing?.outboundCallConsent?.consentCaptured || false,
      firstAttemptAt,
      firstAttemptAtHourMadrid: firstAttemptParts.hour,
      firstAttemptAtMinuteMadrid: firstAttemptParts.minute,
      lastOutcome: "attempt_started",
    },
    outboundCallAudio: {
      provider: "elevenlabs",
      voiceId: audio.voiceId,
      status: "ready",
      audioUrl: audio.audioUrl,
      generatedAt: Date.now(),
      sourceText: audio.sourceText,
    },
  } as Partial<ConversationState>);

  const callerFrom = OUTBOUND_CALLER_NUMBER.value() || OUTBOUND_CALLER_NUMBER_DEFAULT;
  if (!callerFrom) {
    throw new Error("OUTBOUND_CALLER_NUMBER is not configured");
  }
  const voiceWebhookUrl =
    `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/outboundConsentVoiceWebhook` +
    `?orgId=${encodeURIComponent(params.orgId)}` +
    `&chatId=${encodeURIComponent(chatId)}` +
    `&listingCode=${encodeURIComponent(params.listingCode)}`;
  const statusCallbackUrl =
    `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/outboundConsentStatusCallback` +
    `?orgId=${encodeURIComponent(params.orgId)}` +
    `&chatId=${encodeURIComponent(chatId)}` +
    `&listingCode=${encodeURIComponent(params.listingCode)}` +
    `&phone=${encodeURIComponent(normalizedPhone)}` +
    `&leadName=${encodeURIComponent(params.leadName || "")}`;

  const call = await createVoiceCall({
    to: normalizedPhone,
    from: callerFrom,
    url: voiceWebhookUrl,
    statusCallback: statusCallbackUrl,
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  });

  const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
  await db.doc(`organizations/${params.orgId}/calls/${call.callSid}`).set(
    {
      callSid: call.callSid,
      orgId: params.orgId,
      chatId,
      phone: normalizedPhone,
      listingCode: params.listingCode,
      leadName: params.leadName || "",
      outboundConsent: true,
      consentCaptured: false,
      gatherHandled: false,
      retryScheduled: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await upsertConversation(chatId, {
    outboundCallConsent: {
      ...(await getConversationByChatId(chatId))?.outboundCallConsent,
      lastCallSid: call.callSid,
    },
  } as Partial<ConversationState>);

  return { chatId, callSid: call.callSid };
}

export const newLeadCallConsent = onRequest(
  { cors: true, region: REGION, secrets: [TWILIO_AUTH_TOKEN, MAKE_WEBHOOK_SHARED_SECRET, ELEVENLABS_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const providedSecret =
        (typeof req.headers["x-make-secret"] === "string" ? req.headers["x-make-secret"] : "") ||
        (typeof req.query.secret === "string" ? req.query.secret : "");
      const expectedSecret = MAKE_WEBHOOK_SHARED_SECRET.value();
      if (!expectedSecret || !secureCompare(providedSecret, expectedSecret)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!ELEVENLABS_KEY.value()) {
        res.status(500).json({ error: "11LABS_KEY secret is missing or inaccessible" });
        return;
      }
      const bucketName = getOutboundAudioBucketName();
      await assertOutboundAudioBucketWritable(bucketName);

      const phone = typeof req.body?.telefono === "string" ? req.body.telefono.trim() : "";
      const listingCode = typeof req.body?.anuncio === "string" ? req.body.anuncio.trim() : "";
      const orgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
      const leadName = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
      if (!phone || !listingCode) {
        res.status(400).json({ error: "telefono y anuncio son obligatorios" });
        return;
      }

      let resolvedOrgId = orgId;
      if (!resolvedOrgId) {
        const global = await fetchListingGlobally(listingCode);
        if (!global) {
          res.status(404).json({ error: "Anuncio no encontrado" });
          return;
        }
        resolvedOrgId = global.orgId;
      }

      await requestContext.run({ orgId: resolvedOrgId }, async () => {
        const result = await placeIdealistaOutboundConsentCall({
          orgId: resolvedOrgId,
          phone,
          listingCode,
          leadName,
        });
        res.status(200).json({ success: true, chatId: result.chatId, callSid: result.callSid });
      });
    } catch (error) {
      console.error("newLeadCallConsent error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const outboundCallRetryTask = onRequest(
  { cors: true, region: REGION, secrets: [TWILIO_AUTH_TOKEN, ELEVENLABS_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const orgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
      const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
      const listingCode = typeof req.body?.listingCode === "string" ? req.body.listingCode.trim() : "";
      const leadName = typeof req.body?.leadName === "string" ? req.body.leadName.trim() : "";
      if (!orgId || !phone || !listingCode) {
        res.status(400).json({ error: "orgId, phone and listingCode are required" });
        return;
      }
      await requestContext.run({ orgId }, async () => {
        const bucketName = getOutboundAudioBucketName();
        await assertOutboundAudioBucketWritable(bucketName);
        const result = await placeIdealistaOutboundConsentCall({
          orgId,
          phone,
          listingCode,
          leadName,
        });
        res.status(200).json({ ok: true, chatId: result.chatId, callSid: result.callSid });
      });
    } catch (error) {
      console.error("outboundCallRetryTask error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const outboundConsentVoiceWebhook = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      const orgId = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";
      const chatId = typeof req.query.chatId === "string" ? req.query.chatId.trim() : "";
      if (!orgId || !chatId) {
        res.set("Content-Type", "text/xml");
        res.status(200).send(buildTwiml("<Say>Error de configuración.</Say><Hangup/>"));
        return;
      }
      await requestContext.run({ orgId }, async () => {
        const state = await getConversationByChatId(chatId);
        const audioUrl = state?.outboundCallAudio?.audioUrl;
        const audioStatus = state?.outboundCallAudio?.status;
        const gatherUrl =
          `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/outboundConsentGatherCallback` +
          `?orgId=${encodeURIComponent(orgId)}` +
          `&chatId=${encodeURIComponent(chatId)}` +
          `&listingCode=${encodeURIComponent(typeof req.query.listingCode === "string" ? req.query.listingCode : "")}`;
        const body = audioUrl
          ? [
            `<Play>${twimlEscape(audioUrl)}</Play>`,
            `<Gather numDigits="1" timeout="12" action="${twimlEscape(gatherUrl)}" method="POST">`,
            `  <Say language="es-ES">Pulsa 1 para aceptar y continuar por WhatsApp.</Say>`,
            `  <Pause length="4"/>`,
            `  <Say language="es-ES">Por favor, pulsa 1 para continuar por WhatsApp.</Say>`,
            `</Gather>`,
            `<Hangup/>`,
          ].join("\n")
          : audioStatus === "failed_after_retries"
            ? [
              `<Say language="es-ES">Hola. Para continuar por WhatsApp y aceptar el contacto, pulsa 1.</Say>`,
              `<Gather numDigits="1" timeout="12" action="${twimlEscape(gatherUrl)}" method="POST">`,
              `  <Pause length="4"/>`,
              `  <Say language="es-ES">Por favor, pulsa 1 para continuar por WhatsApp.</Say>`,
              `</Gather>`,
              `<Hangup/>`,
            ].join("\n")
          : [
            `<Say language="es-ES">Estamos preparando tu llamada. Te contactaremos de nuevo en breve.</Say>`,
            `<Hangup/>`,
          ].join("\n");
        console.log("[outbound-audio] webhook render", {
          phase: "voice_webhook_render",
          orgId,
          chatId,
          hasAudioUrl: Boolean(audioUrl),
          audioStatus: audioStatus || "none",
          fallback_used: !audioUrl && audioStatus === "failed_after_retries",
        });
        res.set("Content-Type", "text/xml");
        res.status(200).send(buildTwiml(body));
      });
    } catch (error) {
      console.error("outboundConsentVoiceWebhook error", error);
      res.set("Content-Type", "text/xml");
      res.status(200).send(buildTwiml("<Hangup/>"));
    }
  }
);

export const outboundConsentGatherCallback = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const digits = typeof body.Digits === "string" ? body.Digits.trim() : "";
    const callSid = typeof body.CallSid === "string" ? body.CallSid : "";
    const orgId = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";
    const chatId = typeof req.query.chatId === "string" ? req.query.chatId.trim() : "";
    const listingCode = typeof req.query.listingCode === "string" ? req.query.listingCode.trim() : "";
    const leadPhoneFromTo = normalizeE164Phone(typeof body.To === "string" ? body.To : "");

    res.set("Content-Type", "text/xml");
    if (!orgId || !chatId) {
      res.status(200).send(buildTwiml("<Hangup/>"));
      return;
    }

    try {
      await requestContext.run({ orgId }, async () => {
        const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
        if (callSid) {
          await db.doc(`organizations/${orgId}/calls/${callSid}`).set(
            {
              gatherHandled: true,
              gatherDigits: digits || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        const state = await getConversationByChatId(chatId);
        if (digits === "1") {
          const consentResult = await setLeadConsentByChatId({
            chatId,
            phone: leadPhoneFromTo || state?.phone || undefined,
            listingCode: listingCode || undefined,
            consent: {
              capturedAt: admin.firestore.Timestamp.now(),
              source: "phone_call",
              language: "es",
              proofUrl: callSid || undefined,
              proofType: "twilio_call_sid",
              consentScriptVersion: VOICE_CONSENT_SCRIPT_VERSION.value() || "v1",
              dtmfDigit: "1",
            },
          });
          if (consentResult?.leadId) {
            await recordSystemAction("lead", consentResult.leadId, "consent_captured", {
              source: "outbound_dtmf_call",
              callSid,
            });
          }
          if (callSid) {
            await db.doc(`organizations/${orgId}/calls/${callSid}`).set(
              {
                consentCaptured: true,
                finalOutcome: "consent_captured",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
          }
          await upsertConversation(chatId, {
            outboundCallConsent: {
              ...(state?.outboundCallConsent || {}),
              consentCaptured: true,
              lastOutcome: "consent_captured",
              finishedReason: "consent_captured",
            },
          } as Partial<ConversationState>);

          const listingData = listingCode ? await fetchListingByCode(listingCode) : null;
          const destinationLeadPhone = leadPhoneFromTo || state?.phone || "";
          if (listingData && destinationLeadPhone) {
            const pipelineResult = await runNewLeadMessagingPipeline({
              phone: destinationLeadPhone,
              listingCode,
              listingData,
              leadTags: ["lead", "idealista-call-outbound", "consent-captured"],
              leadName: (state?.name || "").trim() || undefined,
            });
            console.log("outboundConsentGatherCallback post-consent messaging result", {
              orgId,
              chatId,
              callSid,
              pipelineOk: pipelineResult.ok,
              pipelineKind: pipelineResult.ok ? "ok" : pipelineResult.kind,
              pipelineDetails: pipelineResult.ok ? undefined : pipelineResult.details,
            });
          } else {
            console.warn("outboundConsentGatherCallback could not run post-consent pipeline", {
              orgId,
              chatId,
              callSid,
              hasListingData: Boolean(listingData),
              hasFromPhone: Boolean(destinationLeadPhone),
              listingCode,
            });
          }
          res.status(200).send(buildTwiml(`<Say language="es-ES">Gracias. En unos momentos te escribiremos por WhatsApp.</Say><Hangup/>`));
          return;
        }

        const policy = computeRetrySchedule({ outcome: "wrong_key_or_timeout", state: state || undefined });
        const wrongCount = Number(state?.outboundCallConsent?.wrongKeyRetryCount || 0) + 1;
        if (policy.shouldRetry && policy.nextAttemptAt && state?.phone && listingCode) {
          await scheduleOutboundRetry({
            orgId,
            chatId,
            phone: state.phone,
            listingCode,
            leadName: state.name,
            nextAttemptAt: policy.nextAttemptAt,
          });
        }
        await upsertConversation(chatId, {
          outboundCallConsent: {
            ...(state?.outboundCallConsent || {}),
            wrongKeyRetryCount: wrongCount,
            lastOutcome: "wrong_key_or_timeout",
            nextAttemptAt: policy.nextAttemptAt,
            finishedReason: policy.shouldRetry ? undefined : policy.finishedReason,
          },
        } as Partial<ConversationState>);
        res.status(200).send(buildTwiml("<Hangup/>"));
      });
    } catch (error) {
      console.error("outboundConsentGatherCallback error", error);
      res.status(200).send(buildTwiml("<Hangup/>"));
    }
  }
);

export const outboundConsentStatusCallback = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
      const orgId = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";
      const chatId = typeof req.query.chatId === "string" ? req.query.chatId.trim() : "";
      const listingCode = typeof req.query.listingCode === "string" ? req.query.listingCode.trim() : "";
      const callSid = typeof body.CallSid === "string" ? body.CallSid : "";
      const status = typeof body.CallStatus === "string" ? body.CallStatus.trim().toLowerCase() : "";
      const answeredBy = typeof body.AnsweredBy === "string" ? body.AnsweredBy.trim().toLowerCase() : "";
      if (!orgId || !chatId) {
        res.status(200).json({ ok: true, ignored: true });
        return;
      }

      await requestContext.run({ orgId }, async () => {
        const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
        const state = await getConversationByChatId(chatId);
        const callDocRef = callSid ? db.doc(`organizations/${orgId}/calls/${callSid}`) : null;
        const callDoc = callDocRef ? await callDocRef.get() : null;
        const callData = (callDoc?.data() || {}) as {
          consentCaptured?: boolean;
          gatherHandled?: boolean;
          retryScheduled?: boolean;
        };

        let outcome: OutboundCallOutcome | null = null;
        if (status === "busy") outcome = "busy";
        else if (status === "no-answer" || status === "failed" || status === "canceled") outcome = "no_answer";
        else if (answeredBy.includes("machine")) outcome = "voicemail";
        else if (status === "completed" && !callData.consentCaptured && callData.gatherHandled) outcome = "wrong_key_or_timeout";
        else if (status === "completed" && !callData.consentCaptured) outcome = "hangup_before_consent";

        if (!outcome || callData.consentCaptured || callData.retryScheduled) {
          return;
        }
        const policy = computeRetrySchedule({ outcome, state: state || undefined });
        if (policy.shouldRetry && policy.nextAttemptAt && state?.phone && listingCode) {
          await scheduleOutboundRetry({
            orgId,
            chatId,
            phone: state.phone,
            listingCode,
            leadName: state.name,
            nextAttemptAt: policy.nextAttemptAt,
          });
        }

        const next = {
          ...(state?.outboundCallConsent || {}),
          lastOutcome: outcome,
          nextAttemptAt: policy.nextAttemptAt,
          finishedReason: policy.shouldRetry ? undefined : policy.finishedReason,
        };
        if (outcome === "no_answer" || outcome === "busy" || outcome === "voicemail") {
          next.noAnswerRetryCount = Number(state?.outboundCallConsent?.noAnswerRetryCount || 0) + 1;
        } else if (outcome === "hangup_before_consent") {
          next.hangupRetryCount = Number(state?.outboundCallConsent?.hangupRetryCount || 0) + 1;
        }
        await upsertConversation(chatId, { outboundCallConsent: next } as Partial<ConversationState>);
        if (callDocRef) {
          await callDocRef.set(
            {
              retryScheduled: policy.shouldRetry,
              finalOutcome: outcome,
              retryNextAttemptAt: policy.nextAttemptAt || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("outboundConsentStatusCallback error", error);
      res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const newLead = onRequest({ cors: false, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET, MAKE_WEBHOOK_SHARED_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const providedSecret =
    (typeof req.headers["x-make-secret"] === "string" ? req.headers["x-make-secret"] : "") ||
    (typeof req.query.secret === "string" ? req.query.secret : "");
  const expectedSecret = MAKE_WEBHOOK_SHARED_SECRET.value();
  if (!expectedSecret || !secureCompare(providedSecret, expectedSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = NewLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }
  const phone = parsed.data.telefono.trim();
  const listingCode = parsed.data.anuncio.trim();
  const orgId = parsed.data.orgId.trim();
  const leadName = parsed.data.nombre?.trim() || "";
  const languageNorm = parsed.data.language === "en" || parsed.data.language === "es" ? parsed.data.language : "";

  // Per-phone+listing rate limit (1 new-lead per 5 min). Prevents an abuser
  // who has the intake secret from re-triggering opt-in WhatsApp messages.
  const allowed = await checkAndRecordRateLimit({
    bucket: "newLead",
    key: `${phone}__${listingCode}`,
    windowMs: 5 * 60 * 1000,
  });
  if (!allowed) {
    res.status(429).json({ error: "Rate limited: este lead ya fue procesado recientemente." });
    return;
  }

  // Per-org ceiling: even with the shared secret an attacker can't burn through
  // an org's credit balance by spraying unique synthetic phones. 200/hour leaves
  // huge headroom for real bursts (Idealista campaigns) but caps abuse cost.
  if (orgId) {
    const rlDb = getFirestore(admin.app(), "realestate-whatsapp-bot");
    const orgLimit = await enforceRateLimit(rlDb, `newLead:org:${orgId}`, {
      windowSec: 60 * 60,
      max: 200,
    });
    if (!orgLimit.allowed) {
      res.setHeader("Retry-After", String(orgLimit.retryAfterSec));
      res.status(429).json({ error: "Rate limited: org hourly cap reached." });
      return;
    }
    // Per-IP cap so a single attacker can't focus on one tenant.
    const ipHash = clientIpKey(req);
    const ipLimit = await enforceRateLimit(rlDb, `newLead:ip:${ipHash}`, {
      windowSec: 60,
      max: 20,
    });
    if (!ipLimit.allowed) {
      res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
      res.status(429).json({ error: "Rate limited: too many requests from this client." });
      return;
    }
  }

  // 1. Resolve organization from listing code. orgId is REQUIRED — we no
  //    longer fall back to a global cross-org listing scan.
  let resolvedOrgId = orgId;
  let listingData: ListingRow | null = null;

  if (!resolvedOrgId) {
    res.status(400).json({ error: "orgId es obligatorio" });
    return;
  }

  try {
    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      listingData = await fetchListingByCode(listingCode);
    });
  } catch (error) {
    console.error(`Error resolving listing ${listingCode} (orgId: ${resolvedOrgId}):`, error);
    res.status(500).json({
      error: "Error interno al buscar el anuncio",
      details: error instanceof Error ? error.message : String(error),
      listingCode,
      orgId: resolvedOrgId,
    });
    return;
  }

  if (!listingData || !resolvedOrgId) {
    console.warn(`Listing ${listingCode} not found in any organization.`);
    res.status(404).json({ error: "Anuncio no encontrado" });
    return;
  }

  // 2. Run the rest of the logic with the correct organization context
  try {
    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      // Check if conversation already exists for this phone and listing and is still open
      const existingConv = await getConversationByPhoneAndListing(phone, listingCode);
      if (existingConv && !existingConv.isFinished) {
        console.log(`Lead ${phone} already has an open conversation for ${listingCode} in org ${resolvedOrgId}. Sending returning message.`);

        const isSpanish = isSpanishPhoneNumber(phone);
        const returnMessage = isSpanish
          ? "Has vuelto a contactar por Idealista en relación al anuncio mostrado arriba, ¿cómo te puedo ayudar?"
          : "You have contacted us again through Idealista regarding the property shown above, how can I help you?";

        try {
          const { twilioTemplates, cloudApiTemplates } = await getOrgTemplateSnapshot(resolvedOrgId);
          const templateSid = isSpanish ? twilioTemplates.returningLeadEs : twilioTemplates.returningLeadEn;
          const cloudApiTemplateName = isSpanish ? cloudApiTemplates.idealistaConfirmEs : cloudApiTemplates.idealistaConfirmEn;
          await sendReturningLeadMessage({
            to: phone,
            body: returnMessage,
            chatId: existingConv.chatId,
            templateSid,
            cloudApiTemplateName,
            language: isSpanish ? "es" : "en",
            context: "returning_lead_idealista",
          });

          // Update history
          const updatedHistory = [...(existingConv.history || [])];
          updatedHistory.push({
            role: "assistant",
            text: returnMessage,
            timestamp: Date.now(),
          });

          await upsertConversation(existingConv.chatId, { history: updatedHistory, tags: ["lead"], type: "lead" });

          // Also update lead info to mark recent activity
          await updateLeadChatInfo({
            phone,
            listingCode,
            chatId: existingConv.chatId,
            operationType: existingConv.operationType as OperationType,
          });

          res.status(200).json({ chatId: existingConv.chatId, message: "Returning lead message sent" });
          return;
        } catch (error) {
          console.error("Error handling returning lead:", error);
        }
      }

      const pipeline = await runIdealistaConfirmPipeline({
        phone,
        listingCode,
        listingData: listingData!,
        leadTags: ["lead"],
        leadName: leadName || undefined,
        language: (languageNorm as "es" | "en" | "") || undefined,
        orgId,
      });

      if (!pipeline.ok) {
        res.status(502).json({
          error: "No se pudieron enviar los mensajes iniciales (pero el lead ha sido guardado)",
          details: pipeline.details,
          chatId: pipeline.chatId,
        });
        return;
      }

      res.status(200).json({ chatId: pipeline.chatId, success: true });
    });
  } catch (error) {
    console.error("Fatal error in newLead pipeline:", error);
    res.status(500).json({ 
      error: "Error interno procesando el lead", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

/**
 * Legacy Idealista intake path that mirrors pre-opt-in behavior:
 * sends the initial WhatsApp template first (Twilio/Cloud API),
 * then continues normal chat flow on inbound replies.
 */
export const newLeadLegacy = onRequest({ cors: false, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN, TWILIO_API_KEY, TWILIO_API_SECRET, MAKE_WEBHOOK_SHARED_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const providedSecret =
    (typeof req.headers["x-make-secret"] === "string" ? req.headers["x-make-secret"] : "") ||
    (typeof req.query.secret === "string" ? req.query.secret : "");
  const expectedSecret = MAKE_WEBHOOK_SHARED_SECRET.value();
  if (!expectedSecret || !secureCompare(providedSecret, expectedSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsedLegacy = NewLeadSchema.safeParse(req.body);
  if (!parsedLegacy.success) {
    res.status(400).json({ error: "Invalid request body", details: parsedLegacy.error.flatten() });
    return;
  }
  const phone = parsedLegacy.data.telefono.trim();
  const listingCode = parsedLegacy.data.anuncio.trim();
  const orgId = parsedLegacy.data.orgId.trim();
  const leadName = parsedLegacy.data.nombre?.trim() || "";

  const allowed = await checkAndRecordRateLimit({
    bucket: "newLeadLegacy",
    key: `${phone}__${listingCode}`,
    windowMs: 5 * 60 * 1000,
  });
  if (!allowed) {
    res.status(429).json({ error: "Rate limited: este lead ya fue procesado recientemente." });
    return;
  }

  // 1. Resolve organization from listing code. orgId is REQUIRED.
  let resolvedOrgId = orgId;
  let listingData: ListingRow | null = null;

  if (!resolvedOrgId) {
    res.status(400).json({ error: "orgId es obligatorio" });
    return;
  }

  try {
    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      listingData = await fetchListingByCode(listingCode);
    });
  } catch (error) {
    console.error(`Error resolving listing ${listingCode} (orgId: ${resolvedOrgId}):`, error);
    res.status(500).json({
      error: "Error interno al buscar el anuncio",
      details: error instanceof Error ? error.message : String(error),
      listingCode,
      orgId: resolvedOrgId,
    });
    return;
  }

  if (!listingData || !resolvedOrgId) {
    console.warn(`Listing ${listingCode} not found in any organization.`);
    res.status(404).json({ error: "Anuncio no encontrado" });
    return;
  }

  // 2. Run legacy template-first logic with the correct organization context
  try {
    await requestContext.run({ orgId: resolvedOrgId }, async () => {
      // Check if conversation already exists for this phone and listing and is still open
      const existingConv = await getConversationByPhoneAndListing(phone, listingCode);
      if (existingConv && !existingConv.isFinished) {
        console.log(`Lead ${phone} already has an open conversation for ${listingCode} in org ${resolvedOrgId}. Sending returning message.`);

        const isSpanish = isSpanishPhoneNumber(phone);
        const returnMessage = isSpanish
          ? "Has vuelto a contactar por Idealista en relación al anuncio mostrado arriba, ¿cómo te puedo ayudar?"
          : "You have contacted us again through Idealista regarding the property shown above, how can I help you?";

        try {
          const { twilioTemplates, cloudApiTemplates } = await getOrgTemplateSnapshot(resolvedOrgId);
          const templateSid = isSpanish ? twilioTemplates.returningLeadEs : twilioTemplates.returningLeadEn;
          const cloudApiTemplateName = isSpanish ? cloudApiTemplates.idealistaConfirmEs : cloudApiTemplates.idealistaConfirmEn;
          await sendReturningLeadMessage({
            to: phone,
            body: returnMessage,
            chatId: existingConv.chatId,
            templateSid,
            cloudApiTemplateName,
            language: isSpanish ? "es" : "en",
            context: "returning_lead_idealista_legacy",
          });

          // Update history
          const updatedHistory = [...(existingConv.history || [])];
          updatedHistory.push({
            role: "assistant",
            text: returnMessage,
            timestamp: Date.now(),
          });

          await upsertConversation(existingConv.chatId, { history: updatedHistory, tags: ["lead"], type: "lead" });

          // Also update lead info to mark recent activity
          await updateLeadChatInfo({
            phone,
            listingCode,
            chatId: existingConv.chatId,
            operationType: existingConv.operationType as OperationType,
          });

          res.status(200).json({ chatId: existingConv.chatId, message: "Returning lead message sent" });
          return;
        } catch (error) {
          console.error("Error handling returning lead:", error);
        }
      }

      const pipeline = await runNewLeadMessagingPipeline({
        phone,
        listingCode,
        listingData: listingData!,
        leadTags: ["lead"],
        leadName: leadName || undefined,
        skipEligibilityGate: true,
      });

      if (!pipeline.ok) {
        res.status(502).json({
          error: "No se pudieron enviar los mensajes iniciales (pero el lead ha sido guardado)",
          details: pipeline.details,
          chatId: pipeline.chatId,
        });
        return;
      }

      res.status(200).json({ chatId: pipeline.chatId, success: true });
    });
  } catch (error) {
    console.error("Fatal error in newLeadLegacy pipeline:", error);
    res.status(500).json({
      error: "Error interno procesando el lead",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export const sendMessage = onRequest({ cors: WEB_CLIENT_CORS, region: REGION, secrets: [TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }
  const { chatId, text } = parsed.data;

  try {
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    // Burst guard: at most 1 per second per org.
    const burstAllowed = await checkAndRecordRateLimit({
      bucket: "sendMessage",
      key: orgId,
      windowMs: 1000,
    });
    if (!burstAllowed) {
      res.status(429).json({ error: "Rate limited: too many outbound messages, slow down." });
      return;
    }
    // Longer-window per-org caps so a leaked admin token can't drive 86k
    // messages/day. 30/min and 500/h give legitimate bulk-reply UX plenty of
    // headroom while bounding abuse cost.
    const rlDb = getFirestore(admin.app(), "realestate-whatsapp-bot");
    const perMin = await enforceRateLimit(rlDb, `sendMessage:org:${orgId}:1m`, { windowSec: 60, max: 30 });
    if (!perMin.allowed) {
      res.setHeader("Retry-After", String(perMin.retryAfterSec));
      res.status(429).json({ error: "Rate limited: org outbound cap (per-minute) reached." });
      return;
    }
    const perHour = await enforceRateLimit(rlDb, `sendMessage:org:${orgId}:1h`, { windowSec: 60 * 60, max: 500 });
    if (!perHour.allowed) {
      res.setHeader("Retry-After", String(perHour.retryAfterSec));
      res.status(429).json({ error: "Rate limited: org outbound cap (hourly) reached." });
      return;
    }

    await requestContext.run({ orgId }, async () => {
      const state = await ensureConversationState(chatId, undefined, { preferFresh: true });
      if (!state) {
        res.status(404).json({ error: "Conversación no encontrada" });
        return;
      }

      await sendAssistantTextAndRecord(state, text);
      setCachedConversationState(chatId, state);

      res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({ error: String(error) });
  }
});

export const sendMassMessage = onRequest({ cors: WEB_CLIENT_CORS, region: REGION, secrets: [TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const parsed = SendMassMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }
  const { chatIds, text } = parsed.data;

  console.log(`Sending mass message to ${chatIds.length} chats`);

  try {
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    // Per-org rate limit: 1 mass-message run per 10s (max ~6/min).
    // Bulk sends are inherently large; this guards against runaway loops.
    const allowed = await checkAndRecordRateLimit({
      bucket: "sendMassMessage",
      key: orgId,
      windowMs: 10_000,
    });
    if (!allowed) {
      res.status(429).json({ error: "Rate limited: wait 10s between mass-send runs." });
      return;
    }

    // Hard cap on the per-call broadcast size to limit blast radius.
    if (chatIds.length > 500) {
      res.status(400).json({ error: "chatIds limit exceeded (max 500 per call)" });
      return;
    }

    // Per-org sustained cap so a leaked token can't loop 6 mass-sends/min ×
    // 500 chats each = 180k messages/h. 5 runs/hour is plenty for legitimate
    // bulk announcements and bounds runaway abuse to ~2500 chats/hour.
    const rlMassDb = getFirestore(admin.app(), "realestate-whatsapp-bot");
    const massPerHour = await enforceRateLimit(rlMassDb, `sendMassMessage:org:${orgId}:1h`, { windowSec: 60 * 60, max: 5 });
    if (!massPerHour.allowed) {
      res.setHeader("Retry-After", String(massPerHour.retryAfterSec));
      res.status(429).json({ error: "Rate limited: org mass-send hourly cap reached." });
      return;
    }

    await requestContext.run({ orgId }, async () => {
      console.log(`Sending mass message to ${chatIds.length} chats in org ${orgId}`);

      const results = {
        success: 0,
        failed: 0,
        errors: [] as { chatId: string; error: string }[],
      };

      await Promise.all(
        chatIds.map(async (chatId) => {
          try {
            const state = await ensureConversationState(chatId, undefined, { preferFresh: true });
            if (!state) {
              throw new Error("Conversación no encontrada");
            }

            await sendAssistantTextAndRecord(state, text);
            setCachedConversationState(chatId, state);

            results.success++;
          } catch (error) {
            console.error(`Error sending mass message to ${chatId}:`, error);
            results.failed++;
            results.errors.push({ chatId, error: String(error) });
          }
        })
      );

      res.status(200).json({
        success: true,
        summary: {
          total: chatIds.length,
          sent: results.success,
          failed: results.failed,
        },
        errors: results.errors,
      });
    });
  } catch (error) {
    console.error("Error in sendMassMessage:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Utility endpoint to retry sending opt-in SMS to leads missing onboarding conversation state.
 */
export const retryMissingLeads = onRequest({ cors: WEB_CLIENT_CORS, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  const authHeader = req.headers.authorization;
  let orgId = "";
  try {
    orgId = await resolveOrgIdFromToken(authHeader);
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Per-org rate limit: 1 retry-run per minute. The endpoint can scan and
  // re-send opt-in messages to many leads at once; one run per minute is plenty.
  const allowed = await checkAndRecordRateLimit({
    bucket: "retryMissingLeads",
    key: orgId,
    windowMs: 60_000,
  });
  if (!allowed) {
    res.status(429).json({ error: "Rate limited: wait 60s between retry runs." });
    return;
  }

  const { chatIds: targetChatIds } = req.body;

  await requestContext.run({ orgId }, async () => {
    try {
      const allLeads = await getAllLeadsWithChatId();
      const stuckLeads = [];

      for (const leadSummary of allLeads) {
        const data = leadSummary.data as LeadRow;
        if (!data.chatId) continue;
        
        // If specific chatIds provided, skip if not in list
        if (targetChatIds && Array.isArray(targetChatIds) && !targetChatIds.includes(data.chatId)) {
          continue;
        }

        const conv = await getConversationByChatId(data.chatId);
        // Case 1: Conv exists and is in listing-collect step with no messages
        // Case 2: Conv doesn't exist at all (initialization failed)
        const isStuck = !conv || (conv.flowStep === "call_listing_collect" && (!conv.history || conv.history.length === 0));
        
        if (isStuck) {
          stuckLeads.push({ data, conv });
        }
      }

      console.log(`Found ${stuckLeads.length} leads to process in org ${orgId}`);
      let processed = 0;
      let failed = 0;

      for (const { data, conv } of stuckLeads) {
        try {
          const listingData = await fetchListingByCode(data.listingCode);
          if (!listingData) {
            console.warn(`Listing ${data.listingCode} not found for lead ${data.phone}`);
            continue;
          }

          const pipeline = await runIdealistaConfirmPipeline({
            phone: data.phone,
            listingCode: data.listingCode,
            listingData,
            leadTags: (conv && conv.tags) || ["lead"],
            leadName: data.name || undefined,
            orgId,
          });

          if (pipeline.ok) {
            processed++;
          } else {
            failed++;
          }
        } catch (e) {
          console.error(`Error retrying lead ${data.phone}:`, e);
          failed++;
        }
      }

      res.status(200).json({
        message: `Retry process complete`,
        found: stuckLeads.length,
        processed,
        failed,
      });
    } catch (error) {
      console.error("Error in retryMissingLeads:", error);
      res.status(500).json({ error: String(error) });
    }
  });
});

/**
 * Sync missed messages from Twilio history (last 48h)
 * Use dryRun=true to just see the orphans without injecting them.
 */
export const syncMissedMessages = onRequest({ 
  cors: true, region: REGION, secrets: [TWILIO_AUTH_TOKEN, ADMIN_TEMPLATE_TOKEN] 
}, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token || token !== ADMIN_TEMPLATE_TOKEN.value()) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  try {
    const { getOrphanedMessages, reprocessOrphans } = await import("./services/recoveryService");
    const dryRun = req.query.dryRun !== "false"; // Default to true
    const hours = parseInt(req.query.hours as string) || 48;
    const orgId = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";
    if (!orgId) {
      res.status(400).json({ error: "orgId query param is required in strict org routing mode" });
      return;
    }

    const orphans = await getOrphanedMessages(hours, orgId);

    if (dryRun) {
      res.status(200).json({
        message: `Found ${orphans.length} orphaned messages in the last ${hours} hours.`,
        dryRun: true,
        orphans
      });
      return;
    }

    const { processed, errors } = await reprocessOrphans(orphans);
    res.status(200).json({
      message: `Recovery complete.`,
      found: orphans.length,
      processed,
      errors
    });

  } catch (error) {
    console.error("Error in syncMissedMessages:", error);
    const details = error instanceof Error ? error.message : String(error);
    res.status(500).json({ 
      error: "Internal Error", 
      details,
      status: 9
    });
  }
});

/**
 * One-shot helper to create Twilio Content templates used by this bot.
 * You will still need to submit them for WhatsApp approval in Twilio manually.
 *
 * Security: requires `?token=...` matching ADMIN_TEMPLATE_TOKEN.
 */
export const createTwilioTemplates = onRequest({ cors: true, region: REGION, secrets: [ADMIN_TEMPLATE_TOKEN, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  // Read the admin token from a header (not query) so it doesn't end up in
  // Cloud Run access logs / browser history. Fall back to the legacy query
  // form during the rollout window — remove once external callers migrate.
  const tokenHeader = req.header("x-admin-token") || "";
  const tokenQuery = typeof req.query.token === "string" ? req.query.token : "";
  const token = tokenHeader || tokenQuery;
  const expected = ADMIN_TEMPLATE_TOKEN.value();
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);
  if (
    !token ||
    !expected ||
    tokenBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(tokenBuf, expectedBuf)
  ) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (tokenQuery && !tokenHeader) {
    console.warn(
      "createTwilioTemplates: admin token supplied via query string — please switch to the X-Admin-Token header to keep it out of access logs."
    );
  }

  try {
    const targetOrgId = typeof req.query.orgId === "string"
      ? req.query.orgId.trim()
      : (typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "");
    if (!targetOrgId) {
      res.status(400).json({ error: "orgId is required (query or body)" });
      return;
    }

    const suffix = Date.now().toString();
    const idealistaConfirm = await createContentTemplate({
      friendlyName: `idealista_confirm_es_${suffix}`,
      language: "es",
      orgId: targetOrgId,
      variables: {
        "1": "Carlos",
        "2": "Paco Granados",
        "3": "https://www.idealista.com/inmueble/110595991",
      },
      types: {
        "twilio/quick-reply": {
          body:
            "Hola {{1}}.\n\n" +
            "Soy Marcos, el asistente virtual de {{2}}.\n\n" +
            "Nos has contactado en Idealista por esta vivienda:\n{{3}}\n\n" +
            "¿Es correcto?",
          actions: [
            { title: "Sí", id: "yes" },
            { title: "No", id: "no" },
          ],
        },
        "twilio/text": {
          body:
            "Hola {{1}}.\n\n" +
            "Soy Marcos, el asistente virtual de {{2}}.\n\n" +
            "Nos has contactado en Idealista por esta vivienda:\n{{3}}\n\n" +
            "¿Es correcto? (Responde: Sí / No)",
        },
      },
    });

    const idealistaConfirmEn = await createContentTemplate({
      friendlyName: `idealista_confirm_en_${suffix}`,
      language: "en",
      orgId: targetOrgId,
      variables: {
        "1": "John",
        "2": "Paco Granados",
        "3": "https://www.idealista.com/inmueble/110595991",
      },
      types: {
        "twilio/quick-reply": {
          body:
            "Hi {{1}}.\n\n" +
            "I'm Marcos, the virtual assistant for {{2}}.\n\n" +
            "You contacted us on Idealista about this property:\n{{3}}\n\n" +
            "Is that correct?",
          actions: [
            { title: "Yes", id: "yes" },
            { title: "No", id: "no" },
          ],
        },
        "twilio/text": {
          body:
            "Hi {{1}}.\n\n" +
            "I'm Marcos, the virtual assistant for {{2}}.\n\n" +
            "You contacted us on Idealista about this property:\n{{3}}\n\n" +
            "Is that correct? (Reply: Yes / No)",
        },
      },
    });

    const callInitialEs = await createContentTemplate({
      friendlyName: `call_initial_es_${suffix}`,
      language: "es",
      orgId: targetOrgId,
      variables: { "1": "Paco Granados" },
      types: {
        "twilio/text": {
          body:
            "¡Hola! Soy el asistente virtual de {{1}}. Acabamos de hablar por teléfono.\n\n" +
            "Para localizar el anuncio, ¿me indicas por favor cuál es?\n\n" +
            "Me puedes pasar:\n\n" +
            "1) El número de referencia (9 dígitos, empieza por 1)\n\n" +
            "2) La calle o zona\n\n" +
            "3) El precio\n\n" +
            "4) O pegar directamente el enlace al anuncio",
        },
      },
    });

    const callHandoffOrgEs = await createContentTemplate({
      friendlyName: `call_handoff_org_es_${suffix}`,
      language: "es",
      orgId: targetOrgId,
      variables: {
        "1": "Carlos",
        "2": "Marcos",
        "3": "Paco Granados",
        "4": "https://www.idealista.com/inmueble/110595991",
        "5": "3 hab. | 85 m² | 2 baños",
      },
      types: {
        "twilio/text": {
          body:
            "¡Hola {{1}}! Soy {{2}}, el asistente virtual de {{3}}. Entiendo que te has interesado en esta vivienda: {{4}}.\n\n" +
            "¿Has visto las características?:\n{{5}}.\n\n" +
            "*Si quieres dejar de recibir estos mensajes, escribe STOP en cualquier momento.",
        },
      },
    });

    const callHandoffOrgEn = await createContentTemplate({
      friendlyName: `call_handoff_org_en_${suffix}`,
      language: "en",
      orgId: targetOrgId,
      variables: {
        "1": "John",
        "2": "Marcos",
        "3": "Paco Granados",
        "4": "https://www.idealista.com/inmueble/110595991",
        "5": "3 beds | 85 m² | 2 bathrooms",
      },
      types: {
        "twilio/text": {
          body:
            "Hello {{1}}! I am {{2}}, the virtual assistant for {{3}}. I understand that you are interested in this property: {{4}}.\n\n" +
            "Have you seen the features?:\n{{5}}.\n\n" +
            "*If you want to stop receiving these messages, type STOP at any time.",
        },
      },
    });

    const voiceOptInConsent = await createContentTemplate({
      friendlyName: `voice_optin_consent_es_${suffix}`,
      language: "es",
      orgId: targetOrgId,
      variables: {},
      types: {
        "twilio/text": {
          body:
            "¡Hola! Gracias por confirmar por teléfono. Te contactamos por WhatsApp para ayudarte con la vivienda de tu interés.\n\n" +
            "Si quieres dejar de recibir estos mensajes, escribe STOP en cualquier momento.",
        },
      },
    });

    await getFirestore(admin.app(), "realestate-whatsapp-bot")
      .doc(`organizations/${targetOrgId}/botConfig/config`)
      .set(
        {
          twilioTemplates: {
            idealistaInitialEs: callInitialEs.contentSid,
            callHandoffOrgEs: callHandoffOrgEs.contentSid,
            callHandoffOrgEn: callHandoffOrgEn.contentSid,
            voiceOptInConsent: voiceOptInConsent.contentSid,
          },
        },
        { merge: true }
      );

    res.status(200).json({
      orgId: targetOrgId,
      idealistaConfirm: idealistaConfirm.contentSid,
      idealistaConfirmEn: idealistaConfirmEn.contentSid,
      callInitialEs: callInitialEs.contentSid,
      callHandoffOrgEs: callHandoffOrgEs.contentSid,
      callHandoffOrgEn: callHandoffOrgEn.contentSid,
      voiceOptInConsent: voiceOptInConsent.contentSid,
      note: "Templates persisted to organizations/{orgId}/botConfig/config.twilioTemplates. WhatsApp approval still required in Twilio.",
    });
  } catch (error) {
    console.error("createTwilioTemplates error", error);
    const errAny = error as unknown as { message?: string; response?: { data?: unknown; status?: number } };
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      twilioStatus: errAny.response?.status,
      twilioData: errAny.response?.data,
    });
  }
});

/**
 * Generate the WhatsApp Cloud API templates for the active organization via Meta's
 * `/{WABA_ID}/message_templates` endpoint. Authentication is the user's Firebase ID token
 * (same pattern as other UI-facing endpoints).
 *
 * Creates 6 templates (3 use cases × 2 languages):
 *   - idealistaInitial  (ES/EN) — business-initiated introduction with image header
 *   - idealistaConfirm  (ES/EN) — quick-reply Yes/No confirmation
 *   - agentNotification (ES/EN) — simple body template used as the 24h-window fallback
 *
 * The resulting names are persisted in `botConfig.cloudApiConfig.templates` so callers
 * (pipelines, agent notifications) can resolve them by language at send time.
 */
export const createCloudApiTemplates = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        // Meta requires lowercase, alphanumeric + underscores, max 512 chars. Suffix makes names unique
        // so callers can re-run this helper without colliding with templates already in review.
        const suffix = Date.now().toString();

        const idealistaInitialEsName = `idealista_initial_es_${suffix}`;
        const idealistaInitialEnName = `idealista_initial_en_${suffix}`;
        const idealistaConfirmEsName = `idealista_confirm_es_${suffix}`;
        const idealistaConfirmEnName = `idealista_confirm_en_${suffix}`;
        const agentNotificationEsName = `agent_notification_es_${suffix}`;
        const agentNotificationEnName = `agent_notification_en_${suffix}`;

        // --- idealista_initial (with image header, 3 body variables) ---
        const idealistaInitialEsComponents: CreateTemplateComponent[] = [
          {
            type: "HEADER",
            format: "IMAGE",
            example: { header_handle: ["https://real-estate-idealista-bot.web.app/idealista.jpg"] },
          },
          {
            type: "BODY",
            text:
              "Hola, soy Marcos, el asistente virtual de {{1}}, un placer atenderte.\n\n" +
              "Te has interesado en esta vivienda: {{2}}\n\n" +
              "Por confirmar, ¿has visto las características?\n\n{{3}}",
            example: { body_text: [["Paco", "https://www.idealista.com/inmueble/110595991", "3 hab. | 85 m² | 2 baños"]] },
          },
          { type: "FOOTER", text: "Responde BAJA para dejar de recibir mensajes." },
        ];
        const idealistaInitialEnComponents: CreateTemplateComponent[] = [
          {
            type: "HEADER",
            format: "IMAGE",
            example: { header_handle: ["https://real-estate-idealista-bot.web.app/idealista.jpg"] },
          },
          {
            type: "BODY",
            text:
              "Hi, I'm Marcos, the virtual assistant for {{1}}, a pleasure to help you.\n\n" +
              "You've shown interest in this property: {{2}}\n\n" +
              "Just to confirm, have you reviewed the property highlights?\n\n{{3}}",
            example: { body_text: [["Paco", "https://www.idealista.com/inmueble/110595991", "3 bed | 85 m² | 2 bath"]] },
          },
          { type: "FOOTER", text: "Reply STOP to unsubscribe from messages." },
        ];

        // --- idealista_confirm (quick-reply Yes/No, 3 body variables, no header) ---
        const idealistaConfirmEsComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text:
              "Hola {{1}}.\n\n" +
              "Soy Marcos, el asistente virtual de {{2}}.\n\n" +
              "Nos has contactado en Idealista por esta vivienda:\n{{3}}\n\n" +
              "¿Es correcto?",
            example: { body_text: [["Carlos", "Paco Granados", "https://www.idealista.com/inmueble/110595991"]] },
          },
          { type: "FOOTER", text: "Responde BAJA para dejar de recibir mensajes." },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Sí" },
              { type: "QUICK_REPLY", text: "No" },
            ],
          },
        ];
        const idealistaConfirmEnComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text:
              "Hi {{1}}.\n\n" +
              "I'm Marcos, the virtual assistant for {{2}}.\n\n" +
              "You contacted us on Idealista about this property:\n{{3}}\n\n" +
              "Is that correct?",
            example: { body_text: [["John", "Paco Granados", "https://www.idealista.com/inmueble/110595991"]] },
          },
          { type: "FOOTER", text: "Reply STOP to unsubscribe from messages." },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Yes" },
              { type: "QUICK_REPLY", text: "No" },
            ],
          },
        ];

        // --- agent_notification (1 body variable — fallback for outside-24h agent alerts) ---
        const agentNotificationEsComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text: "{{1}}",
            example: { body_text: [["Tienes un nuevo lead cualificado."]] },
          },
        ];
        const agentNotificationEnComponents: CreateTemplateComponent[] = [
          {
            type: "BODY",
            text: "{{1}}",
            example: { body_text: [["You have a new qualified lead."]] },
          },
        ];

        const createdIds: Record<string, string> = {};
        const created: Record<string, string> = {};

        async function create(
          name: string,
          language: string,
          category: "UTILITY" | "MARKETING",
          components: CreateTemplateComponent[]
        ) {
          const result = await createCloudApiMessageTemplate({ name, category, language, components });
          createdIds[name] = result.id;
          created[name] = result.status;
        }

        await create(idealistaInitialEsName, "es", "MARKETING", idealistaInitialEsComponents);
        await create(idealistaInitialEnName, "en", "MARKETING", idealistaInitialEnComponents);
        await create(idealistaConfirmEsName, "es", "UTILITY", idealistaConfirmEsComponents);
        await create(idealistaConfirmEnName, "en", "UTILITY", idealistaConfirmEnComponents);
        await create(agentNotificationEsName, "es", "UTILITY", agentNotificationEsComponents);
        await create(agentNotificationEnName, "en", "UTILITY", agentNotificationEnComponents);

        await updateCloudApiTemplates({
          agentNotification: agentNotificationEsName,
          callHandoffOrgEs: idealistaInitialEsName,
          callHandoffOrgEn: idealistaInitialEnName,
          idealistaInitialEs: idealistaInitialEsName,
          idealistaInitialEn: idealistaInitialEnName,
          idealistaConfirmEs: idealistaConfirmEsName,
          idealistaConfirmEn: idealistaConfirmEnName,
          agentNotificationEs: agentNotificationEsName,
          agentNotificationEn: agentNotificationEnName,
        });

        res.status(200).json({
          ok: true,
          templates: {
            agentNotification: agentNotificationEsName,
            callHandoffOrgEs: idealistaInitialEsName,
            callHandoffOrgEn: idealistaInitialEnName,
            idealistaInitialEs: idealistaInitialEsName,
            idealistaInitialEn: idealistaInitialEnName,
            idealistaConfirmEs: idealistaConfirmEsName,
            idealistaConfirmEn: idealistaConfirmEnName,
            agentNotificationEs: agentNotificationEsName,
            agentNotificationEn: agentNotificationEnName,
          },
          ids: createdIds,
          statuses: created,
          note: "Las plantillas se han creado en estado PENDING. Meta tarda típicamente de minutos a 24h en aprobarlas.",
        });
      });
    } catch (error) {
      console.error("createCloudApiTemplates error", error);
      const errAny = error as unknown as { message?: string; response?: { data?: unknown; status?: number } };
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        metaStatus: errAny.response?.status,
        metaData: errAny.response?.data,
      });
    }
  }
);

/**
 * Health/connectivity check for a single org's Cloud API credentials. Used by the UI
 * "Test connection" button. Authentication via the user's Firebase ID token.
 */
export const cloudApiHealthCheck = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);
      await requestContext.run({ orgId }, async () => {
        const result = await checkCloudApiHealth(orgId);
        res.status(result.status === "ok" ? 200 : 502).json(result);
      });
    } catch (error) {
      console.error("cloudApiHealthCheck error", error);
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Readiness check for call handoff configuration.
 * Super admins can pass ?orgId=... to inspect any org; others inspect their own org.
 */
async function evaluateCallHandoffReadiness(targetOrgId: string): Promise<{
  targetOrgId: string;
  provider: "twilio" | "cloud_api";
  providerSource: "org" | "global" | "fallback";
  checks: Array<{ key: string; ok: boolean; value?: string; note?: string }>;
  missingRequiredKeys: string[];
  eligible: boolean;
}> {
  const DATABASE_ID = "realestate-whatsapp-bot";
  const db = getFirestore(admin.app(), DATABASE_ID);
  const cfgSnap = await db.doc(`organizations/${targetOrgId}/botConfig/config`).get();
  const cfg = (cfgSnap.data() || {}) as {
    cloudApiConfig?: {
      templates?: {
        callHandoffOrgEs?: string;
        callHandoffOrgEn?: string;
        idealistaInitialEs?: string;
        idealistaInitialEn?: string;
        agentNotification?: string;
        agentNotificationEs?: string;
      };
    };
    twilioTemplates?: {
      callHandoffOrgEs?: string;
      callHandoffOrgEn?: string;
      voiceOptInConsent?: string;
      idealistaInitialEs?: string;
      idealistaInitialEn?: string;
      agentNotification?: string;
    };
    twilioConfig?: {
      accountSid?: string;
      whatsappNumber?: string;
      smsSenderId?: string;
      authTokenSecretName?: string;
    };
  };
  const providerResolution = await getEffectiveProviderForOrg(targetOrgId);
  const provider = providerResolution.provider;
  const checks: Array<{ key: string; ok: boolean; value?: string; note?: string }> = [];
  const add = (key: string, value: string | undefined, note?: string) => {
    checks.push({ key, ok: Boolean(value && value.trim()), value: value || "", note });
  };

  add("PROPLEAD_INTAKE_ORG_ID", PROPLEAD_INTAKE_ORG_ID.value(), "Global intake org for call entry.");
  add("VOICE_AUDIO_LANG_MENU_URL", VOICE_AUDIO_LANG_MENU_URL.value(), "Bilingual language menu (also the greeting).");
  add("VOICE_AUDIO_2_OPTIN_URL", VOICE_AUDIO_2_OPTIN_URL.value(), "DTMF opt-in prompt (ES).");
  add("VOICE_AUDIO_2_OPTIN_EN_URL", VOICE_AUDIO_2_OPTIN_EN_URL.value(), "DTMF opt-in prompt (EN).");
  add("VOICE_AUDIO_3_URL", VOICE_AUDIO_3_URL.value(), "Post-DTMF confirmation locución (ES).");
  add("VOICE_AUDIO_3_EN_URL", VOICE_AUDIO_3_EN_URL.value(), "Post-DTMF confirmation locución (EN).");
  add("VOICE_CONSENT_SCRIPT_VERSION", VOICE_CONSENT_SCRIPT_VERSION.value(), "Consent script version for audits.");

  if (provider === "cloud_api") {
    add("cloudApiConfig.templates.callHandoffOrgEs", cfg.cloudApiConfig?.templates?.callHandoffOrgEs);
    add("cloudApiConfig.templates.callHandoffOrgEn", cfg.cloudApiConfig?.templates?.callHandoffOrgEn);
    add("cloudApiConfig.templates.idealistaInitialEs", cfg.cloudApiConfig?.templates?.idealistaInitialEs);
    add("cloudApiConfig.templates.idealistaInitialEn", cfg.cloudApiConfig?.templates?.idealistaInitialEn);
    add(
      "cloudApiConfig.templates.agentNotification",
      cfg.cloudApiConfig?.templates?.agentNotification || cfg.cloudApiConfig?.templates?.agentNotificationEs
    );
  } else if (provider === "twilio") {
    add("twilioConfig.accountSid", cfg.twilioConfig?.accountSid);
    add("twilioConfig.whatsappNumber", cfg.twilioConfig?.whatsappNumber);
    add("twilioConfig.smsSenderId", cfg.twilioConfig?.smsSenderId);
    add("twilioConfig.authTokenSecretName", cfg.twilioConfig?.authTokenSecretName);
    add("twilioTemplates.voiceOptInConsent", cfg.twilioTemplates?.voiceOptInConsent);
    add("twilioTemplates.callHandoffOrgEs", cfg.twilioTemplates?.callHandoffOrgEs);
    add("twilioTemplates.callHandoffOrgEn", cfg.twilioTemplates?.callHandoffOrgEn);
    add("twilioTemplates.idealistaInitialEs", cfg.twilioTemplates?.idealistaInitialEs);
    add("twilioTemplates.idealistaInitialEn", cfg.twilioTemplates?.idealistaInitialEn);
    add("twilioTemplates.agentNotification", cfg.twilioTemplates?.agentNotification);
  }
  const missingRequiredKeys = checks.filter((c) => !c.ok).map((c) => c.key);
  return {
    targetOrgId,
    provider,
    providerSource: providerResolution.source,
    checks,
    missingRequiredKeys,
    eligible: missingRequiredKeys.length === 0,
  };
}

export const callHandoffReadiness = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { orgId: authOrgId, role } = await resolveUserContextFromToken(req.headers.authorization);
      const queryOrgId = typeof req.query.orgId === "string" ? req.query.orgId.trim() : "";
      const targetOrgId = role === "super_admin" && queryOrgId ? queryOrgId : authOrgId;

      const result = await evaluateCallHandoffReadiness(targetOrgId);

      res.status(200).json({
        ok: result.eligible,
        eligible: result.eligible,
        missingRequiredKeys: result.missingRequiredKeys,
        targetOrgId: result.targetOrgId,
        provider: result.provider,
        providerSource: result.providerSource,
        checks: result.checks,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("callHandoffReadiness error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const botTestResolveListing = onRequest(
  { cors: true, region: REGION, secrets: [OPENAI_API_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const operationTypeRaw = typeof req.body?.operationType === "string" ? req.body.operationType.trim() : "";
      const operationType = operationTypeRaw === "Venta" || operationTypeRaw === "Alquiler" ? operationTypeRaw : undefined;
      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }

      await requestContext.run({ orgId }, async () => {
        const result = await resolveListingFromBufferedText({ text, operationType });
        if (result.kind === "none") {
          res.status(200).json({ kind: "none", candidates: [] });
          return;
        }
        if (result.kind === "match") {
          res.status(200).json({
            kind: "match",
            candidates: result.candidates && result.candidates.length > 0
              ? result.candidates
              : [result.candidate],
          });
          return;
        }
        res.status(200).json({
          kind: "candidates",
          candidates: result.candidates,
        });
      });
    } catch (error) {
      console.error("botTestResolveListing error", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  }
);

/**
 * Backfill strict per-org template eligibility and block unready orgs.
 * Super admin only. Optional body.orgId to process a single org.
 */
export const backfillPerOrgTemplateEligibility = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const requestedOrgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
      const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
      const orgIds: string[] = requestedOrgId
        ? [requestedOrgId]
        : (await db.collection("organizations").limit(500).get()).docs.map((d) => d.id);

      const rows: Array<{ orgId: string; eligible: boolean; missingRequiredKeys: string[] }> = [];
      let updated = 0;
      let blocked = 0;
      for (const orgId of orgIds) {
        const readiness = await evaluateCallHandoffReadiness(orgId);
        const outboundTemplatesBlocked = !readiness.eligible;
        if (outboundTemplatesBlocked) blocked += 1;
        await db.doc(`organizations/${orgId}/botConfig/config`).set(
          {
            templateEligibility: {
              outboundTemplatesBlocked,
              missingRequiredKeys: readiness.missingRequiredKeys,
              checkedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true }
        );
        updated += 1;
        rows.push({
          orgId,
          eligible: readiness.eligible,
          missingRequiredKeys: readiness.missingRequiredKeys,
        });
      }

      res.status(200).json({
        scanned: orgIds.length,
        updated,
        blocked,
        rows,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("backfillPerOrgTemplateEligibility error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Migrate Twilio transport credentials into org-scoped twilioConfig.
 * Super admin only. Defaults to org_paco_granados.
 */
export const migrateTwilioTransportToOrg = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const targetOrgId = typeof req.body?.orgId === "string" && req.body.orgId.trim()
        ? req.body.orgId.trim()
        : "org_paco_granados";
      if (targetOrgId !== "org_paco_granados") {
        res.status(400).json({ error: "This migration endpoint is restricted to org_paco_granados" });
        return;
      }

      const accountSid = typeof req.body?.accountSid === "string" ? req.body.accountSid.trim() : "";
      const whatsappNumber = typeof req.body?.whatsappNumber === "string" ? req.body.whatsappNumber.trim() : "";
      const smsSenderId = typeof req.body?.smsSenderId === "string" ? req.body.smsSenderId.trim() : "";
      const authToken = typeof req.body?.authToken === "string" ? req.body.authToken.trim() : "";

      if (!accountSid || !whatsappNumber || !smsSenderId || !authToken) {
        res.status(400).json({
          error: "Missing request body values. Require accountSid, whatsappNumber, smsSenderId, authToken",
        });
        return;
      }

      const projectId = getGcpProjectId();
      const sm = new SecretManagerServiceClient();
      const secretId = `twilio_org_${targetOrgId}_auth_token`;
      const secretPath = `projects/${projectId}/secrets/${secretId}`;
      try {
        await sm.createSecret({
          parent: `projects/${projectId}`,
          secretId,
          secret: { replication: { automatic: {} } },
        });
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code !== 6) throw error; // ALREADY_EXISTS
      }

      let latestPayload = "";
      try {
        const [latest] = await sm.accessSecretVersion({ name: `${secretPath}/versions/latest` });
        latestPayload = Buffer.from(latest.payload?.data || "").toString("utf8").trim();
      } catch {
        latestPayload = "";
      }
      if (latestPayload !== authToken) {
        await sm.addSecretVersion({
          parent: secretPath,
          payload: { data: Buffer.from(authToken, "utf8") },
        });
      }

      const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
      await db.doc(`organizations/${targetOrgId}/botConfig/config`).set(
        {
          twilioConfig: {
            accountSid,
            whatsappNumber,
            smsSenderId,
            authTokenSecretName: secretId,
          },
        },
        { merge: true }
      );

      res.status(200).json({
        ok: true,
        orgId: targetOrgId,
        twilioConfig: {
          accountSid,
          whatsappNumber,
          smsSenderId,
          authTokenSecretName: secretId,
        },
        secretUpdated: latestPayload !== authToken,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("migrateTwilioTransportToOrg error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

// ==================== TWILIO SENDER MIGRATION (admin/super_admin) ====================

function isAdminRole(role: string): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Kick off a Twilio-sender migration for an org. Admin or super_admin only.
 * See plan in /Users/ejperezreyes/.claude/plans/we-need-to-develop-recursive-tower.md.
 */
export const startTwilioSenderMigration = onRequest(
  { cors: true, region: REGION, timeoutSeconds: 540 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, email, role } = await resolveUserContextFromToken(req.headers.authorization);
      if (!isAdminRole(role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const targetOrgId = typeof req.body?.targetOrgId === "string" ? req.body.targetOrgId.trim() : "";
      const sourceOrgId = typeof req.body?.sourceOrgId === "string" ? req.body.sourceOrgId.trim() : "";
      const newAccountSid = typeof req.body?.newAccountSid === "string" ? req.body.newAccountSid.trim() : "";
      const newAuthToken = typeof req.body?.newAuthToken === "string" ? req.body.newAuthToken.trim() : "";
      if (!targetOrgId || !sourceOrgId || !newAccountSid || !newAuthToken) {
        res.status(400).json({
          error:
            "Missing required body fields: targetOrgId, sourceOrgId, newAccountSid, newAuthToken",
        });
        return;
      }
      const result = await startMigration({
        targetOrgId,
        sourceOrgId,
        newAccountSid,
        newAuthToken,
        actor: { uid, email },
      });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("startTwilioSenderMigration error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Phase 2 of a Twilio sender migration: create + submit the selected templates
 * for WhatsApp approval. Called after the admin reviews the snapshot from
 * `startTwilioSenderMigration` and confirms which templates to submit.
 *
 * Body: { jobId: string, friendlyNames?: string[] }
 *   - When `friendlyNames` is omitted, every snapshotted template is submitted.
 *   - When provided, only matching templates are submitted; others remain in
 *     `not_submitted` state and can be resubmitted later.
 */
export const submitTwilioMigrationTemplates = onRequest(
  { cors: true, region: REGION, timeoutSeconds: 540 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (!isAdminRole(role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const jobId = typeof req.body?.jobId === "string" ? req.body.jobId.trim() : "";
      if (!jobId) {
        res.status(400).json({ error: "Missing jobId" });
        return;
      }
      const friendlyNames = Array.isArray(req.body?.friendlyNames)
        ? (req.body.friendlyNames as unknown[]).filter((s): s is string => typeof s === "string")
        : undefined;
      if (friendlyNames && friendlyNames.length === 0) {
        res.status(400).json({ error: "friendlyNames must be a non-empty array when provided" });
        return;
      }
      const result = await submitMigrationTemplates(jobId, friendlyNames);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("submitTwilioMigrationTemplates error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Manually poll a migration job for template approval updates ("Refresh now" in the UI).
 */
export const pollTwilioMigrationJob = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (!isAdminRole(role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const jobId = typeof req.body?.jobId === "string" ? req.body.jobId.trim() : "";
      if (!jobId) {
        res.status(400).json({ error: "Missing jobId" });
        return;
      }
      const result = await pollMigration(jobId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("pollTwilioMigrationJob error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Manually mark a migration job complete. Use when the admin has finalized the
 * org's botConfig outside the system and wants the job out of the in-flight list.
 */
export const forceCompleteTwilioMigrationJob = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (!isAdminRole(role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const jobId = typeof req.body?.jobId === "string" ? req.body.jobId.trim() : "";
      if (!jobId) {
        res.status(400).json({ error: "Missing jobId" });
        return;
      }
      const result = await forceCompleteMigration(jobId);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("forceCompleteTwilioMigrationJob error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Retry a single failed step on a migration job (e.g. webhook config, or one template's submission).
 */
export const retryTwilioMigrationStep = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (!isAdminRole(role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const jobId = typeof req.body?.jobId === "string" ? req.body.jobId.trim() : "";
      const step = typeof req.body?.step === "string" ? req.body.step.trim() : "";
      if (!jobId || !step) {
        res.status(400).json({ error: "Missing jobId or step" });
        return;
      }
      const result = await retryMigrationStep(jobId, step);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("retryTwilioMigrationStep error", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Scheduled poller: every 10 minutes scan all in-flight migration jobs and
 * advance their approval state. Idempotent; safe to invoke manually.
 */
export const pollPendingTwilioMigrations = onSchedule(
  { schedule: "every 10 minutes", region: REGION, timeoutSeconds: 540 },
  async () => {
    const result = await pollAllInFlightMigrations();
    console.log(
      `pollPendingTwilioMigrations: scanned=${result.scanned} updated=${result.updated} collection=${TWILIO_MIGRATION_JOBS_COLLECTION}`
    );
  }
);

/**
 * Embedded Signup: complete WhatsApp onboarding via Twilio Tech Provider.
 *
 * Because we pass our Twilio Partner Solution ID to FB.login, Meta has already
 * shared the customer's WABA with Twilio by the time the popup closes. The only
 * remaining work is:
 *   1. Exchange the short-lived `code` for a Meta access token JUST to fetch
 *      the customer's display phone number (Meta postMessage only returns
 *      phone_number_id, not the E.164). Token is discarded immediately.
 *   2. Create a Twilio subaccount for this org.
 *   3. Create a WhatsApp sender on the subaccount, bound to (waba_id, E.164).
 *   4. Poll until sender.status === ONLINE.
 *   5. Persist twilioConfig + set messagingProvider="twilio" on the org.
 *
 * Returns public sender info for the UI. Never leaks tokens or auth tokens.
 */
export const exchangeEmbeddedSignupCode = onRequest(
  {
    cors: true,
    region: REGION,
    // 120s timeout: sender provisioning via Twilio Tech Provider can take
    // 30-90s while Twilio waits for Meta to propagate the WABA share, then we
    // still need ~10s for the template clone job. Default 60s was too tight.
    timeoutSeconds: 120,
    secrets: [
      META_APP_ID,
      META_APP_SECRET,
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      PROPLEAD_TEMPLATE_SOURCE_ORG,
    ],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const authHeader = req.headers.authorization;
      const userContext = await resolveUserContextFromToken(authHeader);
      const orgId = userContext.orgId;

      const body = (req.body || {}) as {
        code?: string;
        phoneNumberId?: string;
        wabaId?: string;
        assistantAvatarId?: string;
        assistantAvatarUrl?: string;
        assistantPhotoUrl?: string;
      };
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
      const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";
      const assistantAvatarId =
        typeof body.assistantAvatarId === "string" ? body.assistantAvatarId.trim().toLowerCase() : "";
      const assistantAvatarUrl = typeof body.assistantAvatarUrl === "string" ? body.assistantAvatarUrl.trim() : "";
      const assistantPhotoUrl = typeof body.assistantPhotoUrl === "string" ? body.assistantPhotoUrl.trim() : "";
      if (!code || !phoneNumberId || !wabaId) {
        res.status(400).json({ error: "code, phoneNumberId and wabaId are required" });
        return;
      }

      const appId = META_APP_ID.value();
      const appSecret = META_APP_SECRET.value();
      const twilioMasterSid = TWILIO_ACCOUNT_SID.value();
      const twilioMasterAuth = TWILIO_AUTH_TOKEN.value();
      if (!appId || !appSecret) {
        res.status(500).json({ error: "Meta app credentials are not configured on the server" });
        return;
      }
      if (!twilioMasterSid || !twilioMasterAuth) {
        res.status(500).json({ error: "Twilio master credentials are not configured on the server" });
        return;
      }

      // 1. Resolve the display phone number via a short-lived Meta token.
      const accessToken = await exchangeCodeForToken({ code, appId, appSecret });
      const appSecretProof = crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");

      // Cross-check the body's wabaId against the WABA Meta says owns this
      // phoneNumberId. The accessToken's scope is bound to the user's own
      // WABAs, so a mismatch indicates either a misconfiguration or a
      // malicious caller trying to poison wabaIndex with a victim's wabaId.
      const metaWabaId = await fetchPhoneNumberWaba({ phoneNumberId, accessToken, appSecretProof });
      if (!metaWabaId) {
        res.status(502).json({ error: "Could not resolve owning WABA for the phone number from Meta" });
        return;
      }
      if (metaWabaId !== wabaId) {
        console.warn(
          `exchangeEmbeddedSignupCode: wabaId mismatch (body=${wabaId}, meta=${metaWabaId}) for phoneNumberId=${phoneNumberId}, orgId=${orgId}`
        );
        res.status(400).json({ error: "wabaId does not match the WhatsApp Business Account that owns this phone number" });
        return;
      }

      const displayDigits = await fetchDisplayPhoneNumber({ phoneNumberId, accessToken, appSecretProof });
      if (!displayDigits) {
        res.status(502).json({ error: "Could not resolve customer's WhatsApp phone number from Meta" });
        return;
      }
      const senderE164 = `+${displayDigits}`;

      // 2. Validate avatar selection if provided. (We no longer push the avatar
      // to Meta's WhatsApp Business Profile here — Twilio owns the WABA now;
      // profile updates go through Twilio's sender profile API in a follow-up.)
      let selectedAvatarId: string | undefined;
      let selectedAvatarName: string | undefined;
      let selectedAvatarUrl: string | undefined;
      if (assistantAvatarId) {
        const selectedAvatar = getAssistantAvatarById(assistantAvatarId);
        if (!selectedAvatar) {
          res.status(400).json({ error: "assistantAvatarId is invalid" });
          return;
        }
        const avatarFromClient = assistantAvatarUrl || "";
        if (avatarFromClient && !avatarFromClient.endsWith(selectedAvatar.imagePath)) {
          res.status(400).json({ error: "assistantAvatarUrl does not match assistantAvatarId" });
          return;
        }
        selectedAvatarId = selectedAvatar.id;
        selectedAvatarName = selectedAvatar.name;
        const inferredOrigin = avatarFromClient.replace(new RegExp(`${selectedAvatar.imagePath}$`), "");
        const origin = inferredOrigin || "https://real-estate-idealista-bot.web.app";
        selectedAvatarUrl = buildAvatarPublicUrl(origin, selectedAvatar.imagePath);
      }

      // Custom uploaded photo (agency logo) wins over the stock avatar URL
      // when downstream services (Twilio sender profile, etc.) read the photo.
      const profilePhotoUrl = assistantPhotoUrl || selectedAvatarUrl;

      // 3-5. Subaccount + sender + persistence, all in one service call.
      // Inbound webhook URL stays the existing twilioWebhook endpoint.
      const inboundWebhookUrl = `https://${REGION}-real-estate-idealista-bot.cloudfunctions.net/twilioWebhook`;
      const result = await onboardTwilioTechProviderSender({
        orgId,
        masterCreds: { accountSid: twilioMasterSid, authToken: twilioMasterAuth },
        wabaId,
        phoneNumberId,
        senderE164,
        inboundWebhookUrl,
        assistantAvatarId: selectedAvatarId,
        assistantAvatarName: selectedAvatarName,
        assistantAvatarUrl: profilePhotoUrl,
      });

      // Auto-clone WhatsApp Content templates from the "golden source" org
      // (currently org_paco_granados) into the new subaccount and submit them
      // for WhatsApp approval. WhatsApp review takes hours/days — the
      // scheduled `pollPendingTwilioMigrations` cron finishes the job and
      // writes approved SIDs into botConfig.twilioTemplates when ready.
      //
      // Failures here do NOT fail onboarding: the sender already works for
      // freeform messages. Admins can rerun the migration job manually.
      const sourceOrgId = PROPLEAD_TEMPLATE_SOURCE_ORG.value()?.trim();
      let templateCloneSummary: {
        jobId?: string;
        totalTemplates?: number;
        submittedTemplates?: number;
        error?: string;
      } = {};
      if (!sourceOrgId) {
        console.warn(
          "[embeddedSignup] PROPLEAD_TEMPLATE_SOURCE_ORG is unset; skipping template clone."
        );
      } else if (sourceOrgId === orgId) {
        console.warn(
          `[embeddedSignup] sourceOrgId equals targetOrgId (${orgId}); skipping template clone.`
        );
      } else {
        try {
          const migration = await startMigration({
            targetOrgId: orgId,
            sourceOrgId,
            newAccountSid: result.subaccountSid,
            newAuthToken: result.subaccountAuthToken,
            actor: { uid: userContext.uid, email: userContext.email },
          });
          const submitResult = await submitMigrationTemplates(migration.jobId);
          templateCloneSummary = {
            jobId: migration.jobId,
            totalTemplates: submitResult.total,
            submittedTemplates: submitResult.submitted,
          };
          console.log(
            `[embeddedSignup] Template clone kicked off for org=${orgId} jobId=${migration.jobId} ` +
              `total=${submitResult.total} submitted=${submitResult.submitted} skipped=${submitResult.skipped}`
          );
        } catch (cloneError) {
          const message =
            cloneError instanceof Error ? cloneError.message : String(cloneError);
          console.error(
            `[embeddedSignup] Template clone failed for org=${orgId}: ${message}`
          );
          templateCloneSummary = { error: message };
        }
      }

      res.status(200).json({
        ok: true,
        provider: "twilio",
        phoneNumberId,
        wabaId,
        senderSid: result.senderSid,
        senderStatus: result.status,
        displayPhoneNumber: result.displayPhoneNumber,
        templateClone: templateCloneSummary,
      });
    } catch (error) {
      console.error("exchangeEmbeddedSignupCode error", error);
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

/**
 * Expose the FB Login for Business config_id (and app_id) to the frontend so
 * the Embedded Signup popup can be launched without baking these into the
 * bundle at build time. Requires an authenticated user.
 */
export const getEmbeddedSignupConfig = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_ID, META_FB_LOGIN_CONFIG_ID, TWILIO_PARTNER_SOLUTION_ID] },
  async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      await resolveOrgIdFromToken(authHeader);
      res.status(200).json({
        appId: META_APP_ID.value(),
        configId: META_FB_LOGIN_CONFIG_ID.value(),
        graphApiVersion: "v23.0",
        twilioPartnerSolutionId: TWILIO_PARTNER_SOLUTION_ID.value(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Admin-only fallback for internal operators to manually set Cloud API credentials.
 * Restricted to super_admin role; the previous hardcoded-email allowlist made a
 * single Gmail account a single point of failure for cross-org takeover.
 */
export const setManualCloudApiConfig = onRequest(
  { cors: true, region: REGION, secrets: [META_VERIFY_TOKEN, META_APP_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      // The org being configured is always supplied in the body for super_admin
      // operations — it is *not* the caller's own org.
      const targetOrgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
      if (!targetOrgId) {
        res.status(400).json({ error: "orgId is required" });
        return;
      }
      const orgId = targetOrgId;

      const body = (req.body || {}) as {
        accessToken?: string;
        phoneNumberId?: string;
        wabaId?: string;
      };
      const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
      const phoneNumberId = typeof body.phoneNumberId === "string" ? body.phoneNumberId.trim() : "";
      const wabaId = typeof body.wabaId === "string" ? body.wabaId.trim() : "";
      if (!accessToken || !phoneNumberId || !wabaId) {
        res.status(400).json({ error: "accessToken, phoneNumberId and wabaId are required" });
        return;
      }

      const accessTokenSecretName = await storeAccessTokenInSecretManager({ orgId, accessToken });
      const appSecret = META_APP_SECRET.value();
      const appSecretProof = appSecret
        ? crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex")
        : undefined;
      const displayPhoneNumber = await fetchDisplayPhoneNumber({ phoneNumberId, accessToken, appSecretProof });
      const verifyToken = META_VERIFY_TOKEN.value();
      if (!verifyToken) {
        res.status(500).json({ error: "META_VERIFY_TOKEN is not configured on the server" });
        return;
      }
      await persistCloudApiConfigForOrg({
        orgId,
        phoneNumberId,
        wabaId,
        accessTokenSecretName,
        verifyToken,
        displayPhoneNumber,
      });
      invalidateCloudApiCredentialsCache(orgId);

      res.status(200).json({
        ok: true,
        phoneNumberId,
        wabaId,
        graphApiVersion: "v23.0",
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("setManualCloudApiConfig error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * A6a - Explicit consent capture endpoint used by Leads UI.
 */
export const setLeadConsent = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, orgId } = await resolveUserContextFromToken(req.headers.authorization);
      const body = (req.body || {}) as {
        leadId?: string;
        source?: string;
        language?: string;
        proofUrl?: string;
        capturedAtMs?: number;
      };
      const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
      const source = typeof body.source === "string" ? body.source.trim() : "";
      const proofUrl = typeof body.proofUrl === "string" ? body.proofUrl.trim() : "";
      const capturedAtMs = typeof body.capturedAtMs === "number" ? body.capturedAtMs : Date.now();
      if (!leadId || !ALLOWED_CONSENT_SOURCES.has(source as "idealista_form" | "agency_website" | "phone_call" | "in_person" | "inbound_whatsapp")) {
        res.status(400).json({ error: "leadId and valid source are required" });
        return;
      }

      await requestContext.run({ orgId }, async () => {
        await setLeadConsentByLeadId({
          leadId,
          consent: {
            source: source as "idealista_form" | "agency_website" | "phone_call" | "in_person" | "inbound_whatsapp",
            capturedAt: admin.firestore.Timestamp.fromMillis(Math.max(0, capturedAtMs)),
            language: normalizeConsentLanguage(body.language),
            collectedBy: uid,
            proofUrl: proofUrl || undefined,
          },
        });
        await recordSystemAction("lead", leadId, "consent_captured", {
          source,
          language: normalizeConsentLanguage(body.language),
          proofUrl: proofUrl || null,
        });
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("setLeadConsent error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Returns the platform-wide messaging policy (super admin only).
 */
export const getGlobalMessagingPolicyConfig = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const policy = await getGlobalMessagingPolicy();
      res.status(200).json({ policy });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("getGlobalMessagingPolicyConfig error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Updates platform-wide provider behavior settings (super admin only).
 */
export const setGlobalMessagingPolicyConfig = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = (req.body || {}) as {
        cloudApi?: { templates?: Record<string, string | undefined> };
        twilio?: { templates?: Record<string, string | undefined> };
      };

      const cleanTemplates = (input?: Record<string, string | undefined>): Record<string, string> | undefined => {
        if (!input || typeof input !== "object") return undefined;
        const entries = Object.entries(input)
          .map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""] as const)
          .filter(([, v]) => Boolean(v));
        if (entries.length === 0) return undefined;
        return Object.fromEntries(entries);
      };

      const cloudTemplates = cleanTemplates(body.cloudApi?.templates);
      const twilioTemplates = cleanTemplates(body.twilio?.templates);
      if (!cloudTemplates && !twilioTemplates) {
        res.status(400).json({ error: "At least one template update is required" });
        return;
      }

      const patch: {
        cloudApi?: { templates?: Record<string, string> };
        twilio?: { templates?: Record<string, string> };
      } = {};
      if (cloudTemplates) patch.cloudApi = { templates: cloudTemplates };
      if (twilioTemplates) patch.twilio = { templates: twilioTemplates };

      const policy = await updateGlobalMessagingPolicy({
        patch,
        updatedBy: uid,
      });
      invalidateProviderCache();
      res.status(200).json({ ok: true, policy });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("setGlobalMessagingPolicyConfig error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Updates only the platform default provider (super admin only).
 */
export const setPlatformDefaultProviderConfig = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const provider = typeof req.body?.provider === "string" ? req.body.provider.trim() : "";
      const allowedProviders = new Set(["cloud_api", "twilio"]);
      if (!allowedProviders.has(provider)) {
        res.status(400).json({ error: "provider must be cloud_api or twilio" });
        return;
      }
      const policy = await setPlatformDefaultProvider({
        provider: provider as "cloud_api" | "twilio",
        updatedBy: uid,
      });
      invalidateProviderCache();
      res.status(200).json({ ok: true, policy });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("setPlatformDefaultProviderConfig error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Seeds (or refreshes) the global messaging policy with known defaults.
 * Intended for controlled migration rollout by super admins.
 */
export const seedGlobalMessagingPolicy = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = (req.body || {}) as {
        defaultProvider?: "cloud_api" | "twilio";
      };
      const defaultProvider = body.defaultProvider || "twilio";

      const policy = await updateGlobalMessagingPolicy({
        updatedBy: uid,
        patch: {
          defaultProvider,
          cloudApi: {
            templates: {
              callHandoffOrgEs: "call_handoff_org_es_hx30e0ded0c2df0f6c43848b00ca01d978",
              callHandoffOrgEn: "call_handoff_org_en_hx029df4498e7f291754fdb5eec601661e",
              agentNotification: "proplead_agent_notification_v6_hx0f65d74044e27ae2f344b28eabad2776",
            },
          },
          twilio: { templates: {} },
        },
      });
      invalidateProviderCache();
      res.status(200).json({ ok: true, policy });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("seedGlobalMessagingPolicy error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Internal-only provider switch.
 * Only super_admin users can change an organization's messaging provider.
 */
export const setOrgMessagingProvider = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const body = (req.body || {}) as { orgId?: string; provider?: string };
      const targetOrgId = typeof body.orgId === "string" ? body.orgId.trim() : "";
      const provider = typeof body.provider === "string" ? body.provider.trim() : "";
      const allowedProviders = new Set(["cloud_api", "twilio"]);
      if (!targetOrgId || !allowedProviders.has(provider)) {
        res.status(400).json({ error: "orgId and valid provider are required" });
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      await db.doc(`organizations/${targetOrgId}/botConfig/config`).set(
        {
          messagingProvider: provider,
          providerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          providerUpdatedBy: uid,
        },
        { merge: true }
      );
      invalidateProviderCache(targetOrgId);

      res.status(200).json({ ok: true, orgId: targetOrgId, provider });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("setOrgMessagingProvider error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Clears org-level provider override so the org inherits platform default.
 */
export const clearOrgMessagingProviderOverride = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { uid, role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const targetOrgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
      if (!targetOrgId) {
        res.status(400).json({ error: "orgId is required" });
        return;
      }
      const db = getFirestore(admin.app(), "realestate-whatsapp-bot");
      await db.doc(`organizations/${targetOrgId}/botConfig/config`).set(
        {
          messagingProvider: admin.firestore.FieldValue.delete(),
          providerOverrideClearedAt: admin.firestore.FieldValue.serverTimestamp(),
          providerOverrideClearedBy: uid,
        },
        { merge: true }
      );
      invalidateProviderCache(targetOrgId);
      const effective = await getEffectiveProviderForOrg(targetOrgId);
      res.status(200).json({ ok: true, orgId: targetOrgId, effectiveProvider: effective.provider, source: effective.source });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("clearOrgMessagingProviderOverride error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Returns all organizations for internal super_admin users.
 */
export const listOrganizationsForSuperAdmin = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const { role } = await resolveUserContextFromToken(req.headers.authorization);
      if (role !== "super_admin") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      const globalPolicy = await getGlobalMessagingPolicy();
      const snapshot = await db.collection("organizations").limit(500).get();
      const organizations = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as { agencyName?: string };
        const orgProvider = await getOrganizationMessagingProvider(docSnap.id);
        const effective = await getEffectiveProviderForOrg(docSnap.id);
        return {
          id: docSnap.id,
          agencyName: data.agencyName || docSnap.id,
          providerOverride: orgProvider || null,
          effectiveProvider: effective.provider,
          providerSource: effective.source,
          platformDefaultProvider: globalPolicy.defaultProvider,
        };
      }));

      res.status(200).json({ organizations });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("listOrganizationsForSuperAdmin error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Re-applies listing agent scope (assignedAgentUid / createdByUid) to all leads and conversations
 * per listingCode. Fixes historical drift so agent-role users see leads for their assigned ads.
 * super_admin: pass { orgId } in JSON body. owner/admin: reconciles their own org (body optional).
 */
export const reconcileAgentScopeForOrganization = onRequest(
  { cors: true, region: REGION, timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const ctx = await resolveUserContextFromToken(req.headers.authorization);
      let orgId = "";
      if (ctx.role === "super_admin") {
        const bodyOrg = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
        const ctxOrg = typeof ctx.orgId === "string" ? ctx.orgId.trim() : "";
        orgId = bodyOrg || ctxOrg;
      } else if (ctx.role === "owner" || ctx.role === "admin") {
        orgId = typeof ctx.orgId === "string" ? ctx.orgId.trim() : "";
      } else {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (!orgId) {
        res.status(400).json({ error: "orgId required (super_admin: set orgId in JSON body)" });
        return;
      }

      const stats = await reconcileAllListingAgentScopesInOrg(orgId);
      res.status(200).json({ ok: true, orgId, ...stats });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("reconcileAgentScopeForOrganization error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Creates (or resolves) the tenant context for an authenticated user.
 * Idempotent: if the user already has orgId/role, returns existing context.
 */
export const bootstrapUserOrganization = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: [TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_UNSUBSCRIBE_SECRET],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const token = authHeader.split("Bearer ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;
      const email = typeof decoded.email === "string" ? decoded.email : "";
      const requestedName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
      const fallbackName = typeof decoded.name === "string" ? decoded.name : "";

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      const userRef = db.collection("users").doc(uid);

      const result = await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const userData = userSnap.data() as
          | {
              orgId?: unknown;
              role?: unknown;
              name?: unknown;
              email?: unknown;
              createdAt?: unknown;
            }
          | undefined;

        const existingOrgId = typeof userData?.orgId === "string" ? userData.orgId.trim() : "";
        const existingRole = typeof userData?.role === "string" ? userData.role.trim() : "";
        if (existingOrgId) {
          return {
            orgId: existingOrgId,
            role: existingRole || "member",
            created: false,
          };
        }

        const orgRef = db.collection("organizations").doc();
        tx.set(orgRef, {
          onboardingCompleted: false,
          onboardingStep: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        tx.set(
          userRef,
          {
            email: typeof userData?.email === "string" ? userData.email : email,
            name:
              requestedName ||
              (typeof userData?.name === "string" ? userData.name : "") ||
              fallbackName ||
              "Owner",
            role: "owner",
            orgId: orgRef.id,
            createdAt: userData?.createdAt || admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return {
          orgId: orgRef.id,
          role: "owner",
          created: true,
        };
      });

      if (result.created && email) {
        const displayName =
          requestedName ||
          fallbackName ||
          (typeof decoded.name === "string" ? decoded.name : "") ||
          "Owner";
        // Fire-and-forget: never let email failures block signup
        sendWelcomeNotification(email, displayName).catch((err) =>
          console.error("sendWelcomeNotification on signup failed:", err)
        );
        sendNewSignupAlert({ userId: uid, email, displayName }).catch((err) =>
          console.error("sendNewSignupAlert on signup failed:", err)
        );
      }

      res.status(200).json(result);
    } catch (error) {
      console.error("bootstrapUserOrganization error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

/**
 * Explicitly activate the Free plan for an org.
 * This is user-initiated (no automatic activation on signup).
 */
export const activateFreePlan = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);
    const orgRef = db.collection("organizations").doc(orgId);

    const freeCredits = PLAN_BASE_CONVERSATIONS["free"] ?? 40;

    // Idempotent activation: only set the plan if not already active.
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orgRef);
      const data = snap.exists ? (snap.data() ?? {}) : {};
      const existingPlan = typeof (data as any).plan === "string" ? String((data as any).plan) : "";
      const existingBalance = typeof (data as any).creditBalance === "number" ? (data as any).creditBalance : 0;

      if (existingPlan !== "free") {
        tx.set(
          orgRef,
          {
            plan: "free",
            planActivatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      const needsInitialCredits = existingBalance < freeCredits;
      return { existingPlan, existingBalance, needsInitialCredits };
    });

    // Grant up to the Free baseline once (only if they had less than freeCredits).
    if (outcome.needsInitialCredits) {
      const currentSnap = await orgRef.get();
      const currentBalance = currentSnap.exists && typeof currentSnap.data()?.creditBalance === "number"
        ? currentSnap.data()!.creditBalance
        : 0;
      const delta = Math.max(0, freeCredits - currentBalance);
      if (delta > 0) {
        await addOrgConversations(delta, "Activación plan Free", orgId, { eventType: "free_plan_activation" });
      }
    }

    res.status(200).json({
      success: true,
      subscription: {
        planId: "free",
        status: "active",
        currentPeriodEnd: null,
        contractedConversations: freeCredits,
      },
    });
  } catch (error) {
    console.error("activateFreePlan error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * Meta Data Deletion Callback (required in App Basic Settings).
 *
 * Meta posts `signed_request` (base64url(sig).base64url(payload)) signed with the app secret.
 * We verify the signature, record a request row keyed by a random confirmation code, and
 * return `{url, confirmation_code}` so the user can track status at /legal/deletion-status.
 *
 * Proplead does not currently persist Facebook-scoped user IDs (we only see WhatsApp phone
 * numbers via Cloud API), so there is no lead data keyed by `user_id` to delete. The row is
 * still recorded for audit + the status page.
 */
export const metaDataDeletion = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const signedRequest =
        (req.body && typeof req.body.signed_request === "string" && req.body.signed_request) ||
        (typeof req.query.signed_request === "string" ? req.query.signed_request : "");
      if (!signedRequest || !signedRequest.includes(".")) {
        res.status(400).json({ error: "Missing signed_request" });
        return;
      }
      const [encodedSig, encodedPayload] = signedRequest.split(".", 2);
      const b64urlToBuf = (s: string): Buffer =>
        Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
      const sig = b64urlToBuf(encodedSig);
      const expected = crypto
        .createHmac("sha256", META_APP_SECRET.value())
        .update(encodedPayload)
        .digest();
      if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      const payload = JSON.parse(b64urlToBuf(encodedPayload).toString("utf8")) as {
        user_id?: string;
        algorithm?: string;
      };
      const userId = payload.user_id || "unknown";

      const confirmationCode = crypto.randomBytes(16).toString("hex");
      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      await db.doc(`dataDeletionRequests/${confirmationCode}`).set({
        code: confirmationCode,
        fbUserId: userId,
        status: "completed",
        requestedAt: new Date(),
        note: "No Proplead data is keyed by Facebook user_id; nothing to erase.",
      });

      res.status(200).json({
        url: `https://proplead.io/legal/deletion-status?code=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
    } catch (error) {
      console.error("metaDataDeletion error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * A5 — Customer-facing account deletion.
 *
 * Soft-deletes the org (`deletedAt` set), revokes Meta webhook subscription for the
 * connected WABA, and destroys the per-org access token stored in Secret Manager.
 * A daily scheduled job (`purgeDeletedOrganizations`) hard-deletes after 30 days.
 */
export const deleteMyOrganization = onRequest(
  { cors: true, region: REGION, secrets: [META_APP_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const orgId = await resolveOrgIdFromToken(req.headers.authorization);
      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);

      // Best-effort: revoke subscribed_apps + delete secret. Never block deletion.
      try {
        const creds = await getCloudApiCredentials(orgId);
        await axios
          .delete(`https://graph.facebook.com/${creds.graphApiVersion}/${creds.wabaId}/subscribed_apps`, {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
            params: { appsecret_proof: creds.appSecretProof },
            timeout: 10000,
          })
          .catch((err) => console.warn("subscribed_apps revoke failed:", err?.message || err));
        // Delete the wabaIndex mapping.
        await db.doc(`wabaIndex/${creds.wabaId}`).delete().catch(() => undefined);
        // Delete the Secret Manager secret for this org.
        try {
          const sm = new SecretManagerServiceClient();
          const projectId =
            process.env.GCLOUD_PROJECT ||
            process.env.GCP_PROJECT ||
            process.env.GOOGLE_CLOUD_PROJECT ||
            admin.app().options.projectId;
          const secretName = `projects/${projectId}/secrets/whatsapp_org_${orgId}_token`;
          await sm.deleteSecret({ name: secretName });
        } catch (err) {
          console.warn("secret delete failed:", (err as Error)?.message || err);
        }
      } catch (err) {
        console.warn("Cloud API creds unavailable during org deletion:", (err as Error)?.message || err);
      }

      await db.doc(`organizations/${orgId}`).set(
        { deletedAt: new Date(), deletedBy: "self_service" },
        { merge: true }
      );

      res.status(200).json({ ok: true, scheduledHardDeleteInDays: 30 });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("deleteMyOrganization error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Set (or clear) this org's dedicated inbound-voice number for the per-org voice flow.
 *
 * Writes `twilioConfig.voiceNumber` on the org's botConfig AND maintains the root
 * `voiceNumberIndex/{e164}` reverse-lookup doc. The index is Admin-SDK only — Firestore
 * rules deny client writes to root index collections (same as phoneNumberIndex/wabaIndex),
 * which is why this must go through a Cloud Function. Cleans up the stale index doc when the
 * number changes and refuses to claim a number already owned by a different org.
 */
export const setOrgVoiceNumber = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const orgId = await resolveOrgIdFromToken(req.headers.authorization);
      const rawVoiceNumber = (req.body && typeof req.body === "object")
        ? (req.body as Record<string, unknown>).voiceNumber
        : undefined;
      const isClearing = typeof rawVoiceNumber === "string" && rawVoiceNumber.trim() === "";
      const newKey = normalizeVoiceE164(rawVoiceNumber);
      if (!newKey && !isClearing) {
        res.status(400).json({ error: "Invalid voiceNumber" });
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      const cfgRef = db.doc(`organizations/${orgId}/botConfig/config`);
      const cfgSnap = await cfgRef.get();
      const cfg = cfgSnap.exists ? (cfgSnap.data() as Partial<BotConfig> | undefined) : undefined;
      const oldKey = normalizeVoiceE164(cfg?.twilioConfig?.voiceNumber);

      // Collision guard: refuse to claim a number another org already owns.
      if (newKey) {
        const idxSnap = await db.doc(`voiceNumberIndex/${newKey}`).get();
        const indexedOrgId = idxSnap.exists ? (idxSnap.data()?.orgId as string | undefined) : undefined;
        if (indexedOrgId && indexedOrgId !== orgId) {
          res.status(409).json({ error: "voiceNumber already assigned to another organization" });
          return;
        }
      }

      // Persist on botConfig (merge so other twilioConfig fields are untouched).
      await cfgRef.set({ twilioConfig: { voiceNumber: newKey || "" } }, { merge: true });

      // Maintain the reverse index: drop the stale mapping, write the new one.
      if (oldKey && oldKey !== newKey) {
        await db.doc(`voiceNumberIndex/${oldKey}`).delete().catch(() => undefined);
      }
      if (newKey) {
        await db.doc(`voiceNumberIndex/${newKey}`).set({ orgId, updatedAt: new Date() }, { merge: true });
      }

      res.status(200).json({ ok: true, voiceNumber: newKey || null });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("setOrgVoiceNumber error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * A5 — Customer-facing data export (GDPR Art. 20 / DSAR).
 *
 * Gathers the org's Firestore footprint, writes a ZIP snapshot to the default
 * Storage bucket, generates a 7-day v4 signed URL, and emails it to the
 * requester via SendGrid.
 */
export const exportMyData = onRequest(
  { cors: true, region: REGION, secrets: [TWILIO_API_KEY, TWILIO_API_SECRET] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const orgId = await resolveOrgIdFromToken(req.headers.authorization);
      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);

      const orgDoc = await db.doc(`organizations/${orgId}`).get();
      // Refuse to export a half-deleted org: deleteMyOrganization sets
      // `deletedAt` and starts revoking subscriptions / removing indices.
      // A concurrent export against that state ships inconsistent data.
      if (orgDoc.exists && orgDoc.data()?.deletedAt) {
        res.status(409).json({ error: "Organization deletion in progress; export unavailable." });
        return;
      }
      const subcollections = ["leads", "conversations", "listings", "auditLogs", "botConfig", "system_config"];
      const data: Record<string, unknown> = {
        orgId,
        exportedAt: new Date().toISOString(),
        organization: orgDoc.data() || null,
      };
      for (const name of subcollections) {
        const snap = await db.collection(`organizations/${orgId}/${name}`).limit(5000).get();
        data[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const zip = new JSZip();
      zip.file("export.json", JSON.stringify(data, null, 2));
      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      });

      const bucket = admin.storage().bucket();
      const filePath = `dsar/${orgId}/${Date.now()}.zip`;
      const file = bucket.file(filePath);
      await file.save(zipBuffer, {
        contentType: "application/zip",
        metadata: {
          contentDisposition: `attachment; filename="proplead-dsar-${orgId}.zip"`,
        },
        resumable: false,
      });
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 7 * 24 * 3600 * 1000,
      });

      // Email the signed URL to the requester.
      const user = await admin
        .auth()
        .getUser((await admin.auth().verifyIdToken((req.headers.authorization || "").replace(/^Bearer /, ""))).uid);
      if (user.email) {
        const logoUrl = "https://proplead.io/proplead-high-resolution-logo.png";
        await sendEmailToUser({
          to: user.email,
          subject: "Tu exportación de datos de Proplead",
          html: `
            <div style="font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:#F8FAFC; padding: 32px 16px;">
              <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px;">
                <div style="text-align:center; margin-bottom: 16px;">
                  <img src="${logoUrl}" alt="Proplead" style="height: 28px; width: auto; display:inline-block;" />
                </div>
                <p style="margin: 0 0 12px; color:#0F172A;">Hola,</p>
                <p style="margin: 0 0 12px; color:#334155; line-height:1.6;">
                  Hemos preparado la exportación de los datos de tu organización. Podrás descargarla durante los próximos 7 días desde el siguiente enlace:
                </p>
                <p style="margin: 16px 0;">
                  <a href="${url}" style="display:inline-block; background:#0F172A; color:#FFFFFF; text-decoration:none; padding: 12px 16px; border-radius: 12px; font-weight: 700;">
                    Descargar exportación
                  </a>
                </p>
                <p style="margin: 16px 0 0; color:#64748B; font-size: 12px; line-height:1.6;">
                  Si no solicitaste esta exportación, ignora este correo o escribe a dpo@proplead.io.
                </p>
              </div>
            </div>
          `,
        });
      }

      res.status(200).json({ ok: true, url, expiresInDays: 7 });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("exportMyData error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Daily sweeper: hard-delete organizations soft-deleted >= 30 days ago.
 * Recursive delete removes all subcollections (leads, conversations, etc.).
 */
export const purgeDeletedOrganizations = onSchedule(
  { schedule: "0 3 * * *", region: REGION, timeZone: "Europe/Madrid" },
  async () => {
    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const snap = await db
      .collection("organizations")
      .where("deletedAt", "<=", cutoff)
      .limit(50)
      .get();
    for (const doc of snap.docs) {
      try {
        await db.recursiveDelete(doc.ref);
        console.log(`purgeDeletedOrganizations: hard-deleted org ${doc.id}`);
      } catch (err) {
        console.error(`purgeDeletedOrganizations failed for ${doc.id}:`, err);
      }
    }
  }
);

/**
 * A6c — /w/{listingCode} short-link.
 *
 * Resolves the org that owns the listing, reads its `cloudApiConfig.displayPhoneNumber`,
 * and 302-redirects to a pre-filled wa.me deep link. The consumer's click does not
 * create consent by itself — consent is recorded when they actually send the message
 * (inbound webhook sees the matching pattern and stamps the lead).
 */
export const waRedirect = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    try {
      // path: /waRedirect/{listingCode}  OR  ?code={listingCode}
      const pathParts = (req.path || "").split("/").filter(Boolean);
      const listingCode =
        (typeof req.query.code === "string" && req.query.code) ||
        pathParts[pathParts.length - 1] ||
        "";
      if (!listingCode || !/^[a-zA-Z0-9_-]{3,20}$/.test(listingCode)) {
        res.status(400).send("Invalid listing code");
        return;
      }

      const DATABASE_ID = "realestate-whatsapp-bot";
      const db = getFirestore(admin.app(), DATABASE_ID);
      const orgIdFromQuery =
        typeof req.query.o === "string" && /^[a-zA-Z0-9_-]{3,64}$/.test(req.query.o)
          ? req.query.o
          : "";
      const leadId =
        typeof req.query.l === "string" && /^[a-zA-Z0-9_-]{3,128}$/.test(req.query.l)
          ? req.query.l
          : "";

      let orgId = orgIdFromQuery;
      if (!orgId && leadId) {
        const leadSnap = await db
          .collectionGroup("leads")
          .where(admin.firestore.FieldPath.documentId(), "==", leadId)
          .limit(1)
          .get();
        if (!leadSnap.empty) {
          orgId = leadSnap.docs[0].ref.path.split("/")[1];
        }
      }
      // The cross-org fallback scans (collectionGroup over listings and the
      // per-org loop over up to 300 organizations) were removed. They let an
      // anonymous caller enumerate orgId↔phone associations by brute-forcing
      // the 3–20-char listingCode space, and could 302 to the wrong org's
      // WhatsApp number when two tenants reused the same code. Modern WA
      // deep links always embed `o=<orgId>` (or `l=<leadId>` for first-touch
      // links), so requiring one of those parameters covers production
      // traffic without leaking tenant data.
      if (!orgId) {
        res.status(404).send("Listing not found");
        return;
      }

      const listingInOrg = await db
        .collection(`organizations/${orgId}/listings`)
        .where("listingCode", "==", listingCode)
        .where("isActive", "==", true)
        .limit(1)
        .get();
      if (listingInOrg.empty) {
        res.status(404).send("Listing not found");
        return;
      }

      const cfgRef = db.doc(`organizations/${orgId}/botConfig/config`);
      const cfgDoc = await cfgRef.get();
      let displayPhone = (cfgDoc.data()?.cloudApiConfig?.displayPhoneNumber as string | undefined) || "";
      if (!displayPhone) {
        try {
          const creds = await getCloudApiCredentials(orgId);
          const fetched = await fetchDisplayPhoneNumber({
            phoneNumberId: creds.phoneNumberId,
            accessToken: creds.accessToken,
            appSecretProof: creds.appSecretProof,
          });
          if (fetched) {
            displayPhone = fetched;
            await cfgRef.set(
              { cloudApiConfig: { displayPhoneNumber: fetched } },
              { merge: true }
            );
          }
        } catch (error) {
          console.warn(`waRedirect could not refresh displayPhoneNumber for org ${orgId}:`, error);
        }
      }
      if (!displayPhone) {
        const twilioNumber = (cfgDoc.data()?.twilioConfig?.whatsappNumber as string | undefined) || "";
        if (twilioNumber) {
          displayPhone = twilioNumber.replace(/[^0-9]/g, "");
        }
      }
      if (!displayPhone) {
        res.status(503).send("Phone number not configured for this organization");
        return;
      }

      const text = `Hola, me interesa la vivienda ${listingCode}`;
      const waUrl = `https://wa.me/${displayPhone}?text=${encodeURIComponent(text)}`;
      res.redirect(302, waUrl);
    } catch (error) {
      console.error("waRedirect error:", error);
      res.status(500).send("Internal server error");
    }
  }
);

export const triggerBot = onRequest({ cors: true, region: REGION, secrets: [OPENAI_API_KEY, TWILIO_AUTH_TOKEN] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { chatId } = req.body;
  if (!chatId) {
    res.status(400).json({ error: "chatId is required" });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const state = await ensureConversationState(chatId);
      if (!state) {
        res.status(404).json({ error: "Conversación no encontrada" });
        return;
      }

      // Explicitly check for botDisabled to avoid confusion, 
      // though processBufferedMessages will also check it.
      if (state.botDisabled) {
        res.status(400).json({ error: "El bot está desactivado para esta conversación" });
        return;
      }

      await processBufferedMessages(state, []);
      res.status(200).json({ success: true });
    });
  } catch (error) {
    console.error("Error in triggerBot:", error);
    res.status(500).json({ error: String(error) });
  }
});


/**
 * Genera un borrador de mensaje de seguimiento (WhatsApp o email) con IA a partir del contexto
 * que el agente acaba de registrar (nombre, nota, inmueble, historial). NO envía nada: devuelve
 * el texto para que el agente lo revise/edite antes de guardarlo con la próxima acción.
 */
export const generateFollowUpMessage = onRequest(
  { cors: true, region: REGION, secrets: [OPENAI_API_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      // Solo exige una sesión válida (evita abusar de la clave de OpenAI); el contexto va en el body.
      await resolveOrgIdFromToken(req.headers.authorization);

      const body = req.body || {};
      const channel = body.channel === "email" ? "email" : "message";
      const recentNotes = Array.isArray(body.recentNotes)
        ? body.recentNotes.filter((n: unknown) => typeof n === "string" && n.trim()).slice(0, 8)
        : undefined;

      const message = await generateFollowUpDraft({
        channel,
        name: typeof body.name === "string" ? body.name : undefined,
        operationType: typeof body.operationType === "string" ? body.operationType : undefined,
        property: typeof body.property === "string" ? body.property : undefined,
        note: typeof body.note === "string" ? body.note : undefined,
        recentNotes,
        todayLabel: typeof body.todayLabel === "string" ? body.todayLabel : undefined,
      });

      res.status(200).json({ message });
    } catch (error) {
      console.error("Error in generateFollowUpMessage:", error);
      res.status(500).json({ error: String(error) });
    }
  }
);

export const healthz = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Seed function to initialize collections (commented out - use scripts/addListingsAdmin.mjs instead)
// import { seedCollectionsWithSampleData } from "./seedData";
//
// export const seedCollections = onRequest({ cors: true, region: REGION }, async (_req, res) => {
//   try {
//     await seedCollectionsWithSampleData();
//     res.status(200).json({ 
//       success: true, 
//       message: "Sample data created successfully. Check Firebase Console." 
//     });
//   } catch (error) {
//     console.error("Error seeding data:", error);
//     res.status(500).json({ 
//       error: "Failed to seed data", 
//       details: error instanceof Error ? error.message : String(error) 
//     });
//   }
// });

/**
 * Scheduled function to check for conversations that haven't responded in 24 hours
 * Runs every hour
 */
export const checkFollowUps = onSchedule({
  schedule: "0 * * * *", // Every hour
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Checking for conversations that need a follow-up...");

  try {
    // Get conversations that haven't had a message in 24 hours
    const conversations = await getConversationsForFollowUp(24);

    if (conversations.length === 0) {
      console.log("No conversations need follow-up.");
      return;
    }

    console.log(`Found ${conversations.length} conversation(s) for follow-up.`);

    for (const state of conversations) {
      try {
        const isSpanish = isSpanishPhoneNumber(state.phone);
        const followUpMessage = isSpanish
          ? "¡Hola! Debido a la gran cantidad de interesados, no me gustaría que te quedaras fuera. ¿Me puedes responder al mensaje anterior porfa? :)"
          : "Hi! Due to high demand for this property, I wouldn't want you to miss out. Could you please get back to me regarding my previous message? :)";

        console.log(`Sending follow-up to ${state.phone} (${state.chatId})`);

        // Send the message
        await sendTextMessage({ to: state.phone, body: followUpMessage, chatId: state.chatId });

        // Update history
        const updatedHistory = [...(state.history || [])];
        updatedHistory.push({
          role: "assistant",
          text: followUpMessage,
          timestamp: Date.now(),
        });

        // Update state in Firestore
        await upsertConversation(state.chatId, {
          history: updatedHistory,
          followUpSent: true,
        });

        console.log(`Follow-up sent and state updated for ${state.chatId}`);
      } catch (error) {
        console.error(`Error sending follow-up to ${state.chatId}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in checkFollowUps schedule:", error);
  }
});

/**
 * Correo diario (07:00 Madrid) con las tareas de seguimiento de cada agente: sus próximas
 * acciones agrupadas en Vencidas, Hoy y Próximos 7 días. Las de WhatsApp incluyen el mensaje
 * configurado y un botón wa.me con el texto precargado. Sustituye a los recordatorios puntuales.
 */
export const sendDailyFollowUpDigest = onSchedule({
  schedule: "0 7 * * *",
  region: REGION,
  timeZone: "Europe/Madrid",
  secrets: [TWILIO_API_KEY, TWILIO_API_SECRET],
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  try {
    const res = await runDailyFollowUpDigest(Date.now());
    console.log(`[dailyFollowUpDigest] agents=${res.agentsEmailed} tasks=${res.tasksIncluded}`);
  } catch (error) {
    console.error("[dailyFollowUpDigest] fatal error:", error);
  }
});

// `testAlert` and `testWelcomeEmail` previously lived here. They were removed
// because both endpoints accepted unauthenticated GETs and let anyone trigger
// outbound emails from Proplead's SMTP — a phishing pretext and an
// email-reputation risk. If a manual smoke test is needed, run the underlying
// service functions from a script (`functions/src/scripts/`) executed with the
// Admin SDK rather than re-exposing them as public HTTP endpoints.

/** JSON API: GET ?action=status|unsubscribe|resubscribe&token= */
export const emailPreferencesApi = onRequest(
  { cors: true, region: REGION, secrets: [EMAIL_UNSUBSCRIBE_SECRET] },
  emailPreferencesApiHandler
);

/** HTML: one-click / confirm unsubscribe */
export const emailUnsubscribe = onRequest(
  { cors: true, region: REGION, secrets: [EMAIL_UNSUBSCRIBE_SECRET] },
  emailUnsubscribeHandler
);

/** JSON API behind the public "leads sin respuesta" page: GET ?token= */
export const inactiveLeadsApi = onRequest(
  { cors: true, region: REGION, secrets: [INACTIVE_LEADS_SECRET] },
  inactiveLeadsApiHandler
);

/**
 * JSON API behind the public listings page the bot links to when it can't
 * identify the property: GET ?code=. No secret — the catalog is public info.
 */
export const catalogApi = onRequest({ cors: true, region: REGION }, catalogApiHandler);

/**
 * Aviso diario de "leads sin respuesta" (09:00 Madrid): un WhatsApp por agencia
 * que tenga leads fríos nuevos, con el enlace a su lista.
 *
 * Con INACTIVITY_ALERT_DRY_RUN="true" no envía nada y solo escribe en el log lo
 * que enviaría; en producción va en "false". Para probar sin esperar a las 09:00
 * se puede forzar
 * desde Cloud Scheduler ("Force run" sobre este job).
 */
export const sendDailyInactiveLeadsAlert = onSchedule({
  schedule: "0 9 * * *",
  region: REGION,
  timeZone: "Europe/Madrid",
  secrets: [TWILIO_AUTH_TOKEN, INACTIVE_LEADS_SECRET],
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  try {
    const dryRun = INACTIVITY_ALERT_DRY_RUN.value().trim().toLowerCase() !== "false";
    const onlyOrgId = INACTIVITY_ALERT_ONLY_ORG.value().trim();
    const summary = await runDailyInactiveLeadsAlert({
      nowMs: Date.now(),
      linkSecret: INACTIVE_LEADS_SECRET.value().trim(),
      appBaseUrl: APP_BASE_URL.value(),
      defaultTemplateSid: TWILIO_TEMPLATE_SID_INACTIVE_LEADS.value(),
      envNotificationFallback: NOTIFICATION_NUMBER.value(),
      dryRun,
      onlyOrgId: onlyOrgId || undefined,
    });
    console.log(
      `[inactiveLeadsAlert] dryRun=${summary.dryRun} onlyOrg=${onlyOrgId || "(todas)"} ` +
        `orgs=${summary.orgsScanned} avisadas=${summary.orgsNotified} ` +
        `sinLeads=${summary.orgsWithoutColdLeads} sinNuevas=${summary.orgsWithoutNewLeads} ` +
        `mensajes=${summary.messagesSent} marcados=${summary.leadsMarked}`
    );
  } catch (error) {
    console.error("[inactiveLeadsAlert] fatal error:", error);
  }
});

/**
 * Periodic maintenance sync (every 30 minutes): retry failed messages and flag stale buffers.
 */
export const syncConversationsTask = onSchedule({
  schedule: "*/30 * * * *", // Every 30 minutes
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Starting scheduled conversation sync...");
  try {
    const result = await syncConversations();
    console.log(`Sync completed: ${result.chatsChecked} chats, ${result.discrepanciesFound} discrepancies, ${result.errors.length} errors`);
  } catch (error) {
    console.error("Sync task failed:", error);
    await sendAlert("Sync Task Error", "Error crítico en la tarea de sincronización programada", {
      error: error instanceof Error ? error.message : String(error)
    }, "critical");
  }
});

/**
 * Twice-Daily Status Report
 * Runs every 12 hours to confirm the system is healthy
 */
export const twiceDailyStatusReportTask = onSchedule({
  schedule: "0 9,21 * * *", // Twice a day at 9:00 and 21:00
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Starting twice-daily status report...");
  try {
    // 1. Run sync to get latest stats
    const syncResult = await syncConversations({ silent: true });

    // 2. Get alerts in last 12 hours
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
    const alertsInLastPeriod = await getAlertCountSince(twelveHoursAgo);

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // 3. Determine overall status
    const status = (syncResult.discrepanciesFound === 0 && alertsInLastPeriod === 0 && syncResult.errors.length === 0)
      ? "OK"
      : "ISSUES";

    const message = status === "OK"
      ? "El sistema está funcionando correctamente. No se han detectado discrepancias ni errores críticos en las últimas 12 horas."
      : `El sistema presenta algunos temas que requieren atención: ${syncResult.discrepanciesFound} discrepancias y ${alertsInLastPeriod} alertas en las últimas 12 horas.`;

    const responseRateStats = await getResponseRateStats(twentyFourHoursAgo);

    await sendHealthReport(
      status === "OK" ? "Todo en orden" : "Revisión necesaria",
      message,
      {
        chatsChecked: syncResult.chatsChecked,
        discrepanciesFound: syncResult.discrepanciesFound,
        alertsInLastHour: alertsInLastPeriod, // Keeping property name for backwards compatibility in alertService
        status,
        responseRate: responseRateStats.rate
      },
      {
        syncErrors: syncResult.errors,
        timestamp: new Date().toISOString()
      }
    );

    console.log(`Twice-daily status report sent. Status: ${status}`);
  } catch (error) {
    console.error("Twice-daily status report failed:", error);
    // Note: We don't send an alert here to avoid infinite loops if alert system is broken,
    // but the task failure will be logged in GCP.
  }
});

/**
 * Retry failed messages every 15 minutes
 * Attempts to resend messages that failed during initial send
 */
export const retryFailedMessagesTask = onSchedule({
  schedule: "*/15 * * * *", // Every 15 minutes
  region: REGION,
  timeZone: "Europe/Madrid",
}, async () => {
  console.log("Starting failed message retry task...");
  try {
    const stats = await retryFailedMessages();
    if (stats.retried > 0) {
      console.log(`Retry complete: ${stats.succeeded}/${stats.retried} succeeded, ${stats.maxedOut} permanently failed`);
    }
  } catch (error) {
    console.error("Retry task failed:", error);
    await sendAlert("Retry Task Error", "Error en la tarea de reintento de mensajes", {
      error: error instanceof Error ? error.message : String(error)
    }, "warning");
  }
});

/**
 * Scheduled agent that analyzes lead conversations and updates structured data.
 * Runs every 6 hours starting at noon (Madrid time): 12:00, 18:00, 00:00, 06:00
 * Uses ChatGPT to extract: pets (boolean), income (€/month), payment method, notes.
 * Only re-analyzes leads that have new messages since last analysis.
 */
export const analyzeLeadsAgent = onSchedule({
  schedule: "0 0,6,12,18 * * *",
  region: REGION,
  timeZone: "Europe/Madrid",
  timeoutSeconds: 540, // 9 minutes max (Cloud Functions gen2 limit)
  memory: "512MiB",
}, async () => {
  console.log("[AnalyzeLeadsAgent] Starting scheduled lead analysis...");

  try {
    const leads = await getAllLeadsWithChatId();
    console.log(`[AnalyzeLeadsAgent] Found ${leads.length} leads with chatId`);

    let analyzed = 0;
    let skipped = 0;
    let errors = 0;

    for (const { docId, data: leadData } of leads) {
      try {
        const chatId = leadData.chatId as string;

        // Get the conversation
        const conversation = await getConversationByChatId(chatId);
        if (!conversation || !conversation.history || conversation.history.length === 0) {
          skipped++;
          continue;
        }

        // Check if there are user messages at all
        const hasUserMessages = conversation.history.some(h => h.role === "user" && h.text.trim());
        if (!hasUserMessages) {
          skipped++;
          continue;
        }

        // Compare lastAnalyzedAt with conversation's lastMessage timestamp
        const lastAnalyzedAt = leadData.lastAnalyzedAt as FirebaseFirestore.Timestamp | undefined;
        const lastMessage = conversation.lastMessage as FirebaseFirestore.Timestamp | undefined;

        if (lastAnalyzedAt && lastMessage) {
          // If the lead was analyzed after the last message, skip
          const analyzedMs = lastAnalyzedAt.toMillis();
          const messageMs = lastMessage.toMillis();
          if (analyzedMs >= messageMs) {
            skipped++;
            continue;
          }
        } else if (lastAnalyzedAt && !lastMessage) {
          // Already analyzed but no lastMessage timestamp — skip to be safe
          skipped++;
          continue;
        }

        // Analyze the full conversation
        console.log(`[AnalyzeLeadsAgent] Analyzing lead ${docId} (chat: ${chatId})`);

        const summary = await summarizeLeadDetails(conversation);

        // Build the analysis update — always replace all fields
        const analysisUpdate: {
          pets?: boolean;
          income?: number;
          paymentMethod?: "Contado" | "Hipoteca";
          notes?: string;
          name?: string;
        } = {};

        if (summary.pets !== undefined) analysisUpdate.pets = summary.pets;
        if (summary.income !== undefined) analysisUpdate.income = summary.income;
        if (summary.paymentMethod !== undefined) analysisUpdate.paymentMethod = summary.paymentMethod;
        if (summary.notes !== undefined) analysisUpdate.notes = summary.notes;
        if (summary.name !== undefined) analysisUpdate.name = summary.name;

        await updateLeadAnalysis(docId, analysisUpdate);
        analyzed++;

        console.log(`[AnalyzeLeadsAgent] Updated lead ${docId}: pets=${summary.pets}, income=${summary.income}, paymentMethod=${summary.paymentMethod}`);
      } catch (error) {
        errors++;
        console.error(`[AnalyzeLeadsAgent] Error analyzing lead ${docId}:`, error);
      }
    }

    console.log(`[AnalyzeLeadsAgent] Complete. Analyzed: ${analyzed}, Skipped: ${skipped}, Errors: ${errors}`);
  } catch (error) {
    console.error("[AnalyzeLeadsAgent] Fatal error:", error);
  }
});

/**
 * Manual trigger for sync (for testing). Restricted to super_admin.
 */
export const triggerSync = onRequest({ cors: false, region: REGION }, async (req, res) => {
  try {
    const { role } = await resolveUserContextFromToken(req.headers.authorization);
    if (role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    console.log("Manual sync triggered...");
    const result = await syncConversations();
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("Manual sync failed:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

/**
 * Manual trigger for lead analysis (for testing). Restricted to super_admin.
 * Forces re-analysis of ALL leads regardless of lastAnalyzedAt.
 */
export const triggerAnalyzeLeads = onRequest({ cors: false, region: REGION, timeoutSeconds: 540, memory: "512MiB" }, async (req, res) => {
  try {
    const { role } = await resolveUserContextFromToken(req.headers.authorization);
    if (role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  console.log("[AnalyzeLeadsAgent] Manual trigger — analyzing ALL leads...");
  try {
    const leads = await getAllLeadsWithChatId();
    console.log(`[AnalyzeLeadsAgent] Found ${leads.length} leads with chatId`);

    let analyzed = 0;
    let skipped = 0;
    let errors = 0;
    const results: { docId: string; status: string; summary?: Record<string, unknown> }[] = [];

    for (const { docId, data: leadData } of leads) {
      try {
        const chatId = leadData.chatId as string;

        const conversation = await getConversationByChatId(chatId);
        if (!conversation || !conversation.history || conversation.history.length === 0) {
          skipped++;
          results.push({ docId, status: "skipped_no_conversation" });
          continue;
        }

        const hasUserMessages = conversation.history.some(h => h.role === "user" && h.text.trim());
        if (!hasUserMessages) {
          skipped++;
          results.push({ docId, status: "skipped_no_user_messages" });
          continue;
        }

        console.log(`[AnalyzeLeadsAgent] Analyzing lead ${docId} (chat: ${chatId})`);
        const summary = await summarizeLeadDetails(conversation);

        const analysisUpdate: {
          pets?: boolean;
          income?: number;
          paymentMethod?: "Contado" | "Hipoteca";
          notes?: string;
          name?: string;
        } = {};

        if (summary.pets !== undefined) analysisUpdate.pets = summary.pets;
        if (summary.income !== undefined) analysisUpdate.income = summary.income;
        if (summary.paymentMethod !== undefined) analysisUpdate.paymentMethod = summary.paymentMethod;
        if (summary.notes !== undefined) analysisUpdate.notes = summary.notes;
        if (summary.name !== undefined) analysisUpdate.name = summary.name;

        await updateLeadAnalysis(docId, analysisUpdate);
        analyzed++;
        results.push({ docId, status: "analyzed", summary: analysisUpdate as Record<string, unknown> });

        console.log(`[AnalyzeLeadsAgent] Updated lead ${docId}`);
      } catch (error) {
        errors++;
        results.push({ docId, status: "error", summary: { error: String(error) } });
        console.error(`[AnalyzeLeadsAgent] Error analyzing lead ${docId}:`, error);
      }
    }

    console.log(`[AnalyzeLeadsAgent] Complete. Analyzed: ${analyzed}, Skipped: ${skipped}, Errors: ${errors}`);
    res.status(200).json({ success: true, analyzed, skipped, errors, results });
  } catch (error) {
    console.error("[AnalyzeLeadsAgent] Fatal error:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// ==================== CREDITS & STRIPE FUNCTIONS ====================

/**
 * Get available conversation packages
 */
export const getPackages = onRequest({ cors: true, region: REGION }, async (_req, res) => {
  try {
    const packages = getConversationPackages();
    res.status(200).json({ packages });
  } catch (error) {
    console.error("Error getting packages:", error);
    res.status(500).json({ error: "Failed to get packages" });
  }
});

/**
 * Get user's conversation balance
 * Requires Authorization header with Firebase ID token
 */
export const getConversations = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  try {
    // Verify auth token
    const authHeader = req.headers.authorization;
    const ctx = await resolveUserContextFromToken(authHeader);
    const requestedOrgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
    const orgId = ctx.role === "super_admin" && requestedOrgId ? requestedOrgId : ctx.orgId;

    await requestContext.run({ orgId }, async () => {
      const balance = await getOrgConversationBalance();
      res.status(200).json({ balance });
    });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
});

type SubscriptionBillingInterval = "month" | "year";

/**
 * Map planId to the Stripe Price ID stored in environment variables
 */
// Nuevos Price IDs proporcionados
const STRIPE_PRICES = {
  month: {
    plus: "price_1TLLeVCXIAxi00WslhmS8iBo",
    pro: "price_1TLLfCCXIAxi00WsvsJgg2sB",
    pro_plus: "price_1TLLgWCXIAxi00WsqK4dIosW",
    extra: "price_1TLLo5CXIAxi00WsmOdzmaTC"
  },
  year: {
    plus: "price_1TLLl3CXIAxi00WsvKDacgj5",
    pro: "price_1TLLlWCXIAxi00WsiVzogPKo",
    pro_plus: "price_1TLLmFCXIAxi00Ws5WJMKj4k",
    extra: "price_1TLLvuCXIAxi00WsueKJHmrl"
  }
} as const;

function getPriceIdForPlan(planId: string, billingInterval: SubscriptionBillingInterval = "month"): string {
  if (billingInterval === "year") {
    const priceId = process.env[
      planId === "pro_plus" ? "STRIPE_PRO_PLUS_ANNUAL_PRICE_ID" :
      planId === "pro" ? "STRIPE_PRO_ANNUAL_PRICE_ID" : 
      "STRIPE_PLUS_ANNUAL_PRICE_ID"
    ]?.trim() || STRIPE_PRICES.year[planId as keyof typeof STRIPE_PRICES.year];
    
    if (!priceId || priceId.includes("REPLACE")) {
      throw new Error("Contratación anual no disponible para el plan solicitado.");
    }
    return priceId;
  }

  const priceId = process.env[
    planId === "pro_plus" ? "STRIPE_PRO_PLUS_PRICE_ID" :
    planId === "pro" ? "STRIPE_PRO_PRICE_ID" : 
    "STRIPE_PLUS_PRICE_ID"
  ]?.trim() || STRIPE_PRICES.month[planId as keyof typeof STRIPE_PRICES.month];
  
  if (!priceId || priceId.includes("REPLACE")) {
    throw new Error(`No valid Stripe Price ID for plan "${planId}".`);
  }
  return priceId;
}

function getExtraBlocksPriceId(billingInterval: SubscriptionBillingInterval = "month"): string {
  return billingInterval === "year" 
    ? process.env.STRIPE_EXTRA_ANNUAL_PRICE_ID?.trim() || STRIPE_PRICES.year.extra
    : process.env.STRIPE_EXTRA_MONTHLY_PRICE_ID?.trim() || STRIPE_PRICES.month.extra;
}

/**
 * Create a Stripe Checkout session for a recurring subscription plan.
 * Requires Authorization header with Firebase ID token.
 */
export const createSubscriptionCheckout = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: [
      "STRIPE_API_KEY",
      "STRIPE_PLUS_PRICE_ID",
      "STRIPE_PRO_PRICE_ID",
      "STRIPE_PRO_PLUS_PRICE_ID",
      "STRIPE_PLUS_ANNUAL_PRICE_ID",
      "STRIPE_PRO_ANNUAL_PRICE_ID",
      "STRIPE_PRO_PLUS_ANNUAL_PRICE_ID",
    ],
  },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { planId, successUrl, cancelUrl, billingInterval: rawBilling, extraBlocks = 0 } = req.body as {
          planId?: string;
          successUrl?: string;
          cancelUrl?: string;
          billingInterval?: string;
          extraBlocks?: number;
        };

        if (!planId || !successUrl || !cancelUrl) {
          res.status(400).json({ error: "planId, successUrl, and cancelUrl are required" });
          return;
        }

        if (!["plus", "pro", "pro_plus"].includes(planId)) {
          res.status(400).json({ error: `Invalid planId: ${planId}. Must be one of: plus, pro, pro_plus` });
          return;
        }

        const billingInterval: SubscriptionBillingInterval =
          rawBilling === "year" ? "year" : "month";

        const basePriceId = getPriceIdForPlan(planId, billingInterval);
        const extraPriceId = getExtraBlocksPriceId(billingInterval);
        
        const lineItems: any[] = [
          {
            price: basePriceId,
            quantity: 1
          }
        ];

        if (extraBlocks > 0) {
          lineItems.push({
            price: extraPriceId,
            quantity: extraBlocks
          });
        }

        const session = await createSubscriptionCheckoutSession(
          orgId,
          planId,
          lineItems,
          extraBlocks,
          successUrl,
          cancelUrl
        );
        console.log(`[createSubscriptionCheckout] Created session for org: ${orgId}, plan: ${planId}`);

        res.status(200).json({ sessionId: session.sessionId, url: session.url });
      });
    } catch (error) {
      console.error("Error creating subscription checkout:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create subscription checkout" });
    }
  }
);

/**
 * Get the current subscription for the org.
 * Returns planId, status, and currentPeriodEnd.
 * Requires Authorization header with Firebase ID token.
 */
export const getSubscription = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization;
    const ctx = await resolveUserContextFromToken(authHeader);
    const requestedOrgId = typeof req.query.orgId === "string" ? req.query.orgId : "";
    const orgId = ctx.role === "super_admin" && requestedOrgId ? requestedOrgId : ctx.orgId;

    await requestContext.run({ orgId }, async () => {
      const sub = await getOrgSubscription(orgId);

      // Cuenta los anuncios activos de la org (a nivel de organización, con
      // privilegios admin) para que la UI pueda aplicar el tope por plan también
      // a usuarios con rol agente, que desde el cliente solo ven los suyos.
      const countActiveListings = async (): Promise<number> => {
        const DATABASE_ID = "realestate-whatsapp-bot";
        const db = getFirestore(admin.app(), DATABASE_ID);
        const countSnap = await db
          .collection(`organizations/${orgId}/listings`)
          .where("isActive", "==", true)
          .count()
          .get();
        return countSnap.data().count;
      };

      // Empaqueta los campos de tope de anuncios activos. Infinity (Enterprise)
      // no se serializa en JSON, así que va como null + flag explícito.
      const listingLimitFields = (planId: SubscriptionPlanId, activeListingsCount: number) => {
        const max = getMaxActiveListings(planId);
        const activeListingsUnlimited = !Number.isFinite(max);
        return {
          activeListingsCount,
          maxActiveListings: activeListingsUnlimited ? null : max,
          activeListingsUnlimited,
        };
      };

      if (!sub) {
        // No Stripe subscription. Only treat as Free if the org explicitly activated it.
        const DATABASE_ID = "realestate-whatsapp-bot";
        const db = getFirestore(admin.app(), DATABASE_ID);
        const orgSnap = await db.collection("organizations").doc(orgId).get();
        const plan = orgSnap.exists ? orgSnap.data()?.plan : undefined;
        if (plan === "free") {
          const activeListingsCount = await countActiveListings();
          res.status(200).json({
            planId: "free",
            status: "active",
            currentPeriodEnd: null,
            contractedConversations: PLAN_BASE_CONVERSATIONS["free"],
            ...listingLimitFields("free", activeListingsCount),
          });
          return;
        }
        res.status(404).json({ error: "No active subscription" });
        return;
      }

      const baseConversations = PLAN_BASE_CONVERSATIONS[sub.planId] ?? 0;
      const contractedConversations = baseConversations + (sub.extraBlocks ?? 0) * 40;
      const activeListingsCount = await countActiveListings();

      res.status(200).json({
        planId: sub.planId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        contractedConversations,
        billingInterval: sub.billingInterval || "month",
        stripeSubscriptionId: sub.stripeSubscriptionId,
        extraBlocks: sub.extraBlocks || 0,
        ...listingLimitFields(sub.planId, activeListingsCount),
      });
    });
  } catch (error) {
    console.error("Error getting subscription:", error);
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

/**
 * Create a Stripe Billing Portal session for managing subscriptions
 */
export const createBillingPortalSession = onRequest(
  { cors: true, region: REGION, secrets: ["STRIPE_API_KEY"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const authHeader = req.headers.authorization;
      const ctx = await resolveUserContextFromToken(authHeader);

      const { returnUrl, orgId: requestedOrgId } = req.body as { returnUrl?: string; orgId?: string };
      const orgId = ctx.role === "super_admin" && typeof requestedOrgId === "string" && requestedOrgId ? requestedOrgId : ctx.orgId;

      await requestContext.run({ orgId }, async () => {
        if (!returnUrl) {
          res.status(400).json({ error: "returnUrl is required" });
          return;
        }
        const customerId = await getOrgStripeCustomerId(orgId);
        if (!customerId) {
          res.status(400).json({ error: "No Stripe customer found for this organization" });
          return;
        }
        const session = await createBillingPortalSessionService(orgId, customerId, returnUrl);
        console.log(`[createBillingPortalSession] Created portal for org: ${orgId}`);
        res.status(200).json({ url: session.url });
      });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create billing portal session" });
    }
  }
);

/**
 * Create a Stripe Checkout session for purchasing credits
 */
export const createStripeCheckout = onRequest({ cors: WEB_CLIENT_CORS, region: REGION, secrets: ["STRIPE_API_KEY", STRIPE_PRICE_TOPUP_40_CONVS] }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const decodedToken = await admin.auth().verifyIdToken(authHeader?.split("Bearer ")[1] || "");
      const userId = decodedToken.uid;

      const { packageId, successUrl, cancelUrl, quantity: rawQty } = req.body as {
        packageId?: string;
        successUrl?: string;
        cancelUrl?: string;
        quantity?: number;
      };

      if (!packageId || !successUrl || !cancelUrl) {
        res.status(400).json({ error: "packageId, successUrl, and cancelUrl are required" });
        return;
      }

      if (packageId === "extra_40") {
        const sub = await getOrgSubscription(orgId);
        const subPlanId = sub?.planId ?? "none";
        const hasActivePaidSub = sub?.status === "active" && subPlanId !== "free" && subPlanId !== "none";
        if (!hasActivePaidSub) {
          res.status(403).json({ error: "Active paid plan required to purchase extra packs" });
          return;
        }
      }

      const parsedQty =
        rawQty === undefined || rawQty === null
          ? 1
          : typeof rawQty === "number"
            ? rawQty
            : parseInt(String(rawQty), 10);
      const quantity = Number.isFinite(parsedQty) ? Math.floor(parsedQty) : 1;

      const activeOrgId = getActiveOrgId();
      const existingCustomerId = await getOrgStripeCustomerId(activeOrgId);
      const session = await createCheckoutSession(
        userId,
        orgId,
        packageId,
        successUrl,
        cancelUrl,
        existingCustomerId ?? undefined,
        quantity,
        packageId === "extra_40" ? STRIPE_PRICE_TOPUP_40_CONVS.value() : undefined
      );
      console.log(`[createStripeCheckout] Created checkout for org: ${orgId}, user: ${userId}`);

      res.status(200).json({
        sessionId: session.sessionId,
        url: session.url,
      });
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create checkout session" });
  }
});

/**
 * Persist auto-recharge preferences for the org.
 */
export const saveAutoRechargeSettings = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const body = req.body as {
        enabled?: boolean;
        thresholdConversations?: number;
        rechargeConversations?: number;
      };
      if (typeof body.enabled !== "boolean") {
        res.status(400).json({ error: "enabled (boolean) is required" });
        return;
      }

      await saveOrgAutoRechargeSettings(orgId, {
        enabled: body.enabled,
        thresholdConversations: typeof body.thresholdConversations === "number" ? body.thresholdConversations : 20,
        rechargeConversations: typeof body.rechargeConversations === "number" ? body.rechargeConversations : 40,
      });
      console.log(`[saveAutoRechargeSettings] Settings saved for org: ${orgId}`);
      res.status(200).json({ ok: true });
    });
  } catch (error) {
    console.error("saveAutoRechargeSettings:", error);
    res.status(500).json({ error: "Failed to save auto-recharge settings" });
  }
});

/**
 * Read auto-recharge preferences (and whether a card is on file).
 */
export const getAutoRechargeSettings = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authHeader = req.headers.authorization;
    const orgId = await resolveOrgIdFromToken(authHeader);

    await requestContext.run({ orgId }, async () => {
      const settings = await getOrgAutoRechargeSettingsForApi(getActiveOrgId());
      res.status(200).json(settings);
    });
  } catch (error) {
    console.error("getAutoRechargeSettings:", error);
    res.status(500).json({ error: "Failed to get auto-recharge settings" });
  }
});

/**
 * Preview a subscription change (proration)
 */
export const previewSubscriptionChange = onRequest(
  { cors: true, region: REGION, secrets: ["STRIPE_API_KEY", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { newPlanId, newExtraBlocks } = req.body as {
          newPlanId: SubscriptionPlanId;
          newExtraBlocks: number;
          billingInterval: "month" | "year";
        };

        const activeOrgId = getActiveOrgId();
        const sub = await getOrgSubscription(activeOrgId);
        const subId = sub?.stripeSubscriptionId;

        const priceId = process.env[`STRIPE_${newPlanId.toUpperCase()}_PRICE_ID`]?.trim();
        if (!priceId) {
          res.status(400).json({ error: `Price ID for plan ${newPlanId} not found` });
          return;
        }

        const oldBaseConvs = PLAN_BASE_CONVERSATIONS[sub?.planId || "free"] ?? 0;
        const newBaseConvs = PLAN_BASE_CONVERSATIONS[newPlanId] ?? 0;
        const oldContracted = oldBaseConvs + (sub?.extraBlocks ?? 0) * 40;
        const newContracted = newBaseConvs + newExtraBlocks * 40;

        const oldRank = PLAN_RANKS[sub?.planId || "free"] ?? 0;
        const newRank = PLAN_RANKS[newPlanId] ?? 0;
        
        // Upgrade if:
        // 1. Moving to a higher tier plan (e.g. Plus -> Pro)
        // 2. Staying on same plan but increasing total contracted conversations (e.g. adding extra blocks)
        const isUpgrade = newRank > oldRank || (newRank === oldRank && newContracted > oldContracted);

        if (!subId || subId.startsWith("manual_")) {
          res.status(200).json({
            proratedAmountCents: 0,
            renewalDate: sub?.currentPeriodEnd?.toMillis() || Date.now(),
            isUpgrade,
            currentConversations: oldContracted,
            newConversations: newContracted,
            newMonthlyPrice: SUBSCRIPTION_BASE_PRICES[newPlanId] + newExtraBlocks * 10,
            newPlanId,
            proratedConversations: 0,
          });
          return;
        }

        const billingInterval = (req.body as any).billingInterval === "year" ? "year" : "month";
        const extraPriceId = getExtraBlocksPriceId(billingInterval);
        
        const newItems = [{ price: priceId, quantity: 1 }];
        if (newExtraBlocks > 0) {
          newItems.push({ price: extraPriceId, quantity: newExtraBlocks });
        }

        const preview = await previewSubscriptionProration(subId, newItems);

        const proratedConvs = isUpgrade
          ? calculateProratedConversations(oldContracted, newContracted, preview.periodEnd * 1000)
          : 0;

        res.status(200).json({
          proratedAmountCents: preview.amountDue,
          renewalDate: preview.periodEnd * 1000,
          isUpgrade,
          currentConversations: oldContracted,
          newConversations: newContracted,
          newMonthlyPrice: SUBSCRIPTION_BASE_PRICES[newPlanId] + (newPlanId === "free" ? 0 : newExtraBlocks * 10),
          newPlanId,
          proratedConversations: proratedConvs,
        });
      });
    } catch (error) {
      console.error("Error previewing subscription change:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to preview subscription change" });
    }
  }
);

/**
 * Update an existing subscription (upgrade/downgrade)
 */
export const updateSubscriptionPlan = onRequest(
  { cors: true, region: REGION, secrets: ["STRIPE_API_KEY", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID"] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const authHeader = req.headers.authorization;
      const orgId = await resolveOrgIdFromToken(authHeader);

      await requestContext.run({ orgId }, async () => {
        const { newPlanId, newExtraBlocks, billingInterval } = req.body as {
          newPlanId: SubscriptionPlanId;
          newExtraBlocks: number;
          billingInterval: "month" | "year";
        };

        const activeOrgId = getActiveOrgId();
        const sub = await getOrgSubscription(activeOrgId);
        const subId = sub?.stripeSubscriptionId;
        if (!subId || subId.startsWith("manual_")) {
          res.status(400).json({ 
            error: "Your current subscription is manual and cannot be updated directly through Stripe. Please contact support or start a new plan.",
            code: "MANUAL_SUBSCRIPTION"
          });
          return;
        }

        const priceKey = `STRIPE_${newPlanId.toUpperCase()}_PRICE_ID`;
        const priceId = process.env[priceKey]?.trim();
        if (!priceId) {
          res.status(400).json({ error: `Price mapping not found for ${newPlanId}` });
          return;
        }

        const extraPriceId = getExtraBlocksPriceId(billingInterval);
        
        const newItems = [{ price: priceId, quantity: 1 }];
        if (newExtraBlocks > 0) {
          newItems.push({ price: extraPriceId, quantity: newExtraBlocks });
        }

        const oldBaseConvs = PLAN_BASE_CONVERSATIONS[sub.planId] ?? 0;
        const newBaseConvs = PLAN_BASE_CONVERSATIONS[newPlanId] ?? 0;
        const oldContracted = oldBaseConvs + (sub.extraBlocks ?? 0) * 40;
        const newContracted = newBaseConvs + newExtraBlocks * 40;
        const oldRank = PLAN_RANKS[sub.planId] ?? 0;
        const newRank = PLAN_RANKS[newPlanId] ?? 0;
        const isUpgrade = newRank > oldRank || (newRank === oldRank && newContracted > oldContracted);

        const updatedSub = await updateExistingSubscription(
          sub.stripeSubscriptionId,
          newItems,
          isUpgrade
        );

        // Update Firestore subscription record
        const updatedPeriodEnd = (updatedSub as any).items?.data?.[0]?.current_period_end ?? 0;
        await setOrgSubscription(activeOrgId, {
          planId: newPlanId as SubscriptionPlanId,
          stripeSubscriptionId: updatedSub.id,
          stripeCustomerId: typeof updatedSub.customer === "string" ? updatedSub.customer : updatedSub.customer?.id ?? sub.stripeCustomerId,
          status: "active",
          currentPeriodEnd: admin.firestore.Timestamp.fromMillis(updatedPeriodEnd * 1000),
          extraBlocks: newExtraBlocks,
          billingInterval,
        } as any);

        // For upgrades: grant prorated conversations immediately
        if (isUpgrade && newContracted > oldContracted) {
          const proratedConvs = calculateProratedConversations(
            oldContracted,
            newContracted,
            updatedPeriodEnd * 1000
          );
          if (proratedConvs > 0) {
            await addOrgConversations(
              proratedConvs,
              `Actualización de plan: +${proratedConvs} conversaciones prorrateadas (${sub.planId} → ${newPlanId})`,
              activeOrgId,
              { eventType: "subscription_grant" }
            );
          }
        }

        res.status(200).json({
          success: true,
          message: isUpgrade ? "Suscripción actualizada correctamente." : "Tu suscripción se actualizará al finalizar el periodo actual.",
        });
      });
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update subscription" });
    }
  }
);

/**
 * Stripe webhook handler for payment events
 * Called by Stripe when payment succeeds, fails, etc.
 */
export const stripeWebhook = onRequest({
  cors: false,
  region: REGION,
  secrets: ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PLUS_PRICE_ID", "STRIPE_PRO_PRICE_ID", "STRIPE_PRO_PLUS_PRICE_ID", TWILIO_API_KEY, TWILIO_API_SECRET],
}, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event;
    try {
      event = constructWebhookEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    console.log(`Stripe webhook received: ${event.type}`);

    // Handle the event
    switch (event.type) {
      // ── One-time credit top-up ─────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.metadata?.orgId ?? getActiveOrgId();

        if (session.mode === "subscription") {
          // Subscription checkout: record the subscription in Firestore.
          // Credits are granted via invoice.paid (fired immediately after for the first invoice).
          const planId = (session.metadata?.planId ?? "free") as SubscriptionPlanId;
          const subscriptionId = extractStripeId(session.subscription);
          const customerId = extractStripeId(session.customer);

          await setOrgSubscription(orgId, {
            planId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: "active",
          });
          console.log(`Subscription checkout completed for org ${orgId}, plan ${planId}`);

        } else {
          // One-time payment: add to org balance (same ledger as getConversations / deductOrgConversations)
          const userId = session.metadata?.userId;
          const conversations = parseInt(session.metadata?.conversations || "0", 10);

          if (conversations > 0) {
            const newBalance = await addOrgConversations(
              conversations,
              `Compra de ${conversations} conversaciones${userId ? ` (uid ${userId})` : ""} · session ${session.id}`,
              orgId,
              { eventType: "manual_purchase", actorUid: userId, stripeReference: session.id }
            );
            console.log(`Added ${conversations} org conversations for ${orgId}. New balance: ${newBalance}`);
          } else {
            console.warn("One-time checkout completed but missing conversations metadata:", session.metadata);
          }
        }

        try {
          const billing = await extractBillingFromCheckoutSession(session.id);
          if (billing) {
            await mergeOrgStripeBillingFields(
              orgId,
              billing.stripeCustomerId,
              billing.stripeDefaultPaymentMethodId
            );
            console.log(`[stripeWebhook] Saved Stripe customer/PM for org ${orgId}`);
          }
        } catch (billingErr) {
          console.error("[stripeWebhook] extractBillingFromCheckoutSession:", billingErr);
        }
        break;
      }

      // ── Subscription upgrade/downgrade handling ─────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const subMeta = asRecord((sub as any).metadata);
        const orgId: string = (subMeta.orgId as string) || getActiveOrgId();
        const planId = ((subMeta.planId as string) || "free") as SubscriptionPlanId;
        const statusRaw = typeof (sub as any).status === "string" ? (sub as any).status : "active";
        const status =
          statusRaw === "active" || statusRaw === "past_due" || statusRaw === "canceled" || statusRaw === "trialing"
            ? statusRaw
            : "active";
        const currentPeriodEnd = (sub as any).current_period_end ?? (sub as any).items?.data?.[0]?.current_period_end;

        if (!orgId) {
          console.error("[stripeWebhook] Missing orgId in metadata for subscription update");
          res.status(400).json({ error: "Missing orgId metadata" });
          return;
        }

        await setOrgSubscription(orgId, {
          planId,
          stripeSubscriptionId: typeof (sub as any).id === "string" ? (sub as any).id : "",
          stripeCustomerId: extractStripeId((sub as any).customer),
          status,
          currentPeriodEnd: currentPeriodEnd
            ? admin.firestore.Timestamp.fromMillis(currentPeriodEnd * 1000)
            : undefined,
        } as any);
        console.log(`Subscription updated for org ${orgId}: plan=${planId}, status=${status}`);
        break;
      }

      // ── Monthly conversation grant (first payment + all renewals) ────────
      case "invoice.paid": {
        const invoice = asRecord(event.data.object);
        // Only process subscription invoices
        if (!invoice.subscription) {
          console.log("invoice.paid: skipping, no subscription attached");
          break;
        }

        const invoiceId: string = typeof invoice.id === "string" ? invoice.id : "";
        // planId is stored on the subscription metadata
        const subscriptionDetails = asRecord(invoice.subscription_details);
        const subMeta = asRecord(subscriptionDetails.metadata);
        const lines = asRecord(invoice.lines);
        const linesData = Array.isArray(lines.data) ? lines.data : [];
        const line0 = linesData.length > 0 ? asRecord(linesData[0]) : {};
        const line0Meta = asRecord(line0.metadata);

        const planId = ((subMeta.planId as string) || (line0Meta.planId as string) || "free") as SubscriptionPlanId;

        const orgId: string = (subMeta.orgId as string) || getActiveOrgId();
        const extraBlocks = parseInt((subMeta.extraBlocks as string) || "0", 10);

        if (!PLAN_BASE_CONVERSATIONS[planId]) {
          console.warn(`invoice.paid: unknown planId "${planId}" on invoice ${invoiceId}`);
          break;
        }

        await grantSubscriptionConversations(orgId, planId, invoiceId, extraBlocks);
        break;
      }



      // ── Cancellation / expiry ──────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = asRecord(event.data.object);
        const subMeta = asRecord(sub.metadata);
        const orgId: string = (subMeta.orgId as string) || getActiveOrgId();

        await setOrgSubscription(orgId, {
          planId: "free",
          stripeSubscriptionId: typeof sub.id === "string" ? sub.id : "",
          stripeCustomerId: extractStripeId(sub.customer),
          status: "canceled",
        });
        console.log(`Subscription cancelled for org ${orgId}. Reverted to free plan.`);
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object as { id: string; metadata?: Record<string, string> };
        if (pi.metadata?.source !== "auto_recharge") {
          break;
        }
        const oid = pi.metadata?.orgId;
        const credits = parseInt(pi.metadata?.credits || "0", 10);
        if (!oid || credits <= 0) {
          break;
        }
        await addOrgConversationsForPaymentIntentOnce(oid, credits, pi.id, "Auto-compra conversaciones");
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as any;
        const orgId = pi.metadata?.orgId ?? getActiveOrgId();
        const amount = `${(pi.amount / 100).toFixed(2)}€`;
        console.warn(`Payment failed for org ${orgId}: ${pi.id}, ${pi.last_payment_error?.message}`);
        
        await sendPaymentFailedNotification(orgId, amount).catch(e => 
          console.error("Failed to send payment failed notification:", e)
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

/**
 * Ignore a chat for sync alerts
 */
export const ignoreChatForSync = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { chatId } = req.body;
  if (!chatId) {
    res.status(400).json({ error: "chatId is required" });
    return;
  }

  try {
    await ignoreChat(chatId);
    res.status(200).json({ success: true, message: `Chat ${chatId} ignored` });
  } catch (error) {
    console.error("Error ignoring chat:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Returns the status of each known alert type (last seen + counters).
 * Used by the Alerts UI to show a "system status" panel.
 */
export const getAlertCatalogStatus = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Require an authenticated org manager. Previously this only used
    // getActiveOrgId() from AsyncLocalStorage, which is empty for unauth
    // calls — the endpoint would error out but still reveal that it exists.
    // Make the access control explicit.
    const callerCtx = await resolveUserContextFromToken(req.headers.authorization);
    if (callerCtx.role !== "owner" && callerCtx.role !== "admin" && callerCtx.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const databaseId = "realestate-whatsapp-bot";
    const orgId = callerCtx.orgId || getActiveOrgId();
    if (!orgId) {
      res.status(400).json({ error: "Missing organization context" });
      return;
    }
    const db = getFirestore(admin.app(), databaseId);
    const alertsRef = db.collection("organizations").doc(orgId).collection("system_alerts");
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");

    const scanLimit = Math.max(50, Math.min(1500, parseInt(String(req.query.limit || "500"), 10) || 500));
    const now = Date.now();
    const since24hMs = now - 24 * 60 * 60 * 1000;

    const settingsSnap = await settingsRef.get();
    const enabledByKey = (settingsSnap.exists ? (settingsSnap.data()?.enabledByKey as Record<string, boolean> | undefined) : undefined) || {};
    const lastCheckByKey =
      (settingsSnap.exists ? (settingsSnap.data()?.lastCheckByKey as Record<string, unknown> | undefined) : undefined) || {};

    const snapshot = await alertsRef.orderBy("timestamp", "desc").limit(scanLimit).get();

    type Row = {
      key: string;
      subject: string;
      description: string;
      autoTest: { kind: "event" } | { kind: "schedule"; every: string };
      enabled: boolean;
      lastSeverity: string | null;
      lastMessage: string | null;
      lastTimestampMs: number | null;
      countLast24h: number;
    };

    const rowsByKey = new Map<string, Row>();
    for (const item of ALERT_CATALOG) {
      rowsByKey.set(item.key, {
        key: item.key,
        subject: item.subject,
        description: item.description,
        autoTest: item.autoTest,
        enabled: enabledByKey[item.key] !== false,
        lastSeverity: null,
        lastMessage: null,
        lastTimestampMs: null,
        countLast24h: 0,
      });
    }

    const matchKeyForSubject = (subject: string): string | null => {
      if (!subject) return null;
      if (subject.startsWith("STATUS REPORT:")) return "status_report";
      const exact = ALERT_CATALOG.find(a => a.subject === subject);
      return exact ? exact.key : null;
    };

    snapshot.forEach((snapDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = snapDoc.data() as {
        subject?: string;
        message?: string;
        severity?: string;
        timestamp?: admin.firestore.Timestamp;
      };
      const subject = String(data.subject || "");
      const key = matchKeyForSubject(subject);
      if (!key) return;

      const row = rowsByKey.get(key);
      if (!row) return;

      const tsMs =
        data.timestamp && typeof (data.timestamp as any).toMillis === "function"
          ? (data.timestamp as any).toMillis()
          : null;

      if (tsMs !== null && tsMs >= since24hMs) {
        row.countLast24h += 1;
      }

      if (row.lastTimestampMs === null && tsMs !== null) {
        row.lastTimestampMs = tsMs;
        row.lastSeverity = data.severity ? String(data.severity) : null;
        row.lastMessage = data.message ? String(data.message) : null;
      }
    });

    // Merge in last health-check results (even when no alert was emitted).
    for (const [key, rawCheck] of Object.entries(lastCheckByKey)) {
      const row = rowsByKey.get(key);
      if (!row) continue;
      const check = rawCheck as any;
      const checkedAtMs = typeof check?.checkedAtMs === "number" ? (check.checkedAtMs as number) : null;
      if (checkedAtMs == null) continue;

      const status = typeof check?.status === "string" ? check.status : "";
      const details = check?.details;
      const message =
        status === "ok"
          ? "Health-check OK"
          : status
            ? `Health-check ${status}`
            : "Health-check";

      // "Última vez" should reflect last test time (not last failure alert).
      row.lastTimestampMs = checkedAtMs;
      row.lastMessage = message;
      if (status === "ok") {
        row.lastSeverity = "healthy";
      } else if (status) {
        // For failures, default to warning.
        row.lastSeverity = "warning";
      }

      // If we have details, keep them as lastMessage in a compact way.
      if (details != null) {
        try {
          const shortDetails = typeof details === "string" ? details : JSON.stringify(details);
          row.lastMessage = `${message}: ${shortDetails}`.slice(0, 280);
        } catch {
          // ignore details serialization errors
        }
      }
    }

    const rows = Array.from(rowsByKey.values());
    res.status(200).json({ rows, scanned: snapshot.size });
  } catch (error) {
    console.error("Error in getAlertCatalogStatus:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Enable/disable a specific alert type (by catalog key).
 */
export const setAlertEnabled = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = (req.body && typeof req.body === "object") ? (req.body as { key?: string; enabled?: boolean }) : {};
    const key = typeof body.key === "string" ? body.key.trim() : "";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

    if (!key || enabled === undefined) {
      res.status(400).json({ error: "key and enabled are required" });
      return;
    }

    if (!ALERT_CATALOG.some(a => a.key === key)) {
      res.status(400).json({ error: "Unknown alert key" });
      return;
    }

    const databaseId = "realestate-whatsapp-bot";
    const orgId = getActiveOrgId();
    const db = getFirestore(admin.app(), databaseId);
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");

    await settingsRef.set(
      {
        enabledByKey: {
          [key]: enabled,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ success: true, key, enabled });
  } catch (error) {
    console.error("Error in setAlertEnabled:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Run an on-demand check for a specific alert type.
 * Supports all keys in ALERT_CATALOG.
 */
export const runAlertCheck = onRequest({ cors: true, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Require authenticated manager. See getAlertCatalogStatus for the same
    // reasoning — getActiveOrgId() alone is not access control.
    const callerCtx = await resolveUserContextFromToken(req.headers.authorization);
    if (callerCtx.role !== "owner" && callerCtx.role !== "admin" && callerCtx.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = (req.body && typeof req.body === "object") ? (req.body as { key?: string }) : {};
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) {
      res.status(400).json({ error: "key is required" });
      return;
    }
    if (!ALERT_CATALOG.some(a => a.key === key)) {
      res.status(400).json({ error: "Unknown alert key" });
      return;
    }

    const checkedAt = new Date().toISOString();
    const checkedAtMsBase = Date.now();

    const databaseId = "realestate-whatsapp-bot";
    const orgId = callerCtx.orgId || getActiveOrgId();
    if (!orgId) {
      res.status(400).json({ error: "Missing organization context" });
      return;
    }
    const db = getFirestore(admin.app(), databaseId);
    const settingsRef = db.collection("organizations").doc(orgId).collection("system_config").doc("alert_settings");
    const alertsRef = db.collection("organizations").doc(orgId).collection("system_alerts");

    const persistLastCheck = async (params: { status: "ok" | "error"; details: any; checkedAtMs?: number }) => {
      try {
        await settingsRef.set(
          {
            lastCheckByKey: {
              [key]: {
                status: params.status,
                checkedAt,
                checkedAtMs: params.checkedAtMs ?? checkedAtMsBase,
                details: params.details ?? null,
              },
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn("Failed to persist lastCheckByKey for runAlertCheck:", e);
      }
    };

    // Guardrail: rate-limit per key to prevent spam.
    try {
      const settingsSnap = await settingsRef.get();
      const lastCheckByKey = (settingsSnap.exists ? (settingsSnap.data()?.lastCheckByKey as Record<string, any> | undefined) : undefined) || {};
      const lastMs = typeof lastCheckByKey?.[key]?.checkedAtMs === "number" ? (lastCheckByKey[key].checkedAtMs as number) : null;
      if (lastMs != null && checkedAtMsBase - lastMs < 60_000) {
        res.status(429).json({
          ok: false,
          key,
          error: "Rate limited: espera 60s antes de volver a ejecutar este check.",
        });
        return;
      }
    } catch (e) {
      // If rate-limit read fails, proceed with the check.
      console.warn("Rate-limit read failed, proceeding:", e);
    }

    if (
      key === "sync_failed" ||
      key === "sync_task_error"
    ) {
      const startedAt = Date.now();
      try {
        const result = await syncConversations({ silent: true });
        const ok = (result.errors?.length || 0) === 0;
        const details = {
          kind: "sync_health_check",
          synthetic: true,
          chatsChecked: result.chatsChecked,
          discrepanciesFound: result.discrepanciesFound,
          errors: result.errors,
          durationMs: Date.now() - startedAt,
        };

        await persistLastCheck({ status: ok ? "ok" : "error", details });

        if (ok) {
          res.status(200).json({ ok: true, key, status: "ok", checkedAt, details });
          return;
        }
        res.status(200).json({ ok: true, key, status: "error", checkedAt, details });
        return;
      } catch (e: any) {
        const details = { kind: "sync_health_check", synthetic: true, error: e?.message || String(e), durationMs: Date.now() - startedAt };
        await persistLastCheck({ status: "error", details });

        res.status(200).json({ ok: true, key, status: "error", checkedAt, details });
        return;
      }
    }

    if (key === "manual_test_alert") {
      // Synthetic check: verify we can write a test alert to Firestore (no email).
      const startedAt = Date.now();
      try {
        const docRef = await alertsRef.add({
          subject: "Prueba Manual de Alerta",
          message: "Synthetic check OK (Firestore write).",
          details: { synthetic: true, kind: "manual_test_alert", checkedAt },
          severity: "info",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          resolved: true,
        });
        const details = {
          kind: "manual_test_alert_check",
          synthetic: true,
          wroteToFirestore: true,
          alertId: docRef.id,
          durationMs: Date.now() - startedAt,
        };
        await persistLastCheck({ status: "ok", details });
        res.status(200).json({ ok: true, key, status: "ok", checkedAt, details });
        return;
      } catch (e: any) {
        const details = {
          kind: "manual_test_alert_check",
          synthetic: true,
          wroteToFirestore: false,
          error: e?.message || String(e),
          durationMs: Date.now() - startedAt,
        };
        await persistLastCheck({ status: "error", details });
        res.status(200).json({ ok: true, key, status: "error", checkedAt, details });
        return;
      }
    }

    // Default synthetic check: look for occurrences of this alert in the last 6 hours.
    const windowHours = 6;
    const sinceMs = Date.now() - windowHours * 60 * 60 * 1000;
    const catalogItem = ALERT_CATALOG.find((a) => a.key === key);
    const subject = catalogItem?.subject || "";

    const recentSnapshot = await alertsRef.orderBy("timestamp", "desc").limit(200).get();
    const recentMatches: Array<{ subject: string; message: string; severity: string; timestampMs: number; id: string }> = [];
    recentSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const tsMs =
        data.timestamp && typeof data.timestamp?.toMillis === "function"
          ? (data.timestamp.toMillis() as number)
          : null;
      if (tsMs == null || tsMs < sinceMs) return;
      const s = String(data.subject || "");
      const isMatch = key === "status_report" ? s.startsWith("STATUS REPORT:") : s === subject;
      if (!isMatch) return;
      recentMatches.push({
        id: docSnap.id,
        subject: s,
        message: String(data.message || ""),
        severity: String(data.severity || ""),
        timestampMs: tsMs,
      });
    });

    const ok = recentMatches.length === 0;
    const details = {
      kind: "recent_occurrence_check",
      synthetic: true,
      windowHours,
      sinceMs,
      subject,
      recentCount: recentMatches.length,
      examples: recentMatches.slice(0, 5),
    };
    await persistLastCheck({ status: ok ? "ok" : "error", details });

    res.status(200).json({ ok: true, key, status: ok ? "ok" : "error", checkedAt, details });
  } catch (error) {
    console.error("Error in runAlertCheck:", error);
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Get audit logs with optional filtering
 */
export const getAuditLogs = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { entityType, entityId, action, userId, isSystemAction, limit } = req.query;

    const allowedEntityTypes: AuditEntityType[] = [
      "lead",
      "conversation",
      "listing",
      "qualified_lead",
      "system_config",
    ];
    const allowedActions: AuditAction[] = [
      "create",
      "update",
      "delete",
      "status_change",
      "bot_toggle",
      "message_sent",
      "qualification_change",
    ];

    const entityTypeValue =
      typeof entityType === "string" && allowedEntityTypes.includes(entityType as AuditEntityType)
        ? (entityType as AuditEntityType)
        : undefined;
    const actionValue =
      typeof action === "string" && allowedActions.includes(action as AuditAction)
        ? (action as AuditAction)
        : undefined;

    const logs = await getAuditLogsFromService({
      entityType: entityTypeValue,
      entityId: entityId as string | undefined,
      action: actionValue,
      userId: userId as string | undefined,
      isSystemAction: isSystemAction === "true" ? true : isSystemAction === "false" ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.status(200).json({ logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: String(error) });
  }
});
/**
 * Get all system users from Firebase Auth
 */
export const getSystemUsers = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { role } = await resolveUserContextFromToken(req.headers.authorization);
    if (role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const listUsersResult = await admin.auth().listUsers(1000);
    const users = listUsersResult.users.map((userRecord) => ({
      uid: userRecord.uid,
      email: userRecord.email || "",
      displayName: userRecord.displayName || "",
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
    }));

    res.status(200).json({ users });
  } catch (error) {
    console.error("Error fetching system users:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ==================== TEAM INVITATIONS ====================

function randomInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function normalizeInviteRole(role: unknown): "admin" | "member" | "agent" {
  if (role === "admin" || role === "agent") return role;
  return "member";
}

function parseEditableTeamRole(role: unknown): "admin" | "member" | "agent" | null {
  if (role === "admin" || role === "agent" || role === "member") return role;
  return null;
}

export const sendInvitation = onRequest({ cors: WEB_CLIENT_CORS, region: REGION, secrets: [TWILIO_API_KEY, TWILIO_API_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { uid, orgId, role: requesterRole } = await resolveUserContextFromToken(req.headers.authorization);
    if (requesterRole !== "owner" && requesterRole !== "admin" && requesterRole !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const emailRaw = typeof req.body?.email === "string" ? req.body.email : "";
    const nameRaw = typeof req.body?.name === "string" ? req.body.name : "";
    const email = emailRaw.trim().toLowerCase();
    const name = nameRaw.trim();
    const inviteRole = normalizeInviteRole(req.body?.role);

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "Invalid name" });
      return;
    }

    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);

    const orgSnap = await db.collection("organizations").doc(orgId).get();
    const orgName = organizationDisplayNameFromOrgDoc({
      orgId,
      exists: orgSnap.exists,
      data: orgSnap.data(),
      fallback: "Proplead",
    });

    const inviterSnap = await db.collection("users").doc(uid).get();
    const inviterName = inviterSnap.exists ? (inviterSnap.data()?.name || inviterSnap.data()?.email || "Equipo Proplead") : "Equipo Proplead";

    const token = randomInviteToken();
    const now = Date.now();
    const expiresAtMs = now + 7 * 24 * 60 * 60 * 1000;

    await db.collection("invitations").doc(token).set({
      orgId,
      email,
      name,
      role: inviteRole,
      status: "pending",
      invitedBy: uid,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
    });

    await sendInvitationNotification({
      email,
      name,
      orgName,
      inviterName,
      token,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("sendInvitation error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export const updateTeamMember = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { uid, orgId, role: requesterRole } = await resolveUserContextFromToken(req.headers.authorization);
    if (requesterRole !== "owner" && requesterRole !== "admin" && requesterRole !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const requestedOrgId = typeof req.body?.orgId === "string" ? req.body.orgId.trim() : "";
    const targetOrgId = requesterRole === "super_admin" ? requestedOrgId : orgId;
    const targetUid = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const qualifiedLeadNotificationNumbers =
      typeof req.body?.qualifiedLeadNotificationNumbers === "string"
        ? req.body.qualifiedLeadNotificationNumbers.trim()
        : "";

    if (!targetOrgId) {
      res.status(400).json({ error: "Missing organization" });
      return;
    }
    if (requesterRole !== "super_admin" && requestedOrgId && requestedOrgId !== orgId) {
      res.status(403).json({ error: "Forbidden organization" });
      return;
    }
    if (!targetUid) {
      res.status(400).json({ error: "Missing user" });
      return;
    }
    if (!name) {
      res.status(400).json({ error: "Invalid name" });
      return;
    }

    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);
    const targetRef = db.collection("users").doc(targetUid);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const targetData = targetSnap.data() || {};
    const currentTargetOrgId = typeof targetData.orgId === "string" ? targetData.orgId : "";
    const currentTargetRole = typeof targetData.role === "string" ? targetData.role : "";

    if (currentTargetOrgId !== targetOrgId) {
      res.status(403).json({ error: "User does not belong to this organization" });
      return;
    }

    const isProtectedTarget = currentTargetRole === "owner" || currentTargetRole === "super_admin";
    if (isProtectedTarget && requesterRole !== "super_admin") {
      res.status(403).json({ error: "Protected role cannot be edited" });
      return;
    }

    let resolvedNextRole: "admin" | "member" | "agent" | "owner" | "super_admin";
    if (isProtectedTarget && requesterRole === "super_admin") {
      const bodyRole = typeof req.body?.role === "string" ? req.body.role.trim() : "";
      if (bodyRole !== currentTargetRole) {
        res.status(400).json({ error: "Role cannot be changed for this user" });
        return;
      }
      resolvedNextRole = currentTargetRole as "owner" | "super_admin";
    } else {
      const parsed = parseEditableTeamRole(req.body?.role);
      if (!parsed) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      resolvedNextRole = parsed;
    }

    if (targetUid === uid && resolvedNextRole !== currentTargetRole) {
      res.status(403).json({ error: "You cannot change your own role" });
      return;
    }

    await targetRef.set(
      {
        name,
        role: resolvedNextRole,
        qualifiedLeadNotificationNumbers: resolvedNextRole === "member" ? "" : qualifiedLeadNotificationNumbers,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("updateTeamMember error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export const getInvitationPreview = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "Missing token" });
      return;
    }

    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);
    const invRef = db.collection("invitations").doc(token);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    const inv = invSnap.data() || {};
    const invEmail = typeof inv.email === "string" ? inv.email.trim().toLowerCase() : "";
    const invOrgId = typeof inv.orgId === "string" ? inv.orgId.trim() : "";
    const invRole = normalizeInviteRole(inv.role);
    const status = typeof inv.status === "string" ? inv.status : "pending";
    const expiresAtIso = typeof inv.expiresAt === "string" ? inv.expiresAt : "";
    const expiresAt = expiresAtIso ? Date.parse(expiresAtIso) : 0;

    if (!invOrgId) {
      res.status(400).json({ error: "Invalid invitation" });
      return;
    }
    if (status !== "pending") {
      res.status(400).json({ error: "Invitation already used" });
      return;
    }
    if (expiresAt && Date.now() > expiresAt) {
      await invRef.set({ status: "expired" }, { merge: true });
      res.status(400).json({ error: "Invitation expired" });
      return;
    }

    const orgSnap = await db.collection("organizations").doc(invOrgId).get();
    const orgName = organizationDisplayNameFromOrgDoc({
      orgId: invOrgId,
      exists: orgSnap.exists,
      data: orgSnap.data(),
      fallback: "Proplead",
    });

    res.status(200).json({
      ok: true,
      orgId: invOrgId,
      orgName,
      email: invEmail,
      name: typeof inv.name === "string" ? inv.name : "",
      role: invRole,
      status,
      expiresAt: expiresAtIso,
    });
  } catch (error) {
    console.error("getInvitationPreview error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

export const acceptInvitation = onRequest({ cors: WEB_CLIENT_CORS, region: REGION }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { uid, email } = await resolveAuthIdentityFromToken(req.headers.authorization);

    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    if (!token) {
      res.status(400).json({ error: "Missing token" });
      return;
    }

    const DATABASE_ID = "realestate-whatsapp-bot";
    const db = getFirestore(admin.app(), DATABASE_ID);
    const invRef = db.collection("invitations").doc(token);
    const invSnap = await invRef.get();
    if (!invSnap.exists) {
      res.status(404).json({ error: "Invitation not found" });
      return;
    }

    const inv = invSnap.data() || {};
    const invEmail = typeof inv.email === "string" ? inv.email.trim().toLowerCase() : "";
    const invOrgId = typeof inv.orgId === "string" ? inv.orgId.trim() : "";
    const invRole = normalizeInviteRole(inv.role);
    const status = typeof inv.status === "string" ? inv.status : "pending";
    const expiresAt = typeof inv.expiresAt === "string" ? Date.parse(inv.expiresAt) : 0;

    if (!invOrgId) {
      res.status(400).json({ error: "Invalid invitation" });
      return;
    }
    if (status !== "pending") {
      res.status(400).json({ error: "Invitation already used" });
      return;
    }
    if (expiresAt && Date.now() > expiresAt) {
      await invRef.set({ status: "expired" }, { merge: true });
      res.status(400).json({ error: "Invitation expired" });
      return;
    }
    if (invEmail && invEmail !== String(email || "").trim().toLowerCase()) {
      res.status(403).json({ error: "Invitation email mismatch" });
      return;
    }

    const userRef = db.collection("users").doc(uid);
    await db.runTransaction(async (tx) => {
      tx.set(
        userRef,
        {
          email: invEmail || email,
          name: typeof inv.name === "string" ? inv.name : "",
          orgId: invOrgId,
          role: invRole,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(invRef, { status: "accepted", acceptedBy: uid, acceptedAt: new Date().toISOString() }, { merge: true });
    });

    res.status(200).json({ ok: true, orgId: invOrgId });
  } catch (error) {
    console.error("acceptInvitation error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// ==================== FIRESTORE TRIGGERS (AUDIT LOG) ====================

const DATABASE_ID = "realestate-whatsapp-bot";

/**
 * Helper to detect changes between two document snapshots
 */
function extractDocChanges(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  const b = before || {};
  const a = after || {};

  // Fields to ignore in audit logs to avoid noise
  const ignoreFields = ["lastMessage", "timestamp", "updatedAt", "lastMessageDate", "history", "pendingUserMessages"];

  const allFields = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const field of allFields) {
    if (ignoreFields.includes(field)) continue;

    const valBefore = b[field];
    const valAfter = a[field];

    if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
      changes.push({
        field,
        oldValue: valBefore,
        newValue: valAfter
      });
    }
  }
  return changes;
}

export const onLeadWritten = onDocumentWritten({
  document: "organizations/{orgId}/leads/{leadId}",
  database: DATABASE_ID,
  region: REGION,
  secrets: [TWILIO_AUTH_TOKEN],
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
  const after = event.data?.after.data();

  let action: AuditAction = "update";
  if (!before) action = "create";
  else if (!after) action = "delete";

  const changes = extractDocChanges(before, after);
  if (changes.length === 0 && action === "update") return;

  await recordLeadChange(
    event.params.leadId,
    action,
    changes,
    after?.updatedBy,
    after?.userName
  );

  if (action !== "delete" && after) {
    const listingCode = typeof after.listingCode === "string" ? after.listingCode.trim() : "";
    if (listingCode && listingCode !== "__pending__") {
      const curAssigned = typeof after.assignedAgentUid === "string" ? after.assignedAgentUid.trim() : "";
      const listingCodeChanged =
        !before || String((before as { listingCode?: string })?.listingCode || "").trim() !== listingCode;
      const shouldReconcileScope =
        action === "create" ||
        listingCodeChanged ||
        changes.some((c) => c.field === "assignedAgentUid" || c.field === "listingCode") ||
        !curAssigned;
      if (shouldReconcileScope) {
        try {
          const listing = await fetchListingByCode(listingCode);
          const scope = getListingAgentScopeUid(listing);
          if (scope && curAssigned !== scope) {
            const leadRef = event.data?.after?.ref;
            if (leadRef) {
              await leadRef.set({ assignedAgentUid: scope }, { merge: true });
              await syncAssignedAgentUidForListingCode(listingCode, scope);
            }
          }
        } catch (scopeErr) {
          console.warn(
            `[onLeadWritten] assignedAgentUid reconcile skipped for ${event.params.leadId}`,
            scopeErr
          );
        }
      }
    }
  }

  // Reliable notification path for qualified leads (covers bot + manual qualification).
  const becameQualified = before?.qualificationStatus !== "qualified" && after?.qualificationStatus === "qualified";
  if (!becameQualified) return;

  // Apply listing qualification filters (if any) via AI before notifying agents.
  let listingDescriptionForAgentVar = "";
  let listingForNotifications: ListingRow | null = null;
  if (after?.listingCode) {
    try {
      const listing = await fetchListingByCode(after.listingCode);
      listingForNotifications = listing;
      if (listing) {
        if (listing.description?.trim()) {
          listingDescriptionForAgentVar = listing.description.trim();
        }
        const hasFilters =
          (listing.operationType === "Alquiler" && (listing.minMonthlyIncome != null || listing.maxPeople != null)) ||
          (listing.operationType === "Venta" && listing.requireMortgageApproved === true);

        if (hasFilters) {
          const summaryForFilter = typeof after.conversationSummary === "string" && after.conversationSummary.trim()
            ? after.conversationSummary
            : `Teléfono: ${after.phone || "N/D"}\nNombre: ${after.name || "Sin nombre"}`;

          const filterResult = await checkLeadPassesFilters({
            conversationSummary: summaryForFilter,
            operationType: listing.operationType,
            minMonthlyIncome: listing.minMonthlyIncome,
            maxPeople: listing.maxPeople,
            requireMortgageApproved: listing.requireMortgageApproved,
          });

          if (!filterResult.pass) {
            console.log(`Lead ${event.params.leadId} filtered out by listing criteria: ${filterResult.reason}`);
            // Update lead to rejected so it surfaces correctly in the UI
            const leadDocRef = event.data?.after.ref;
            if (leadDocRef) {
              await leadDocRef.update({
                qualificationStatus: "rejected",
                rejectionReason: filterResult.reason,
              });
            }
            return;
          }

          console.log(`Lead ${event.params.leadId} passed listing filters: ${filterResult.reason}`);
        }
      }
    } catch (filterError) {
      // Fail-open: if something goes wrong with the filter, proceed with notification
      console.error("Error applying listing qualification filters; proceeding with notification", filterError);
    }
  }

  const config = await getBotConfig();
  const db = getFirestore(admin.app(), DATABASE_ID);
  const leadAssignedUid =
    typeof after?.assignedAgentUid === "string" ? after.assignedAgentUid : undefined;
  const agentNums = await resolveQualifiedLeadNotificationRecipients({
    orgId: event.params.orgId,
    botConfig: config,
    envNotificationFallback: NOTIFICATION_NUMBER.value(),
    listing: listingForNotifications,
    leadAssignedAgentUid: leadAssignedUid,
    db,
  });
  if (agentNums.length === 0) {
    console.warn("No notification numbers configured; qualified lead summary not sent", event.params.leadId);
    return;
  }

  const templateSid = await getAgentNotificationTemplateSid(getActiveOrgId());
  const notificationPayload = buildQualifiedLeadAgentNotificationPayload({
    templateSid,
    is8VarFlag: config.twilioTemplates?.agentNotificationIs8Var,
    after: after as Record<string, unknown>,
    listingDescription: listingDescriptionForAgentVar,
  });

  for (const num of agentNums) {
    try {
      await sendAgentNotificationMessage({
        to: num,
        body: notificationPayload.body,
        templateSid,
        twilioTemplateVariables: notificationPayload.twilioTemplateVariables,
        context: `onLeadWritten:${after?.chatId || event.params.leadId}`,
      });
      console.log(`Notification sent for qualified lead to ${num}`, after?.chatId || event.params.leadId);
    } catch (error) {
      console.error(`Error sending notification to ${num}`, error);
    }
  }
  });
});

export const onConversationWritten = onDocumentWritten({
  document: "organizations/{orgId}/conversations/{chatId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    let action: AuditAction = "update";
    if (!before) action = "create";
    else if (!after) action = "delete";

    // For conversations, we only care about specific changes like botDisabled or qualification
    const changes = extractDocChanges(before, after);

    // Filter changes to only record significant ones to avoid bloat
    const significantFields = ["botDisabled", "qualificationStatus", "isFinished", "name", "tags"];
    const significantChanges = changes.filter(c => significantFields.includes(c.field));

    if (significantChanges.length === 0 && action === "update") return;

    // Determine specific action if it's a toggle
    let finalAction: AuditAction = action;
    if (action === "update") {
      if (significantChanges.find(c => c.field === "botDisabled")) finalAction = "bot_toggle";
      else if (significantChanges.find(c => c.field === "qualificationStatus")) finalAction = "qualification_change";
    }

    await recordConversationChange(
      event.params.chatId,
      finalAction,
      significantChanges,
      after?.updatedBy,
      after?.userName
    );
  });
});


export const onListingWritten = onDocumentWritten({
  document: "organizations/{orgId}/listings/{listingId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    let action: AuditAction = "update";
    if (!before) action = "create";
    else if (!after) action = "delete";

    const changes = extractDocChanges(before, after);
    if (changes.length === 0 && action === "update") return;

    await recordListingChange(
      event.params.listingId,
      action,
      changes,
      after?.updatedBy,
      after?.userName
    );

    if (action !== "delete" && after) {
      const listingCode = typeof after.listingCode === "string" ? after.listingCode.trim() : "";
      if (listingCode && listingCode !== "__pending__") {
        const beforeScope = agentScopeFromListingSnapshotData(before);
        const afterScope = agentScopeFromListingSnapshotData(after);
        const scopeFields = new Set(["assignedAgentUid", "createdByUid", "listingCode"]);
        const scopeRelatedChange =
          action === "create" ||
          changes.some((c) => scopeFields.has(c.field)) ||
          beforeScope !== afterScope;
        if (scopeRelatedChange && afterScope) {
          try {
            await syncAgentScopeUidForListingCodeFromListingDoc(listingCode, after);
          } catch (syncErr) {
            console.error(
              `[onListingWritten] Failed to sync assignedAgentUid for listingCode=${listingCode}`,
              syncErr
            );
          }
        }
      }

      // Plan-limit enforcement: truncate notificationNumberIds to the plan cap.
      // This is the authoritative backend gate — the UI selector mirrors the
      // same cap and the listings service truncates client-side too, but a
      // tampered client could bypass both. Reads the latest plan from
      // org_subscriptions so a downgrade applied seconds before this write
      // is respected.
      try {
        const rawIds = (after as { notificationNumberIds?: unknown }).notificationNumberIds;
        if (Array.isArray(rawIds) && rawIds.length > 0) {
          const ids = rawIds.filter((v): v is string => typeof v === "string" && v.trim() !== "");
          const sub = await getOrgSubscription(event.params.orgId);
          const max = getMaxListingNotificationNumbers(sub?.planId);
          if (ids.length > max) {
            const truncated = ids.slice(0, max);
            console.warn(
              `[onListingWritten] Truncating notificationNumberIds for listing=${event.params.listingId} ` +
                `plan=${sub?.planId || "free"} max=${max} requested=${ids.length}`
            );
            await event.data!.after.ref.set(
              { notificationNumberIds: truncated, updatedAt: new Date() },
              { merge: true }
            );
          } else if (ids.length !== rawIds.length) {
            // Cleanup-only — strip non-string entries without re-triggering a length change.
            await event.data!.after.ref.set(
              { notificationNumberIds: ids, updatedAt: new Date() },
              { merge: true }
            );
          }
        }
      } catch (limitErr) {
        console.error(
          `[onListingWritten] plan-limit enforcement failed for listing=${event.params.listingId}`,
          limitErr
        );
      }

      // Active-listings cap enforcement (red de seguridad anti-tamper).
      // Si el anuncio pasa a activo (creado activo, o reactivado: before inactivo
      // → after activo) y la org supera el máximo de su plan, lo revierte a
      // inactivo. La UI ya bloquea esto e invita a subir de plan; esto cubre un
      // cliente manipulado. Solo actúa en la TRANSICIÓN a activo, así que las
      // cuentas que ya superaban el tope (grandfathering) no se ven afectadas al
      // editar anuncios que ya estaban activos.
      try {
        const wasActive = before ? (before as { isActive?: unknown }).isActive === true : false;
        const isNowActive = (after as { isActive?: unknown }).isActive === true;
        const becameActive = isNowActive && !wasActive;
        if (becameActive) {
          const sub = await getOrgSubscription(event.params.orgId);
          const max = getMaxActiveListings(sub?.planId);
          if (Number.isFinite(max)) {
            const countSnap = await event
              .data!.after.ref.parent.where("isActive", "==", true)
              .count()
              .get();
            const activeCount = countSnap.data().count; // incluye este doc (post-write)
            if (activeCount > max) {
              console.warn(
                `[onListingWritten] Active-listings cap exceeded for listing=${event.params.listingId} ` +
                  `plan=${sub?.planId || "free"} max=${max} active=${activeCount} — reverting to inactive`
              );
              await event.data!.after.ref.set(
                { isActive: false, updatedAt: new Date() },
                { merge: true }
              );
            }
          }
        }
      } catch (capErr) {
        console.error(
          `[onListingWritten] active-listings cap enforcement failed for listing=${event.params.listingId}`,
          capErr
        );
      }
    }
  });
});

export const onConfigWritten = onDocumentWritten({
  document: "organizations/{orgId}/botConfig/{configId}",
  database: DATABASE_ID,
  region: REGION,
}, async (event) => {
  return requestContext.run({ orgId: event.params.orgId }, async () => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    const changes = extractDocChanges(before, after);
    if (changes.length === 0) return;

    await recordSystemAction(
      "system_config",
      event.params.configId,
      "update",
      { changes }
    );
  });
});

export const testEmailTemplates = onRequest({ cors: true, region: REGION, secrets: [TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_UNSUBSCRIBE_SECRET] }, async (req, res) => {
  // Authenticated super_admin only — this endpoint sends real emails from
  // Proplead's SMTP to an arbitrary recipient and was previously
  // unauthenticated (same class of vuln as the deleted testWelcomeEmail /
  // testAlert). Without this gate any third party can drive a phishing /
  // SMTP-reputation attack via the production sender.
  try {
    const ctx = await resolveUserContextFromToken(req.headers.authorization);
    if (ctx.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch (e) {
    res.status(401).json({ error: e instanceof Error && e.message === "Unauthorized" ? "Unauthorized" : "Unauthorized" });
    return;
  }

  // Accept type/email from either query (GET) or body (POST) to make ad-hoc testing easier.
  const source = (req.method === "GET" ? req.query : req.body) || {};
  const rawType = typeof (source as Record<string, unknown>).type === "string" ? String((source as Record<string, unknown>).type) : "";
  const rawEmail = typeof (source as Record<string, unknown>).email === "string" ? String((source as Record<string, unknown>).email).trim() : "";
  const type = rawType.toLowerCase();
  const testEmail = rawEmail || "ejperezreyes@gmail.com";

  const sendOne = async (kind: string): Promise<void> => {
    if (kind === "welcome") {
      await sendWelcomeNotification(testEmail, "User Test");
    } else if (kind === "low_balance") {
      const { formatLowBalanceEmail } = await import("./services/emailTemplates");
      const { sendEmailToUser } = await import("./services/emailService");
      const html = formatLowBalanceEmail({ name: "User Test", balance: 8 });
      await sendEmailToUser({ to: testEmail, subject: "Pausa programada del asistente ⏳", html });
    } else if (kind === "payment_failed") {
      const { formatPaymentFailedEmail } = await import("./services/emailTemplates");
      const { sendEmailToUser } = await import("./services/emailService");
      const html = formatPaymentFailedEmail({ name: "User Test", orgName: "Proplead Org Test", lastPaymentAmount: "39.00€" });
      await sendEmailToUser({ to: testEmail, subject: "Fallo en la renovación 💳", html });
    } else if (kind === "invitation") {
      await sendInvitationNotification({
        email: testEmail,
        name: "User Test",
        orgName: "Proplead Org Test",
        inviterName: "Eddy",
        token: "test-invitation-token-1234567890",
      });
    } else if (kind === "password_reset") {
      const { sendPasswordResetNotification } = await import("./services/emailService");
      // Try to generate a real Firebase Auth reset link so the email lands at /reset-password.
      // Falls back to a placeholder URL when the test address doesn't exist as a Firebase user.
      let resetUrl = `${APP_BASE_URL.value().trim().replace(/\/+$/, "")}/reset-password?oobCode=test-placeholder`;
      try {
        resetUrl = await admin.auth().generatePasswordResetLink(testEmail, {
          url: `${APP_BASE_URL.value().trim().replace(/\/+$/, "")}/login`,
        });
      } catch (e) {
        console.warn(`password_reset test: could not generate real reset link for ${testEmail}, using placeholder. ${String(e)}`);
      }
      await sendPasswordResetNotification(testEmail, resetUrl);
    } else if (kind === "new_signup_alert") {
      await sendNewSignupAlert({
        userId: "test-uid-1234567890",
        email: testEmail,
        displayName: "User Test",
      });
    } else if (kind === "support_inquiry") {
      const { sendSupportInquiryNotification } = await import("./services/emailService");
      await sendSupportInquiryNotification({
        name: "User Test",
        email: testEmail,
        subject: "Consulta de prueba",
        message: "Hola, esto es un email de prueba enviado desde testEmailTemplates para verificar el formato de soporte.",
        userId: "test-uid-1234567890",
        locale: "es",
        sourcePage: "/configuracion",
        userAgent: "Test runner",
        ip: "n/a",
      });
    } else {
      throw new Error(`Unknown email type: ${kind}`);
    }
  };

  const allTypes = ["welcome", "low_balance", "payment_failed", "invitation", "password_reset", "new_signup_alert", "support_inquiry"];

  try {
    if (type === "all") {
      const results: Record<string, string> = {};
      for (const k of allTypes) {
        try {
          await sendOne(k);
          results[k] = "sent";
        } catch (e) {
          results[k] = `error: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      res.status(200).json({ success: true, to: testEmail, results });
      return;
    }

    if (!type) {
      res.status(400).json({
        error: "Specify type",
        validTypes: [...allTypes, "all"],
      });
      return;
    }

    await sendOne(type);
    res.status(200).json({ success: true, message: `Email ${type} sent to ${testEmail}` });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({ error: String(error) });
  }
});

// ============================================================================
// Notification numbers verification (Twilio Verify, SMS channel)
// ============================================================================
//
// Three HTTPS endpoints — all called from the web client.
//
// * startNotificationNumberVerification: Twilio sends a 6-digit code via SMS.
//   We persist a pending notificationNumbers doc with the verificationSid;
//   if the same phone is already verified for this org, we short-circuit.
// * checkNotificationNumberVerification: client posts the 6-digit code; on
//   approval we flip `verified: true` and clear the SID. The first verified
//   number in the org also becomes the org default (used as onboarding's
//   default sender for legacy `whatsappSummariesPhone`).
// * deleteNotificationNumber: managers only. Centralised so we can layer
//   audit on top later — rules also permit direct deletes by managers.
//
// All three require `role in ["owner", "admin", "super_admin"]`.

type NotificationNumberManagerCheck = {
  uid: string;
  orgId: string;
  role: string;
  email: string;
};

function isNotificationNumberManager(ctx: NotificationNumberManagerCheck): boolean {
  return ctx.role === "owner" || ctx.role === "admin" || ctx.role === "super_admin";
}

const VERIFY_ATTEMPTS_HARD_LIMIT = 5;

export const startNotificationNumberVerification = onRequest(
  {
    cors: WEB_CLIENT_CORS,
    region: REGION,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const ctx = await resolveUserContextFromToken(req.headers.authorization);
      if (!isNotificationNumberManager(ctx)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = (req.body || {}) as { phone?: string; label?: string; source?: string };
      const e164 = normalizeToE164(body.phone);
      if (!e164) {
        res.status(400).json({ error: "Invalid phone number; expected E.164 (e.g. +34612345678)" });
        return;
      }
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : undefined;
      const source =
        body.source === "onboarding" || body.source === "team_add" ? body.source : "team_add";

      const accountSid = TWILIO_ACCOUNT_SID.value();
      const authToken = TWILIO_AUTH_TOKEN.value();
      const serviceSid = TWILIO_VERIFY_SERVICE_SID.value();
      if (!accountSid || !authToken || !serviceSid) {
        res.status(500).json({ error: "Twilio Verify is not configured on the server" });
        return;
      }

      let verification;
      try {
        verification = await twilioVerifyStart({
          credentials: { accountSid, authToken, serviceSid },
          to: e164,
          channel: "sms",
          locale: "es",
        });
      } catch (error) {
        if (isTwilioVerifyRateLimited(error)) {
          res.status(429).json({ error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." });
          return;
        }
        console.error("Twilio Verify start failed", twilioVerifyErrorMessage(error));
        res.status(502).json({ error: "No se pudo enviar el código de verificación" });
        return;
      }

      const { numberId, alreadyVerified } = await upsertPendingNumber({
        orgId: ctx.orgId,
        e164,
        label,
        createdBy: ctx.uid,
        source,
        verificationSid: verification.sid,
      });

      res.status(200).json({ numberId, alreadyVerified, e164 });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("startNotificationNumberVerification error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const checkNotificationNumberVerification = onRequest(
  {
    cors: WEB_CLIENT_CORS,
    region: REGION,
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const ctx = await resolveUserContextFromToken(req.headers.authorization);
      if (!isNotificationNumberManager(ctx)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = (req.body || {}) as { numberId?: string; code?: string };
      const numberId = typeof body.numberId === "string" ? body.numberId.trim() : "";
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!numberId || !code) {
        res.status(400).json({ error: "numberId and code are required" });
        return;
      }
      if (!/^\d{4,8}$/.test(code)) {
        res.status(400).json({ error: "Invalid code format" });
        return;
      }

      const doc = await getNotificationNumber(ctx.orgId, numberId);
      if (!doc) {
        res.status(404).json({ error: "Notification number not found" });
        return;
      }
      if (doc.verified) {
        res.status(200).json({ verified: true, status: "approved" });
        return;
      }
      if ((doc.verificationAttempts || 0) >= VERIFY_ATTEMPTS_HARD_LIMIT) {
        res.status(429).json({ error: "Demasiados intentos. Solicita un código nuevo." });
        return;
      }

      const accountSid = TWILIO_ACCOUNT_SID.value();
      const authToken = TWILIO_AUTH_TOKEN.value();
      const serviceSid = TWILIO_VERIFY_SERVICE_SID.value();
      if (!accountSid || !authToken || !serviceSid) {
        res.status(500).json({ error: "Twilio Verify is not configured on the server" });
        return;
      }

      let result;
      try {
        result = await twilioVerifyCheck({
          credentials: { accountSid, authToken, serviceSid },
          to: doc.e164,
          code,
        });
      } catch (error) {
        if (isTwilioVerifyRateLimited(error)) {
          res.status(429).json({ error: "Demasiados intentos. Inténtalo de nuevo en unos minutos." });
          return;
        }
        console.error("Twilio Verify check failed", twilioVerifyErrorMessage(error));
        res.status(502).json({ error: "No se pudo verificar el código" });
        return;
      }

      if (result.valid) {
        await markNotificationNumberVerified({ orgId: ctx.orgId, numberId });
        res.status(200).json({ verified: true, status: result.status });
        return;
      }

      const attempts = await incrementVerificationAttempts({ orgId: ctx.orgId, numberId });
      res.status(200).json({
        verified: false,
        status: result.status,
        attemptsRemaining: Math.max(0, VERIFY_ATTEMPTS_HARD_LIMIT - attempts),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("checkNotificationNumberVerification error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const deleteNotificationNumber = onRequest(
  { cors: WEB_CLIENT_CORS, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    try {
      const ctx = await resolveUserContextFromToken(req.headers.authorization);
      if (!isNotificationNumberManager(ctx)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const body = (req.body || {}) as { numberId?: string };
      const numberId = typeof body.numberId === "string" ? body.numberId.trim() : "";
      if (!numberId) {
        res.status(400).json({ error: "numberId is required" });
        return;
      }
      const doc = await getNotificationNumber(ctx.orgId, numberId);
      if (!doc) {
        res.status(200).json({ ok: true, alreadyDeleted: true });
        return;
      }
      await deleteNotificationNumberDoc({ orgId: ctx.orgId, numberId });
      res.status(200).json({ ok: true });
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      console.error("deleteNotificationNumber error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
);

export const passwordResetRequest = onRequest(
  {
    cors: true,
    region: REGION,
    secrets: [TWILIO_API_KEY, TWILIO_API_SECRET, EMAIL_UNSUBSCRIBE_SECRET],
  },
  async (req, res) => {
    const { passwordResetRequestHandler } = await import("./passwordResetEndpoints");
    await passwordResetRequestHandler(req, res);
  }
);
