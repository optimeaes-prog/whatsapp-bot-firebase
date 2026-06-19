import type {
  ProspectStage,
  ProspectActivityChannel,
  ProspectActivityOutcome,
  ProspectPropertyType,
  ProspectSource,
  ProspectOperationType,
  LeadFollowUpStatus,
} from "../types";

/** Clases de color (pill) por etapa del pipeline — mismas en tablero y tabla. */
export const PROSPECT_STAGE_CLASSES: Record<ProspectStage, string> = {
  por_llamar: "bg-slate-100 text-slate-700",
  ilocalizable: "bg-gray-100 text-gray-600",
  seguimiento: "bg-primary-100 text-primary-800",
  citado: "bg-blue-100 text-blue-800",
  negociacion: "bg-violet-100 text-violet-800",
  ganado: "bg-emerald-100 text-emerald-800",
  descartado: "bg-rose-100 text-rose-700",
};

/** Acento de la columna del Kanban (barra superior). */
export const PROSPECT_STAGE_ACCENT: Record<ProspectStage, string> = {
  por_llamar: "bg-slate-400",
  ilocalizable: "bg-gray-400",
  seguimiento: "bg-primary-500",
  citado: "bg-blue-500",
  negociacion: "bg-violet-500",
  ganado: "bg-emerald-500",
  descartado: "bg-rose-400",
};

export const PROSPECT_OUTCOME_LABELS: Record<ProspectActivityOutcome, string> = {
  no_answer: "No coge",
  wrong_number: "Número no existe",
  phone_off: "Apagado",
  callback: "Llamar de nuevo",
  stalled: "Da largas",
  appointment_set: "Cita agendada",
  docs_pending: "Pendiente de documentación",
  won: "Encargo firmado",
  not_interested: "No interesa",
  has_tenant: "Tiene inquilino",
  other: "Otro",
};

export const PROSPECT_OUTCOMES: ProspectActivityOutcome[] = [
  "no_answer",
  "wrong_number",
  "phone_off",
  "callback",
  "stalled",
  "appointment_set",
  "docs_pending",
  "won",
  "not_interested",
  "has_tenant",
  "other",
];

/** Resultados disponibles al registrar contacto con un lead COMPRADOR (subconjunto de propietario). */
export const LEAD_ACTIVITY_OUTCOMES: ProspectActivityOutcome[] = [
  "no_answer",
  "callback",
  "stalled",
  "appointment_set",
  "not_interested",
  "other",
];

/** Clases de color (pill) por estado de seguimiento del comprador — espejo de PROSPECT_STAGE_CLASSES. */
export const LEAD_FOLLOWUP_STATUS_CLASSES: Record<LeadFollowUpStatus, string> = {
  nuevo: "bg-slate-100 text-slate-700",
  contactar: "bg-primary-100 text-primary-800",
  en_conversacion: "bg-blue-100 text-blue-800",
  visita: "bg-violet-100 text-violet-800",
  cerrado: "bg-gray-100 text-gray-600",
};

/** Acento de la columna del Kanban de leads (barra superior) — espejo de PROSPECT_STAGE_ACCENT. */
export const LEAD_FOLLOWUP_STATUS_ACCENT: Record<LeadFollowUpStatus | "sin_estado", string> = {
  sin_estado: "bg-gray-300",
  nuevo: "bg-slate-400",
  contactar: "bg-primary-500",
  en_conversacion: "bg-blue-500",
  visita: "bg-violet-500",
  cerrado: "bg-gray-400",
};

export const PROSPECT_CHANNEL_LABELS: Record<ProspectActivityChannel, string> = {
  call: "Llamada",
  whatsapp: "WhatsApp",
  email: "Email",
  visit: "Visita",
  note: "Nota",
};

export const PROSPECT_CHANNELS: ProspectActivityChannel[] = [
  "call",
  "whatsapp",
  "email",
  "visit",
  "note",
];

export const PROSPECT_PROPERTY_TYPES: ProspectPropertyType[] = [
  "Piso",
  "Casa",
  "Ático",
  "Local",
  "Garaje",
  "Terreno",
  "Nave",
  "Otro",
];

export const PROSPECT_OPERATION_TYPES: ProspectOperationType[] = ["Venta", "Alquiler", "Traspaso"];

export const PROSPECT_SOURCE_LABELS: Record<ProspectSource, string> = {
  idealista: "Idealista",
  fotocasa: "Fotocasa",
  wallapop: "Wallapop",
  milanuncios: "Milanuncios",
  particular: "Particular",
  otro: "Otro",
};

export const PROSPECT_SOURCES: ProspectSource[] = [
  "idealista",
  "fotocasa",
  "wallapop",
  "milanuncios",
  "particular",
  "otro",
];

/** Fecha corta (sin hora) para "próxima acción" / "último contacto". */
export function formatShortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** `<input type="date">` quiere `YYYY-MM-DD` en hora local. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const off = d.getTimezoneOffset();
  return new Date(ms - off * 60000).toISOString().slice(0, 10);
}

/** `<input type="datetime-local">` quiere `YYYY-MM-DDTHH:mm` en hora local. */
export function toDateTimeInputValue(ms: number): string {
  const off = new Date(ms).getTimezoneOffset();
  return new Date(ms - off * 60000).toISOString().slice(0, 16);
}

/** Fecha + hora corta para mostrar próximas acciones con hora. */
export function formatShortDateTime(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Antelación del recordatorio (minutos antes de la próxima acción). */
export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "A la hora" },
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 día antes" },
];
