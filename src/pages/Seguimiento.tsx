import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ListTodo, Search, CalendarClock, Target, ChevronDown, CheckSquare, Square } from "lucide-react";
import type { Lead, LeadFollowUpStatus, Prospect, ProspectStage } from "../types";
import {
  PROSPECT_STAGES, PROSPECT_STAGE_LABELS,
  LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS,
} from "../types";
import {
  getProspects, getProspectsForAgent, updateProspectStage,
  prospectsByStage, isDueToday,
} from "../services/prospects";
import { getLeads, getLeadsForAgent, isLeadDueToday, updateLead } from "../services/leads";
import { getOrgMembers, type SystemUser } from "../services/users";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import {
  OPERATION_FILTER_LABEL, PROSPECT_OPERATION_FILTER_OPTIONS, type OperationFilterValue,
} from "../lib/operationFilter";
import {
  leadHasFollowUp, leadMatchesStatusFilter, prospectToItem, leadToItem,
  sortProspectsByNextAction, sortLeadsByNextAction, compareByNextAction, leadsByStatus,
  type FollowUpItem,
} from "../lib/followUp";
import { PageHeader, PageLoading, FilterCard, Button, SegmentedControl, FilterDropdown } from "../components/ui";
import { ProspectDrawer } from "../components/ProspectDrawer";
import { ProspectCreateModal } from "../components/ProspectCreateModal";
import { LeadEditModal } from "../components/LeadEditModal";
import { KanbanBoard, LeadKanbanBoard } from "../components/seguimiento/KanbanBoard";
import { ProspectTable, BuyerTable, EmptyState } from "../components/seguimiento/FollowUpTables";
import { AgendaList } from "../components/seguimiento/AgendaList";
import { QuickLogModal } from "../components/seguimiento/QuickLogModal";
import { FollowUpPicker } from "../components/seguimiento/FollowUpPicker";
import { SinSeguimientoSection } from "../components/seguimiento/SinSeguimientoSection";

type ViewMode = "kanban" | "lista";
type OpFilter = OperationFilterValue;
type Subject = "all" | "owner" | "buyer";
type StatusFilterValue = LeadFollowUpStatus | "sin_estado";

const STATUS_FILTER_OPTIONS: StatusFilterValue[] = [...LEAD_FOLLOWUP_STATUSES, "sin_estado"];

const SEARCH_PLACEHOLDER: Record<Subject, string> = {
  all: "Buscar por nombre o teléfono...",
  owner: "Buscar por nombre, teléfono, municipio...",
  buyer: "Buscar por nombre, teléfono o email...",
};

/** Toggle de pestañas estilo Conversaciones (fondo gris, pastilla blanca activa). */
function PillToggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-gray-100 p-1 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "py-1.5 px-3 text-xs font-bold rounded-md transition-all font-heading uppercase tracking-wider whitespace-nowrap",
            value === opt.value ? "bg-white text-primary-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Filtro desplegable de selección múltiple estilo Leads (varios estados a la vez). */
function MultiFilterDropdown({
  label,
  options,
  isActive,
  activeCount,
  onToggle,
  onClear,
}: {
  label: string;
  options: { value: string; label: string }[];
  isActive: (v: string) => boolean;
  activeCount: number;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-[150px]">
      <div
        className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
          <span className="text-xs font-semibold text-gray-600 shrink-0 font-heading uppercase tracking-wider">{label}:</span>
          <div className="flex items-center gap-1 flex-1 overflow-hidden justify-end">
            <span className="truncate">{activeCount === 0 ? "Todos" : `${activeCount} seleccionados`}</span>
            <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1 shrink-0", open && "rotate-180")} />
          </div>
        </div>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              <button
                onClick={onClear}
                className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
              >
                {activeCount === 0 ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                <span className="text-xs text-gray-700 font-medium">Todos</span>
              </button>
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onToggle(opt.value)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                >
                  {isActive(opt.value) ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                  <span className="text-xs text-gray-700 font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Seguimiento() {
  const navigate = useNavigate();
  const { user, organizationId, effectiveRole, effectiveUid, isImpersonationReadOnly } = useAuth();
  const isAgent = effectiveRole === "agent";
  const isManager = effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "super_admin";

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [members, setMembers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem("seguimiento_view") as ViewMode) || "kanban");
  useEffect(() => { localStorage.setItem("seguimiento_view", view); }, [view]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [opFilter, setOpFilter] = useState<OpFilter>("all");
  const [stageFilter, setStageFilter] = useState<Set<ProspectStage>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilterValue>>(new Set());
  const [dueOnly, setDueOnly] = useState(false);

  const [selected, setSelected] = useState<Prospect | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [quickLogTarget, setQuickLogTarget] = useState<FollowUpItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [subject, setSubject] = useState<Subject>(() => (localStorage.getItem("seguimiento_subject") as Subject) || "all");
  useEffect(() => { localStorage.setItem("seguimiento_subject", subject); }, [subject]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  useEffect(() => {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    loadProspects();
    loadLeads();
    if (isManager) {
      getOrgMembers(organizationId)
        .then((m) => setMembers(m.filter((u) => u.role === "agent" || u.role === "admin" || u.role === "owner")))
        .catch((e) => console.error("[Seguimiento] members failed", e));
    }
  }, [organizationId, effectiveRole, effectiveUid]);

  async function loadProspects(opts?: { silent?: boolean }) {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    if (!opts?.silent) setLoading(true);
    try {
      const data = isAgent ? await getProspectsForAgent(effectiveUid) : await getProspects();
      setProspects(data);
    } catch (e) {
      console.error("[Seguimiento] loadProspects failed", e);
      toast.error("Error al cargar las tareas");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  async function loadLeads() {
    if (!organizationId || !effectiveRole) return;
    if (isAgent && !effectiveUid) return;
    try {
      const data = isAgent ? await getLeadsForAgent(effectiveUid) : await getLeads();
      setLeads(data);
    } catch (e) {
      console.error("[Seguimiento] loadLeads failed", e);
    }
  }

  /** Refresco sin parpadeo tras registrar/editar (mantiene los modales montados). */
  function refreshAll() {
    loadProspects({ silent: true });
    loadLeads();
  }

  // --- Filtros comunes (todas las pestañas): búsqueda + operación + pendientes ---

  const prospectsCommon = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return prospects.filter((p) => {
      const matchesSearch = !q ||
        p.ownerName?.toLowerCase().includes(q) ||
        p.phone?.includes(debouncedSearch) ||
        p.municipality?.toLowerCase().includes(q) ||
        p.zone?.toLowerCase().includes(q) ||
        p.address?.toLowerCase().includes(q);
      const matchesOp = opFilter === "all" || p.operationType === opFilter;
      const matchesDue = !dueOnly || isDueToday(p);
      return matchesSearch && matchesOp && matchesDue;
    });
  }, [prospects, debouncedSearch, opFilter, dueOnly]);

  const leadsCommon = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch = !q ||
        l.name?.toLowerCase().includes(q) ||
        l.phone?.includes(debouncedSearch) ||
        l.email?.toLowerCase().includes(q);
      const matchesOp = opFilter === "all" || l.operationType === opFilter;
      const matchesDue = !dueOnly || isLeadDueToday(l);
      return matchesSearch && matchesOp && matchesDue;
    });
  }, [leads, debouncedSearch, opFilter, dueOnly]);

  // --- Pestaña Propietarios: además etapa, ordenado por próxima acción ---

  const ownerRows = useMemo(() => {
    const base = prospectsCommon.filter((p) => {
      const matchesStage = stageFilter.size === 0 || stageFilter.has(p.stage);
      return matchesStage;
    });
    return sortProspectsByNextAction(base);
  }, [prospectsCommon, stageFilter]);

  const grouped = useMemo(() => prospectsByStage(ownerRows), [ownerRows]);

  // --- Pestaña Compradores: en seguimiento (+ chips de estado) y sin seguimiento ---

  const buyersWithFollowUp = useMemo(() => leadsCommon.filter(leadHasFollowUp), [leadsCommon]);

  const buyerRows = useMemo(
    () => sortLeadsByNextAction(buyersWithFollowUp.filter((l) => leadMatchesStatusFilter(l, statusFilter))),
    [buyersWithFollowUp, statusFilter]
  );

  const groupedLeads = useMemo(() => leadsByStatus(buyerRows), [buyerRows]);

  const leadsSinSeguimiento = useMemo(
    () => leadsCommon.filter((l) => !leadHasFollowUp(l)),
    [leadsCommon]
  );

  // --- Pestaña Todos: agenda unificada (activos, agrupados por urgencia) ---

  const agendaItems = useMemo(() => {
    const items: FollowUpItem[] = [
      ...prospectsCommon.map(prospectToItem),
      ...buyersWithFollowUp.map(leadToItem),
    ];
    return items.filter((i) => !i.isClosed);
  }, [prospectsCommon, buyersWithFollowUp]);

  const dueCount = useMemo(
    () => prospects.filter(isDueToday).length + leads.filter(isLeadDueToday).length,
    [prospects, leads]
  );

  /** Siguiente vencido/de hoy para encadenar registros desde el modal rápido. */
  const nextPending = useMemo(() => {
    if (!quickLogTarget) return null;
    const due: FollowUpItem[] = [
      ...prospects.filter(isDueToday).map(prospectToItem),
      ...leads.filter(isLeadDueToday).map(leadToItem),
    ].sort(compareByNextAction);
    return due.find((i) => i.id !== quickLogTarget.id) || null;
  }, [prospects, leads, quickLogTarget]);

  function toggleStageFilter(stage: ProspectStage) {
    setStageFilter((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage); else next.add(stage);
      return next;
    });
  }

  function toggleStatusFilter(status: StatusFilterValue) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  }

  async function moveStage(p: Prospect, stage: ProspectStage) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, stage } : x)));
    try {
      await updateProspectStage(p.id, stage);
    } catch (e) {
      console.error(e);
      toast.error("Error al cambiar la etapa");
      loadProspects();
    }
  }

  async function moveStatus(l: Lead, followUpStatus: LeadFollowUpStatus) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, followUpStatus } : x)));
    try {
      await updateLead(l.id, { followUpStatus });
    } catch (e) {
      console.error(e);
      toast.error("Error al cambiar el estado");
      loadLeads();
    }
  }

  const openQuickLogProspect = (p: Prospect) => setQuickLogTarget(prospectToItem(p));
  const openQuickLogLead = (l: Lead) => setQuickLogTarget(leadToItem(l));

  if (loading) return <PageLoading className="h-64" />;

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          className="flex-col md:flex-row md:items-end"
          title="Tareas"
          subtitle={`Captaciones y leads · agenda de próximas acciones${dueCount ? ` · ${dueCount} pendientes hoy` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                ariaLabel="Ámbito de tareas"
                colorScheme="amber"
                value={subject}
                onChange={(v) => setSubject(v as Subject)}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "owner", label: "Captaciones" },
                  { value: "buyer", label: "Leads" },
                ]}
              />
              <div className="hidden sm:block h-6 w-px bg-gray-200" />
              <Button onClick={() => setPickerOpen(true)} disabled={isImpersonationReadOnly}>
                <ListTodo size={16} /> Registrar tarea
              </Button>
            </div>
          }
        />
      </div>

      {/* Filtros (los específicos cambian según la pestaña) */}
      <FilterCard className="mb-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder={SEARCH_PLACEHOLDER[subject]}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtros que acotan los resultados */}
            <FilterDropdown
              label={OPERATION_FILTER_LABEL}
              value={opFilter}
              onChange={(v) => setOpFilter(v as OpFilter)}
              options={PROSPECT_OPERATION_FILTER_OPTIONS}
            />
            {subject === "owner" && (
              <MultiFilterDropdown
                label="Etapa"
                activeCount={stageFilter.size}
                isActive={(v) => stageFilter.has(v as ProspectStage)}
                onToggle={(v) => toggleStageFilter(v as ProspectStage)}
                onClear={() => setStageFilter(new Set())}
                options={PROSPECT_STAGES.map((s) => ({ value: s, label: PROSPECT_STAGE_LABELS[s] }))}
              />
            )}
            {subject === "buyer" && (
              <MultiFilterDropdown
                label="Estado"
                activeCount={statusFilter.size}
                isActive={(v) => statusFilter.has(v as StatusFilterValue)}
                onToggle={(v) => toggleStatusFilter(v as StatusFilterValue)}
                onClear={() => setStatusFilter(new Set())}
                options={STATUS_FILTER_OPTIONS.map((s) => ({
                  value: s,
                  label: s === "sin_estado" ? "Sin estado" : LEAD_FOLLOWUP_STATUS_LABELS[s],
                }))}
              />
            )}

            {/* Filtro rápido, pegado a los filtros con un separador */}
            <div className="hidden sm:block h-6 w-px bg-gray-200" />
            <button
              type="button"
              onClick={() => setDueOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors shrink-0",
                dueOnly ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
              )}
            >
              <CalendarClock size={16} /> Pendientes hoy
            </button>
          </div>
        </div>
      </FilterCard>

      {subject === "owner" ? (
        <>
          <div className="mb-4 flex justify-end">
            <PillToggle
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: "kanban", label: "Kanban" },
                { value: "lista", label: "Lista" },
              ]}
            />
          </div>
          {ownerRows.length === 0 ? (
            <EmptyState
              text="No hay propietarios en captación con estos filtros."
              actions={
                <Button onClick={() => setCreateOpen(true)} disabled={isImpersonationReadOnly}>
                  <Target size={15} /> Nueva captación
                </Button>
              }
            />
          ) : view === "kanban" ? (
            <KanbanBoard grouped={grouped} onOpen={setSelected} onMove={moveStage} onQuickLog={openQuickLogProspect} readOnly={isImpersonationReadOnly} />
          ) : (
            <ProspectTable rows={ownerRows} onOpen={setSelected} onQuickLog={openQuickLogProspect} readOnly={isImpersonationReadOnly} />
          )}
        </>
      ) : subject === "buyer" ? (
        <>
          <div className="mb-4 flex justify-end">
            <PillToggle
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: "kanban", label: "Kanban" },
                { value: "lista", label: "Lista" },
              ]}
            />
          </div>
          {buyerRows.length === 0 ? (
            <EmptyState
              text="Ningún comprador con tareas todavía."
              actions={
                <Button onClick={() => setPickerOpen(true)} disabled={isImpersonationReadOnly}>
                  <ListTodo size={15} /> Crear tarea para un comprador
                </Button>
              }
            />
          ) : view === "kanban" ? (
            <LeadKanbanBoard grouped={groupedLeads} onOpen={setSelectedLead} onMove={moveStatus} onQuickLog={openQuickLogLead} readOnly={isImpersonationReadOnly} />
          ) : (
            <BuyerTable rows={buyerRows} onOpen={setSelectedLead} onQuickLog={openQuickLogLead} readOnly={isImpersonationReadOnly} />
          )}
          <SinSeguimientoSection leads={leadsSinSeguimiento} onStart={openQuickLogLead} readOnly={isImpersonationReadOnly} />
        </>
      ) : agendaItems.length === 0 ? (
        <EmptyState
          text="Nada en la agenda todavía. Crea una captación o una tarea."
          actions={
            <>
              <Button variant="outline" onClick={() => setPickerOpen(true)} disabled={isImpersonationReadOnly}>
                <ListTodo size={15} /> Registrar tarea
              </Button>
              <Button onClick={() => setCreateOpen(true)} disabled={isImpersonationReadOnly}>
                <Target size={15} /> Nueva captación
              </Button>
            </>
          }
        />
      ) : (
        <AgendaList
          items={agendaItems}
          onOpen={(item) => (item.kind === "prospect" ? setSelected(item.prospect) : setSelectedLead(item.lead))}
          onQuickLog={setQuickLogTarget}
          readOnly={isImpersonationReadOnly}
        />
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          readOnly={isImpersonationReadOnly}
          isManager={isManager}
          currentUid={effectiveUid}
          currentName={user?.displayName || user?.email || undefined}
          members={members}
          onClose={() => setSelected(null)}
          onChanged={refreshAll}
          onDeleted={() => { setSelected(null); refreshAll(); }}
        />
      )}

      {createOpen && (
        <ProspectCreateModal
          readOnly={isImpersonationReadOnly}
          isManager={isManager}
          currentUid={effectiveUid}
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={refreshAll}
          onOpenExisting={(p) => { setCreateOpen(false); setSelected(p); }}
        />
      )}

      {selectedLead && (
        <LeadEditModal
          lead={selectedLead}
          readOnly={isImpersonationReadOnly}
          onClose={() => setSelectedLead(null)}
          onUpdate={refreshAll}
          onViewConversation={() => navigate("/conversaciones")}
        />
      )}

      {pickerOpen && (
        <FollowUpPicker
          prospects={prospects}
          leads={leads}
          defaultKind={subject === "owner" ? "prospect" : subject === "buyer" ? "lead" : "all"}
          onSelect={(item) => { setPickerOpen(false); setQuickLogTarget(item); }}
          onClose={() => setPickerOpen(false)}
          onCreateNew={() => { setPickerOpen(false); setCreateOpen(true); }}
        />
      )}

      {quickLogTarget && (
        <QuickLogModal
          key={quickLogTarget.id}
          target={quickLogTarget}
          readOnly={isImpersonationReadOnly}
          currentUid={effectiveUid}
          currentName={user?.displayName || user?.email || undefined}
          onClose={() => setQuickLogTarget(null)}
          onLogged={refreshAll}
          nextPending={nextPending}
          onOpenNext={(item) => setQuickLogTarget(item)}
        />
      )}
    </div>
  );
}
