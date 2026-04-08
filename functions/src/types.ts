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
  profitabilityReportAvailable?: boolean;
  profitabilityReport?: string;
  /** Simple workflow step for deterministic parts (e.g., Idealista Si/No confirmation) */
  flowStep?:
    | "idealista_confirm"
    | "call_listing_collect"
    | "call_listing_pick"
    | "call_listing_confirm"
    | "qualification"
    | "closed";
  pendingListingCandidate?: { listingCode: string; link?: string; description?: string; address?: string; price?: number | string };
  pendingListingCandidates?: Array<{ listingCode: string; link?: string; description?: string; address?: string; price?: number | string }>;
  listingResolveAttempts?: number;
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
  recordings?: string[];
  /** Firestore server timestamp of last update (stored on conversation doc) */
  lastMessage?: FirebaseFirestore.Timestamp;
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
  notes?: string;
  lastAnalyzedAt?: FirebaseFirestore.Timestamp;
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
  quickQualificationEnabled?: boolean;
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

export type AgentListingResolutionDecision =
  | { kind: "match"; listingCode: string; confidence: number; reason: string }
  | { kind: "ambiguous"; listingCodes: string[]; confidence: number; reason: string }
  | { kind: "none"; confidence: number; reason: string };

export type BotStyle = {
  id: string;
  name: string;
  description: string;
  promptModifier: string;
};

export type BotConfig = {
  activeStyleId: string;
  styles: BotStyle[];
  messagingProvider?: string;
  orgName?: string;
};

export type InboundMessage = {
  chatId: string;
  phone: string;
  text: string;
  timestamp: number;
};

// ==================== WHAPI SYNC TYPES ====================

export type WhapiChat = {
  id: string;
  name?: string;
  type: string;
  timestamp: number;
  last_message?: WhapiMessage;
  unread?: number;
};

export type WhapiMessage = {
  id: string;
  chat_id: string;
  from: string;
  from_me: boolean;
  timestamp: number;
  text?: { body: string };
  body?: string;
  type?: string;
  source?: string;
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
  type: "missing_in_firestore" | "missing_in_whapi" | "message_mismatch" | "stale_buffer";
  details: string;
  whapiTimestamp?: number;
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
};

// ==================== CREDIT SYSTEM TYPES ====================

export type UserCredits = {
  userId: string;
  balance: number;
  updatedAt: FirebaseFirestore.Timestamp;
};

export type CreditTransaction = {
  id?: string;
  userId: string;
  type: "purchase" | "deduction";
  amount: number;  // positive for purchases, negative for deductions
  stripeSessionId?: string;
  description: string;
  createdAt: FirebaseFirestore.Timestamp;
};

export type CreditPackage = {
  id: string;
  name: string;
  amount: number;       // Price in cents (e.g., 500 = €5.00)
  credits: number;      // Credits to add (e.g., 50)
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
  | "qualification_change";

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
