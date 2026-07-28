import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Phone, MessageSquare, PhoneCall, ListTodo, Check } from "lucide-react";
import type { Lead, Prospect, ProspectTask } from "../types";
import { getProspects, getProspectsForAgent, completeProspectTask } from "../services/prospects";
import { getLeads, getLeadsForAgent, completeLeadTask } from "../services/leads";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { pendingTasks } from "../lib/tasks";
import {
  OPERATION_FILTER_LABEL, PROSPECT_OPERATION_FILTER_OPTIONS, type OperationFilterValue,
} from "../lib/operationFilter";
import {
  prospectToItem, leadToItem,
  agendaBucketOf, AGENDA_BUCKETS, AGENDA_BUCKET_LABELS,
  isOverdueMillis, formatRelativeDays, whatsappLink,
  type AgendaBucket, type FollowUpItem,
} from "../lib/followUp";
import { NEXT_ACTION_TYPE_LABELS, formatShortDateTime } from "../lib/prospectMeta";
import { PageHeader, PageLoading, FilterCard, SegmentedControl, FilterDropdown } from "../components/ui";
import { KindBadge } from "../components/seguimiento/KindBadge";
import { QuickLogModal } from "../components/seguimiento/QuickLogModal";
import { WhatsAppIconLink } from "../components/WhatsAppIconLink";

type Subject = "all" | "owner" | "buyer";

/** Una fila del to-do: un contacto + UNA de sus tareas pendientes. */
type TodoRow = {
  key: string;
  item: FollowUpItem;
  task: ProspectTask;
  dueMillis: number;
};

/**
 * Página "Tareas" (subpágina de Seguimiento): lista de cosas POR HACER en formato to-do.
 * Solo muestra tareas pendientes (las completadas desaparecen), agrupadas por urgencia.
 */
export function SeguimientoTareas() {
  const { user, organizationId, effectiveRole, effectiveUid, isImpersonationReadOnly } = useAuth();
  const isAgent = effectiveRole === "agent";

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const [subject, setSubject] = useState<Subject>("all");
  const [opFilter, setOpFilter] = useState<OperationFilterValue>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Tareas que se acaban de marcar hechas (se ocultan al instante, antes de recargar).
  const [doneKeys, setDoneKeys] = useState<Set<string>>(new Set());
  const [quickLogTarget, setQuickLogTarget] = useState<FollowUpItem | null>(null);

  useEffect(() => {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    load();
  }, [organizationId, effectiveRole, effectiveUid]);

  async function load(opts?: { silent?: boolean }) {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    if (!opts?.silent) setLoading(true);
    try {
      const [p, l] = await Promise.all([
        isAgent ? getProspectsForAgent(effectiveUid) : getProspects(),
        isAgent ? getLeadsForAgent(effectiveUid) : getLeads(),
      ]);
      setProspects(p);
      setLeads(l);
    } catch (e) {
      console.error("[Tareas] load failed", e);
      toast.error("Error al cargar las tareas");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  // --- Construir las filas del to-do (una por tarea pendiente) ---
  const rows = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const out: TodoRow[] = [];

    const pushFrom = (item: FollowUpItem, tasks: ProspectTask[] | undefined) => {
      if (item.isClosed) return; // fuera del pipeline activo (ganado/descartado/cerrado)
      for (const task of pendingTasks(tasks)) {
        out.push({ key: `${item.id}:${task.id}`, item, task, dueMillis: task.dueAt.toMillis() });
      }
    };

    if (subject !== "buyer") {
      for (const p of prospects) {
        if (opFilter !== "all" && p.operationType !== opFilter) continue;
        if (q && !(p.ownerName?.toLowerCase().includes(q) || p.phone?.includes(debouncedSearch) || p.municipality?.toLowerCase().includes(q))) continue;
        pushFrom(prospectToItem(p), p.tasks);
      }
    }
    if (subject !== "owner") {
      for (const l of leads) {
        if (opFilter !== "all" && l.operationType !== opFilter) continue;
        if (q && !(l.name?.toLowerCase().includes(q) || l.phone?.includes(debouncedSearch) || l.email?.toLowerCase().includes(q))) continue;
        pushFrom(leadToItem(l), l.tasks);
      }
    }
    return out.filter((r) => !doneKeys.has(r.key));
  }, [prospects, leads, subject, opFilter, debouncedSearch, doneKeys]);

  // Agrupar por urgencia (vencidas/hoy/mañana/semana/adelante) y ordenar por fecha.
  const groups = useMemo(() => {
    const g: Record<AgendaBucket, TodoRow[]> = {
      vencidas: [], hoy: [], manana: [], semana: [], adelante: [], sin_fecha: [],
    };
    for (const r of rows) g[agendaBucketOf(r.dueMillis)].push(r);
    for (const b of AGENDA_BUCKETS) g[b].sort((a, b2) => a.dueMillis - b2.dueMillis);
    return g;
  }, [rows]);

  async function completeTask(row: TodoRow) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setDoneKeys((prev) => new Set(prev).add(row.key));
    try {
      if (row.item.kind === "prospect") await completeProspectTask(row.item.prospect.id, row.task.id);
      else await completeLeadTask(row.item.lead.id, row.task.id);
      toast.success("Tarea completada");
      load({ silent: true });
    } catch (e) {
      console.error("[Tareas] complete failed", e);
      setDoneKeys((prev) => { const n = new Set(prev); n.delete(row.key); return n; });
      toast.error("No se pudo completar la tarea");
    }
  }

  const total = rows.length;

  if (loading) return <PageLoading className="h-64" />;

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          className="flex-col md:flex-row md:items-end"
          title="Tareas"
          subtitle={`Cosas por hacer${total ? ` · ${total} pendiente${total === 1 ? "" : "s"}` : ""}`}
          actions={
            <SegmentedControl
              ariaLabel="Ámbito de tareas"
              colorScheme="amber"
              value={subject}
              onChange={(v) => setSubject(v as Subject)}
              options={[
                { value: "all", label: "Todas" },
                { value: "owner", label: "Captaciones" },
                { value: "buyer", label: "Leads" },
              ]}
            />
          }
        />
      </div>

      <FilterCard className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
            />
          </div>
          <FilterDropdown
            label={OPERATION_FILTER_LABEL}
            value={opFilter}
            onChange={(v) => setOpFilter(v as OperationFilterValue)}
            options={PROSPECT_OPERATION_FILTER_OPTIONS}
          />
        </div>
      </FilterCard>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <ListTodo size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-700">No tienes tareas pendientes</p>
          <p className="text-sm text-gray-500 mt-1">Crea tareas desde Seguimiento al registrar un contacto.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {AGENDA_BUCKETS.filter((b) => groups[b].length > 0).map((bucket) => (
            <section key={bucket}>
              <div className="mb-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider font-heading",
                    bucket === "vencidas" ? "bg-rose-100 text-rose-700" : "bg-gray-200 text-gray-600"
                  )}
                >
                  {AGENDA_BUCKET_LABELS[bucket]}
                  <span className={bucket === "vencidas" ? "text-rose-400" : "text-gray-400"}>{groups[bucket].length}</span>
                </span>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-50">
                {groups[bucket].map((row) => {
                  const overdue = isOverdueMillis(row.dueMillis);
                  const wa = whatsappLink(row.item.phone);
                  return (
                    <div
                      key={row.key}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      {/* Checkbox "Hecho" */}
                      <button
                        type="button"
                        title="Marcar como hecha"
                        disabled={isImpersonationReadOnly}
                        onClick={() => completeTask(row)}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300 text-transparent hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-40 transition-colors"
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setQuickLogTarget(row.item)}
                        className="flex items-center gap-2 min-w-0 flex-1 basis-52 text-left"
                      >
                        <KindBadge kind={row.item.kind} />
                        <span className="font-semibold text-gray-900 text-sm truncate hover:text-primary-700">{row.item.name}</span>
                      </button>

                      <span className="rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                        {NEXT_ACTION_TYPE_LABELS[row.task.type]}
                      </span>

                      {row.item.phone && (
                        <span className="hidden sm:inline-flex items-center gap-2">
                          <a
                            href={`tel:${row.item.phone}`}
                            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 whitespace-nowrap"
                          >
                            <Phone size={13} /> {row.item.phone}
                          </a>
                          <WhatsAppIconLink phone={row.item.phone} />
                        </span>
                      )}

                      <span className="text-sm whitespace-nowrap">
                        <span className={overdue ? "text-rose-600 font-semibold" : "text-gray-600"}>
                          {formatShortDateTime(row.dueMillis)}
                          {overdue && (
                            <span className="ml-1.5 inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                              {formatRelativeDays(row.dueMillis)}
                            </span>
                          )}
                        </span>
                      </span>

                      <div className="flex items-center gap-1 ml-auto">
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
                          disabled={isImpersonationReadOnly}
                          onClick={() => setQuickLogTarget(row.item)}
                          className="inline-flex items-center gap-1 rounded-btn border border-primary-200 bg-primary-50 px-2 py-1 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
                        >
                          <PhoneCall size={12} /> Registrar
                        </button>
                      </div>

                      {row.task.message && (
                        <p className="basis-full text-xs text-gray-500 truncate pl-9">“{row.task.message}”</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {quickLogTarget && (
        <QuickLogModal
          key={quickLogTarget.id}
          target={quickLogTarget}
          readOnly={isImpersonationReadOnly}
          currentUid={effectiveUid}
          currentName={user?.displayName || user?.email || undefined}
          onClose={() => setQuickLogTarget(null)}
          onLogged={() => load({ silent: true })}
        />
      )}
    </div>
  );
}
