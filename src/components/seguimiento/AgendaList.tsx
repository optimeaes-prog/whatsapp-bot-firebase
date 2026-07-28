import { Phone, MessageSquare, PhoneCall, CheckSquare, Square } from "lucide-react";
import {
  AGENDA_BUCKETS, AGENDA_BUCKET_LABELS, groupByAgendaBucket,
  isOverdueMillis, formatRelativeDays, whatsappLink, type FollowUpItem,
} from "../../lib/followUp";
import { formatShortDate, formatShortDateTime } from "../../lib/prospectMeta";
import { cn } from "../../lib/utils";
import { OperationTypeBadge } from "../StatusBadges";
import { WhatsAppIconLink } from "../WhatsAppIconLink";
import { KindBadge } from "./KindBadge";

/**
 * Agenda unificada (pestaña "Todos"): propietarios y compradores mezclados,
 * agrupados por urgencia (Vencidas / Hoy / Mañana / Esta semana / Más adelante / Sin fecha)
 * y ordenados por próxima acción dentro de cada grupo.
 */
export function AgendaList({
  items, onOpen, onQuickLog, readOnly, selectable = false, isSelected, onToggleSelect,
}: {
  items: FollowUpItem[];
  onOpen: (item: FollowUpItem) => void;
  onQuickLog: (item: FollowUpItem) => void;
  readOnly: boolean;
  selectable?: boolean;
  isSelected?: (item: FollowUpItem) => boolean;
  onToggleSelect?: (item: FollowUpItem) => void;
}) {
  const groups = groupByAgendaBucket(items);

  return (
    <div className="space-y-6">
      {AGENDA_BUCKETS.filter((b) => groups[b].length > 0).map((bucket) => (
        <section key={bucket}>
          <div className="sticky top-0 z-10 py-1 -my-1 mb-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider font-heading backdrop-blur",
                bucket === "vencidas" ? "bg-rose-100/95 text-rose-700" : "bg-gray-200/90 text-gray-600"
              )}
            >
              {AGENDA_BUCKET_LABELS[bucket]}
              <span className={bucket === "vencidas" ? "text-rose-400" : "text-gray-400"}>{groups[bucket].length}</span>
            </span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-50">
            {groups[bucket].map((item) => {
              const wa = whatsappLink(item.phone);
              const selected = selectable && (isSelected?.(item) ?? false);
              return (
                <div
                  key={item.id}
                  onClick={() => onOpen(item)}
                  className={cn(
                    "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors",
                    selected && "bg-primary-50/60"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 basis-52">
                    {selectable && (
                      <button
                        type="button"
                        title={selected ? "Quitar de la selección" : "Seleccionar"}
                        onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item); }}
                        className="shrink-0 text-gray-400 hover:text-primary-600 transition-colors"
                      >
                        {selected ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} />}
                      </button>
                    )}
                    <KindBadge kind={item.kind} />
                    <span className="font-semibold text-gray-900 text-sm truncate">{item.name}</span>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", item.statusClasses)}>
                    {item.statusLabel}
                  </span>
                  <OperationTypeBadge type={item.operationType} />
                  {item.phone && (
                    <span className="hidden sm:inline-flex items-center gap-2">
                      <a
                        href={`tel:${item.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap"
                      >
                        <Phone size={13} /> {item.phone}
                      </a>
                      <WhatsAppIconLink phone={item.phone} />
                    </span>
                  )}
                  <span className="text-sm whitespace-nowrap">
                    {item.nextActionMillis != null ? (
                      <span className={item.isDue ? "text-rose-600 font-semibold" : "text-gray-600"}>
                        {formatShortDateTime(item.nextActionMillis)}
                        {item.isDue && isOverdueMillis(item.nextActionMillis) && (
                          <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            {formatRelativeDays(item.nextActionMillis)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">Sin fecha</span>
                    )}
                  </span>
                  <span className="hidden lg:inline text-xs text-gray-400 whitespace-nowrap">
                    Último: {item.lastContactMillis != null ? formatShortDate(item.lastContactMillis) : "—"}
                  </span>
                  <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
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
                      onClick={() => onQuickLog(item)}
                      className="inline-flex items-center gap-1 rounded-btn border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
                    >
                      <PhoneCall size={12} /> Registrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
