import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Prospect, ProspectStage, ProspectActivity } from "../../types";
import { PROSPECT_STAGES, PROSPECT_STAGE_LABELS } from "../../types";
import { isDueToday } from "../../services/prospects";
import { pendingTasks } from "../../lib/tasks";
import { cn } from "../../lib/utils";
import {
  PROSPECT_STAGE_CLASSES, PROSPECT_OUTCOME_LABELS, NEXT_ACTION_TYPE_LABELS,
  formatShortDate, formatShortDateTime,
} from "../../lib/prospectMeta";
import { OperationTypeBadge } from "../StatusBadges";
import { WhatsAppIconLink } from "../WhatsAppIconLink";
import { SelectAllHeader, SelectCell } from "./FollowUpTables";
import { EditableTextCell, EditableSelectCell, EditableBoolCell } from "./EditableCells";
import { SpreadsheetZoomProvider, zoomCfg, type SpreadsheetZoomId } from "./spreadsheetZoom";

const STAGE_OPTIONS = PROSPECT_STAGES.map((s) => ({ value: s, label: PROSPECT_STAGE_LABELS[s] }));

/** Texto de un evento: la nota si la hay, si no la etiqueta del resultado. */
function eventText(a: ProspectActivity): string {
  return a.note?.trim() || PROSPECT_OUTCOME_LABELS[a.outcome] || "Otro";
}

/** Celda "Eventos": muestra el último evento; se puede expandir para ver los 3 últimos. */
function EventsCell({ prospect, tdClass, textClass }: { prospect: Prospect; tdClass: string; textClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const events = [...(prospect.activities || [])].sort((a, b) => b.at.toMillis() - a.at.toMillis());

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

/** Color de fila como en el Excel: verde = vendido/ganado, ámbar = citado o pendiente hoy. */
function rowTint(p: Prospect): string {
  if (p.stage === "ganado") return "bg-emerald-50";
  if (p.stage === "citado" || isDueToday(p)) return "bg-amber-50";
  return "";
}

/** Celda "Tarea": muestra la tarea pendiente más próxima; se puede expandir para ver las 3 próximas. */
function TaskCell({ prospect, tdClass, textClass }: { prospect: Prospect; tdClass: string; textClass: string }) {
  const [expanded, setExpanded] = useState(false);
  const tasks = pendingTasks(prospect.tasks).slice().sort((a, b) => a.dueAt.toMillis() - b.dueAt.toMillis());

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

/** Vista "Tabla" estilo Excel de captaciones: columnas del Excel + edición en línea de campos clave. */
export function ProspectSpreadsheet({
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
  rows: Prospect[];
  onOpen: (p: Prospect) => void;
  onChanged: (id: string, partial: Partial<Prospect>) => Promise<void>;
  readOnly: boolean;
  zoom: SpreadsheetZoomId;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const cfg = zoomCfg(zoom);
  const thClass = cn(cfg.td, cfg.text, "whitespace-nowrap");
  const allSelected = selectable && rows.length > 0 && rows.every((p) => selectedIds?.has(p.id));

  // Sombra interior en los bordes cuando la tabla se puede desplazar en horizontal.
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
              <th className={thClass}>Etapa</th>
              <th className={thClass}>Publicación</th>
              <th className={thClass}>Nombre</th>
              <th className={thClass}>Municipio</th>
              <th className={thClass}>Dirección</th>
              <th className={thClass}>Teléfono</th>
              <th className={thClass}>Eventos</th>
              <th className={thClass}>Tarea</th>
              <th className={thClass}>Precio</th>
              <th className={thClass}>Aprendizajes</th>
              <th className={thClass}>Características</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const selected = selectable && selectedIds?.has(p.id);
              return (
                <tr
                  key={p.id}
                  onClick={() => onOpen(p)}
                  className={cn(
                    "border-b border-gray-100 cursor-pointer transition hover:brightness-[0.98]",
                    rowTint(p),
                    selected && "!bg-primary-50/60"
                  )}
                >
                  {selectable && (
                    <SelectCell checked={selectedIds?.has(p.id) ?? false} onToggle={() => onToggleSelect?.(p.id)} />
                  )}
                  {/* OPERACIÓN */}
                  <td className={cn("align-middle", cfg.td)}>
                    <OperationTypeBadge type={p.operationType} />
                  </td>
                  {/* ETAPA: editable; al cambiar actualiza el color de fila */}
                  <EditableSelectCell<ProspectStage>
                    value={p.stage}
                    options={STAGE_OPTIONS}
                    readOnly={readOnly}
                    className={cn(PROSPECT_STAGE_CLASSES[p.stage], "border-transparent")}
                    tdClassName="min-w-[150px]"
                    onSave={(v) => onChanged(p.id, { stage: v })}
                  />
                  {/* PUBLICACIÓN */}
                  <EditableBoolCell
                    value={p.stillListed}
                    readOnly={true}
                    trueLabel="Publicado"
                    falseLabel="No publicado"
                    onSave={(v) => onChanged(p.id, { stillListed: v })}
                  />
                  {/* NOMBRE */}
                  <EditableTextCell
                    value={p.ownerName}
                    readOnly={true}
                    tdClassName="min-w-[140px]"
                    onSave={(v) => onChanged(p.id, { ownerName: v })}
                  />
                  <EditableTextCell
                    value={p.municipality}
                    readOnly={true}
                    tdClassName="min-w-[130px]"
                    onSave={(v) => onChanged(p.id, { municipality: v })}
                  />
                  <EditableTextCell
                    value={p.address}
                    readOnly={true}
                    tdClassName="min-w-[150px]"
                    onSave={(v) => onChanged(p.id, { address: v })}
                  />
                  <EditableTextCell
                    value={p.phone}
                    readOnly={true}
                    tdClassName="min-w-[120px]"
                    onSave={(v) => onChanged(p.id, { phone: v })}
                    suffix={<WhatsAppIconLink phone={p.phone} size={13} />}
                  />
                  {/* EVENTOS: último evento, expandible a los 3 últimos */}
                  <EventsCell prospect={p} tdClass={cfg.td} textClass={cfg.text} />
                  {/* TAREA: próxima tarea pendiente, expandible a las 3 próximas */}
                  <TaskCell prospect={p} tdClass={cfg.td} textClass={cfg.text} />
                  <EditableTextCell
                    value={p.price}
                    readOnly={true}
                    tdClassName="min-w-[90px]"
                    onSave={(v) => onChanged(p.id, { price: v })}
                  />
                  <EditableTextCell
                    value={p.learnings}
                    readOnly={true}
                    multiline
                    tdClassName="min-w-[180px]"
                    onSave={(v) => onChanged(p.id, { learnings: v })}
                  />
                  <EditableTextCell
                    value={p.features}
                    readOnly={true}
                    multiline
                    tdClassName="min-w-[220px]"
                    onSave={(v) => onChanged(p.id, { features: v })}
                  />
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
