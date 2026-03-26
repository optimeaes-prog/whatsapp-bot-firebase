import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, Phone, Search, User, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, X, Trash2, Download, Filter } from "lucide-react";
import type { Lead, QualificationStatus, Conversation } from "../types";
import { getLeads, deleteLead } from "../services/leads";
import { getListings } from "../services/listings";
import { getConversationByChatId, sendMassMessageToWhatsApp } from "../services/conversations";
import { getQualifiedLeads } from "../services/qualifiedLeads";
import { formatDate, formatPhone, cn, formatMessageTime } from "../lib/utils";
import { downloadConversation } from "../lib/export";
import { LeadDetails } from "../components/LeadDetails";
import { LeadEditModal } from "../components/LeadEditModal";
import { Send, CheckSquare, Square, XCircle, ExternalLink } from "lucide-react";

type SortField = "name" | "phone" | "listingCode" | "operationType" | "qualificationStatus" | "lastMessageDate" | "messageCount" | "qualifiedAt";
type SortDirection = "asc" | "desc";

type LeadWithMessages = Lead & {
  messageCount?: number;
  qualifiedAt?: Date;
  listingDescription?: string;
};

export function Leads() {
  const [leads, setLeads] = useState<LeadWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const adFromUrl = searchParams.get("ad");
  const [filterTipo, setFilterTipo] = useState<"all" | "Venta" | "Alquiler">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | QualificationStatus>("all");
  const [filterAnuncio, setFilterAnuncio] = useState<string>(adFromUrl || "all");

  useEffect(() => {
    if (adFromUrl) {
      setFilterAnuncio(adFromUrl);
    }
  }, [adFromUrl]);
  const [sortField, setSortField] = useState<SortField>("lastMessageDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [massMessageText, setMassMessageText] = useState("");
  const [sendingMassMessage, setSendingMassMessage] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    try {
      const [data, qualifiedData, listingsData] = await Promise.all([
        getLeads(),
        getQualifiedLeads(),
        getListings()
      ]);

      // Create a map of qualification dates for quick lookup
      const qualifiedMap = new Map(
        qualifiedData.map(ql => [ql.chatId, ql.createdAt?.toDate()])
      );

      // Create a map of listing descriptions
      const listingsMap = new Map(
        listingsData.map(l => [l.listingCode, l.description])
      );

      // Load message count, qualification date, and listing description for each lead
      const leadsWithMessages = await Promise.all(
        data.map(async (lead) => {
          try {
            const conversation = await getConversationByChatId(lead.chatId);
            return {
              ...lead,
              messageCount: conversation?.messageCount || 0,
              qualifiedAt: qualifiedMap.get(lead.chatId),
              listingDescription: listingsMap.get(lead.listingCode),
              notes: conversation?.notes || lead.notes
            };
          } catch {
            return {
              ...lead,
              messageCount: 0,
              qualifiedAt: qualifiedMap.get(lead.chatId),
              listingDescription: listingsMap.get(lead.listingCode)
            };
          }
        })
      );
      setLeads(leadsWithMessages);
    } catch (error) {
      console.error("Error loading leads:", error);
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(lead: Lead) {
    setLoadingConversation(true);
    try {
      const conversation = await getConversationByChatId(lead.chatId);
      if (!conversation) {
        alert("No hay conversación disponible para este lead. El cliente aún no ha enviado mensajes.");
        return;
      }
      setSelectedLead(lead);
      setSelectedConversation(conversation);
      setLeadToEdit(null); // Close edit modal if open
    } catch (error) {
      console.error("Error loading conversation:", error);
      alert("Error al cargar la conversación");
    } finally {
      setLoadingConversation(false);
    }
  }

  function openEditModal(lead: Lead) {
    setLeadToEdit(lead);
  }

  async function handleDeleteLead(e: React.MouseEvent, lead: Lead) {
    e.stopPropagation();

    const leadName = lead.name || formatPhone(lead.phone);
    const warningMessage = `⚠️ ADVERTENCIA: Esta acción eliminará permanentemente:\n\n` +
      `• El lead de ${leadName}\n` +
      `• La conversación asociada\n\n` +
      `Esta acción NO se puede deshacer.\n\n` +
      `¿Estás seguro de que quieres continuar?`;

    if (!window.confirm(warningMessage)) {
      return;
    }

    try {
      await deleteLead(lead.id);
      setLeads(leads.filter(l => l.id !== lead.id));
      // Remove from selection if deleted
      setSelectedLeadIds(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    } catch (error) {
      console.error("Error deleting lead:", error);
      alert("Error al eliminar el lead y su conversación");
    }
  }

  function toggleLeadSelection(leadId: string) {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }

  function toggleAllSelection() {
    if (selectedLeadIds.size === filteredAndSortedLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredAndSortedLeads.map(l => l.id)));
    }
  }

  async function handleSendMassMessage() {
    if (!massMessageText.trim()) {
      alert("Por favor introduce un mensaje");
      return;
    }

    const selectedChatIds = leads
      .filter(l => selectedLeadIds.has(l.id))
      .map(l => l.chatId);

    if (selectedChatIds.length === 0) return;

    setSendingMassMessage(true);
    try {
      const result = await sendMassMessageToWhatsApp(selectedChatIds, massMessageText);
      alert(`Mensaje enviado correctamente: ${result.summary.sent} éxitos, ${result.summary.failed} errores.`);
      setIsMassMessageModalOpen(false);
      setMassMessageText("");
      setSelectedLeadIds(new Set());
      loadLeads(); // Refresh leads to show updated history
    } catch (error) {
      console.error("Error sending mass message:", error);
      alert("Error al enviar el mensaje masivo");
    } finally {
      setSendingMassMessage(false);
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with default desc direction
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp size={14} className="text-primary-600" />
    ) : (
      <ArrowDown size={14} className="text-primary-600" />
    );
  };

  const filteredAndSortedLeads = leads
    .filter((lead) => {
      const matchesSearch =
        (lead.phone || "").includes(search) ||
        (lead.listingCode || "").toLowerCase().includes(search.toLowerCase()) ||
        (lead.chatId || "").includes(search) ||
        (lead.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (lead.listingDescription || "").toLowerCase().includes(search.toLowerCase());
      const matchesTipo = filterTipo === "all" || lead.operationType === filterTipo;
      const matchesStatus = filterStatus === "all" || lead.qualificationStatus === filterStatus;
      const matchesAnuncio = filterAnuncio === "all" || lead.listingCode === filterAnuncio;
      return matchesSearch && matchesTipo && matchesStatus && matchesAnuncio;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
          break;
        case "phone":
          aValue = a.phone;
          bValue = b.phone;
          break;
        case "listingCode":
          aValue = a.listingCode;
          bValue = b.listingCode;
          break;
        case "operationType":
          aValue = a.operationType;
          bValue = b.operationType;
          break;
        case "qualificationStatus":
          aValue = a.qualificationStatus || "not_qualified";
          bValue = b.qualificationStatus || "not_qualified";
          break;
        case "qualifiedAt":
          aValue = a.qualifiedAt?.getTime() || 0;
          bValue = b.qualifiedAt?.getTime() || 0;
          break;
        case "lastMessageDate":
          aValue = a.lastMessageDate?.toMillis() || 0;
          bValue = b.lastMessageDate?.toMillis() || 0;
          break;
        case "messageCount":
          aValue = a.messageCount || 0;
          bValue = b.messageCount || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  function getStatusBadge(lead: LeadWithMessages) {
    const status = lead.qualificationStatus;

    if (!status || status === "not_qualified") {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
          No cualif.
        </span>
      );
    }
    if (status === "qualified") {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
          Cualificado
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
        Rechazado
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mostrando {filteredAndSortedLeads.length} de {leads.length} leads
          </p>
        </div>
        <div className="flex gap-2">
          {(search || filterTipo !== "all" || filterStatus !== "all" || filterAnuncio !== "all" || selectedLeadIds.size > 0) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterTipo("all");
                setFilterStatus("all");
                setFilterAnuncio("all");
                setSearchParams({});
                setSelectedLeadIds(new Set());
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Floating Action Bar for Mass Messaging */}
      {selectedLeadIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-primary-100 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{selectedLeadIds.size} seleccionados</p>
                <button
                  onClick={() => setSelectedLeadIds(new Set())}
                  className="text-[11px] text-primary-600 font-bold hover:underline"
                >
                  Deseleccionar todos
                </button>
              </div>
            </div>
            <button
              onClick={() => setIsMassMessageModalOpen(true)}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center gap-2"
            >
              <Send size={16} />
              <span>Enviar Mensaje</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por teléfono, nombre o anuncio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
            <Filter size={18} className="text-gray-500 flex-shrink-0" />
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
              className="bg-transparent text-sm focus:outline-none focus:ring-0 text-gray-700 font-medium w-full sm:w-auto"
            >
              <option value="all">Todos los tipos</option>
              <option value="Venta">Venta</option>
              <option value="Alquiler">Alquiler</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
            <Filter size={18} className="text-gray-500 flex-shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="bg-transparent text-sm focus:outline-none focus:ring-0 text-gray-700 font-medium w-full sm:w-auto"
            >
              <option value="all">Todos los estados</option>
              <option value="not_qualified">No cualificado</option>
              <option value="qualified">Cualificado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border shadow-sm">
            <Filter size={18} className="text-gray-500 flex-shrink-0" />
            <select
              value={filterAnuncio}
              onChange={(e) => {
                const newValue = e.target.value;
                setFilterAnuncio(newValue);
                if (newValue === "all") {
                  searchParams.delete("ad");
                  setSearchParams(searchParams);
                } else {
                  setSearchParams({ ...Object.fromEntries(searchParams.entries()), ad: newValue });
                }
              }}
              className="bg-transparent text-sm focus:outline-none focus:ring-0 text-gray-700 font-medium w-full sm:w-[140px] max-w-[200px] truncate"
            >
              <option value="all">Todos los anuncios</option>
              {Array.from(
                leads.reduce((map, lead) => {
                  if (lead.listingCode && !map.has(lead.listingCode)) {
                    map.set(lead.listingCode, lead.listingDescription || lead.listingCode);
                  }
                  return map;
                }, new Map<string, string>())
              )
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([code, description]) => (
                  <option key={code} value={code}>
                    {description === code ? code : `${code} - ${description.substring(0, 30)}${description.length > 30 ? "..." : ""}`}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {filteredAndSortedLeads.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {leads.length === 0 ? "No hay leads" : "No se encontraron resultados"}
          </h3>
          <p className="text-gray-500">
            {leads.length === 0
              ? "Los leads aparecerán aquí cuando los clientes interactúen con el bot"
              : "Intenta con otros términos de búsqueda"}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Select All Button */}
          <div className="md:hidden flex justify-start mb-3">
            <button
              onClick={toggleAllSelection}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100"
            >
              {selectedLeadIds.size === filteredAndSortedLeads.length && filteredAndSortedLeads.length > 0 ? (
                <>
                  <CheckSquare size={16} /> Deseleccionar todos
                </>
              ) : (
                <>
                  <CheckSquare size={16} /> Seleccionar todos
                </>
              )}
            </button>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredAndSortedLeads.map((lead) => (
              <div
                key={lead.id}
                className={cn(
                  "card p-4 cursor-pointer hover:shadow-md transition-shadow relative",
                  selectedLeadIds.has(lead.id) && "ring-2 ring-primary-500 bg-primary-50/30"
                )}
                onClick={() => toggleLeadSelection(lead.id)}
              >
                <div className="absolute top-2 right-2 md:hidden">
                  {selectedLeadIds.has(lead.id) ? (
                    <CheckSquare size={18} className="text-primary-600" />
                  ) : (
                    <Square size={18} className="text-gray-300" />
                  )}
                </div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User size={18} className="text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate" onClick={(e) => { e.stopPropagation(); openEditModal(lead); }}>
                        {lead.name || "Sin nombre"}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Phone size={12} />
                        <span>{formatPhone(lead.phone)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteLead(e, lead)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0 z-10"
                    title="Eliminar lead"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {getStatusBadge(lead)}
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      lead.operationType === "Venta"
                        ? "bg-primary-100 text-primary-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {lead.operationType}
                  </span>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 w-fit">
                      <span>{lead.listingCode}</span>
                      <a
                        href={`https://www.idealista.com/inmueble/${lead.listingCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 transition-colors p-0.5 rounded-sm hover:bg-gray-200"
                        title="Ver en Idealista"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    {lead.listingDescription && (
                      <span className="text-[10px] text-gray-500 line-clamp-1 italic px-1">
                        {lead.listingDescription}
                      </span>
                    )}
                  </div>
                  {lead.tags?.filter(tag => tag.toLowerCase() !== 'lead').map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-600 border border-primary-100">
                      {tag}
                    </span>
                  ))}
                  {lead.notes && (
                    <div className="w-full mt-1.5 text-[11px] text-gray-600 bg-amber-50/50 p-1.5 rounded border border-amber-100/50 italic break-words" title={lead.notes}>
                      <span className="font-semibold text-amber-700">Nota:</span> {lead.notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <MessageSquare size={12} className="text-primary-500" />
                    <span>{lead.messageCount || 0} mensajes</span>
                  </div>
                  <span>
                    {lead.lastMessageDate ? formatDate(lead.lastMessageDate.toDate()) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-center w-8">
                      <button onClick={toggleAllSelection} className="text-gray-400 hover:text-primary-600 transition-colors">
                        {selectedLeadIds.size === filteredAndSortedLeads.length && filteredAndSortedLeads.length > 0 ? (
                          <CheckSquare size={16} className="text-primary-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Nombre
                        {getSortIcon("name")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("phone")}
                    >
                      <div className="flex items-center gap-1">
                        Teléfono
                        {getSortIcon("phone")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("listingCode")}
                    >
                      <div className="flex items-center gap-1">
                        Anuncio
                        {getSortIcon("listingCode")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre Anuncio
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("operationType")}
                    >
                      <div className="flex items-center gap-1">
                        Tipo
                        {getSortIcon("operationType")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("qualificationStatus")}
                    >
                      <div className="flex items-center gap-1">
                        Estado
                        {getSortIcon("qualificationStatus")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("qualifiedAt")}
                    >
                      <div className="flex items-center gap-1">
                        Fecha Cualif.
                        {getSortIcon("qualifiedAt")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("lastMessageDate")}
                    >
                      <div className="flex items-center gap-1">
                        Último Msj
                        {getSortIcon("lastMessageDate")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("messageCount")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Msjs
                        {getSortIcon("messageCount")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notas
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chat
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAndSortedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={cn(
                        "hover:bg-gray-50 transition-colors",
                        selectedLeadIds.has(lead.id) && "bg-primary-50/50"
                      )}
                    >
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => toggleLeadSelection(lead.id)} className="text-gray-400 hover:text-primary-600 transition-colors">
                          {selectedLeadIds.has(lead.id) ? (
                            <CheckSquare size={16} className="text-primary-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 truncate max-w-[120px]" title={lead.name || "—"}>
                            {lead.name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-900 text-xs">
                            {formatPhone(lead.phone)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-900 font-medium">{lead.listingCode}</span>
                          <a
                            href={`https://www.idealista.com/inmueble/${lead.listingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 transition-colors p-1 rounded-md hover:bg-primary-50"
                            title="Ver en Idealista"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        {lead.listingDescription ? (
                          <span className="text-xs text-gray-900 truncate max-w-[150px] inline-block align-bottom" title={lead.listingDescription}>
                            {lead.listingDescription}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        <span
                          className={cn(
                            "px-2 py-0.5 text-xs font-medium rounded-full",
                            lead.operationType === "Venta"
                              ? "bg-primary-100 text-primary-700"
                              : "bg-green-100 text-green-700"
                          )}
                        >
                          {lead.operationType}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        {getStatusBadge(lead)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => openEditModal(lead)}>
                        {lead.qualifiedAt ? formatDate(lead.qualifiedAt) : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => openEditModal(lead)}>
                        {lead.lastMessageDate ? formatDate(lead.lastMessageDate.toDate()) : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center cursor-pointer" onClick={() => openEditModal(lead)}>
                        <span className={cn(
                          "font-medium",
                          lead.messageCount && lead.messageCount > 0 ? "text-gray-900" : "text-gray-400"
                        )}>
                          {lead.messageCount || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        {lead.notes ? (
                          <span className="text-xs text-gray-600 truncate max-w-[150px] inline-block align-bottom" title={lead.notes}>
                            {lead.notes}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center cursor-pointer" onClick={() => openConversation(lead)}>
                        <MessageSquare size={16} className="text-primary-600 mx-auto" />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {lead.tags?.filter(tag => tag.toLowerCase() !== 'lead').map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-50 text-primary-600 border border-primary-100">
                              {tag}
                            </span>
                          ))}
                          {(!lead.tags || lead.tags.filter(tag => tag.toLowerCase() !== 'lead').length === 0) && <span className="text-gray-400 text-[10px]">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => handleDeleteLead(e, lead)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors inline-flex items-center justify-center"
                          title="Eliminar lead"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de conversación */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white sm:rounded-lg shadow-xl max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header del modal */}
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="sm:hidden text-gray-600 hover:text-gray-900 p-1"
                >
                  <X size={20} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 truncate text-sm sm:text-lg">
                    {selectedConversation.name || formatPhone(selectedConversation.phone)}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span className="truncate">{selectedConversation.listingCode}</span>
                    <span>•</span>
                    <span className="whitespace-nowrap">{selectedConversation.messageCount || 0} msjs</span>
                  </div>
                </div>
                <button
                  onClick={() => downloadConversation(selectedConversation)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm ml-2"
                  title="Descargar conversación"
                >
                  <Download size={14} />
                  <span className="hidden xs:inline">Descargar</span>
                </button>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="hidden sm:block text-gray-400 hover:text-gray-600 transition-colors ml-2"
                >
                  <X size={24} />
                </button>
              </div>
              {/* Badges on separate line */}
              <div className="flex items-center gap-2 mt-2">
                {selectedConversation.isFinished && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                    Finalizada
                  </span>
                )}
                {selectedConversation.qualified !== null && (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      selectedConversation.qualified
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    )}
                  >
                    {selectedConversation.qualified ? "Cualificado" : "No interesado"}
                  </span>
                )}
              </div>
            </div>

            {/* Mensajes */}
            <div
              className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
              <div className="space-y-3 sm:max-w-4xl sm:mx-auto">
                {selectedConversation.history && selectedConversation.history.length > 0 ? (
                  selectedConversation.history.map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        "p-3 rounded-lg text-sm",
                        item.role === "assistant"
                          ? "bg-white border border-gray-200 mr-8"
                          : "bg-primary-100 text-primary-800 ml-8"
                      )}
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      <span className={cn(
                        "text-xs font-medium mb-1 block",
                        item.role === "assistant" ? "text-gray-400" : "text-primary-600"
                      )}>
                        {item.role === "assistant" ? "Bot" : "Interesado"}
                      </span>
                      <p 
                        className="whitespace-pre-wrap break-words" 
                        style={{ wordBreak: 'break-word' }}
                        dangerouslySetInnerHTML={{ 
                          __html: item.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<strong>$1</strong>') 
                        }}
                      />
                      {item.timestamp && (
                        <p className="text-[10px] mt-1 text-right text-gray-400">
                          {formatMessageTime(item.timestamp)}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No hay mensajes en esta conversación</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lead Details (Notes/Tags) */}
            <div className="border-t border-gray-200">
              <LeadDetails
                lead={selectedLead || undefined}
                conversation={selectedConversation || undefined}
                onUpdate={() => {
                  loadLeads();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {loadingConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-700 mt-4">Cargando conversación...</p>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      {leadToEdit && (
        <LeadEditModal
          lead={leadToEdit}
          onClose={() => setLeadToEdit(null)}
          onUpdate={loadLeads}
          onViewConversation={openConversation}
        />
      )}

      {/* Modal de Mensaje Masivo */}
      {isMassMessageModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                  <Send size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Enviar mensaje masivo</h3>
                  <p className="text-xs text-gray-500 font-medium">
                    Se enviará a {selectedLeadIds.size} leads seleccionados
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMassMessageModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mensaje de WhatsApp
              </label>
              <div className="relative group">
                <textarea
                  value={massMessageText}
                  onChange={(e) => setMassMessageText(e.target.value)}
                  placeholder="Escribe el mensaje que recibirán todos los leads..."
                  className="w-full h-40 px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all resize-none group-hover:border-gray-300"
                />
                <div className="absolute bottom-3 right-3 text-[10px] font-bold text-gray-400 bg-white/80 px-2 py-1 rounded-md">
                  {massMessageText.length} caracteres
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="text-amber-600 mt-0.5 font-bold">⚠️</div>
                <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                  Este mensaje se enviará de forma individual a cada lead. Asegúrate de que el contenido sea apropiado para todos los destinatarios seleccionados.
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => setIsMassMessageModalOpen(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendMassMessage}
                disabled={sendingMassMessage || !massMessageText.trim()}
                className="flex-[2] px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {sendingMassMessage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Enviar a {selectedLeadIds.size} leads</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
