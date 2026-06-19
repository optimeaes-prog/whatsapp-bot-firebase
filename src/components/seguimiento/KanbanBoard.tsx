import { CalendarClock, ListTodo, CheckSquare, Square } from "lucide-react";
import type { Lead, LeadFollowUpStatus, Prospect, ProspectStage } from "../../types";
import {
  PROSPECT_STAGES, PROSPECT_STAGE_LABELS,
  LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS,
} from "../../types";
import { isDueToday } from "../../services/prospects";
import { isLeadDueToday } from "../../services/leads";
import { cn } from "../../lib/utils";
import { PROSPECT_STAGE_ACCENT, LEAD_FOLLOWUP_STATUS_ACCENT } from "../../lib/prospectMeta";
import { sortProspectsByNextAction, sortLeadsByNextAction, type LeadStatusKey } from "../../lib/followUp";
import { OperationTypeBadge } from "../StatusBadges";

/** Casilla de selección para acciones en grupo (no abre el detalle). */
function SelectBox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      title={checked ? "Quitar de la selección" : "Seleccionar"}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="shrink-0 p-0.5 -ml-0.5 text-gray-400 hover:text-primary-600 transition-colors"
    >
      {checked ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
    </button>
  );
}

/** Casilla "seleccionar toda la columna" para la cabecera de cada etapa/estado. */
function ColumnSelectAll({ ids, selectedIds, onToggleColumn }: { ids: string[]; selectedIds?: Set<string>; onToggleColumn?: (ids: string[]) => void }) {
  if (ids.length === 0) return null;
  const allSelected = ids.every((id) => selectedIds?.has(id));
  return (
    <button
      type="button"
      title={allSelected ? "Quitar selección de la columna" : "Seleccionar toda la columna"}
      onClick={() => onToggleColumn?.(ids)}
      className="ml-auto shrink-0 text-gray-400 hover:text-primary-600 transition-colors"
    >
      {allSelected ? <CheckSquare size={15} className="text-primary-600" /> : <Square size={15} />}
    </button>
  );
}

/** Tablero de captaciones por etapa. Cada columna ordenada por próxima acción (vencidas primero). */
export function KanbanBoard({
  grouped, onOpen, onMove, onQuickLog, readOnly, selectable = false, selectedIds, onToggleSelect, onToggleColumn,
}: {
  grouped: Record<ProspectStage, Prospect[]>;
  onOpen: (p: Prospect) => void;
  onMove: (p: Prospect, stage: ProspectStage) => void;
  onQuickLog: (p: Prospect) => void;
  readOnly: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleColumn?: (ids: string[]) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {PROSPECT_STAGES.map((stage) => {
        const items = sortProspectsByNextAction(grouped[stage] || []);
        return (
          <div key={stage} className="w-72 shrink-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("w-2 h-2 rounded-full", PROSPECT_STAGE_ACCENT[stage])} />
              <h3 className="text-sm font-bold text-gray-800 font-heading">{PROSPECT_STAGE_LABELS[stage]}</h3>
              <span className="text-xs font-semibold text-gray-400">{items.length}</span>
              {selectable && <ColumnSelectAll ids={items.map((p) => p.id)} selectedIds={selectedIds} onToggleColumn={onToggleColumn} />}
            </div>
            <div className="space-y-2.5">
              {items.map((p) => (
                <ProspectCard
                  key={p.id}
                  prospect={p}
                  onOpen={onOpen}
                  onMove={onMove}
                  onQuickLog={onQuickLog}
                  readOnly={readOnly}
                  selectable={selectable}
                  selected={selectedIds?.has(p.id) ?? false}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProspectCard({
  prospect, onOpen, onMove, onQuickLog, readOnly, selectable, selected, onToggleSelect,
}: {
  prospect: Prospect;
  onOpen: (p: Prospect) => void;
  onMove: (p: Prospect, stage: ProspectStage) => void;
  onQuickLog: (p: Prospect) => void;
  readOnly: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const due = isDueToday(prospect);
  return (
    <div
      onClick={() => onOpen(prospect)}
      className={cn(
        "card !p-3 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all",
        selected && "!border-primary-500 ring-2 ring-primary-500 shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {selectable && <SelectBox checked={selected} onToggle={() => onToggleSelect?.(prospect.id)} />}
          <p className="font-bold text-gray-900 text-sm truncate">{prospect.ownerName || "Sin nombre"}</p>
        </div>
        <OperationTypeBadge type={prospect.operationType} />
      </div>
      <p className="text-xs text-gray-500 truncate mt-0.5">
        {[prospect.municipality, prospect.zone].filter(Boolean).join(" · ") || "Sin ubicación"}
      </p>
      <div className="flex items-center justify-between gap-2 mt-2">
        {prospect.price ? <span className="text-xs font-semibold text-gray-700">{prospect.price}</span> : <span />}
        {due && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-full">
            <CalendarClock size={10} /> Hoy
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <select
          value={prospect.stage}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onMove(prospect, e.target.value as ProspectStage); }}
          disabled={readOnly}
          className="flex-1 min-w-0 text-[11px] px-2 py-1 border border-gray-200 rounded-btn bg-gray-50 text-gray-600 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
        >
          {PROSPECT_STAGES.map((s) => <option key={s} value={s}>{PROSPECT_STAGE_LABELS[s]}</option>)}
        </select>
        <button
          type="button"
          title="Registrar tarea"
          disabled={readOnly}
          onClick={(e) => { e.stopPropagation(); onQuickLog(prospect); }}
          className="shrink-0 p-1.5 rounded-btn border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
        >
          <ListTodo size={13} />
        </button>
      </div>
    </div>
  );
}

/** Columnas del tablero de leads: una por estado + "Sin estado" para los que aún no lo tienen. */
const LEAD_KANBAN_COLUMNS: LeadStatusKey[] = ["sin_estado", ...LEAD_FOLLOWUP_STATUSES];
const LEAD_COLUMN_LABELS: Record<LeadStatusKey, string> = {
  sin_estado: "Sin estado",
  ...LEAD_FOLLOWUP_STATUS_LABELS,
};

/** Tablero de leads compradores por estado. Cada columna ordenada por próxima acción (vencidas primero). */
export function LeadKanbanBoard({
  grouped, onOpen, onMove, onQuickLog, readOnly, selectable = false, selectedIds, onToggleSelect, onToggleColumn,
}: {
  grouped: Record<LeadStatusKey, Lead[]>;
  onOpen: (l: Lead) => void;
  onMove: (l: Lead, status: LeadFollowUpStatus) => void;
  onQuickLog: (l: Lead) => void;
  readOnly: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleColumn?: (ids: string[]) => void;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {LEAD_KANBAN_COLUMNS.map((col) => {
        const items = sortLeadsByNextAction(grouped[col] || []);
        return (
          <div key={col} className="w-72 shrink-0 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className={cn("w-2 h-2 rounded-full", LEAD_FOLLOWUP_STATUS_ACCENT[col])} />
              <h3 className="text-sm font-bold text-gray-800 font-heading">{LEAD_COLUMN_LABELS[col]}</h3>
              <span className="text-xs font-semibold text-gray-400">{items.length}</span>
              {selectable && <ColumnSelectAll ids={items.map((l) => l.id)} selectedIds={selectedIds} onToggleColumn={onToggleColumn} />}
            </div>
            <div className="space-y-2.5">
              {items.map((l) => (
                <LeadCard
                  key={l.id}
                  lead={l}
                  onOpen={onOpen}
                  onMove={onMove}
                  onQuickLog={onQuickLog}
                  readOnly={readOnly}
                  selectable={selectable}
                  selected={selectedIds?.has(l.id) ?? false}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadCard({
  lead, onOpen, onMove, onQuickLog, readOnly, selectable, selected, onToggleSelect,
}: {
  lead: Lead;
  onOpen: (l: Lead) => void;
  onMove: (l: Lead, status: LeadFollowUpStatus) => void;
  onQuickLog: (l: Lead) => void;
  readOnly: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const due = isLeadDueToday(lead);
  return (
    <div
      onClick={() => onOpen(lead)}
      className={cn(
        "card !p-3 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all",
        selected && "!border-primary-500 ring-2 ring-primary-500 shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          {selectable && <SelectBox checked={selected} onToggle={() => onToggleSelect?.(lead.id)} />}
          <p className="font-bold text-gray-900 text-sm truncate">{lead.name || "Sin nombre"}</p>
        </div>
        {lead.operationType && <OperationTypeBadge type={lead.operationType} />}
      </div>
      <p className="text-xs text-gray-500 truncate mt-0.5">{lead.phone || "Sin teléfono"}</p>
      <div className="flex items-center justify-end gap-2 mt-2">
        {due && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-full">
            <CalendarClock size={10} /> Hoy
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <select
          value={lead.followUpStatus ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onMove(lead, e.target.value as LeadFollowUpStatus); }}
          disabled={readOnly}
          className="flex-1 min-w-0 text-[11px] px-2 py-1 border border-gray-200 rounded-btn bg-gray-50 text-gray-600 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50"
        >
          {!lead.followUpStatus && <option value="" disabled>Sin estado</option>}
          {LEAD_FOLLOWUP_STATUSES.map((s) => <option key={s} value={s}>{LEAD_FOLLOWUP_STATUS_LABELS[s]}</option>)}
        </select>
        <button
          type="button"
          title="Registrar tarea"
          disabled={readOnly}
          onClick={(e) => { e.stopPropagation(); onQuickLog(lead); }}
          className="shrink-0 p-1.5 rounded-btn border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
        >
          <ListTodo size={13} />
        </button>
      </div>
    </div>
  );
}
