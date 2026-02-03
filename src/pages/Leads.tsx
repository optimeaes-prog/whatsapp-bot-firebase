import { useEffect, useState } from "react";
import { Users, Phone, Search, User, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, X, Trash2 } from "lucide-react";
import type { Lead, QualificationStatus, Conversation } from "../types";
import { getLeads, deleteLead } from "../services/leads";
import { getConversationByChatId } from "../services/conversations";
import { formatDate, formatPhone, cn } from "../lib/utils";
import { LeadDetails } from "../components/LeadDetails";

type SortField = "name" | "phone" | "listingCode" | "operationType" | "qualificationStatus" | "firstMessageDate" | "lastMessageDate" | "messageCount";
type SortDirection = "asc" | "desc";

type LeadWithMessages = Lead & { messageCount?: number };

export function Leads() {
  const [leads, setLeads] = useState<LeadWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "Venta" | "Alquiler">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | QualificationStatus>("all");
  const [sortField, setSortField] = useState<SortField>("lastMessageDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    try {
      const data = await getLeads();
      // Load message count for each lead
      const leadsWithMessages = await Promise.all(
        data.map(async (lead) => {
          try {
            const conversation = await getConversationByChatId(lead.chatId);
            return {
              ...lead,
              messageCount: conversation?.messageCount || 0
            };
          } catch {
            return { ...lead, messageCount: 0 };
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
    } catch (error) {
      console.error("Error loading conversation:", error);
      alert("Error al cargar la conversación");
    } finally {
      setLoadingConversation(false);
    }
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
    } catch (error) {
      console.error("Error deleting lead:", error);
      alert("Error al eliminar el lead y su conversación");
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
        (lead.name || "").toLowerCase().includes(search.toLowerCase());
      const matchesTipo = filterTipo === "all" || lead.operationType === filterTipo;
      const matchesStatus = filterStatus === "all" || lead.qualificationStatus === filterStatus;
      return matchesSearch && matchesTipo && matchesStatus;
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
        case "firstMessageDate":
          aValue = a.firstMessageDate?.toMillis() || 0;
          bValue = b.firstMessageDate?.toMillis() || 0;
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

  function getStatusBadge(status?: QualificationStatus) {
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
          {(search || filterTipo !== "all" || filterStatus !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterTipo("all");
                setFilterStatus("all");
              }}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

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
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white w-full sm:w-auto sm:min-w-[140px]"
          >
            <option value="all">Todos los tipos</option>
            <option value="Venta">Venta</option>
            <option value="Alquiler">Alquiler</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white w-full sm:w-auto sm:min-w-[160px]"
          >
            <option value="all">Todos los estados</option>
            <option value="not_qualified">No cualificado</option>
            <option value="qualified">Cualificado</option>
            <option value="rejected">Rechazado</option>
          </select>
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
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredAndSortedLeads.map((lead) => (
              <div
                key={lead.id}
                className="card p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openConversation(lead)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User size={18} className="text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
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
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0"
                    title="Eliminar lead"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {getStatusBadge(lead.qualificationStatus)}
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
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                    {lead.listingCode}
                  </span>
                  {lead.tags?.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-600 border border-primary-100">
                      {tag}
                    </span>
                  ))}
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
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("operationType")}
                    >
                      <div className="flex items-center gap-1">
                        Tipo
                        {getSortIcon("operationType")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
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
                      onClick={() => handleSort("firstMessageDate")}
                    >
                      <div className="flex items-center gap-1">
                        1er Msj
                        {getSortIcon("firstMessageDate")}
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
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chat
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
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openConversation(lead)}>
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 truncate max-w-[120px]" title={lead.name || "—"}>
                            {lead.name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openConversation(lead)}>
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-900 text-xs">
                            {formatPhone(lead.phone)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openConversation(lead)}>
                        <span className="text-gray-900">{lead.listingCode}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openConversation(lead)}>
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
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openConversation(lead)}>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {lead.tags?.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-50 text-primary-600 border border-primary-100">
                              {tag}
                            </span>
                          ))}
                          {!lead.tags?.length && <span className="text-gray-400 text-[10px]">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openConversation(lead)}>
                        {getStatusBadge(lead.qualificationStatus)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => openConversation(lead)}>
                        {lead.firstMessageDate ? formatDate(lead.firstMessageDate.toDate()) : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => openConversation(lead)}>
                        {lead.lastMessageDate ? formatDate(lead.lastMessageDate.toDate()) : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center cursor-pointer" onClick={() => openConversation(lead)}>
                        <span className={cn(
                          "font-medium",
                          lead.messageCount && lead.messageCount > 0 ? "text-gray-900" : "text-gray-400"
                        )}>
                          {lead.messageCount || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center cursor-pointer" onClick={() => openConversation(lead)}>
                        <MessageSquare size={16} className="text-primary-600 mx-auto" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white sm:rounded-lg shadow-xl max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col">
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
                  onClick={() => setSelectedConversation(null)}
                  className="hidden sm:block text-gray-400 hover:text-gray-600 transition-colors"
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
              <div className="space-y-2 sm:space-y-3 sm:max-w-4xl sm:mx-auto">
                {selectedConversation.history && selectedConversation.history.length > 0 ? (
                  selectedConversation.history.map((item, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex",
                        item.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] sm:max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                          item.role === "user"
                            ? "bg-green-500 text-white rounded-br-sm"
                            : "bg-white text-gray-900 rounded-bl-sm"
                        )}
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>{item.text}</p>
                      </div>
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

      {/* Loading overlay */}
      {loadingConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-700 mt-4">Cargando conversación...</p>
          </div>
        </div>
      )}
    </div>
  );
}
