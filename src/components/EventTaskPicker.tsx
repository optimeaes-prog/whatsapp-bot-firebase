import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ChevronDown, CalendarPlus, ClipboardList } from "lucide-react";
import type { ActivityChannel, ActivityOutcome, ProspectNextActionType } from "../types";
import { addProspectActivity, addProspectTask } from "../services/prospects";
import { addLeadActivity, addLeadTask } from "../services/leads";
import { cn } from "../lib/utils";
import { EventForm } from "./EventForm";
import { TaskForm } from "./TaskForm";

type Mode = null | "evento" | "tarea";

interface Props {
  kind: "prospect" | "lead";
  id: string;
  readOnly?: boolean;
  currentUid: string;
  currentName?: string;
  /** Resultados disponibles en el evento (los leads pasan un subconjunto). */
  outcomes?: ActivityOutcome[];
  /** Genera un borrador de mensaje con IA para tareas de WhatsApp/email. */
  onGenerateMessage?: (channel: "message" | "email", note: string) => Promise<string>;
  /** Tras guardar (evento o tarea): el consumidor refresca y/o muestra confirmación. */
  onLogged?: (what: "evento" | "tarea") => void;
  /** Campos extra dentro de la tarjeta de evento (p. ej. una nota o el estado del lead). */
  eventExtraFields?: ReactNode;
}

/**
 * Selector reutilizable de 2 tarjetas — "Crear evento" (algo que ya pasó) vs "Crear tarea"
 * (algo por hacer). Cada tarjeta guarda al instante (addActivity / addTask). Lo usan el
 * modal rápido (QuickLogModal) y las fichas completas (ProspectDrawer / LeadEditModal).
 */
export function EventTaskPicker({
  kind, id, readOnly, currentUid, currentName, outcomes, onGenerateMessage, onLogged, eventExtraFields,
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [saving, setSaving] = useState(false);

  async function submitEvent(
    entry: { channel: ActivityChannel; outcome: ActivityOutcome; note?: string },
    eventDate: Date
  ) {
    if (readOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setSaving(true);
    try {
      if (kind === "prospect") {
        await addProspectActivity(id, { ...entry, createdByUid: currentUid, createdByName: currentName }, eventDate);
      } else {
        await addLeadActivity(id, { ...entry, createdByUid: currentUid, createdByName: currentName }, eventDate);
      }
      toast.success("Evento registrado");
      setMode(null);
      onLogged?.("evento");
    } catch (e) {
      console.error("[EventTaskPicker] evento", e);
      toast.error("Error al registrar el evento");
    } finally {
      setSaving(false);
    }
  }

  async function submitTask(dueAt: Date, type: ProspectNextActionType, message: string | null) {
    if (readOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setSaving(true);
    try {
      if (kind === "prospect") {
        await addProspectTask(id, { dueAt, type, message, createdByUid: currentUid, createdByName: currentName });
      } else {
        await addLeadTask(id, { dueAt, type, message, createdByUid: currentUid, createdByName: currentName });
      }
      toast.success("Tarea creada");
      setMode(null);
      onLogged?.("tarea");
    } catch (e) {
      console.error("[EventTaskPicker] tarea", e);
      toast.error("Error al crear la tarea");
    } finally {
      setSaving(false);
    }
  }

  // Acordeón: ambas tarjetas siempre visibles; al abrir una, la otra se queda colapsada (no desaparece).
  const cardHeader = (
    target: "evento" | "tarea",
    icon: ReactNode,
    iconClass: string,
    title: string,
    subtitle: string
  ) => {
    const active = mode === target;
    return (
      <button
        type="button"
        onClick={() => setMode(active ? null : target)}
        aria-expanded={active}
        className={cn(
          "w-full flex items-center gap-3 text-left rounded-xl border p-4 transition-colors",
          active ? "border-primary-300 bg-primary-50/40" : "border-gray-200 hover:border-primary-300 hover:bg-primary-50/40"
        )}
      >
        <span className={cn("shrink-0 rounded-lg p-2", iconClass)}>{icon}</span>
        <span className="min-w-0">
          <span className="block font-bold text-gray-900 font-heading">{title}</span>
          <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>
        </span>
        <ChevronDown size={18} className={cn("ml-auto shrink-0 text-gray-400 transition-transform", active && "rotate-180")} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {cardHeader(
          "evento",
          <CalendarPlus size={20} />,
          "bg-emerald-100 text-emerald-700",
          "Crear evento",
          "Registra algo que ya pasó: llamada, WhatsApp, visita…"
        )}
        {mode === "evento" && (
          <EventForm
            disabled={readOnly}
            loading={saving}
            outcomes={outcomes}
            submitLabel="Registrar evento"
            onSubmit={submitEvent}
            extraFields={eventExtraFields}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        {cardHeader(
          "tarea",
          <ClipboardList size={20} />,
          "bg-primary-100 text-primary-700",
          "Crear tarea",
          "Programa algo por hacer con fecha y hora."
        )}
        {mode === "tarea" && (
          <TaskForm
            disabled={readOnly}
            loading={saving}
            submitLabel="Crear tarea"
            onGenerateMessage={onGenerateMessage}
            onSubmit={submitTask}
          />
        )}
      </div>
    </div>
  );
}
