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
  profitabilityReportAvailable?: boolean;
  profitabilityReport?: string;
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
  vapiCallId?: string;
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

export type Call = {
  id?: string;
  phone: string;
  chatId: string;
  name?: string;
  listingCode?: string;
  transcript?: string;
  summary?: string;
  isQualified: boolean;
  recordingUrl?: string;
  timestamp: any; // admin.firestore.Timestamp
  callId: string;
  structuredData?: any;
};

export type ListingRow = {
  description: string;
  listingCode: string;
  link: string;
  operationType: OperationType;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport: string;
  idealistaDescription?: string;
  price?: string;
  m2?: string;
  rooms?: string;
  address?: string;
  agentName?: string;
};

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
