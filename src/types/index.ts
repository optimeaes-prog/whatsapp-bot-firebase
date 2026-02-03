import { Timestamp } from "firebase/firestore";

export type OperationType = "Venta" | "Alquiler";

// Razón por la que se desactiva un anuncio
export type ListingClosureReason =
  | "sold_to_qualified"    // Vendido a un lead cualificado
  | "rented_to_qualified"  // Alquilado a un lead cualificado
  | "sold_to_other"        // Vendido a otra persona (externa)
  | "rented_to_other"      // Alquilado a otra persona (externa)
  | "other";               // Otros motivos

export type ListingClosureInfo = {
  reason: ListingClosureReason;
  qualifiedLeadId?: string;      // ID del lead cualificado si aplica
  qualifiedLeadName?: string;    // Nombre del lead para mostrar
  notes?: string;                // Notas adicionales (opcional)
  closedAt: Timestamp;
};

export type Listing = {
  id: string;
  description: string;
  listingCode: string;
  link: string;
  operationType: OperationType;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport: string;
  isActive: boolean;                      // true = activo, false = inactivo
  closureInfo?: ListingClosureInfo;       // Info de cierre (solo si isActive = false)
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type QualificationStatus = "not_qualified" | "qualified" | "rejected";

export type Lead = {
  id: string;
  phone: string;
  listingCode: string;
  chatId: string;
  operationType: OperationType;
  createdAt: Timestamp;
  name?: string;
  firstMessageDate?: Timestamp;
  lastMessageDate?: Timestamp;
  qualificationStatus?: QualificationStatus;
  notes?: string;
  tags?: string[];
};

export type HistoryItem = {
  role: "assistant" | "user";
  text: string;
  timestamp: number;
};

export type Conversation = {
  id: string;
  phone: string;
  chatId: string;
  listingCode: string;
  history: HistoryItem[];
  messageCount: number;
  lastMessage: Timestamp;
  name: string;
  qualified?: boolean | null;
  isFinished: boolean;
  notes?: string;
  tags?: string[];
  followUpSent?: boolean;
};

export type QualifiedLead = {
  id: string;
  phone: string;
  chatId: string;
  listingCode: string;
  conversationSummary: string;
  name: string;
  qualified: boolean;
  createdAt: Timestamp;
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

// Form types for creating/editing
export type ListingFormData = Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'closureInfo'>;
export type LeadFormData = Omit<Lead, 'id' | 'createdAt' | 'firstMessageDate' | 'lastMessageDate'>;
