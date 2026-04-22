import type { AlertSeverity } from "../types";

export type AlertCatalogKey =
  | "whapi_down"
  | "cloud_api_down"
  | "cloud_api_template_rejected"
  | "sync_task_error"
  | "sync_error"
  | "sync_failed"
  | "sync_discrepancies"
  | "twilio_maintenance"
  | "provider_maintenance"
  | "failed_message_permanent"
  | "retry_task_error"
  | "webhook_error"
  | "fatal_webhook_error"
  | "process_buffer_error"
  | "state_not_found"
  | "new_lead_error"
  | "manual_test_alert"
  | "status_report";

export type AlertCatalogItem = {
  key: AlertCatalogKey;
  /** Exact subject stored in Firestore (except status_report, which matches prefix). */
  subject: string;
  description: string;
  defaultSeverity: AlertSeverity;
  /**
   * How often the system auto-runs the check that can generate this alert.
   * - "event": generated only when the event happens (no periodic check)
   * - "schedule": periodic check with a human-friendly interval label
   */
  autoTest: { kind: "event" } | { kind: "schedule"; every: string };
};

export const ALERT_CATALOG: AlertCatalogItem[] = [
  {
    key: "whapi_down",
    subject: "Whapi Down",
    description: "Whapi no responde o el token es inválido (health-check programado).",
    defaultSeverity: "warning",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "cloud_api_down",
    subject: "Cloud API Down",
    description: "WhatsApp Cloud API no responde o el Access Token es inválido.",
    defaultSeverity: "warning",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "cloud_api_template_rejected",
    subject: "Plantilla Cloud API Rechazada",
    description: "Meta rechazó una plantilla de Cloud API (revisar categoría o contenido).",
    defaultSeverity: "warning",
    autoTest: { kind: "event" },
  },
  {
    key: "sync_task_error",
    subject: "Sync Task Error",
    description: "Falló la tarea programada de sincronización.",
    defaultSeverity: "critical",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "sync_error",
    subject: "Sync Error",
    description: "No se pudieron obtener chats de Whapi durante la sincronización.",
    defaultSeverity: "critical",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "sync_failed",
    subject: "Sync Failed",
    description: "Fallo crítico general durante la sincronización Whapi ↔ Firestore.",
    defaultSeverity: "critical",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "sync_discrepancies",
    subject: "Discrepancias de Sincronización Detectadas",
    description: "Se detectaron desajustes entre Whapi y Firestore (mismatch/missing/stale buffer).",
    defaultSeverity: "warning",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "twilio_maintenance",
    subject: "Mantenimiento de Twilio",
    description: "Mantenimiento cuando Twilio está activo (p. ej. buffers atascados).",
    defaultSeverity: "warning",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "provider_maintenance",
    subject: "Mantenimiento de Proveedor",
    description: "Mantenimiento cuando un proveedor sin listing de chats está activo (Twilio/Cloud API) — p. ej. buffers atascados.",
    defaultSeverity: "warning",
    autoTest: { kind: "schedule", every: "cada 30 min" },
  },
  {
    key: "failed_message_permanent",
    subject: "Mensaje Fallido Permanentemente",
    description: "Un mensaje excedió reintentos máximos y se marcó como fallido permanente.",
    defaultSeverity: "critical",
    autoTest: { kind: "schedule", every: "cada 15 min" },
  },
  {
    key: "retry_task_error",
    subject: "Retry Task Error",
    description: "Falló la tarea programada de reintento de mensajes.",
    defaultSeverity: "warning",
    autoTest: { kind: "schedule", every: "cada 15 min" },
  },
  {
    key: "webhook_error",
    subject: "Webhook Error",
    description: "Error al bufferizar mensajes entrantes en el webhook.",
    defaultSeverity: "warning",
    autoTest: { kind: "event" },
  },
  {
    key: "fatal_webhook_error",
    subject: "Fatal Webhook Error",
    description: "Error crítico a nivel global en el webhook principal.",
    defaultSeverity: "critical",
    autoTest: { kind: "event" },
  },
  {
    key: "process_buffer_error",
    subject: "ProcessBuffer Error",
    description: "Error al procesar el buffer de mensajes (Cloud Tasks).",
    defaultSeverity: "warning",
    autoTest: { kind: "event" },
  },
  {
    key: "state_not_found",
    subject: "Estado no encontrado",
    description: "No se pudo reconstruir el estado de conversación (lead/anuncio inexistente).",
    defaultSeverity: "warning",
    autoTest: { kind: "event" },
  },
  {
    key: "new_lead_error",
    subject: "NewLead Error",
    description: "Error al buscar el anuncio/listing al crear o gestionar un lead.",
    defaultSeverity: "warning",
    autoTest: { kind: "event" },
  },
  {
    key: "manual_test_alert",
    subject: "Prueba Manual de Alerta",
    description: "Prueba manual para verificar que el sistema de alertas/email funciona.",
    defaultSeverity: "info",
    autoTest: { kind: "event" },
  },
  {
    key: "status_report",
    subject: "STATUS REPORT:",
    description: "Reporte periódico de estado (se guarda como alerta).",
    defaultSeverity: "healthy",
    autoTest: { kind: "schedule", every: "2 veces al día" },
  },
];

