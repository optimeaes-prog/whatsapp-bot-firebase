export type Role = "assistant" | "user";

export type HistoryItem = {
  role: Role;
  text: string;
  timestamp: number;
};

export type PendingItem = {
  text: string;
  timestamp: number;
};

export type OperationType = "Venta" | "Alquiler";

/**
 * Sub-tipo de alquiler. Aplica solo si operationType === "Alquiler".
 * Para "Venta" (o si el agente no quiere clasificar) se usa "No aplica".
 */
export type RentalSubtype = "Vacacional" | "Temporada" | "Larga temporada" | "No aplica";

export type ConversationType = "lead" | "non-lead";

export type ConversationState = {
  phone: string;
  listingCode?: string;
  chatId: string;
  operationType?: OperationType;
  name?: string;
  description?: string;
  link?: string;
  address?: string;
  features?: string;
  /** Full Idealista description text for this listing (if stored) */
  idealistaDescription?: string;
  /** Rental sub-type (only meaningful when operationType === "Alquiler"). */
  rentalSubtype?: RentalSubtype;
  profitabilityReportAvailable?: boolean;
  profitabilityReport?: string;
  /** Simple workflow step for deterministic parts (e.g., Idealista Si/No confirmation) */
  flowStep?:
    | "call_listing_collect"
    | "call_listing_pick"
    | "call_listing_confirm"
    | "call_name_confirm"
    | "call_name_collect"
    | "qualification"
    | "closed";
  /**
   * Marks how an inbound-call conversation should be processed.
   * "per_org" = in-place no-handoff flow (org resolved from the dialed voice number);
   * absent / "global_intake" = legacy global-intake + cross-org handoff.
   */
  callFlowMode?: "per_org" | "global_intake";
  pendingListingCandidate?: { listingCode: string; orgId?: string; link?: string; description?: string; address?: string; price?: number | string; confidence?: number };
  pendingListingCandidates?: Array<{ listingCode: string; orgId?: string; link?: string; description?: string; address?: string; price?: number | string; confidence?: number }>;
  pendingListingQueue?: Array<{ listingCode: string; orgId?: string; link?: string; description?: string; address?: string; price?: number | string; confidence: number }>;
  pendingListingQueueIndex?: number;
  rejectedListingCodes?: string[];
  listingResolveAttempts?: number;
  pendingNameConfirmation?: {
    capturedName?: string;
    listingCode: string;
    targetOrgId: string;
    sourceOrgId: string;
    correlationId: string;
    deadlineAtMs: number;
    timeoutTaskName?: string;
  };
  history: HistoryItem[];
  pendingUserMessages: PendingItem[];
  isFinished: boolean;
  qualificationStatus?: boolean;
  // Buffer fields for Cloud Tasks
  pendingTaskName?: string;
  bufferExpiresAt?: number;
  followUpSent?: boolean;
  botDisabled?: boolean;
  type?: ConversationType;
  tags?: string[];
  language?: "es" | "en";
  /** Stable outbound language target for assistant replies. */
  targetLanguage?: "es" | "en";
  /** Why current outbound language lock is set. */
  languageLockSource?: "initial" | "user_confirmed" | "agent_override";
  recordings?: string[];
  /** Detailed error information if the pipeline failed */
  errorDetails?: string;
  /** Firestore server timestamp of last update */
  lastMessage?: FirebaseFirestore.Timestamp;
  /** A6b mirror field for UI visibility. Enforcement uses ignoredChats. */
  optedOut?: boolean;
  /**
   * Cross-org call handoff tracking (global intake WABA -> org WABA).
   */
  handoff?: {
    correlationId: string;
    sourceOrgId: string;
    targetOrgId?: string;
    matchedListingCode?: string;
    language?: "es" | "en";
    phone?: string;
    status: "pending" | "transferred" | "failed";
    reason?: string;
    transferredAt?: FirebaseFirestore.Timestamp;
  };
  outboundCallConsent?: {
    attemptCount?: number;
    noAnswerRetryCount?: number;
    wrongKeyRetryCount?: number;
    hangupRetryCount?: number;
    firstAttemptAt?: number;
    firstAttemptAtHourMadrid?: number;
    firstAttemptAtMinuteMadrid?: number;
    consentCaptured?: boolean;
    lastOutcome?: string;
    nextAttemptAt?: number;
    finishedReason?: string;
    lastCallSid?: string;
  };
  outboundCallAudio?: {
    provider: "elevenlabs";
    voiceId: string;
    status: "ready" | "failed_after_retries";
    audioUrl?: string;
    generatedAt?: number;
    sourceText?: string;
    failureReason?: string;
    retryAttempts?: number;
  };
};

export type LeadSummary = {
  name?: string;
  people?: string;
  income?: number;
  pets?: boolean;
  paymentMethod?: "Contado" | "Hipoteca";
  dates?: string;
  visitAvailability?: string;
  notes?: string;
};

export type QualificationStatus = "not_qualified" | "qualified" | "rejected" | "no_response";

export type LeadRow = {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  firstMessageDate?: FirebaseFirestore.Timestamp;
  lastMessageDate?: FirebaseFirestore.Timestamp;
  qualificationStatus?: QualificationStatus;
  tags?: string[];
  hasResponse?: boolean;
  recordings?: string[];
  pets?: boolean;
  income?: number;
  paymentMethod?: "Contado" | "Hipoteca";
  /** Visit preference when extracted by qualification / analysis */
  visitAvailability?: string;
  notes?: string;
  lastAnalyzedAt?: FirebaseFirestore.Timestamp;
  /**
   * Prior-opt-in evidence. WhatsApp Business Messaging Policy requires explicit consent
   * before any business-initiated (template) message. Server enforces this in
   * sendInitialTemplateMessage; the UI captures it at lead creation. Auto-populated
   * with source "inbound_whatsapp" when the lead first writes to us.
   */
  consent?: {
    capturedAt: FirebaseFirestore.Timestamp;
    source: "idealista_form" | "agency_website" | "phone_call" | "in_person" | "inbound_whatsapp";
    collectedBy?: string;
    language?: "es" | "en";
    proofUrl?: string;
    proofType?: "twilio_call_sid" | "twilio_recording_sid" | "wa_inbound";
    consentScriptVersion?: string;
    dtmfDigit?: "1";
  };
};

export type ListingRow = {
  description: string;
  listingCode: string;
  listingCodeFotocasa?: string;
  link: string;
  operationType: OperationType;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport: string;
  idealistaDescription?: string;
  /** Rental sub-type (only meaningful when operationType === "Alquiler"). */
  rentalSubtype?: RentalSubtype;
  quickQualificationEnabled?: boolean;
  createdByUid?: string;
  assignedAgentUid?: string;
  assignedAgentName?: string;
  /**
   * IDs into `organizations/{orgId}/notificationNumbers` to which qualified-lead
   * summaries are sent. Drives the new listing-scoped resolver; absent on legacy
   * listings until backfill runs.
   */
  notificationNumberIds?: string[];
  price?: string;
  m2?: string;
  rooms?: string;
  address?: string;
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  provinceNormalized?: string;
  agentName?: string;
  // Qualification filters
  minMonthlyIncome?: number;
  maxPeople?: number;
  requireMortgageApproved?: boolean;
};

export type ListingForResolution = {
  listingCode: string;
  operationType?: OperationType;
  description?: string;
  address?: string;
  street?: string;
  city?: string;
  province?: string;
  price?: string | number;
  link?: string;
};

export type AgentListingCandidate = {
  listingCode: string;
  confidence: number;
  reason?: string;
};

export type AgentListingResolutionDecision =
  | { kind: "match"; listingCode: string; confidence: number; reason: string; candidates: AgentListingCandidate[] }
  | { kind: "ambiguous"; confidence: number; reason: string; candidates: AgentListingCandidate[] }
  | { kind: "none"; confidence: number; reason: string; candidates: AgentListingCandidate[] };

export type BotStyle = {
  id: string;
  name: string;
  description: string;
  promptModifier: string;
};

export type MessagingProvider = "cloud_api" | "twilio";

export type CloudApiTemplateNames = {
  /** Preferred single key for agent notifications (always ES strategy). */
  agentNotification?: string;
  agentNotificationEs?: string;
  agentNotificationEn?: string;
  idealistaConfirmEs?: string;
  idealistaConfirmEn?: string;
  /** Legacy name used by non-call initial lead flows. */
  idealistaInitialEs?: string;
  /** Legacy name used by non-call initial lead flows. */
  idealistaInitialEn?: string;
  /** Preferred ES template key for call handoff flow. */
  callHandoffOrgEs?: string;
  /** Preferred EN template key for call handoff flow. */
  callHandoffOrgEn?: string;
};

export type TwilioTemplateNames = {
  agentNotification?: string;
  /** Optional single-body ({{1}}) template for quick-qual / call-flow when `agentNotification` is a multi-variable template */
  agentNotificationLegacy?: string;
  /**
   * True when the org's `agentNotification` template is the 8-variable Proplead-style format.
   * False/undefined falls back to legacy 1-variable behavior. Set by the Twilio sender migration
   * when an 8-var template is cloned into a new account (replaces the legacy hardcoded SID whitelist).
   */
  agentNotificationIs8Var?: boolean;
  callHandoffOrgEs?: string;
  callHandoffOrgEn?: string;
  callHandoffOrgNoNameEs?: string;
  callHandoffOrgNoNameEn?: string;
  voiceOptInConsent?: string;
  /**
   * Igual que `voiceOptInConsent` pero en inglés, para quien llama desde un
   * número que no es español. Opcional a propósito: si una agencia no la
   * tiene, se le manda la castellana, que es lo que pasaba hasta ahora.
   */
  voiceOptInConsentEn?: string;
  idealistaInitialEs?: string;
  idealistaInitialEn?: string;
  /**
   * Aviso diario de "leads sin respuesta" ({{1}} = cuántos, {{2}} = enlace a la
   * página). Por org, porque cada cuenta de Twilio tiene sus propias plantillas;
   * si falta se usa TWILIO_TEMPLATE_SID_INACTIVE_LEADS.
   */
  inactiveLeads?: string;
  /** Static template for returning-lead reconnect message (ES). Used as 24h-window fallback. */
  returningLeadEs?: string;
  /** Static template for returning-lead reconnect message (EN). Used as 24h-window fallback. */
  returningLeadEn?: string;
};

export type TwilioTransportConfig = {
  accountSid?: string;
  whatsappNumber?: string;
  smsSenderId?: string;
  authTokenSecretName?: string;
  /** Twilio Senders API resource SID (XE…) for the WhatsApp sender. */
  senderSid?: string;
  /** Meta WABA ID associated with this sender (granted via Embedded Signup). */
  wabaId?: string;
  /** Meta phone_number_id for graph/profile calls during onboarding. */
  phoneNumberId?: string;
  /** Display number in digits-only E.164 form (e.g. "34669354177"). */
  displayPhoneNumber?: string;
  /**
   * Dedicated inbound-voice number in digits-only E.164 form (e.g. "34911223344"),
   * SEPARATE from whatsappNumber. When set (and inboundVoicePerOrgEnabled is true),
   * inbound calls to this number resolve directly to this org and run the in-place
   * (no-handoff) voice flow.
   */
  voiceNumber?: string;
  /** Optional assistant persona metadata selected during onboarding. */
  assistantAvatarId?: string;
  assistantAvatarName?: string;
  assistantAvatarUrl?: string;
  /** Custom uploaded photo (e.g. agency logo). When set, overrides assistantAvatarUrl for WA profile. */
  assistantPhotoUrl?: string;
};

export type GlobalMessagingPolicy = {
  defaultProvider: MessagingProvider;
  cloudApi?: {
    templates?: CloudApiTemplateNames;
  };
  twilio?: {
    templates?: TwilioTemplateNames;
  };
  version?: number;
  updatedAt?: FirebaseFirestore.Timestamp;
  updatedBy?: string;
};

export type CloudApiConfig = {
  /** Name of the secret in GCP Secret Manager holding the Access Token (value not stored in Firestore). */
  accessTokenSecretName: string;
  phoneNumberId: string;
  wabaId: string;
  /** Graph API version, e.g. "v23.0" (defaults to v23.0 if omitted). */
  graphApiVersion?: string;
  /** Token used for Meta webhook handshake (hub.verify_token). */
  verifyToken: string;
  /** Display number normalized to digits only (optional). */
  displayPhoneNumber?: string;
  /** Optional assistant persona metadata selected during onboarding. */
  assistantAvatarId?: string;
  assistantAvatarName?: string;
  assistantAvatarUrl?: string;
  /** Custom uploaded photo (e.g. agency logo). When set, overrides assistantAvatarUrl for WA profile. */
  assistantPhotoUrl?: string;
  /** Template names created programmatically, keyed by purpose+language. */
  templates?: CloudApiTemplateNames;
};

export type BotConfig = {
  activeStyleId: string;
  styles: BotStyle[];
  messagingProvider?: MessagingProvider;
  orgName?: string;
  /** Comma-separated WhatsApp recipients that always receive qualified-lead summaries for this org. */
  notificationNumbers?: string;
  assistantAvatarName?: string;
  cloudApiConfig?: CloudApiConfig;
  /** Twilio ContentSid mappings owned by this org (no global fallback). */
  twilioTemplates?: TwilioTemplateNames;
  /** Twilio transport credentials owned by this org. */
  twilioConfig?: TwilioTransportConfig;
  /**
   * When true, inbound voice calls to this org's dedicated voiceNumber resolve the
   * org directly and run the in-place (no-handoff) flow. Default off = legacy global
   * intake (PROPLEAD_INTAKE_ORG_ID) + cross-org handoff.
   */
  inboundVoicePerOrgEnabled?: boolean;
  templateEligibility?: {
    outboundTemplatesBlocked?: boolean;
    missingRequiredKeys?: string[];
    checkedAt?: FirebaseFirestore.Timestamp;
  };
};

export type InboundMessage = {
  chatId: string;
  phone: string;
  text: string;
  timestamp: number;
};

export type AlertSeverity = "info" | "warning" | "critical" | "healthy";

export type FailedMessage = {
  id?: string;
  chatId: string;
  phone: string;
  body: string;
  attempt: number;
  maxAttempts: number;
  lastError: string;
  createdAt: FirebaseFirestore.Timestamp;
  nextRetryAt: FirebaseFirestore.Timestamp;
};

export type SyncResult = {
  timestamp: Date;
  chatsChecked: number;
  discrepanciesFound: number;
  messagesRecovered: number;
  failedMessagesRetried: number;
  errors: string[];
};

export type SyncDiscrepancy = {
  chatId: string;
  type: "stale_buffer";
  details: string;
  firestoreTimestamp?: number;
};

// ==================== SUBSCRIPTION TYPES ====================

export type SubscriptionPlanId = "free" | "plus" | "pro" | "pro_plus";

export type OrgSubscription = {
  planId: SubscriptionPlanId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodEnd: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  /** Extra 40-conversation blocks purchased on top of the base plan */
  extraBlocks?: number;
  /** Billing cadence: monthly or yearly */
  billingInterval?: "month" | "year";
};

// ==================== BILLING / CONVERSATION SYSTEM TYPES ====================

export type ConversationPackage = {
  id: string;
  name: string;
  amount: number;       // Price in cents (e.g., 1000 = €10.00)
  conversations: number;      // Conversations to add (e.g., 40)
  currency: "eur" | "usd" | "gbp";
};

// ==================== AUDIT LOG TYPES ====================

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "bot_toggle"
  | "message_sent"
  | "qualification_change"
  | "consent_captured"
  | "consent_auto_captured"
  | "opt_out_captured"
  | "template_send_blocked";

export type AuditEntityType =
  | "lead"
  | "conversation"
  | "listing"
  | "qualified_lead"
  | "system_config";

export type AuditLogEntry = {
  id?: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  userId?: string;          // Email of user who made the change
  userName?: string;        // Display name if available
  isSystemAction: boolean;  // true for automated/bot actions
  changes?: {               // What changed (before/after values)
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: any;           // Additional context
  timestamp: FirebaseFirestore.Timestamp;
};
