import { useState } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import type { ProspectNextActionType } from "../types";
import {
  NEXT_ACTION_TYPES, NEXT_ACTION_TYPE_LABELS,
  toDateTimeInputValue,
} from "../lib/prospectMeta";
import { cn } from "../lib/utils";
import { Button } from "./ui";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 font-heading uppercase tracking-wider";

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

interface Props {
  disabled?: boolean;
  loading?: boolean;
  /** Valores iniciales (al editar una tarea existente). */
  initialDueDate?: string;
  initialType?: ProspectNextActionType;
  initialMessage?: string | null;
  /** Texto del botón de envío. */
  submitLabel?: string;
  /** Genera un borrador de mensaje con IA (solo WhatsApp/email). */
  onGenerateMessage?: (channel: "message" | "email", note: string) => Promise<string>;
  onSubmit: (
    dueAt: Date,
    type: ProspectNextActionType,
    message: string | null
  ) => void | Promise<void>;
}

/**
 * Formulario de TAREA: programa algo POR HACER (fecha + hora, tipo y mensaje opcional).
 * Es la mitad "tarea" de lo que antes era la sección "Próxima acción" de ContactLogForm.
 */
export function TaskForm({
  disabled, loading, initialDueDate = "", initialType = "call", initialMessage = null,
  submitLabel = "Crear tarea", onGenerateMessage, onSubmit,
}: Props) {
  const [dueDate, setDueDate] = useState(initialDueDate || presetInDaysValue(1));
  const [type, setType] = useState<ProspectNextActionType>(initialType);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [generating, setGenerating] = useState(false);

  const presets: { label: string; value: string }[] = [
    { label: "Hoy", value: presetTodayValue() },
    { label: "Mañana", value: presetInDaysValue(1) },
    { label: "+3 días", value: presetInDaysValue(3) },
    { label: "+1 semana", value: presetInDaysValue(7) },
  ];

  // El redactor de mensaje solo aplica cuando la tarea es enviar WhatsApp o email.
  const showComposer = type === "message" || type === "email";

  async function handleGenerate() {
    if (!onGenerateMessage || !showComposer) return;
    setGenerating(true);
    try {
      const text = await onGenerateMessage(type === "email" ? "email" : "message", "");
      if (text) setMessage(text);
    } catch {
      // El consumidor avisa del error (toast); aquí solo restauramos el estado del botón.
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    if (!dueDate) return;
    await onSubmit(new Date(dueDate), type, showComposer ? (message.trim() || null) : null);
  }

  return (
    <section className="rounded-xl border border-gray-200 p-4 bg-gray-50/60">
      <label className={`${labelClass} flex items-center gap-1`}><CalendarClock size={12} /> Próxima tarea</label>

      {/* Cuándo */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={disabled}
            onClick={() => setDueDate(p.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40",
              dueDate === p.value
                ? "bg-primary-100 text-primary-800 border-primary-200"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input type="datetime-local" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={disabled} />

      {/* Qué hacer */}
      <div className="flex flex-wrap gap-1.5 mb-2 mt-3">
        {NEXT_ACTION_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => setType(t)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors disabled:opacity-40",
              type === t
                ? "bg-primary-500 text-white border-primary-500"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            {NEXT_ACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Redactor del mensaje (solo WhatsApp / email) */}
      {showComposer && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-white p-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-600">
              {type === "email" ? "Email a enviar" : "Mensaje a enviar"}
            </span>
            {onGenerateMessage && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={disabled || generating}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-btn bg-primary-100 text-primary-800 text-xs font-bold hover:bg-primary-200 transition-colors disabled:opacity-50"
              >
                <Sparkles size={13} className={generating ? "animate-pulse" : ""} />
                {generating ? "Generando…" : "Generar con IA"}
              </button>
            )}
          </div>
          <textarea
            className={`${inputClass} min-h-[90px] resize-none`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe el mensaje o genéralo con IA. Podrás revisarlo antes de enviarlo."
            disabled={disabled || generating}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Se guarda con la tarea para enviarlo el día del seguimiento.
          </p>
        </div>
      )}

      <Button onClick={submit} loading={loading} disabled={disabled || !dueDate} className="w-full mt-3">
        {submitLabel}
      </Button>
    </section>
  );
}
