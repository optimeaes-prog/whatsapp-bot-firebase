import type { ReactNode } from "react";
import { MessageSquare, Phone, ListTodo, CheckSquare, Square } from "lucide-react";
import type { Lead, Prospect } from "../../types";
import { PROSPECT_STAGE_LABELS, LEAD_FOLLOWUP_STATUS_LABELS } from "../../types";
import { isDueToday } from "../../services/prospects";
import { isLeadDueToday } from "../../services/leads";
import { cn } from "../../lib/utils";
import {
  PROSPECT_STAGE_CLASSES, LEAD_FOLLOWUP_STATUS_CLASSES, formatShortDate, formatShortDateTime,
} from "../../lib/prospectMeta";
import { isOverdueMillis, formatRelativeDays, whatsappLink } from "../../lib/followUp";
import { OperationTypeBadge } from "../StatusBadges";

const thClass = "px-4 py-3";

/** Celda "Próx. acción": fecha + badge "hace X días" si está vencida (solo registros activos). */
function NextActionCell({ ms, due }: { ms: number | null; due: boolean }) {
  return (
    <td className={cn("px-4 py-3 whitespace-nowrap", due ? "text-rose-600 font-semibold" : "text-gray-600")}>
      {ms != null ? (
        <>
          {formatShortDateTime(ms)}
          {due && isOverdueMillis(ms) && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
              {formatRelativeDays(ms)}
            </span>
          )}
        </>
      ) : "—"}
    </td>
  );
}

/** Acciones rápidas de la fila: WhatsApp + registrar seguimiento sin abrir el detalle. */
function RowActionsCell({ phone, onQuickLog, readOnly }: { phone?: string | null; onQuickLog: () => void; readOnly: boolean }) {
  const wa = whatsappLink(phone);
  return (
    <td className="px-4 py-3">
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir WhatsApp"
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <MessageSquare size={15} />
          </a>
        )}
        <button
          type="button"
          disabled={readOnly}
          onClick={onQuickLog}
          className="inline-flex items-center gap-1 rounded-btn border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
        >
          <ListTodo size={12} /> Registrar
        </button>
      </div>
    </td>
  );
}

/** Cabecera "seleccionar todo" (solo cuando hay selección activa). */
function SelectAllHeader({ allSelected, onToggleAll }: { allSelected: boolean; onToggleAll: () => void }) {
  return (
    <th className="px-4 py-3 w-10">
      <button
        type="button"
        title={allSelected ? "Quitar selección" : "Seleccionar todo"}
        onClick={onToggleAll}
        className="text-gray-400 hover:text-primary-600 transition-colors align-middle"
      >
        {allSelected ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
      </button>
    </th>
  );
}

/** Celda de selección por fila (no abre el detalle). */
function SelectCell({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={checked ? "Quitar de la selección" : "Seleccionar"}
        onClick={onToggle}
        className="text-gray-400 hover:text-primary-600 transition-colors align-middle"
      >
        {checked ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
      </button>
    </td>
  );
}

function PhoneCellLink({ phone }: { phone?: string | null }) {
  return (
    <td className="px-4 py-3 text-gray-600">
      {phone ? (
        <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700">
          <Phone size={13} /> {phone}
        </a>
      ) : "—"}
    </td>
  );
}

export function ProspectTable({
  rows, onOpen, onQuickLog, readOnly, selectable = false, selectedIds, onToggleSelect, onToggleAll,
}: {
  rows: Prospect[];
  onOpen: (p: Prospect) => void;
  onQuickLog: (p: Prospect) => void;
  readOnly: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const allSelected = selectable && rows.length > 0 && rows.every((p) => selectedIds?.has(p.id));
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider font-heading">
            {selectable && <SelectAllHeader allSelected={!!allSelected} onToggleAll={() => onToggleAll?.()} />}
            <th className={thClass}>Propietario</th>
            <th className={thClass}>Teléfono</th>
            <th className={thClass}>Municipio</th>
            <th className={thClass}>Operación</th>
            <th className={thClass}>Etapa</th>
            <th className={thClass}>Próx. acción</th>
            <th className={thClass}>Último contacto</th>
            <th className={thClass}>Precio</th>
            <th className={cn(thClass, "text-right")}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const due = isDueToday(p);
            return (
              <tr
                key={p.id}
                onClick={() => onOpen(p)}
                className={cn(
                  "border-b border-gray-50 hover:bg-gray-50 cursor-pointer",
                  selectable && selectedIds?.has(p.id) && "bg-primary-50/60"
                )}
              >
                {selectable && (
                  <SelectCell checked={selectedIds?.has(p.id) ?? false} onToggle={() => onToggleSelect?.(p.id)} />
                )}
                <td className="px-4 py-3 font-semibold text-gray-900">{p.ownerName || "Sin nombre"}</td>
                <PhoneCellLink phone={p.phone} />
                <td className="px-4 py-3 text-gray-600">{[p.municipality, p.zone].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3"><OperationTypeBadge type={p.operationType} /></td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", PROSPECT_STAGE_CLASSES[p.stage])}>
                    {PROSPECT_STAGE_LABELS[p.stage]}
                  </span>
                </td>
                <NextActionCell ms={p.nextActionDate ? p.nextActionDate.toMillis() : null} due={due} />
                <td className="px-4 py-3 text-gray-500">{p.lastContactAt ? formatShortDate(p.lastContactAt.toMillis()) : "—"}</td>
                <td className="px-4 py-3 text-gray-700">{p.price || "—"}</td>
                <RowActionsCell phone={p.phone} onQuickLog={() => onQuickLog(p)} readOnly={readOnly} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BuyerTable({
  rows, onOpen, onQuickLog, readOnly, selectable = false, selectedIds, onToggleSelect, onToggleAll,
}: {
  rows: Lead[];
  onOpen: (l: Lead) => void;
  onQuickLog: (l: Lead) => void;
  readOnly: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const allSelected = selectable && rows.length > 0 && rows.every((l) => selectedIds?.has(l.id));
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider font-heading">
            {selectable && <SelectAllHeader allSelected={!!allSelected} onToggleAll={() => onToggleAll?.()} />}
            <th className={thClass}>Comprador</th>
            <th className={thClass}>Teléfono</th>
            <th className={thClass}>Operación</th>
            <th className={thClass}>Estado</th>
            <th className={thClass}>Próx. acción</th>
            <th className={thClass}>Último contacto</th>
            <th className={cn(thClass, "text-right")}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const due = isLeadDueToday(l);
            return (
              <tr
                key={l.id}
                onClick={() => onOpen(l)}
                className={cn(
                  "border-b border-gray-50 hover:bg-gray-50 cursor-pointer",
                  selectable && selectedIds?.has(l.id) && "bg-primary-50/60"
                )}
              >
                {selectable && (
                  <SelectCell checked={selectedIds?.has(l.id) ?? false} onToggle={() => onToggleSelect?.(l.id)} />
                )}
                <td className="px-4 py-3 font-semibold text-gray-900">{l.name || "Sin nombre"}</td>
                <PhoneCellLink phone={l.phone} />
                <td className="px-4 py-3"><OperationTypeBadge type={l.operationType} /></td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                      l.followUpStatus ? LEAD_FOLLOWUP_STATUS_CLASSES[l.followUpStatus] : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {l.followUpStatus ? LEAD_FOLLOWUP_STATUS_LABELS[l.followUpStatus] : "Sin estado"}
                  </span>
                </td>
                <NextActionCell ms={l.nextActionDate ? l.nextActionDate.toMillis() : null} due={due} />
                <td className="px-4 py-3 text-gray-500">{l.lastContactAt ? formatShortDate(l.lastContactAt.toMillis()) : "—"}</td>
                <RowActionsCell phone={l.phone} onQuickLog={() => onQuickLog(l)} readOnly={readOnly} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ text, actions }: { text: string; actions?: ReactNode }) {
  return (
    <div className="text-center py-16 text-gray-500">
      <ListTodo size={40} className="mx-auto text-gray-300 mb-3" />
      <p className="font-semibold text-gray-700">Tareas</p>
      <p className="text-sm">{text}</p>
      {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
