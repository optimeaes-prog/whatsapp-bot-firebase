import { Timestamp } from "firebase/firestore";
import type { ProspectTask, ProspectNextActionType } from "../types";

// --- Lógica pura de tareas (sin Firestore) ----------------------------------
// Las tareas (`tasks[]`) son la fuente de verdad de la agenda. Los escalares
// nextActionDate/Type/Message son un ESPEJO de la tarea pendiente más próxima,
// que recalculamos con `deriveNextActionMirror` cada vez que cambian las tareas.
// Así toda la maquinaria existente (digest, buckets de agenda, kanban, isDueToday)
// sigue funcionando sin tocarse.

/** Tareas aún por hacer (no completadas). */
export function pendingTasks(tasks?: ProspectTask[] | null): ProspectTask[] {
  return (tasks || []).filter((t) => !t.done);
}

/** Tareas ya completadas (historial). */
export function completedTasks(tasks?: ProspectTask[] | null): ProspectTask[] {
  return (tasks || []).filter((t) => t.done);
}

/** La tarea pendiente más próxima (menor `dueAt`). null si no hay ninguna. */
export function earliestPendingTask(tasks?: ProspectTask[] | null): ProspectTask | null {
  const p = pendingTasks(tasks);
  if (p.length === 0) return null;
  return p.reduce((a, b) => (a.dueAt.toMillis() <= b.dueAt.toMillis() ? a : b));
}

/** Campos espejo (escalares) derivados de la tarea pendiente más próxima. */
export function deriveNextActionMirror(tasks?: ProspectTask[] | null): {
  nextActionDate: Timestamp | null;
  nextActionType: ProspectNextActionType | null;
  nextActionMessage: string | null;
} {
  const t = earliestPendingTask(tasks);
  return t
    ? { nextActionDate: t.dueAt, nextActionType: t.type, nextActionMessage: t.message ?? null }
    : { nextActionDate: null, nextActionType: null, nextActionMessage: null };
}

/**
 * Sintetiza `tasks[]` desde los escalares legados (registros viejos sin `tasks`).
 * Solo lectura: NO persiste. Si ya hay tareas, las devuelve tal cual.
 */
export function synthesizeLegacyTasks(rec: {
  tasks?: ProspectTask[] | null;
  nextActionDate?: Timestamp;
  nextActionType?: ProspectNextActionType | null;
  nextActionMessage?: string | null;
}): ProspectTask[] {
  if (rec.tasks && rec.tasks.length > 0) return rec.tasks;
  if (!rec.nextActionDate) return [];
  return [
    {
      id: "legacy",
      dueAt: rec.nextActionDate,
      type: rec.nextActionType || "call",
      message: rec.nextActionMessage ?? null,
      done: false,
      createdByUid: "",
    },
  ];
}
