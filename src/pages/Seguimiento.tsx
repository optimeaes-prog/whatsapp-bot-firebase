import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PhoneCall, Search, LayoutGrid, List, CalendarClock, Target } from "lucide-react";
import type { Lead, LeadFollowUpStatus, Prospect, ProspectStage } from "../types";
import {
  PROSPECT_STAGES, PROSPECT_STAGE_LABELS,
  LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS,
} from "../types";
import {
  getProspects, getProspectsForAgent, updateProspectStage,
  prospectsByStage, isDueToday,
} from "../services/prospects";
import { getLeads, getLeadsForAgent, isLeadDueToday } from "../services/leads";
import { getOrgMembers, type SystemUser } from "../services/users";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { PROSPECT_STAGE_CLASSES, LEAD_FOLLOWUP_STATUS_CLASSES } from "../lib/prospectMeta";
import {
  leadHasFollowUp, leadMatchesStatusFilter, prospectToItem, leadToItem,
  sortProspectsByNextAction, sortLeadsByNextAction, compareByNextAction,
  type FollowUpItem,
} from "../lib/followUp";
import { PageHeader, PageLoading, FilterCard, SegmentedControl, Button } from "../components/ui";
import { ProspectDrawer } from "../components/ProspectDrawer";
import { ProspectCreateModal } from "../components/ProspectCreateModal";
import { LeadEditModal } from "../components/LeadEditModal";
import { KanbanBoard } from "../components/seguimiento/KanbanBoard";
import { ProspectTable, BuyerTable, EmptyState } from "../components/seguimiento/FollowUpTables";
import { AgendaList } from "../components/seguimiento/AgendaList";
import { QuickLogModal } from "../components/seguimiento/QuickLogModal";
import { FollowUpPicker } from "../components/seguimiento/FollowUpPicker";
import { NewActionMenu } from "../components/seguimiento/NewActionMenu";
import { SinSeguimientoSection } from "../components/seguimiento/SinSeguimientoSection";

type ViewMode = "kanban" | "lista";
type OpFilter = "all" | "Venta" | "Alquiler";
type Subject = "all" | "owner" | "buyer";
type StatusFilterValue = LeadFollowUpStatus | "sin_estado";

const STATUS_FILTER_OPTIONS: StatusFilterValue[] = [...LEAD_FOLLOWUP_STATUSES, "sin_estado"];

const SEARCH_PLACEHOLDER: Record<Subject, string> = {
  all: "Buscar por nombre o teléfono...",
  owner: "Buscar por nombre, teléfono, municipio...",
  buyer: "Buscar por nombre, teléfono o email...",
};

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
  const [municipality, setMunicipality] = useState<string>("all");
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
      toast.error("Error al cargar el seguimiento");
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

  const municipalities = useMemo(() => {
    const set = new Set<string>();
    prospects.forEach((p) => { if (p.municipality) set.add(p.municipality); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [prospects]);

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

  // --- Pestaña Propietarios: además municipio + etapa, ordenado por próxima acción ---

  const ownerRows = useMemo(() => {
    const base = prospectsCommon.filter((p) => {
      const matchesMuni = municipality === "all" || p.municipality === municipality;
      const matchesStage = stageFilter.size === 0 || stageFilter.has(p.stage);
      return matchesMuni && matchesStage;
    });
    return sortProspectsByNextAction(base);
  }, [prospectsCommon, municipality, stageFilter]);

  const grouped = useMemo(() => prospectsByStage(ownerRows), [ownerRows]);

  // --- Pestaña Compradores: en seguimiento (+ chips de estado) y sin seguimiento ---

  const buyersWithFollowUp = useMemo(() => leadsCommon.filter(leadHasFollowUp), [leadsCommon]);

  const buyerRows = useMemo(
    () => sortLeadsByNextAction(buyersWithFollowUp.filter((l) => leadMatchesStatusFilter(l, statusFilter))),
    [buyersWithFollowUp, statusFilter]
  );

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

  const openQuickLogProspect = (p: Prospect) => setQuickLogTarget(prospectToItem(p));
  const openQuickLogLead = (l: Lead) => setQuickLogTarget(leadToItem(l));

  if (loading) return <PageLoading className="h-64" />;

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          className="flex-col md:flex-row md:items-end"
          title="Seguimiento"
          subtitle={`Propietarios y leads · agenda de próximas acciones${dueCount ? ` · ${dueCount} pendientes hoy` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Tipo: todos / propietarios / compradores */}
              <SegmentedControl
                ariaLabel="Tipo"
                mode="single"
                value={subject}
                onChange={(v) => setSubject(v)}
                options={[
                  { value: "all", label: "Todos" },
                  { value: "owner", label: "Propietarios" },
                  { value: "buyer", label: "Leads" },
                ]}
              />
              {subject === "owner" && (
                <SegmentedControl
                  ariaLabel="Vista"
                  mode="single"
                  value={view}
                  onChange={(v) => setView(v)}
                  options={[
                    { value: "kanban", label: <span className="flex items-center gap-1.5"><LayoutGrid size={15} /> Kanban</span> },
                    { value: "lista", label: <span className="flex items-center gap-1.5"><List size={15} /> Lista</span> },
                  ]}
                />
              )}
              <NewActionMenu
                subject={subject}
                disabled={isImpersonationReadOnly}
                onNewCaptacion={() => setCreateOpen(true)}
                onRegistrarSeguimiento={() => setPickerOpen(true)}
              />
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
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            {subject === "owner" && (
              <select
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="all">Todos los municipios</option>
                {municipalities.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
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

          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="Operación"
              mode="single"
              value={opFilter}
              onChange={(v) => setOpFilter(v)}
              className="!shadow-none"
              options={[
                { value: "all", label: "Todas" },
                { value: "Venta", label: "Venta" },
                { value: "Alquiler", label: "Alquiler" },
              ]}
            />
            {subject === "owner" && (
              <div className="flex flex-wrap gap-1.5">
                {PROSPECT_STAGES.map((s) => {
                  const active = stageFilter.has(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStageFilter(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                        active ? cn(PROSPECT_STAGE_CLASSES[s], "border-transparent ring-2 ring-offset-1 ring-primary-300")
                               : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {PROSPECT_STAGE_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            )}
            {subject === "buyer" && (
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTER_OPTIONS.map((s) => {
                  const active = statusFilter.has(s);
                  const activeClasses = s === "sin_estado" ? "bg-gray-100 text-gray-600" : LEAD_FOLLOWUP_STATUS_CLASSES[s];
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatusFilter(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                        active ? cn(activeClasses, "border-transparent ring-2 ring-offset-1 ring-primary-300")
                               : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {s === "sin_estado" ? "Sin estado" : LEAD_FOLLOWUP_STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </FilterCard>

      {subject === "owner" ? (
        ownerRows.length === 0 ? (
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
        )
      ) : subject === "buyer" ? (
        <>
          {buyerRows.length === 0 ? (
            <EmptyState
              text="Ningún comprador en seguimiento todavía."
              actions={
                <Button onClick={() => setPickerOpen(true)} disabled={isImpersonationReadOnly}>
                  <PhoneCall size={15} /> Iniciar seguimiento de un comprador
                </Button>
              }
            />
          ) : (
            <BuyerTable rows={buyerRows} onOpen={setSelectedLead} onQuickLog={openQuickLogLead} readOnly={isImpersonationReadOnly} />
          )}
          <SinSeguimientoSection leads={leadsSinSeguimiento} onStart={openQuickLogLead} readOnly={isImpersonationReadOnly} />
        </>
      ) : agendaItems.length === 0 ? (
        <EmptyState
          text="Nada en la agenda todavía. Crea una captación o registra un seguimiento."
          actions={
            <>
              <Button variant="outline" onClick={() => setPickerOpen(true)} disabled={isImpersonationReadOnly}>
                <PhoneCall size={15} /> Registrar seguimiento
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
