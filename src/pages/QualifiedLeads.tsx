import { useEffect, useState, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CheckCircle, User, Phone, FileText, Clock, Search, ArrowUpDown, ExternalLink, MessageSquare, Trash2, Send, CheckSquare, Square, XCircle, Users, ArrowUp, ArrowDown, X, Download, Calendar, ChevronDown } from "lucide-react";
import type { QualifiedLead, Conversation } from "../types";
import { getQualifiedLeads, deleteQualifiedLead } from "../services/qualifiedLeads";
import { getListings } from "../services/listings";
import { getConversationByChatId, sendMassMessageToWhatsApp } from "../services/conversations";
import { formatDate, formatPhone, cn, formatMessageTime } from "../lib/utils";
import { downloadConversation } from "../lib/export";
import { PageHeader, PageLoading } from "../components/ui";
import { OperationTypeBadge } from "../components/StatusBadges";

type SortField = "name" | "phone" | "listingCode" | "listingDescription" | "createdAt" | "messageCount";
type SortDirection = "asc" | "desc";

type QualifiedLeadWithListing = QualifiedLead & {
  listingDescription?: string;
  messageCount?: number;
  operationType?: string;
  tags?: string[];
  notes?: string;
};

export function QualifiedLeads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const adFromUrl = searchParams.get("ad");

  const [qualifiedLeads, setQualifiedLeads] = useState<QualifiedLeadWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "Venta" | "Alquiler">("all");
  const [filterAnuncio, setFilterAnuncio] = useState<string[]>(adFromUrl ? [adFromUrl] : []);
  const [isTipoDropdownOpen, setIsTipoDropdownOpen] = useState(false);
  const [isAnuncioDropdownOpen, setIsAnuncioDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [isMassMessageModalOpen, setIsMassMessageModalOpen] = useState(false);
  const [massMessageText, setMassMessageText] = useState("");
  const [sendingMassMessage, setSendingMassMessage] = useState(false);

  useEffect(() => {
    if (adFromUrl) {
      setFilterAnuncio([adFromUrl]);
    }
  }, [adFromUrl]);

  useEffect(() => {
    loadQualifiedLeads();
  }, []);

  async function loadQualifiedLeads() {
    try {
      const [data, listingsData] = await Promise.all([
        getQualifiedLeads(),
        getListings()
      ]);

      const listingsMap = new Map(
        listingsData.map(l => [l.listingCode, { description: l.description, operationType: l.operationType }])
      );

      const leadsWithListingsAndMessages = await Promise.all(
        data.map(async (lead) => {
          let extra = {};
          try {
            const conversation = await getConversationByChatId(lead.chatId);
            if (conversation) {
              extra = {
                messageCount: conversation.messageCount,
                tags: conversation.tags,
                notes: conversation.notes,
              };
            }
          } catch (e) {
            console.error(e);
          }
          
          const listingInfo = listingsMap.get(lead.listingCode);
          
          return {
            ...lead,
            ...extra,
            listingDescription: listingInfo?.description,
            operationType: listingInfo?.operationType || (lead as any).operationType || "Venta"
          };
        })
      );

      setQualifiedLeads(leadsWithListingsAndMessages);
    } catch (error) {
      console.error("Error loading qualified leads:", error);
    } finally {
      setLoading(false);
    }
  }

  async function openConversation(lead: QualifiedLeadWithListing) {
    setLoadingConversation(true);
    try {
      const conversation = await getConversationByChatId(lead.chatId);
      if (!conversation) {
        toast.error("No hay conversación disponible para este lead.");
        return;
      }
      setSelectedConversation(conversation);
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Error al cargar la conversación");
    } finally {
      setLoadingConversation(false);
    }
  }

  async function handleDeleteLead(e: React.MouseEvent, lead: QualifiedLeadWithListing) {
    e.stopPropagation();
    const leadName = lead.name || formatPhone(lead.phone);
    const warningMessage = `⚠️ ADVERTENCIA: Esta acción eliminará permanentemente:\n\n` +
      `• El lead cualificado de ${leadName}\n\n` +
      `Esta acción NO se puede rehacer.\n\n` +
      `¿Estás seguro de que quieres continuar?`;

    if (!window.confirm(warningMessage)) {
      return;
    }

    try {
      await deleteQualifiedLead(lead.id);
      setQualifiedLeads(qualifiedLeads.filter(l => l.id !== lead.id));
      setSelectedLeadIds(prev => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    } catch (error) {
      console.error("Error deleting qualified lead:", error);
      toast.error("Error al eliminar el lead cualificado");
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
      toast.error("Por favor introduce un mensaje");
      return;
    }

    const selectedChatIds = qualifiedLeads
      .filter(l => selectedLeadIds.has(l.id))
      .map(l => l.chatId);

    if (selectedChatIds.length === 0) return;

    setSendingMassMessage(true);
    try {
      const result = await sendMassMessageToWhatsApp(selectedChatIds, massMessageText);
      toast.success(`Mensaje enviado correctamente: ${result.summary.sent} éxitos, ${result.summary.failed} errores.`);
      setIsMassMessageModalOpen(false);
      setMassMessageText("");
      setSelectedLeadIds(new Set());
      loadQualifiedLeads();
    } catch (error) {
      console.error("Error sending mass message:", error);
      toast.error("Error al enviar el mensaje masivo");
    } finally {
      setSendingMassMessage(false);
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
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

  const filteredAndSortedLeads = qualifiedLeads
    .filter((lead) => {
      const matchesSearch =
        (lead.phone || "").includes(search) ||
        (lead.listingCode || "").toLowerCase().includes(search.toLowerCase()) ||
        (lead.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (lead.listingDescription || "").toLowerCase().includes(search.toLowerCase());
      const matchesTipo = filterTipo === "all" || lead.operationType === filterTipo || (lead as any).operationType === filterTipo;
      const matchesAnuncio = filterAnuncio.length === 0 || (lead.listingCode && filterAnuncio.includes(lead.listingCode));
      return matchesSearch && matchesTipo && matchesAnuncio;
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
        case "listingDescription":
          aValue = (a.listingDescription || "").toLowerCase();
          bValue = (b.listingDescription || "").toLowerCase();
          break;
        case "createdAt":
          aValue = a.createdAt?.toMillis() || 0;
          bValue = b.createdAt?.toMillis() || 0;
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

  if (loading) {
    return <PageLoading className="h-64" />;
  }

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Leads Cualificados"
        subtitle={`Mostrando ${filteredAndSortedLeads.length} de ${qualifiedLeads.length} leads cualificados`}
        actions={
          (search || filterTipo !== "all" || filterAnuncio.length > 0 || selectedLeadIds.size > 0) ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilterTipo("all");
                setFilterAnuncio([]);
                setSelectedLeadIds(new Set());
                setSearchParams({});
              }}
              className="text-sm text-gray-600 underline hover:text-gray-900"
            >
              Limpiar filtros
            </button>
          ) : undefined
        }
      />

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
              className="px-5 py-2.5 bg-primary-600 text-white rounded-btn text-sm font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center gap-2"
            >
              <Send size={16} />
              <span>Enviar Mensaje</span>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6 p-4">
        <div className="flex flex-col gap-3">
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
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100 items-center w-full">
            <div className="relative flex-1">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full" onClick={() => setIsAnuncioDropdownOpen(!isAnuncioDropdownOpen)}>
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span className="text-xs font-semibold text-gray-600 shrink-0">Anuncio:</span>
                  <div className="flex items-center gap-1 flex-1 overflow-hidden justify-end">
                    <span className="truncate">
                      {filterAnuncio.length === 0 ? "Todos" : `${filterAnuncio.length} seleccionados`}
                    </span>
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-2", isAnuncioDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isAnuncioDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAnuncioDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-full min-w-[300px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-1 max-h-[280px] overflow-y-auto">
                      <button
                        onClick={() => setFilterAnuncio([])}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterAnuncio.length === 0 ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                        <span className="text-xs text-gray-700 font-medium">Todos</span>
                      </button>
                      {Array.from(
                        qualifiedLeads.reduce((map, lead) => {
                          if (lead.listingCode && !map.has(lead.listingCode)) {
                            map.set(lead.listingCode, lead.listingDescription || lead.listingCode);
                          }
                          return map;
                        }, new Map<string, string>())
                      )
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([code, description]) => (
                          <button
                            key={code}
                            onClick={() => {
                              const newValue = filterAnuncio.includes(code)
                                ? filterAnuncio.filter(v => v !== code)
                                : [...filterAnuncio, code];
                              setFilterAnuncio(newValue);
                            }}
                            className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                          >
                            {filterAnuncio.includes(code) ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                            <span className="text-xs text-gray-700 font-medium whitespace-normal">
                              {description === code ? code : `${code} - ${description}`}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative flex-1">
              <div 
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full" 
                onClick={() => setIsTipoDropdownOpen(!isTipoDropdownOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-gray-600">Tipo:</span>
                  <div className="flex items-center gap-1 justify-end flex-1">
                    {filterTipo === "all" ? "Todos" : filterTipo}
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isTipoDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isTipoDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsTipoDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-1">
                    {[
                      { value: "all", label: "Todos" },
                      { value: "Venta", label: "Venta" },
                      { value: "Alquiler", label: "Alquiler" }
                    ].map(tipo => (
                      <button
                        key={tipo.value}
                        onClick={() => {
                          setFilterTipo(tipo.value as any);
                          setIsTipoDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterTipo === tipo.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                        <span className="text-xs text-gray-700 font-medium">{tipo.label}</span>
                      </button>
                    ))}
                    </div>
                  </div>
                </>
              )}
            </div>


          </div>
        </div>
      </div>

      {filteredAndSortedLeads.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay leads cualificados</h3>
          <p className="text-gray-500">
            Los leads cualificados aparecerán aquí cuando completen el proceso de cualificación
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Select All Button */}
          <div className="md:hidden flex justify-start mb-3">
            <button
              onClick={toggleAllSelection}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-btn border border-primary-100"
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
                <div className="flex items-start justify-between mb-3 mt-4">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <User size={18} className="text-primary-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate" onClick={(e) => { e.stopPropagation(); toggleLeadSelection(lead.id); }}>
                        {lead.name || "Sin nombre"}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Phone size={12} />
                        <span>{formatPhone(lead.phone)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle size={12} /> Cualificado
                  </span>
                  {lead.operationType ? <OperationTypeBadge type={lead.operationType} /> : null}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 border border-gray-200 shadow-sm w-fit">
                      <span className="text-gray-400 font-medium">ID</span>
                      <span>{lead.listingCode}</span>
                      <a
                        href={`https://www.idealista.com/inmueble/${lead.listingCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-primary-600 transition-colors ml-0.5"
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
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <MessageSquare size={12} className="text-primary-500" />
                      <span>{lead.messageCount || 0} mensajes</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>
                      {lead.createdAt ? formatDate(lead.createdAt.toDate()) : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex justify-between items-center z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); openConversation(lead); }}
                    className="text-primary-600 hover:text-primary-800 hover:bg-primary-50 px-3 py-1.5 rounded-btn transition-colors flex items-center gap-1 text-sm font-medium"
                    title="Ver Chat"
                  >
                    <MessageSquare size={16} /> Ver Chat
                  </button>
                  <button
                    onClick={(e) => handleDeleteLead(e, lead)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-btn transition-colors flex-shrink-0"
                    title="Eliminar lead"
                  >
                    <Trash2 size={16} />
                  </button>
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
                        ID Idealista
                        {getSortIcon("listingCode")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("listingDescription")}
                    >
                      <div className="flex items-center gap-1">
                        Identificador Anuncio
                        {getSortIcon("listingDescription")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-gray-400" />
                        Cualificacion
                        {getSortIcon("createdAt")}
                      </div>
                    </th>
                    <th
                      className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("messageCount")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Mensajes
                        {getSortIcon("messageCount")}
                      </div>
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resumen
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
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAndSortedLeads.map((lead) => (
                    <Fragment key={lead.id}>
                    <tr
                      className={cn(
                        "hover:bg-gray-50 transition-colors cursor-pointer",
                        selectedLeadIds.has(lead.id) && "bg-primary-50/50"
                      )}
                      onClick={(e) => {
                         const target = e.target as HTMLElement;
                         if (target.closest('button') || target.closest('a')) return;
                         openConversation(lead);
                      }}
                    >
                      <td className="px-3 py-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); toggleLeadSelection(lead.id); }} className="text-gray-400 hover:text-primary-600 transition-colors">
                          {selectedLeadIds.has(lead.id) ? (
                            <CheckSquare size={16} className="text-primary-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-primary-600 flex-shrink-0" />
                          <span className="font-medium text-gray-900 truncate max-w-[120px]" title={lead.name || "—"}>
                            {lead.name || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Phone size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="text-gray-900 text-xs">
                            {formatPhone(lead.phone)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 border border-gray-200 shadow-sm w-fit">
                          <span className="text-gray-400 font-medium">ID</span>
                          <span>{lead.listingCode}</span>
                          <a
                            href={`https://www.idealista.com/inmueble/${lead.listingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-primary-600 transition-colors ml-0.5"
                            title="Ver en Idealista"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {lead.listingDescription ? (
                          <span className="text-sm text-gray-900 truncate max-w-[200px] block" title={lead.listingDescription}>
                            {lead.listingDescription}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {lead.operationType ? <OperationTypeBadge type={lead.operationType} /> : null}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                          <CheckCircle size={10} /> Cualificado
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                        {lead.createdAt ? formatDate(lead.createdAt.toDate()) : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <span className={cn(
                          "font-medium",
                          lead.messageCount && lead.messageCount > 0 ? "text-gray-900" : "text-gray-400"
                        )}>
                          {lead.messageCount || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                         <div className="max-w-[150px] relative group inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSummaries(prev => {
                                const next = new Set(prev);
                                if (next.has(lead.id)) next.delete(lead.id);
                                else next.add(lead.id);
                                return next;
                              });
                            }}
                            className="text-xs text-gray-500 hover:text-gray-800 underline truncate max-w-full block text-left"
                            title="Ver resumen"
                          >
                            {lead.conversationSummary ? "Ver Resumen" : "—"}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={(e) => { e.stopPropagation(); openConversation(lead); }}>
                        {lead.notes ? (
                          <span className="text-xs text-gray-600 truncate max-w-[150px] inline-block align-bottom" title={lead.notes}>
                            {lead.notes}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <button onClick={(e) => { e.stopPropagation(); openConversation(lead); }} className="text-primary-600 hover:text-primary-800 p-1.5 hover:bg-primary-50 rounded-btn" title="Ver Conversación">
                          <MessageSquare size={16} className="mx-auto" />
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={(e) => { e.stopPropagation(); openConversation(lead); }}>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {lead.tags?.filter(tag => tag.toLowerCase() !== 'lead').map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-50 text-primary-600 border border-primary-100">
                              {tag}
                            </span>
                          ))}
                          {(!lead.tags || lead.tags.filter(tag => tag.toLowerCase() !== 'lead').length === 0) && <span className="text-gray-400 text-[10px]">—</span>}
                        </div>
                      </td>                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => handleDeleteLead(e, lead)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded-btn transition-colors inline-flex items-center justify-center"
                          title="Eliminar lead"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    
                    {/* Render expanded summary row underneath */}
                    {expandedSummaries.has(lead.id) && lead.conversationSummary && (
                      <tr className="bg-gray-50">
                        <td colSpan={14} className="px-4 py-3 border-b border-gray-100">
                           <div className="flex items-start gap-2 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border border-gray-100">
                             <FileText size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                             <pre className="text-xs font-sans whitespace-pre-wrap flex-1">{lead.conversationSummary}</pre>
                           </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-white flex flex-col">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="sm:hidden text-gray-600 hover:text-gray-900 p-1.5 rounded-btn hover:bg-gray-100"
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
                    <span className="whitespace-nowrap">{selectedConversation.messageCount || 0} mensajes</span>
                  </div>
                </div>
                <button
                  onClick={() => downloadConversation(selectedConversation)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm ml-2"
                  title="Descargar conversación"
                >
                  <Download size={14} />
                  <span className="hidden xs:inline">Descargar</span>
                </button>
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="hidden sm:block text-gray-400 hover:text-gray-600 transition-colors ml-2 p-1.5 rounded-btn hover:bg-gray-100"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

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
                        {item.role === "assistant" ? "Asistente" : "Interesado"}
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
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-btn transition-colors"
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
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-btn transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendMassMessage}
                disabled={sendingMassMessage || !massMessageText.trim()}
                className="flex-[2] px-4 py-2.5 bg-primary-600 text-white rounded-btn text-sm font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
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
    </div>
  );
}
