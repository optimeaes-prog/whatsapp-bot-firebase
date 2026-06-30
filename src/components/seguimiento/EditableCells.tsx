import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { formatShortDateTime, toDateTimeInputValue } from "../../lib/prospectMeta";
import { isOverdueMillis, formatRelativeDays } from "../../lib/followUp";
import { useZoom } from "./spreadsheetZoom";

/**
 * Celdas editables en línea para la vista "Tabla" (estilo Excel).
 *
 * Idea: la celda muestra el valor como texto; al hacer clic se convierte en un
 * campo y guarda al salir (blur) o al cambiar (select/booleano). Nunca guarda por
 * cada tecla. Si el guardado falla, la celda revierte su borrador (el padre muestra
 * el toast de error). El borrador se re-sincroniza con el valor externo solo cuando
 * NO se está editando, para no pisar una edición en curso.
 *
 * Cada celda renderiza su propio <td> y corta la propagación del clic para que
 * editar no abra la ficha de la fila.
 */

/** Celda de texto editable (una línea o `multiline` para textos largos). */
export function EditableTextCell({
  value,
  onSave,
  readOnly,
  multiline = false,
  placeholder = "—",
  tdClassName,
  suffix,
}: {
  value?: string | null;
  onSave: (value: string) => Promise<void>;
  readOnly?: boolean;
  multiline?: boolean;
  placeholder?: string;
  tdClassName?: string;
  /** Contenido a la derecha del valor cuando NO se está editando (p. ej. icono de WhatsApp). */
  suffix?: ReactNode;
}) {
  const cfg = useZoom();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  // Re-sincronizar con el valor externo solo si no estamos editando.
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    const current = (value ?? "").trim();
    if (next === current) return; // sin cambios: no escribimos
    onSave(next).catch(() => setDraft(value ?? ""));
  }

  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  if (readOnly) {
    return (
      <td className={cn("align-middle text-gray-700", cfg.td, cfg.text, tdClassName)}>
        <div className="flex items-center gap-1.5">
          <span className={cn(!value && "text-gray-300", multiline && "line-clamp-2 whitespace-pre-wrap")}>
            {value || placeholder}
          </span>
          {suffix}
        </div>
      </td>
    );
  }

  return (
    <td className={cn("px-0 py-0 align-middle", tdClassName)} onClick={(e) => e.stopPropagation()}>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
            rows={3}
            className={cn(
              "w-full min-w-[180px] resize-y rounded-md border border-primary-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400",
              cfg.td,
              cfg.text
            )}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                cancel();
              }
            }}
            className={cn(
              "w-full rounded-md border border-primary-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400",
              cfg.td,
              cfg.text
            )}
          />
        )
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Editar"
            className={cn(
              "block flex-1 min-w-0 rounded-md text-left transition-colors hover:bg-primary-50/60",
              cfg.td,
              cfg.text,
              value ? "text-gray-700" : "text-gray-300",
              multiline && "whitespace-pre-wrap line-clamp-2"
            )}
          >
            {value || placeholder}
          </button>
          {suffix && <span className="pr-2">{suffix}</span>}
        </div>
      )}
    </td>
  );
}

/** Celda desplegable editable (etapa, estado…). Guarda al cambiar. */
export function EditableSelectCell<T extends string>({
  value,
  options,
  onSave,
  readOnly,
  className,
  tdClassName,
}: {
  value: T;
  options: { value: T; label: string }[];
  onSave: (value: T) => Promise<void>;
  readOnly?: boolean;
  className?: string; // color de fondo opcional (pastilla)
  tdClassName?: string;
}) {
  const cfg = useZoom();
  const [val, setVal] = useState<T>(value);
  useEffect(() => setVal(value), [value]);

  if (readOnly) {
    const label = options.find((o) => o.value === value)?.label ?? value;
    return (
      <td className={cn("align-middle", cfg.td, tdClassName)}>
        <span className={cn("inline-flex rounded-full px-2 py-0.5 font-semibold", cfg.text, className)}>{label}</span>
      </td>
    );
  }

  return (
    <td className={cn("align-middle", cfg.td, tdClassName)} onClick={(e) => e.stopPropagation()}>
      <select
        value={val}
        onChange={(e) => {
          const next = e.target.value as T;
          setVal(next);
          if (next !== value) onSave(next).catch(() => setVal(value));
        }}
        className={cn(
          "w-full cursor-pointer rounded-md border border-gray-200 px-2 py-1 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-400",
          cfg.text,
          className || "bg-white text-gray-700"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </td>
  );
}

/** Celda Sí/No editable (tri-estado: vacío → Sí → No). Guarda al hacer clic. */
export function EditableBoolCell({
  value,
  onSave,
  readOnly,
  tdClassName,
  trueLabel = "Sí",
  falseLabel = "No",
}: {
  value?: boolean;
  onSave: (value: boolean) => Promise<void>;
  readOnly?: boolean;
  tdClassName?: string;
  /** Etiquetas para los estados (por defecto Sí/No). */
  trueLabel?: string;
  falseLabel?: string;
}) {
  const cfg = useZoom();
  const [val, setVal] = useState<boolean | undefined>(value);
  useEffect(() => setVal(value), [value]);

  const pill = (v: boolean | undefined) => (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 font-bold whitespace-nowrap",
        cfg.text,
        v === true && "bg-emerald-100 text-emerald-800",
        v === false && "bg-gray-100 text-gray-500",
        v === undefined && "bg-gray-50 text-gray-300"
      )}
    >
      {v === undefined ? "—" : v ? trueLabel : falseLabel}
    </span>
  );

  if (readOnly) {
    return <td className={cn("align-middle", cfg.td, tdClassName)}>{pill(value)}</td>;
  }

  return (
    <td className={cn("align-middle", cfg.td, tdClassName)} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Cambiar"
        onClick={() => {
          const next = val === true ? false : true; // vacío/No → Sí, Sí → No
          setVal(next);
          onSave(next).catch(() => setVal(value));
        }}
      >
        {pill(val)}
      </button>
    </td>
  );
}

/** Celda de fecha/hora editable (próxima acción). Abre un selector datetime; guarda al salir. */
export function EditableDateCell({
  ms,
  onSave,
  readOnly,
  due = false,
  placeholder = "Añadir…",
  tdClassName,
}: {
  ms: number | null;
  onSave: (ms: number) => Promise<void>;
  readOnly?: boolean;
  due?: boolean; // resaltar en rojo si está vencida / es para hoy
  placeholder?: string;
  tdClassName?: string;
}) {
  const cfg = useZoom();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ms != null ? toDateTimeInputValue(ms) : "");

  useEffect(() => {
    if (!editing) setDraft(ms != null ? toDateTimeInputValue(ms) : "");
  }, [ms, editing]);

  function revert() {
    setDraft(ms != null ? toDateTimeInputValue(ms) : "");
  }

  function commit() {
    setEditing(false);
    const next = draft ? new Date(draft).getTime() : null;
    // El borrado en línea no está soportado: si se vacía, se revierte.
    if (next == null || Number.isNaN(next) || next === ms) {
      revert();
      return;
    }
    onSave(next).catch(revert);
  }

  const overdue = due && ms != null && isOverdueMillis(ms);
  const display =
    ms != null ? (
      <>
        {formatShortDateTime(ms)}
        {overdue && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            {formatRelativeDays(ms)}
          </span>
        )}
      </>
    ) : null;

  if (readOnly) {
    return (
      <td
        className={cn(
          "align-top whitespace-nowrap",
          cfg.td,
          cfg.text,
          ms != null && due ? "text-rose-600 font-semibold" : "text-gray-600",
          tdClassName
        )}
      >
        {display ?? "—"}
      </td>
    );
  }

  return (
    <td className={cn("px-0 py-0 align-top", tdClassName)} onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <input
          type="datetime-local"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setEditing(false);
              revert();
            }
          }}
          className={cn(
            "w-full rounded-md border border-primary-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400",
            cfg.td,
            cfg.text
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Editar fecha de próxima tarea"
          className={cn(
            "block w-full whitespace-nowrap rounded-md text-left transition-colors hover:bg-primary-50/60",
            cfg.td,
            cfg.text,
            ms == null ? "text-gray-300" : due ? "text-rose-600 font-semibold" : "text-gray-700"
          )}
        >
          {display ?? placeholder}
        </button>
      )}
    </td>
  );
}

/** Celda de solo lectura para valores derivados (LLAMADO, ¿cómo está esto?…). */
export function ReadOnlyCell({ children, tdClassName }: { children: ReactNode; tdClassName?: string }) {
  const cfg = useZoom();
  return <td className={cn("align-middle text-gray-600", cfg.td, cfg.text, tdClassName)}>{children}</td>;
}
