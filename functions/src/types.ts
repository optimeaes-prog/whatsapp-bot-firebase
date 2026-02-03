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

export type ConversationState = {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  description: string;
  link: string;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport?: string;
  history: HistoryItem[];
  pendingUserMessages: PendingItem[];
  isFinished: boolean;
  qualificationStatus?: boolean;
  // Buffer fields for Cloud Tasks
  pendingTaskName?: string;
  bufferExpiresAt?: number;
  followUpSent?: boolean;
};

export type LeadSummary = {
  name?: string;
  people?: string;
  income?: string;
  pets?: string;
  paymentMethod?: string;
  dates?: string;
  visitAvailability?: string;
  notes?: string;
};

export type QualificationStatus = "not_qualified" | "qualified" | "rejected";

export type LeadRow = {
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  name?: string;
  firstMessageDate?: FirebaseFirestore.Timestamp;
  lastMessageDate?: FirebaseFirestore.Timestamp;
  qualificationStatus?: QualificationStatus;
};

export type ListingRow = {
  description: string;
  listingCode: string;
  link: string;
  operationType: OperationType;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport: string;
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
};

export type InboundMessage = {
  chatId: string;
  phone: string;
  text: string;
  timestamp: number;
};
