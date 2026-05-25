/**
 * Colores semánticos para métricas, embudo (Dashboard) y badges de estado.
 * Mantener contadores / % / pills alineados con estos tokens.
 */
export const metricTheme = {
  leads: {
    funnelBg: "bg-slate-100",
    funnelText: "text-slate-700",
  },
  conversations: {
    /** Embudo: neutro (misma línea visual que conteos en listas), no indigo */
    funnelBg: "bg-gray-100",
    funnelText: "text-gray-800",
    /** Listados (p. ej. Anuncios): neutro, no el color del embudo */
    listValue: "text-gray-900",
    listIcon: "text-gray-500",
  },
  responded: {
    funnelBg: "bg-sky-50",
    funnelText: "text-sky-700",
    value: "text-sky-600",
    icon: "text-sky-600",
    iconSoft: "text-sky-500",
  },
  qualified: {
    funnelBg: "bg-emerald-50",
    funnelText: "text-emerald-700",
    value: "text-emerald-700",
    kpiValue: "text-emerald-600",
    icon: "text-emerald-600",
    iconSoft: "text-emerald-500",
  },
  qualificationRate: {
    value: "text-violet-600",
    icon: "text-violet-600",
    iconSoft: "text-violet-500",
  },
  messages: {
    /** KPI Dashboard — tarjeta Leads (mismo tono que antes tenía Mensajes) */
    kpiLeads: "text-gray-900",
    /** KPI Dashboard — Mensajes totales (gris claro vs Leads) */
    kpiValue: "text-gray-500",
    /** Tablas y filas compactas */
    listValue: "text-gray-900",
    listMuted: "text-gray-400",
    listIcon: "text-gray-500",
    /** Pie de tarjeta móvil (como antes: icono marca) */
    listIconCard: "text-primary-500",
  },
  conversion: {
    icon: "text-indigo-500",
    text: "text-indigo-600",
  },
} as const;

/** Cualificación en badges compactos (mismo criterio que QualificationBadge) */
export const qualificationStatusClasses = {
  notQualified: "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700",
  noResponse: "rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800",
  qualified: "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700",
  rejected: "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700",
} as const;

/** Tags personalizados en tarjetas/tablas */
export const customLeadTagSm =
  "px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary-50 text-primary-600 border border-primary-100";
export const customLeadTagMd =
  "px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-600 border border-primary-100";

/** Pill “Cualificado” en listas (Cualificados) */
export const qualifiedListPill =
  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700";

/** Pill “Pendiente” / warning (estado pendiente de acción) */
export const pendingPillSm =
  "px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-700 uppercase tracking-tighter";
export const pendingPillMd =
  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-100";

/** Estado conversación en cabeceras de chat */
export const conversationHeaderPills = {
  finalized: "px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200 text-slate-700",
  qualified: "px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700",
  notInterested: "px-2 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-700",
} as const;
