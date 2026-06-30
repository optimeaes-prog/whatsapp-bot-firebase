import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, ChevronDown } from "lucide-react";
import type { Lead, LeadFollowUpStatus, Activity } from "../../types";
import { LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS } from "../../types";
import { isLeadDueToday } from "../../services/leads";
import { pendingTasks } from "../../lib/tasks";
import { cn } from "../../lib/utils";
import {
  LEAD_FOLLOWUP_STATUS_CLASSES, PROSPECT_OUTCOME_LABELS, NEXT_ACTION_TYPE_LABELS,
  formatShortDate, formatShortDateTime,
} from "../../lib/prospectMeta";
import { OperationTypeBadge } from "../StatusBadges";
import { WhatsAppIconLink } from "../WhatsAppIconLink";
import { SelectAllHeader, SelectCell } from "./FollowUpTables";
import { EditableTextCell, EditableSelectCell, ReadOnlyCell } from "./EditableCells";
import { SpreadsheetZoomProvider, zoomCfg, type SpreadsheetZoomId } from "./spreadsheetZoom";

const STATUS_OPTIONS = LEAD_FOLLOWUP_STATUSES.map((s) => ({ value: s, label: LEAD_FOLLOWUP_STATUS_LABELS[s] }));

/** Texto de un evento: la nota si la hay, si no la etiqueta del resultado. */
function eventText(a: Activity): string {
  return a.note?.trim() || PROSPECT_OUTCOME_LABELS[a.outcome] || "Otro";
}

/** Celda "Eventos": muestra el último evento del lead; se puede expandir para ver los 3 últimos. */
function EventsCell({ lead, tdClass, textClass }: { lead: Lead; tdClass: string; textClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const events = [...(lead.activities || [])].sort((a, b) => b.at.toMillis() - a.at.toMillis());

  if (events.length === 0) {
    return (
      <td className="px-0 py-0 align-top min-w-[200px]" onClick={(e) => e.stopPropagation()}>
        <div className={cn(tdClass, textClass, "text-gray-300")}>Sin eventos</div>
      </td>
    );
  }

  const canExpand = events.length > 1;
  const shown = expanded ? events.slice(0, 3) : events.slice(0, 1);
  return (
    <td className="px-0 py-0 align-top min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setExpanded((v) => !v)}
        title={canExpand ? (expanded ? "Ver menos" : "Ver los últimos 3 eventos") : undefined}
        className={cn(
          "flex w-full items-start gap-1.5 text-left rounded-md transition-colors",
          tdClass,
          textClass,
          canExpand && "hover:bg-primary-50/60 cursor-pointer"
        )}
      >
        <ul className="space-y-1.5 min-w-0 flex-1">
          {shown.map((a) => (
            <li key={a.id} className="text-gray-700">
              <span className="line-clamp-2">{eventText(a)}</span>
              <span className="block text-[10px] text-gray-400">{formatShortDate(a.at.toMillis())}</span>
            </li>
          ))}
        </ul>
        {canExpand && (
          <ChevronDown size={14} className={cn("mt-0.5 shrink-0 text-gray-400 transition-transform", expanded && "rotate-180")} />
        )}
      </button>
    </td>
  );
}

/** Celda "Tarea": muestra la tarea pendiente más próxima del lead; expandible a las 3 próximas. */
function TaskCell({ lead, tdClass, textClass }: { lead: Lead; tdClass: string; textClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const tasks = pendingTasks(lead.tasks).slice().sort((a, b) => a.dueAt.toMillis() - b.dueAt.toMillis());

  if (tasks.length === 0) {
    return (
      <td className="px-0 py-0 align-top min-w-[200px]" onClick={(e) => e.stopPropagation()}>
        <div className={cn(tdClass, textClass, "text-gray-300")}>Sin tareas</div>
      </td>
    );
  }

  const canExpand = tasks.length > 1;
  const shown = expanded ? tasks.slice(0, 3) : tasks.slice(0, 1);
  return (
    <td className="px-0 py-0 align-top min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setExpanded((v) => !v)}
        title={canExpand ? (expanded ? "Ver menos" : "Ver las próximas 3 tareas") : undefined}
        className={cn(
          "flex w-full items-start gap-1.5 text-left rounded-md transition-colors",
          tdClass,
          textClass,
          canExpand && "hover:bg-primary-50/60 cursor-pointer"
        )}
      >
        <ul className="space-y-1.5 min-w-0 flex-1">
          {shown.map((t) => (
            <li key={t.id} className="text-gray-700">
              <span className="line-clamp-2">
                {NEXT_ACTION_TYPE_LABELS[t.type]}{t.message ? ` · ${t.message}` : ""}
              </span>
              <span className="block text-[10px] text-gray-400">{formatShortDateTime(t.dueAt.toMillis())}</span>
            </li>
          ))}
        </ul>
        {canExpand && (
          <ChevronDown size={14} className={cn("mt-0.5 shrink-0 text-gray-400 transition-transform", expanded && "rotate-180")} />
        )}
      </button>
    </td>
  );
}

/** Vista "Tabla" estilo Excel de leads compradores (columnas adaptadas). */
export function BuyerSpreadsheet({
  rows,
  onOpen,
  onChanged,
  readOnly,
  zoom,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleAll,
}: {
  rows: Lead[];
  onOpen: (l: Lead) => void;
  onChanged: (id: string, partial: Partial<Lead>) => Promise<void>;
  readOnly: boolean;
  zoom: SpreadsheetZoomId;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const cfg = zoomCfg(zoom);
  const thClass = cn(cfg.td, cfg.text, "whitespace-nowrap");
  const allSelected = selectable && rows.length > 0 && rows.every((l) => selectedIds?.has(l.id));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hScroll, setHScroll] = useState({ canScroll: false, atStart: true, atEnd: true });
  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const eps = 2;
    setHScroll({
      canScroll: scrollWidth > clientWidth + eps,
      atStart: scrollLeft <= eps,
      atEnd: scrollLeft + clientWidth >= scrollWidth - eps,
    });
  }, []);
  useEffect(() => {
    updateScroll();
    window.addEventListener("resize", updateScroll);
    return () => window.removeEventListener("resize", updateScroll);
  }, [updateScroll, rows.length]);

  return (
    <SpreadsheetZoomProvider zoom={zoom}>
    <div className="card overflow-hidden p-0">
      <div
        ref={scrollRef}
        onScroll={updateScroll}
        className="overflow-auto overscroll-contain max-h-[calc(100vh-300px)]"
        style={{
          boxShadow: hScroll.canScroll
            ? [
                !hScroll.atStart ? "inset 14px 0 22px -10px rgba(15, 23, 42, 0.07)" : null,
                !hScroll.atEnd ? "inset -14px 0 22px -10px rgba(15, 23, 42, 0.07)" : null,
              ]
                .filter((s): s is string => Boolean(s))
                .join(", ") || undefined
            : undefined,
        }}
      >
        <table className={cn("w-full border-collapse", cfg.text)}>
          <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-gray-50 [&_th]:border-b [&_th]:border-gray-200">
            <tr className="text-left font-semibold uppercase tracking-wider text-gray-500 font-heading">
              {selectable && <SelectAllHeader allSelected={!!allSelected} onToggleAll={() => onToggleAll?.()} />}
              <th className={thClass}>Operación</th>
              <th className={thClass}>Nombre</th>
              <th className={thClass}>Teléfono</th>
              <th className={thClass}>Estado</th>
              <th className={thClass}>Eventos</th>
              <th className={thClass}>Tarea</th>
              <th className={thClass}>Notas</th>
              <th className={thClass}>Cód. anuncio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const selected = selectable && selectedIds?.has(l.id);
              return (
                <tr
                  key={l.id}
                  onClick={() => onOpen(l)}
                  className={cn(
                    "border-b border-gray-100 cursor-pointer transition hover:brightness-[0.98]",
                    isLeadDueToday(l) && "bg-amber-50",
                    selected && "!bg-primary-50/60"
                  )}
                >
                  {selectable && (
                    <SelectCell checked={selectedIds?.has(l.id) ?? false} onToggle={() => onToggleSelect?.(l.id)} />
                  )}
                  {/* OPERACIÓN */}
                  <td className={cn("align-middle", cfg.td)}>
                    <OperationTypeBadge type={l.operationType} />
                  </td>
                  <EditableTextCell
                    value={l.name}
                    readOnly={true}
                    tdClassName="min-w-[140px]"
                    onSave={(v) => onChanged(l.id, { name: v })}
                  />
                  {/* TELEFONO: solo lectura (no editable a nivel de servicio) */}
                  <ReadOnlyCell tdClassName="min-w-[120px]">
                    {l.phone ? (
                      <span className="inline-flex items-center gap-2">
                        <a
                          href={`tel:${l.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                        >
                          <Phone size={13} /> {l.phone}
                        </a>
                        <WhatsAppIconLink phone={l.phone} size={13} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </ReadOnlyCell>
                  {/* ESTADO: editable */}
                  <EditableSelectCell<LeadFollowUpStatus>
                    value={l.followUpStatus ?? "nuevo"}
                    options={STATUS_OPTIONS}
                    readOnly={readOnly}
                    className={cn(
                      LEAD_FOLLOWUP_STATUS_CLASSES[l.followUpStatus ?? "nuevo"],
                      "border-transparent"
                    )}
                    tdClassName="min-w-[150px]"
                    onSave={(v) => onChanged(l.id, { followUpStatus: v })}
                  />
                  {/* EVENTOS: último evento, expandible a los 3 últimos */}
                  <EventsCell lead={l} tdClass={cfg.td} textClass={cfg.text} />
                  {/* TAREA: próxima tarea pendiente, expandible a las 3 próximas */}
                  <TaskCell lead={l} tdClass={cfg.td} textClass={cfg.text} />
                  <EditableTextCell
                    value={l.notes}
                    readOnly={true}
                    multiline
                    tdClassName="min-w-[200px]"
                    onSave={(v) => onChanged(l.id, { notes: v })}
                  />
                  <ReadOnlyCell tdClassName="whitespace-nowrap text-gray-500">{l.listingCode || "—"}</ReadOnlyCell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </SpreadsheetZoomProvider>
  );
}
