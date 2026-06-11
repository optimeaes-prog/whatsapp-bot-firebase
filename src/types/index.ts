import { Timestamp } from "firebase/firestore";

export type OperationType = "Venta" | "Alquiler";

/**
 * Sub-tipo de alquiler. Aplica solo si operationType === "Alquiler".
 * Para "Venta" (o si el agente no quiere clasificar) se usa "No aplica".
 */
export type RentalSubtype = "Vacacional" | "Temporada" | "Larga temporada" | "No aplica";

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
  /** Sub-tipo de alquiler (solo significativo si operationType === "Alquiler"). */
  rentalSubtype?: RentalSubtype;
  /** Si está activo, al resolver el anuncio se notifica al agente y se hace handoff sin cualificación */
  quickQualificationEnabled?: boolean;
  /** UID del usuario que creó el anuncio (para scoping por rol agent). */
  createdByUid?: string;
  /** UID del agente asignado (para scoping por rol agent). */
  assignedAgentUid?: string;
  /** Nombre del agente asignado (solo para UI; no es fuente de verdad). */
  assignedAgentName?: string;
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
  /**
   * IDs de la colección `organizations/{orgId}/notificationNumbers` a los que se enviarán
   * los resúmenes de leads cualificados. Sustituye al merge legacy de org+agent.
   * El array siempre tiene >=1 entrada; planes no Pro+ están limitados a 1.
   */
  notificationNumberIds?: string[];
  // Filtros de cualificación (opcionales, se aplican antes de notificar al agente)
  minMonthlyIncome?: number;             // Alquiler: ingresos netos mensuales mínimos exigidos
  maxPeople?: number;                    // Alquiler: máximo de personas permitidas
  requireMortgageApproved?: boolean;     // Venta: solo hipoteca concedida o pago al contado
  /** Captación (prospect) desde la que se copió este anuncio. Sin sincronización en vivo. */
  captacionId?: string;
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
  /** UID del agente asignado al anuncio en el momento de crear/upsert el lead. */
  assignedAgentUid?: string;
  notes?: string;
  email?: string;
  pets?: boolean;
  income?: number;
  paymentMethod?: "Contado" | "Hipoteca";
  tags?: string[];
  // Seguimiento del lead COMPRADOR (agenda + historial). Reutiliza la maquinaria de Prospect
  // pero con estados propios de comprador (no las etapas de propietario).
  nextActionDate?: Timestamp;
  reminderMinutesBefore?: number | null;
  reminderSentAt?: Timestamp | null;
  lastContactAt?: Timestamp;
  activities?: Activity[];
  followUpStatus?: LeadFollowUpStatus;
  lastAnalyzedAt?: Timestamp;
  conversationSummary?: string;
  errorDetails?: string;
  consent?: {
    capturedAt: Timestamp;
    source: "idealista_form" | "agency_website" | "phone_call" | "in_person" | "inbound_whatsapp";
    collectedBy?: string;
    language?: "es" | "en";
    proofUrl?: string;
  };
};

// Estado de seguimiento de un lead COMPRADOR. Distinto de las etapas de propietario
// (ProspectStage): un comprador no "se gana como encargo".
export type LeadFollowUpStatus =
  | "nuevo"            // sin gestionar
  | "contactar"       // hay que llamar/escribir
  | "en_conversacion" // hablando
  | "visita"          // visita agendada
  | "cerrado";        // convertido o descartado (sale de "pendientes")

export const LEAD_FOLLOWUP_STATUSES: LeadFollowUpStatus[] = [
  "nuevo",
  "contactar",
  "en_conversacion",
  "visita",
  "cerrado",
];

export const LEAD_FOLLOWUP_STATUS_LABELS: Record<LeadFollowUpStatus, string> = {
  nuevo: "Nuevo",
  contactar: "Por contactar",
  en_conversacion: "En conversación",
  visita: "Visita",
  cerrado: "Cerrado",
};

// --- Seguimiento / Captación ------------------------------------------------
// Pipeline del lado de "oferta": el agente llama a propietarios (particulares
// de Idealista/Fotocasa…) para conseguir el encargo de vender/alquilar. Es
// independiente de los Leads compradores que entran por WhatsApp.

export type ProspectOperationType = "Venta" | "Alquiler" | "Traspaso";

export type ProspectStage =
  | "por_llamar"     // nuevo, sin contactar (LLAMADO = NO)
  | "ilocalizable"   // no coge / número no existe / apagado
  | "seguimiento"    // llamar mañana / da largas / reconducido
  | "citado"         // cita o visita agendada
  | "negociacion"    // pendiente docu / no firmado, esperando
  | "ganado"         // encargo firmado
  | "descartado";    // no interesa / tiene inquilino / parado

export const PROSPECT_STAGES: ProspectStage[] = [
  "por_llamar",
  "ilocalizable",
  "seguimiento",
  "citado",
  "negociacion",
  "ganado",
  "descartado",
];

export const PROSPECT_STAGE_LABELS: Record<ProspectStage, string> = {
  por_llamar: "Por llamar",
  ilocalizable: "Ilocalizable",
  seguimiento: "Seguimiento",
  citado: "Citado",
  negociacion: "Negociación / Docu",
  ganado: "Encargo ganado",
  descartado: "Descartado",
};

export type ProspectPropertyType =
  | "Piso" | "Casa" | "Ático" | "Local" | "Garaje" | "Terreno" | "Nave" | "Otro";

export type ProspectSource =
  | "idealista" | "fotocasa" | "wallapop" | "milanuncios" | "particular" | "otro";

export type ProspectActivityChannel = "call" | "whatsapp" | "email" | "visit" | "note";

export type ProspectActivityOutcome =
  | "no_answer"        // NO COGE
  | "wrong_number"     // NÚMERO NO EXISTE
  | "phone_off"        // APAGADO
  | "callback"         // LLAMAR MAÑANA
  | "stalled"          // ME HA DADO LARGAS
  | "appointment_set"  // CITADO
  | "docs_pending"     // ME MANDA LA DOCU / PENDIENTE
  | "won"              // HACER ENCARGO (firmado)
  | "not_interested"   // NO INTERESANTE
  | "has_tenant"       // TIENE INQUILINO
  | "other";

/** Un intento de contacto. Sustituye al ESTADO de texto libre del Excel por un historial estructurado. */
export type ProspectActivity = {
  id: string;
  at: Timestamp;
  channel: ProspectActivityChannel;
  outcome: ProspectActivityOutcome;
  note?: string;
  createdByUid: string;
  createdByName?: string;      // denormalizado solo para mostrar
};

export type Prospect = {
  id: string;
  orgId: string;
  stage: ProspectStage;
  operationType: ProspectOperationType;
  propertyType?: ProspectPropertyType;        // TIPO
  source?: ProspectSource;
  campaign?: string;                          // pestaña de origen al importar (VENTA 2026, OKUPAS…)
  ownerName?: string;                         // NOMBRE
  phone?: string;                             // TELEFONO
  email?: string;                             // EMAIL del propietario (captación)
  listingUrl?: string;                        // link al anuncio original
  address?: string;                           // DIRECCIÓN
  municipality?: string;                      // MUNICIPIO
  zone?: string;                              // ZONA
  price?: string;                             // PRECIO
  features?: string;                          // CARACTERÍSTICAS / DETALLES
  // Datos del inmueble (mezcla con Anuncios): se rellenan al captar y sirven para
  // autocompletar el Anuncio. Todos opcionales por compatibilidad con prospectos antiguos.
  m2?: string;                                // metros cuadrados
  rooms?: string;                             // habitaciones
  street?: string;                            // vía y número
  city?: string;                              // ciudad
  province?: string;                          // provincia
  postalCode?: string;                        // código postal
  country?: string;                           // país (por defecto España en UI)
  idealistaDescription?: string;              // descripción comercial larga
  referencia?: string;                        // referencia interna / CRM
  photos?: string[];                          // URLs de fotos en Storage (captacion-photos)
  stillListed?: boolean;                      // A LA VENTA / PUBLICADO SI/NO
  nextActionDate?: Timestamp;                 // FECHA SEGUIMIENTO (próxima acción, con hora)
  reminderMinutesBefore?: number | null;      // recordatorio: minutos antes de nextActionDate (null = sin recordatorio)
  reminderSentAt?: Timestamp | null;          // cuándo se envió el email de recordatorio (lo escribe Cloud Functions)
  lastContactAt?: Timestamp;                  // ÚLTIMO CONTACTO (derivado de la última actividad)
  activities: ProspectActivity[];             // historial de contactos
  learnings?: string;                         // APRENDIZAJES
  createdByUid?: string;
  assignedAgentUid?: string;
  assignedAgentName?: string;                 // solo para UI
  wonListingId?: string;                      // anuncio publicado desde esta captación (back-ref)
  linkedLeadId?: string;                      // enlace opcional a un lead comprador
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type ProspectFormData = Omit<
  Prospect,
  "id" | "orgId" | "activities" | "lastContactAt" | "wonListingId" | "createdAt" | "updatedAt"
>;

/**
 * "Captación" es el MISMO registro que `Prospect` (vive en `organizations/{orgId}/prospects`).
 * Es solo un alias para que el código de la sección Captaciones se lea de forma natural;
 * no hay segunda colección ni migración.
 */
export type Captacion = Prospect;
export type CaptacionFormData = ProspectFormData;

/** Actividad de seguimiento genérica: vale para propietarios (Prospect) y para leads compradores. */
export type Activity = ProspectActivity;
export type ActivityChannel = ProspectActivityChannel;
export type ActivityOutcome = ProspectActivityOutcome;

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
  optedOut?: boolean;
};

export type BotStyle = {
  id: string;
  name: string;
  description: string;
  promptModifier: string;
};

export type CloudApiConfig = {
  accessTokenSecretName: string;
  phoneNumberId: string;
  wabaId: string;
  graphApiVersion?: string;
  verifyToken: string;
  displayPhoneNumber?: string;
  assistantAvatarId?: string;
  assistantAvatarName?: string;
  assistantAvatarUrl?: string;
  templates?: {
    agentNotification?: string;
    agentNotificationEs?: string;
    agentNotificationEn?: string;
    idealistaConfirmEs?: string;
    idealistaConfirmEn?: string;
    idealistaInitialEs?: string;
    idealistaInitialEn?: string;
    callHandoffOrgEs?: string;
    callHandoffOrgEn?: string;
  };
};

export type BotConfig = {
  activeStyleId: string;
  styles: BotStyle[];
  messagingProvider?: MessagingProvider;
  orgName?: string;                       // Nombre de la inmobiliaria
  /** Siempre reciben resúmenes de leads cualificados; ver también Equipo (agente asignado). */
  notificationNumbers?: string;
  cloudApiConfig?: CloudApiConfig;
  twilioTemplates?: {
    agentNotification?: string;
    agentNotificationLegacy?: string;
    /** True when `agentNotification` is the 8-variable Proplead-style format (set by migration). */
    agentNotificationIs8Var?: boolean;
    callHandoffOrgEs?: string;
    callHandoffOrgEn?: string;
    callHandoffOrgNoNameEs?: string;
    callHandoffOrgNoNameEn?: string;
    voiceOptInConsent?: string;
    idealistaInitialEs?: string;
    idealistaInitialEn?: string;
  };
  twilioConfig?: {
    accountSid?: string;
    whatsappNumber?: string;
    smsSenderId?: string;
    authTokenSecretName?: string;
  };
  templateEligibility?: {
    outboundTemplatesBlocked?: boolean;
    missingRequiredKeys?: string[];
    checkedAt?: Timestamp;
  };
};

export type MessagingProvider = "cloud_api" | "twilio";


export type AlertSeverity = "info" | "warning" | "critical" | "healthy";

export type SystemAlert = {
  id: string;
  subject: string;
  details: any;
  severity: AlertSeverity;
  timestamp: Timestamp;
};

/**
 * Número de teléfono al que se envían los resúmenes de leads cualificados.
 * Vive en `organizations/{orgId}/notificationNumbers/{id}`. La verificación se
 * gestiona vía Twilio Verify; `verified: true` sólo lo escribe Cloud Functions.
 */
export type NotificationNumber = {
  id: string;
  /** E.164 canónico, p.ej. "+34612345678". */
  e164: string;
  /** Dígitos sin "+", para dedupe rápido y unicidad por org. */
  phoneDigests: string;
  label?: string;
  verified: boolean;
  verificationStatus?: "pending" | "approved" | "canceled" | "expired";
  verifiedAt?: Timestamp;
  /** Por org: exactamente uno con true (el verificado en onboarding por defecto). */
  isOrgDefault?: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  source?:
    | "onboarding"
    | "team_add"
    | "backfill_org_summary"
    | "backfill_botconfig"
    | "backfill_user_agent";
  /** Sólo para entries provenientes del backfill por-agente, para auditoría. */
  legacyOwnerUid?: string;
};

// Form types for creating/editing
export type ListingFormData = Omit<Listing, 'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'closureInfo'>;
export type LeadFormData = Omit<Lead, 'id' | 'createdAt' | 'firstMessageDate' | 'lastMessageDate'>;

// Billing / Conversation System Types
export type UserConversations = {
  userId: string;
  balance: number;
  updatedAt: Timestamp;
};

export type ConversationPackage = {
  id: string;
  name: string;
  amount: number;       // Price in cents (e.g., 1000 = €10.00)
  conversations: number;      // Conversations to add (e.g., 40)
  currency: "eur" | "usd" | "gbp";
};

export type SubscriptionPlanId = "free" | "plus" | "pro" | "pro_plus" | "enterprise";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  name: string;
  priceMonthly: number | null;    // null = enterprise (contact sales)
  conversationsMonthly: number;
  bonusConversations: number;
  popular?: boolean;
};

export type AutoRechargeSettings = {
  enabled: boolean;
  thresholdConversations: number;   // Trigger auto-buy when balance drops below this
  rechargeConversations: number;    // Conversations to purchase automatically (40 = €10)
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
