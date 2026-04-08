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
  listingCodeFotocasa?: string;           // ID Fotocasa (opcional)
  referencia: string;                     // Referencia del anuncio (normalmente igual a listingCode si no tienen CRM propio)
  link: string;
  operationType: OperationType;
  features: string;
  profitabilityReportAvailable: boolean;
  profitabilityReport: string;
  isActive: boolean;                      // true = activo, false = inactivo
  closureInfo?: ListingClosureInfo;       // Info de cierre (solo si isActive = false)
  idealistaDescription?: string;          // Descripción manual de Idealista
  /** Si está activo, al resolver el anuncio se notifica al agente y se hace handoff sin cualificación */
  quickQualificationEnabled?: boolean;
  price?: string;                         // Precio
  m2?: string;                            // Metros cuadrados
  rooms?: string;                         // Habitaciones
  /** Línea única para mostrar / legado; puede componerse desde los campos estructurados al guardar */
  address?: string;
  /** Vía y número (p. ej. Calle Mayor 12) */
  street?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  /** Por defecto ES / España en UI */
  country?: string;
  /** Derivado de province para búsqueda por voz (minúsculas, sin acentos) */
  provinceNormalized?: string;
  agentName?: string;                     // Nombre del agente responsable
  // Filtros de cualificación (opcionales, se aplican antes de notificar al agente)
  minMonthlyIncome?: number;             // Alquiler: ingresos netos mensuales mínimos exigidos
  maxPeople?: number;                    // Alquiler: máximo de personas permitidas
  requireMortgageApproved?: boolean;     // Venta: solo hipoteca concedida o pago al contado
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type QualificationStatus = "not_qualified" | "qualified" | "rejected" | "no_response";

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
  pets?: boolean;
  income?: number;
  paymentMethod?: "Contado" | "Hipoteca";
  tags?: string[];
  lastAnalyzedAt?: Timestamp;
  conversationSummary?: string;
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
  listingCode?: string;
  history: HistoryItem[];
  messageCount: number;
  lastMessage: Timestamp;
  name: string;
  qualified?: boolean | null;
  isFinished: boolean;
  notes?: string;
  tags?: string[];
  followUpSent?: boolean;
  botDisabled?: boolean;
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
  messagingProvider?: MessagingProvider;
  orgName?: string;                       // Nombre de la inmobiliaria
};

export type MessagingProvider = "whapi" | "twilio";


export type AlertSeverity = "info" | "warning" | "critical" | "healthy";

export type SystemAlert = {
  id: string;
  subject: string;
  details: any;
  severity: AlertSeverity;
  timestamp: Timestamp;
};

// Form types for creating/editing
export type ListingFormData = Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'closureInfo'>;
export type LeadFormData = Omit<Lead, 'id' | 'createdAt' | 'firstMessageDate' | 'lastMessageDate'>;

// Credit System Types
export type UserCredits = {
  userId: string;
  balance: number;
  updatedAt: Timestamp;
};

export type CreditPackage = {
  id: string;
  name: string;
  amount: number;       // Price in cents (e.g., 500 = €5.00)
  credits: number;      // Credits to add (e.g., 50)
  currency: "eur" | "usd" | "gbp";
};

export type SubscriptionPlanId = "free" | "plus" | "pro" | "pro_plus" | "enterprise";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  priceMonthly: number | null;    // null = enterprise (contact sales)
  creditsMonthly: number;
  bonusCredits: number;
  conversationsMonthly: number;
  popular?: boolean;
};

export type AutoRechargeSettings = {
  enabled: boolean;
  thresholdCredits: number;   // Trigger auto-buy when balance drops below this
  rechargeCredits: number;    // Credits to purchase automatically (100 = €10)
};

// Audit Log Types
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
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userName?: string;
  isSystemAction: boolean;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: any;
  timestamp: Timestamp;
};
