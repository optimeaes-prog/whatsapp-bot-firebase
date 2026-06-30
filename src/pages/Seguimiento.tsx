import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ListTodo, Search, CalendarClock, Target, ChevronDown, CheckSquare, Square, Trash2, RefreshCw, UserCog, Users, X, Plus } from "lucide-react";
import type { Lead, LeadFollowUpStatus, Prospect, ProspectStage } from "../types";
import {
  PROSPECT_STAGES, PROSPECT_STAGE_LABELS,
  LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS,
} from "../types";
import {
  getProspects, getProspectsForAgent, updateProspect, updateProspectStage,
  prospectsByStage, isDueToday,
  deleteProspects, bulkUpdateProspectsStage, bulkAssignProspects,
} from "../services/prospects";
import {
  getLeads, getLeadsForAgent, isLeadDueToday, updateLead,
  deleteLeads, bulkUpdateLeadsFollowUpStatus, bulkAssignLeads,
} from "../services/leads";
import { getOrgMembers, type SystemUser } from "../services/users";
import { analytics } from "../lib/analytics";
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
import { ProspectSpreadsheet } from "../components/seguimiento/ProspectSpreadsheet";
import { BuyerSpreadsheet } from "../components/seguimiento/BuyerSpreadsheet";
import { ZoomControl, DEFAULT_ZOOM, type SpreadsheetZoomId } from "../components/seguimiento/spreadsheetZoom";
import { AgendaList } from "../components/seguimiento/AgendaList";
import { QuickLogModal } from "../components/seguimiento/QuickLogModal";
import { FollowUpPicker } from "../components/seguimiento/FollowUpPicker";
import { SinSeguimientoSection } from "../components/seguimiento/SinSeguimientoSection";

type ViewMode = "kanban" | "lista" | "tabla";
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

  // Tamaño de letra de la vista "Tabla" (control lupa). Se recuerda entre sesiones.
  const [tableZoom, setTableZoom] = useState<SpreadsheetZoomId>(
    () => (localStorage.getItem("seguimiento_table_zoom") as SpreadsheetZoomId) || DEFAULT_ZOOM
  );
  useEffect(() => { localStorage.setItem("seguimiento_table_zoom", tableZoom); }, [tableZoom]);

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

  // --- Selección múltiple (acciones en grupo) ---
  // Solo para managers (las reglas de Firestore solo permiten borrar a owner/admin/super_admin).
  const selectable = isManager && !isImpersonationReadOnly;
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState<null | "delete" | "stage" | "status" | "assign">(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStage, setBulkStage] = useState<ProspectStage>(PROSPECT_STAGES[0]);
  const [bulkStatus, setBulkStatus] = useState<LeadFollowUpStatus>(LEAD_FOLLOWUP_STATUSES[0]);
  const [bulkAssignUid, setBulkAssignUid] = useState<string>("");

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

  // --- Selección múltiple: helpers y acciones en grupo ---

  const selectedCount = selectedProspectIds.size + selectedLeadIds.size;

  function clearSelection() {
    setSelectedProspectIds(new Set());
    setSelectedLeadIds(new Set());
    setBulkMenuOpen(false);
  }

  // Limpiar la selección al cambiar de pestaña o de filtros (no actuar sobre lo que ya no se ve).
  useEffect(() => {
    setSelectedProspectIds(new Set());
    setSelectedLeadIds(new Set());
    setBulkMenuOpen(false);
  }, [subject, debouncedSearch, opFilter, stageFilter, statusFilter, dueOnly]);

  function toggleProspectSelection(id: string) {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleLeadSelection(id: string) {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllProspects() {
    const allSelected = ownerRows.length > 0 && ownerRows.every((p) => selectedProspectIds.has(p.id));
    setSelectedProspectIds(allSelected ? new Set() : new Set(ownerRows.map((p) => p.id)));
  }

  function toggleAllLeads() {
    const allSelected = buyerRows.length > 0 && buyerRows.every((l) => selectedLeadIds.has(l.id));
    setSelectedLeadIds(allSelected ? new Set() : new Set(buyerRows.map((l) => l.id)));
  }

  // Seleccionar/deseleccionar de golpe todas las tarjetas de una columna (una etapa o estado).
  function toggleProspectColumn(ids: string[]) {
    setSelectedProspectIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function toggleLeadColumn(ids: string[]) {
    setSelectedLeadIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  const agendaIsSelected = (item: FollowUpItem) =>
    item.kind === "prospect" ? selectedProspectIds.has(item.prospect.id) : selectedLeadIds.has(item.lead.id);
  const agendaToggleSelect = (item: FollowUpItem) =>
    item.kind === "prospect" ? toggleProspectSelection(item.prospect.id) : toggleLeadSelection(item.lead.id);

  function guardBulk(): boolean {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return false;
    }
    return true;
  }

  async function runBulkDelete() {
    if (!guardBulk()) return;
    const pIds = Array.from(selectedProspectIds);
    const lIds = Array.from(selectedLeadIds);
    const total = pIds.length + lIds.length;
    if (total === 0) return;
    setBulkBusy(true);
    try {
      if (pIds.length) await deleteProspects(pIds);
      if (lIds.length) await deleteLeads(lIds);
      analytics.trackBulkActionExecuted({ action: "delete", count: total });
      toast.success(`Eliminados ${total} registro${total === 1 ? "" : "s"}`);
      setBulkModal(null);
      clearSelection();
      refreshAll();
    } catch (e) {
      console.error("[Seguimiento] bulk delete failed", e);
      toast.error("Error al eliminar los registros seleccionados");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkStage() {
    if (!guardBulk()) return;
    const pIds = Array.from(selectedProspectIds);
    if (pIds.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateProspectsStage(pIds, bulkStage);
      analytics.trackBulkActionExecuted({ action: `stage_${bulkStage}`, count: pIds.length });
      toast.success(`Etapa actualizada en ${pIds.length} captación${pIds.length === 1 ? "" : "es"}`);
      setBulkModal(null);
      clearSelection();
      refreshAll();
    } catch (e) {
      console.error("[Seguimiento] bulk stage failed", e);
      toast.error("Error al cambiar la etapa");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkStatus() {
    if (!guardBulk()) return;
    const lIds = Array.from(selectedLeadIds);
    if (lIds.length === 0) return;
    setBulkBusy(true);
    try {
      await bulkUpdateLeadsFollowUpStatus(lIds, bulkStatus);
      analytics.trackBulkActionExecuted({ action: `status_${bulkStatus}`, count: lIds.length });
      toast.success(`Estado actualizado en ${lIds.length} lead${lIds.length === 1 ? "" : "s"}`);
      setBulkModal(null);
      clearSelection();
      refreshAll();
    } catch (e) {
      console.error("[Seguimiento] bulk status failed", e);
      toast.error("Error al cambiar el estado");
    } finally {
      setBulkBusy(false);
    }
  }

  async function runBulkAssign() {
    if (!guardBulk()) return;
    const pIds = Array.from(selectedProspectIds);
    const lIds = Array.from(selectedLeadIds);
    const total = pIds.length + lIds.length;
    if (total === 0) return;
    const member = members.find((m) => m.uid === bulkAssignUid);
    const name = member ? (member.name || member.displayName || member.email) : "";
    setBulkBusy(true);
    try {
      if (pIds.length) await bulkAssignProspects(pIds, bulkAssignUid, name);
      if (lIds.length) await bulkAssignLeads(lIds, bulkAssignUid);
      analytics.trackBulkActionExecuted({ action: bulkAssignUid ? "assign" : "unassign", count: total });
      toast.success(`Reasignados ${total} registro${total === 1 ? "" : "s"}`);
      setBulkModal(null);
      clearSelection();
      refreshAll();
    } catch (e) {
      console.error("[Seguimiento] bulk assign failed", e);
      toast.error("Error al reasignar");
    } finally {
      setBulkBusy(false);
    }
  }

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

  // --- Edición en línea desde la vista "Tabla" (parche optimista, sin re-ordenar) ---

  /** Guarda un cambio de un campo de una captación sin recargar (la fila no salta). */
  async function patchProspect(id: string, partial: Partial<Prospect>) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      throw new Error("read-only");
    }
    const prev = prospects;
    setProspects((rows) => rows.map((x) => (x.id === id ? { ...x, ...partial } : x)));
    try {
      if ("stage" in partial && partial.stage) {
        await updateProspectStage(id, partial.stage);
      } else {
        await updateProspect(id, partial);
      }
    } catch (e) {
      console.error("[Seguimiento] patchProspect failed", e);
      toast.error("No se pudo guardar el cambio");
      setProspects(prev); // revertir
      throw e;
    }
  }

  /** Guarda un cambio de un campo de un lead sin recargar. */
  async function patchLead(id: string, partial: Partial<Lead>) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      throw new Error("read-only");
    }
    const prev = leads;
    setLeads((rows) => rows.map((x) => (x.id === id ? { ...x, ...partial } : x)));
    try {
      await updateLead(id, partial);
    } catch (e) {
      console.error("[Seguimiento] patchLead failed", e);
      toast.error("No se pudo guardar el cambio");
      setLeads(prev); // revertir
      throw e;
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
          subtitle={`Captaciones y leads · agenda de tareas y eventos${dueCount ? ` · ${dueCount} pendientes hoy` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                ariaLabel="Ámbito de seguimiento"
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
              <Button size="lg" onClick={() => setPickerOpen(true)} disabled={isImpersonationReadOnly}>
                <Plus size={20} /> Seguimiento
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
          <div className="mb-4 flex items-center justify-end gap-2">
            {view === "tabla" && <ZoomControl zoom={tableZoom} onChange={setTableZoom} />}
            <PillToggle
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: "kanban", label: "Kanban" },
                { value: "lista", label: "Lista" },
                { value: "tabla", label: "Tabla" },
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
            <KanbanBoard
              grouped={grouped}
              onOpen={setSelected}
              onMove={moveStage}
              onQuickLog={openQuickLogProspect}
              readOnly={isImpersonationReadOnly}
              selectable={selectable}
              selectedIds={selectedProspectIds}
              onToggleSelect={toggleProspectSelection}
              onToggleColumn={toggleProspectColumn}
            />
          ) : view === "lista" ? (
            <ProspectTable
              rows={ownerRows}
              onOpen={setSelected}
              onQuickLog={openQuickLogProspect}
              readOnly={isImpersonationReadOnly}
              selectable={selectable}
              selectedIds={selectedProspectIds}
              onToggleSelect={toggleProspectSelection}
              onToggleAll={toggleAllProspects}
            />
          ) : (
            <ProspectSpreadsheet
              rows={ownerRows}
              onOpen={setSelected}
              onChanged={patchProspect}
              readOnly={isImpersonationReadOnly}
              zoom={tableZoom}
              selectable={selectable}
              selectedIds={selectedProspectIds}
              onToggleSelect={toggleProspectSelection}
              onToggleAll={toggleAllProspects}
            />
          )}
        </>
      ) : subject === "buyer" ? (
        <>
          <div className="mb-4 flex items-center justify-end gap-2">
            {view === "tabla" && <ZoomControl zoom={tableZoom} onChange={setTableZoom} />}
            <PillToggle
              value={view}
              onChange={(v) => setView(v as ViewMode)}
              options={[
                { value: "kanban", label: "Kanban" },
                { value: "lista", label: "Lista" },
                { value: "tabla", label: "Tabla" },
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
            <LeadKanbanBoard
              grouped={groupedLeads}
              onOpen={setSelectedLead}
              onMove={moveStatus}
              onQuickLog={openQuickLogLead}
              readOnly={isImpersonationReadOnly}
              selectable={selectable}
              selectedIds={selectedLeadIds}
              onToggleSelect={toggleLeadSelection}
              onToggleColumn={toggleLeadColumn}
            />
          ) : view === "lista" ? (
            <BuyerTable
              rows={buyerRows}
              onOpen={setSelectedLead}
              onQuickLog={openQuickLogLead}
              readOnly={isImpersonationReadOnly}
              selectable={selectable}
              selectedIds={selectedLeadIds}
              onToggleSelect={toggleLeadSelection}
              onToggleAll={toggleAllLeads}
            />
          ) : (
            <BuyerSpreadsheet
              rows={buyerRows}
              onOpen={setSelectedLead}
              onChanged={patchLead}
              readOnly={isImpersonationReadOnly}
              zoom={tableZoom}
              selectable={selectable}
              selectedIds={selectedLeadIds}
              onToggleSelect={toggleLeadSelection}
              onToggleAll={toggleAllLeads}
            />
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
          selectable={selectable}
          isSelected={agendaIsSelected}
          onToggleSelect={agendaToggleSelect}
        />
      )}

      {selected && (
        <ProspectDrawer
          prospect={selected}
          context="seguimiento"
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

      {/* Barra flotante de acciones en grupo (aparece al seleccionar registros) */}
      {selectable && selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 border border-primary-100 rounded-lg flex items-center justify-center text-primary-700">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">
                  {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
                </p>
                <button
                  onClick={clearSelection}
                  className="text-[11px] text-gray-600 font-semibold hover:text-gray-800 hover:underline"
                >
                  Deseleccionar todos
                </button>
              </div>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setBulkMenuOpen((v) => !v)}
                className="px-4 py-2 bg-primary-600 text-white rounded-btn text-sm font-bold hover:bg-primary-700 transition-all shadow-sm active:scale-95 flex items-center gap-2"
              >
                <ChevronDown size={16} className={cn("transition-transform", bulkMenuOpen && "rotate-180")} />
                <span>Acciones</span>
              </button>

              {bulkMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBulkMenuOpen(false)} />
                  <div className="absolute right-0 bottom-12 z-50 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5">
                    <button
                      onClick={() => { setBulkMenuOpen(false); setBulkAssignUid(""); setBulkModal("assign"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <UserCog size={16} className="text-gray-600" />
                      Reasignar agente
                    </button>
                    {subject === "owner" && (
                      <button
                        onClick={() => { setBulkMenuOpen(false); setBulkModal("stage"); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                      >
                        <RefreshCw size={16} className="text-gray-600" />
                        Cambiar etapa
                      </button>
                    )}
                    {subject === "buyer" && (
                      <button
                        onClick={() => { setBulkMenuOpen(false); setBulkModal("status"); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                      >
                        <RefreshCw size={16} className="text-gray-600" />
                        Cambiar estado
                      </button>
                    )}
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      onClick={() => { setBulkMenuOpen(false); setBulkModal("delete"); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-btn transition-colors"
                    >
                      <Trash2 size={16} className="text-rose-600" />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modales de las acciones en grupo */}
      {bulkModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
          onClick={() => { if (!bulkBusy) setBulkModal(null); }}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-gray-900 font-heading">
                {bulkModal === "delete" && "Eliminar selección"}
                {bulkModal === "stage" && "Cambiar etapa"}
                {bulkModal === "status" && "Cambiar estado"}
                {bulkModal === "assign" && "Reasignar agente"}
              </h3>
              <button
                type="button"
                onClick={() => { if (!bulkBusy) setBulkModal(null); }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {bulkModal === "delete" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Vas a eliminar <strong>{selectedCount}</strong> registro{selectedCount === 1 ? "" : "s"}
                  {selectedLeadIds.size > 0 && " (los leads borran también su conversación asociada)"}.
                  Esta acción <strong>no se puede deshacer</strong>.
                </p>
              </div>
            )}

            {bulkModal === "stage" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 font-heading uppercase tracking-wider">Nueva etapa</label>
                <select
                  value={bulkStage}
                  onChange={(e) => setBulkStage(e.target.value as ProspectStage)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {PROSPECT_STAGES.map((s) => <option key={s} value={s}>{PROSPECT_STAGE_LABELS[s]}</option>)}
                </select>
                <p className="text-xs text-gray-500">Se aplicará a {selectedProspectIds.size} captación{selectedProspectIds.size === 1 ? "" : "es"}.</p>
              </div>
            )}

            {bulkModal === "status" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 font-heading uppercase tracking-wider">Nuevo estado</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as LeadFollowUpStatus)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {LEAD_FOLLOWUP_STATUSES.map((s) => <option key={s} value={s}>{LEAD_FOLLOWUP_STATUS_LABELS[s]}</option>)}
                </select>
                <p className="text-xs text-gray-500">Se aplicará a {selectedLeadIds.size} lead{selectedLeadIds.size === 1 ? "" : "s"}.</p>
              </div>
            )}

            {bulkModal === "assign" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 font-heading uppercase tracking-wider">Agente responsable</label>
                <select
                  value={bulkAssignUid}
                  onChange={(e) => setBulkAssignUid(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>{m.name || m.displayName || m.email}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">Se aplicará a {selectedCount} registro{selectedCount === 1 ? "" : "s"}.</p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkModal(null)} disabled={bulkBusy}>
                Cancelar
              </Button>
              {bulkModal === "delete" ? (
                <button
                  type="button"
                  onClick={runBulkDelete}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  <Trash2 size={15} /> {bulkBusy ? "Eliminando…" : "Eliminar"}
                </button>
              ) : (
                <Button
                  onClick={bulkModal === "stage" ? runBulkStage : bulkModal === "status" ? runBulkStatus : runBulkAssign}
                  disabled={bulkBusy}
                >
                  {bulkBusy ? "Aplicando…" : "Aplicar"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
