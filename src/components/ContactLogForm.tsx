import { useState, type ReactNode } from "react";
import { CalendarClock, Bell } from "lucide-react";
import type { ActivityChannel, ActivityOutcome } from "../types";
import {
  PROSPECT_CHANNELS, PROSPECT_CHANNEL_LABELS,
  PROSPECT_OUTCOMES, PROSPECT_OUTCOME_LABELS, REMINDER_OPTIONS,
  toDateTimeInputValue,
} from "../lib/prospectMeta";
import { cn } from "../lib/utils";
import { Button } from "./ui";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 font-heading uppercase tracking-wider";

interface Props {
  disabled?: boolean;
  loading?: boolean;
  /** Resultados disponibles. Por defecto todos (propietarios); los leads compradores pasan un subconjunto. */
  outcomes?: ActivityOutcome[];
  /** Valor inicial del datetime-local (YYYY-MM-DDTHH:mm), p. ej. la próxima acción ya fijada. */
  initialNextDate?: string;
  /** Recordatorio inicial en minutos antes (null = sin recordatorio). */
  initialReminderMinutes?: number | null;
  /** Texto del botón de envío. */
  submitLabel?: string;
  /** Campos extra del consumidor (p. ej. estado de seguimiento del comprador), entre la nota y la fecha. */
  extraFields?: ReactNode;
  onSubmit: (
    entry: { channel: ActivityChannel; outcome: ActivityOutcome; note?: string },
    nextDate: Date | null,
    reminderMinutes: number | null
  ) => void | Promise<void>;
}

/** "Hoy" = dentro de ~1 hora, redondeado a la media hora siguiente. */
function presetTodayValue(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60);
  const m = d.getMinutes();
  if (m !== 0) d.setMinutes(m <= 30 ? 30 : 60, 0, 0);
  else d.setSeconds(0, 0);
  return toDateTimeInputValue(d.getTime());
}

/** Dentro de N días, a las 09:00. */
function presetInDaysValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return toDateTimeInputValue(d.getTime());
}

/**
 * Formulario reutilizable "Registrar evento" (canal + resultado + nota + próxima acción con
 * fecha/hora + recordatorio opcional). Lo usan el seguimiento de leads compradores, las
 * captaciones (ProspectDrawer) y el registro rápido de la página Seguimiento.
 *
 * El estado se inicializa al montar: pasa `key={entityId}` para re-montarlo al cambiar de registro.
 */
export function ContactLogForm({
  disabled, loading, outcomes = PROSPECT_OUTCOMES, initialNextDate = "", initialReminderMinutes = null,
  submitLabel = "Registrar evento", extraFields, onSubmit,
}: Props) {
  const [channel, setChannel] = useState<ActivityChannel>("call");
  const [outcome, setOutcome] = useState<ActivityOutcome>(outcomes[0] || "other");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState(initialNextDate);
  const [reminderOn, setReminderOn] = useState(initialReminderMinutes != null);
  const [reminderMinutes, setReminderMinutes] = useState<number>(initialReminderMinutes ?? 30);

  const presets: { label: string; value: string }[] = [
    { label: "Hoy", value: presetTodayValue() },
    { label: "Mañana", value: presetInDaysValue(1) },
    { label: "+3 días", value: presetInDaysValue(3) },
    { label: "+1 semana", value: presetInDaysValue(7) },
    { label: "Sin fecha", value: "" },
  ];

  async function submit() {
    await onSubmit(
      { channel, outcome, note: note.trim() || undefined },
      nextDate ? new Date(nextDate) : null,
      nextDate && reminderOn ? reminderMinutes : null
    );
    setNote("");
  }

  return (
    <section className="rounded-xl border border-gray-200 p-4 bg-gray-50/60">
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
          placeholder="Qué se ha hablado, próximos pasos..."
          disabled={disabled}
        />
      </div>
      {extraFields}
      <div className="mt-3">
        <label className={cn(labelClass, "flex items-center gap-1")}><CalendarClock size={12} /> Próxima acción</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={disabled}
              onClick={() => setNextDate(p.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40",
                nextDate === p.value
                  ? "bg-primary-100 text-primary-800 border-primary-200"
                  : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input type="datetime-local" className={inputClass} value={nextDate} onChange={(e) => setNextDate(e.target.value)} disabled={disabled} />
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className={cn(labelClass, "flex items-center gap-1 mb-0")}><Bell size={12} /> Recordatorio</span>
          <button
            type="button"
            role="switch"
            aria-checked={reminderOn}
            disabled={disabled || !nextDate}
            onClick={() => setReminderOn((v) => !v)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-40",
              reminderOn ? "bg-primary-500" : "bg-gray-300"
            )}
          >
            <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", reminderOn ? "translate-x-4" : "translate-x-0.5")} />
          </button>
        </div>
        {reminderOn && nextDate && (
          <select className={cn(inputClass, "mt-2")} value={reminderMinutes} onChange={(e) => setReminderMinutes(Number(e.target.value))} disabled={disabled}>
            {REMINDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
      <Button onClick={submit} loading={loading} disabled={disabled} className="w-full mt-3">
        {submitLabel}
      </Button>
    </section>
  );
}
