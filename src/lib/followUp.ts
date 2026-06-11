import type { Lead, LeadFollowUpStatus, Prospect } from "../types";
import { LEAD_FOLLOWUP_STATUS_LABELS, PROSPECT_STAGE_LABELS } from "../types";
import { isDueToday } from "../services/prospects";
import { isLeadDueToday, leadRecencyMillis } from "../services/leads";
import { LEAD_FOLLOWUP_STATUS_CLASSES, PROSPECT_STAGE_CLASSES } from "./prospectMeta";
import { formatPhone } from "./utils";

// --- Modelo unificado de fila de seguimiento --------------------------------
// Propietarios (Prospect) y compradores (Lead) comparten la misma agenda: este
// item normaliza ambos para listas mezcladas, ordenación y el registro rápido.

type FollowUpItemBase = {
  /** Único entre colecciones: `prospect:<id>` | `lead:<id>`. */
  id: string;
  name: string;
  phone: string | null;
  operationType: string | null;
  nextActionMillis: number | null;
  lastContactMillis: number | null;
  /** Para ordenar listas sin fecha (último toque del registro). */
  recencyMillis: number;
  isDue: boolean;
  /** Fuera del pipeline activo: ganado/descartado (prospect) o cerrado (lead). */
  isClosed: boolean;
  statusLabel: string;
  statusClasses: string;
};

export type ProspectFollowUpItem = FollowUpItemBase & { kind: "prospect"; prospect: Prospect };
export type LeadFollowUpItem = FollowUpItemBase & { kind: "lead"; lead: Lead };
export type FollowUpItem = ProspectFollowUpItem | LeadFollowUpItem;

const NO_STATUS_CLASSES = "bg-gray-100 text-gray-500";

function displayName(name?: string, phone?: string): string {
  return name?.trim() || (phone ? formatPhone(phone) : "") || "Sin nombre";
}

export function prospectToItem(p: Prospect): ProspectFollowUpItem {
  return {
    kind: "prospect",
    id: `prospect:${p.id}`,
    name: displayName(p.ownerName, p.phone),
    phone: p.phone || null,
    operationType: p.operationType || null,
    nextActionMillis: p.nextActionDate ? p.nextActionDate.toMillis() : null,
    lastContactMillis: p.lastContactAt ? p.lastContactAt.toMillis() : null,
    recencyMillis: Math.max(p.updatedAt?.toMillis?.() ?? 0, p.createdAt?.toMillis?.() ?? 0),
    isDue: isDueToday(p),
    isClosed: p.stage === "ganado" || p.stage === "descartado",
    statusLabel: PROSPECT_STAGE_LABELS[p.stage],
    statusClasses: PROSPECT_STAGE_CLASSES[p.stage],
    prospect: p,
  };
}

export function leadToItem(l: Lead): LeadFollowUpItem {
  return {
    kind: "lead",
    id: `lead:${l.id}`,
    name: displayName(l.name, l.phone),
    phone: l.phone || null,
    operationType: l.operationType || null,
    nextActionMillis: l.nextActionDate ? l.nextActionDate.toMillis() : null,
    lastContactMillis: l.lastContactAt ? l.lastContactAt.toMillis() : null,
    recencyMillis: leadRecencyMillis(l),
    isDue: isLeadDueToday(l),
    isClosed: l.followUpStatus === "cerrado",
    statusLabel: l.followUpStatus ? LEAD_FOLLOWUP_STATUS_LABELS[l.followUpStatus] : "Sin estado",
    statusClasses: l.followUpStatus ? LEAD_FOLLOWUP_STATUS_CLASSES[l.followUpStatus] : NO_STATUS_CLASSES,
    lead: l,
  };
}

/** ¿El lead ya está "en seguimiento"? (próxima acción, historial o estado fijado). */
export function leadHasFollowUp(l: Lead): boolean {
  return !!(l.nextActionDate || (l.activities && l.activities.length > 0) || l.followUpStatus);
}

/** ¿El estado del lead coincide con el filtro de chips? ("sin_estado" = sin followUpStatus). */
export function leadMatchesStatusFilter(
  l: Lead,
  filter: Set<LeadFollowUpStatus | "sin_estado">
): boolean {
  if (filter.size === 0) return true;
  return l.followUpStatus ? filter.has(l.followUpStatus) : filter.has("sin_estado");
}

// --- Ordenación: agenda primero ----------------------------------------------

/** Próxima acción ascendente (vencidas primero), sin fecha al final; desempata por último contacto y nombre. */
export function compareByNextAction(a: FollowUpItem, b: FollowUpItem): number {
  if (a.nextActionMillis != null || b.nextActionMillis != null) {
    if (a.nextActionMillis == null) return 1;
    if (b.nextActionMillis == null) return -1;
    if (a.nextActionMillis !== b.nextActionMillis) return a.nextActionMillis - b.nextActionMillis;
  }
  const byLastContact = (b.lastContactMillis ?? 0) - (a.lastContactMillis ?? 0);
  if (byLastContact !== 0) return byLastContact;
  return a.name.localeCompare(b.name);
}

export function sortProspectsByNextAction(list: Prospect[]): Prospect[] {
  return list.map(prospectToItem).sort(compareByNextAction).map((i) => i.prospect);
}

export function sortLeadsByNextAction(list: Lead[]): Lead[] {
  return list.map(leadToItem).sort(compareByNextAction).map((i) => i.lead);
}

// --- Buckets de agenda (hora local) ------------------------------------------
// Mismo criterio de "fin de día" que isDueToday / isLeadDueToday (23:59:59.999).

export type AgendaBucket = "vencidas" | "hoy" | "manana" | "semana" | "adelante" | "sin_fecha";

export const AGENDA_BUCKETS: AgendaBucket[] = [
  "vencidas",
  "hoy",
  "manana",
  "semana",
  "adelante",
  "sin_fecha",
];

export const AGENDA_BUCKET_LABELS: Record<AgendaBucket, string> = {
  vencidas: "Vencidas",
  hoy: "Hoy",
  manana: "Mañana",
  semana: "Esta semana",
  adelante: "Más adelante",
  sin_fecha: "Sin fecha",
};

function startOfDayMillis(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfTodayMillis(now: Date = new Date()): number {
  return startOfDayMillis(now.getTime());
}

/** Vencida = anterior al inicio de hoy (lo de hoy no cuenta como vencido). */
export function isOverdueMillis(ms: number | null, now: Date = new Date()): boolean {
  return ms != null && ms < startOfTodayMillis(now);
}

export function agendaBucketOf(nextActionMillis: number | null, now: Date = new Date()): AgendaBucket {
  if (nextActionMillis == null) return "sin_fecha";

  const startToday = startOfTodayMillis(now);
  if (nextActionMillis < startToday) return "vencidas";

  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  if (nextActionMillis <= endToday.getTime()) return "hoy";

  const endTomorrow = new Date(now);
  endTomorrow.setDate(endTomorrow.getDate() + 1);
  endTomorrow.setHours(23, 59, 59, 999);
  if (nextActionMillis <= endTomorrow.getTime()) return "manana";

  // Fin de la semana actual (lunes-domingo): si mañana ya es la semana
  // siguiente, "manana" tiene prioridad y este bucket queda vacío.
  const dowMon = (now.getDay() + 6) % 7;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(endOfWeek.getDate() + (6 - dowMon));
  endOfWeek.setHours(23, 59, 59, 999);
  if (nextActionMillis <= endOfWeek.getTime()) return "semana";

  return "adelante";
}

/** Agrupa y ordena cada bucket por próxima acción. */
export function groupByAgendaBucket(
  items: FollowUpItem[],
  now: Date = new Date()
): Record<AgendaBucket, FollowUpItem[]> {
  const groups: Record<AgendaBucket, FollowUpItem[]> = {
    vencidas: [], hoy: [], manana: [], semana: [], adelante: [], sin_fecha: [],
  };
  for (const item of items) {
    groups[agendaBucketOf(item.nextActionMillis, now)].push(item);
  }
  for (const bucket of AGENDA_BUCKETS) {
    groups[bucket].sort(compareByNextAction);
  }
  return groups;
}

/** "hoy" / "hace 1 día" / "hace N días" — para resaltar lo vencido. */
export function formatRelativeDays(ms: number, now: Date = new Date()): string {
  const days = Math.round((startOfTodayMillis(now) - startOfDayMillis(ms)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

/** Enlace wa.me a partir de un teléfono en cualquier formato. */
export function whatsappLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
