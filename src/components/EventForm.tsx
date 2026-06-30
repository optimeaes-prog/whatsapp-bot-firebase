import { useState, type ReactNode } from "react";
import { CalendarClock } from "lucide-react";
import type { ActivityChannel, ActivityOutcome } from "../types";
import {
  PROSPECT_CHANNELS, PROSPECT_CHANNEL_LABELS,
  PROSPECT_OUTCOMES, PROSPECT_OUTCOME_LABELS,
  toDateTimeInputValue,
} from "../lib/prospectMeta";
import { Button } from "./ui";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 font-heading uppercase tracking-wider";

interface Props {
  disabled?: boolean;
  loading?: boolean;
  /** Resultados disponibles. Por defecto todos (propietarios); los leads pasan un subconjunto. */
  outcomes?: ActivityOutcome[];
  /** Texto del botón de envío. */
  submitLabel?: string;
  /** Campos extra del consumidor (p. ej. estado del comprador), bajo la nota. */
  extraFields?: ReactNode;
  onSubmit: (
    entry: { channel: ActivityChannel; outcome: ActivityOutcome; note?: string },
    eventDate: Date
  ) => void | Promise<void>;
}

/**
 * Formulario de EVENTO: registra algo que YA pasó (canal + resultado + nota + fecha).
 * Es la mitad "evento" de lo que antes hacía ContactLogForm; la parte "tarea" vive en TaskForm.
 */
export function EventForm({
  disabled, loading, outcomes = PROSPECT_OUTCOMES, submitLabel = "Registrar evento", extraFields, onSubmit,
}: Props) {
  const [channel, setChannel] = useState<ActivityChannel>("call");
  const [outcome, setOutcome] = useState<ActivityOutcome>(outcomes[0] || "other");
  const [note, setNote] = useState("");
  const [eventDate, setEventDate] = useState(() => toDateTimeInputValue(Date.now()));

  async function submit() {
    await onSubmit(
      { channel, outcome, note: note.trim() || undefined },
      eventDate ? new Date(eventDate) : new Date()
    );
    setNote("");
  }

  return (
    <section className="rounded-xl border border-gray-200 p-4 bg-gray-50/60">
      <div className="mb-3">
        <label className={`${labelClass} flex items-center gap-1`}><CalendarClock size={12} /> Fecha del evento</label>
        <input
          type="datetime-local"
          className={inputClass}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Canal</label>
          <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value as ActivityChannel)} disabled={disabled}>
            {PROSPECT_CHANNELS.map((c) => <option key={c} value={c}>{PROSPECT_CHANNEL_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Resultado</label>
          <select className={inputClass} value={outcome} onChange={(e) => setOutcome(e.target.value as ActivityOutcome)} disabled={disabled}>
            {outcomes.map((o) => <option key={o} value={o}>{PROSPECT_OUTCOME_LABELS[o]}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={labelClass}>Nota</label>
        <textarea
          className={`${inputClass} min-h-[60px] resize-none`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Qué se ha hablado, cómo ha ido..."
          disabled={disabled}
        />
      </div>
      {extraFields}

      <Button onClick={submit} loading={loading} disabled={disabled} className="w-full mt-3">
        {submitLabel}
      </Button>
    </section>
  );
}
