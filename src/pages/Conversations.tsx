import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { MessageSquare, Search, ArrowLeft, Trash2, Send, Bot, BotOff, Download, ChevronDown, ChevronUp, CheckCircle, Megaphone, Activity, Calendar, CheckSquare, Square } from "lucide-react";
import type { Conversation } from "../types";
import {
  getConversations,
  deleteConversation,
  updateConversation,
  sendMessageToWhatsApp,
  triggerAssistantResponse,
  getConversationById
} from "../services/conversations";
import { formatDate, formatPhoneWhatsApp, formatMessageTime, cn } from "../lib/utils";
import { metricTheme, customLeadTagSm, conversationHeaderPills } from "../lib/metricTheme";
import { resolveConversationQualification } from "../lib/conversationQualification";
import { downloadConversation } from "../lib/export";
import { LeadDetails } from "../components/LeadDetails";
import { getListings } from "../services/listings";
import type { Listing } from "../types";
import { Button, InboxShell, PageLoading } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export function Conversations() {
  const { organizationId } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "finished">("all");
  const [filterListing, setFilterListing] = useState("all");
  const [filterQualified, setFilterQualified] = useState<"all" | "qualified" | "not_qualified">("all");
  const [filterListingStatus, setFilterListingStatus] = useState<"all" | "active" | "inactive">("all");
  const [filterAssistantStatus, setFilterAssistantStatus] = useState<"all" | "active" | "disabled">("all");
  const [filterDate, setFilterDate] = useState("all");
  const [filterType, setFilterType] = useState<"leads" | "unidentified">("leads");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showDetailsMobile, setShowDetailsMobile] = useState(false);

  // Dropdown open states
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isListingDropdownOpen, setIsListingDropdownOpen] = useState(false);
  const [isQualifiedDropdownOpen, setIsQualifiedDropdownOpen] = useState(false);
  const [isListingStatusDropdownOpen, setIsListingStatusDropdownOpen] = useState(false);
  const [isAssistantStatusDropdownOpen, setIsAssistantStatusDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [organizationId]);

  async function loadConversations() {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [data, listingsData] = await Promise.all([
        getConversations(),
        getListings(),
      ]);
      setConversations(data);
      setListings(listingsData);
      
      setSelectedConversation(prev => {
        if (prev) {
          // Keep the currently selected conversation updated with new data
          const updated = data.find(c => c.id === prev.id);
          return updated || prev;
        }
        // Auto-select the first (latest) conversation if none is selected,
        // and only on desktop (to avoid hiding the conversation list on mobile)
        if (!prev && data.length > 0 && window.innerWidth >= 768) {
          return data[0];
        }
        return prev;
      });
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConversation(e: React.MouseEvent, conversation: Conversation) {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la conversación de ${conversation.name || formatPhoneWhatsApp(conversation.phone)}?`)) {
      return;
    }
    try {
      await deleteConversation(conversation.id);
      setConversations(conversations.filter(c => c.id !== conversation.id));
      if (selectedConversation?.id === conversation.id) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Error al eliminar la conversación");
    }
  }

  async function handleToggleAssistant() {
    if (!selectedConversation) return;
    const newValue = !selectedConversation.botDisabled;
    try {
      await updateConversation(selectedConversation.id, { botDisabled: newValue });

      const updatedConv = { ...selectedConversation, botDisabled: newValue };
      setSelectedConversation(updatedConv);
      setConversations(conversations.map(c => c.id === updatedConv.id ? updatedConv : c));

      if (!newValue) {
        // If re-enabling, trigger assistant response if last message was from user
        const lastMsg = updatedConv.history?.[updatedConv.history.length - 1];
        if (lastMsg?.role === "user") {
          try {
            await triggerAssistantResponse(updatedConv.id);
            // Wait a bit for the assistant to respond then reload
            setTimeout(() => loadConversations().then(() => {
              getConversationById(updatedConv.id).then(c => {
                if (c) setSelectedConversation(c);
              });
            }), 2000);
          } catch (err) {
            console.error("Error triggering assistant:", err);
          }
        }
      }
    } catch (error) {
      console.error("Error toggling assistant:", error);
      toast.error("Error al cambiar el estado del asistente");
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConversation || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessageToWhatsApp(selectedConversation.id, newMessage);
      setNewMessage("");

      // Update local state temporarily for immediate feedback
      const tempMsg = {
        role: "assistant" as const,
        text: newMessage,
        timestamp: Date.now()
      };

      const updatedConv = {
        ...selectedConversation,
        history: [...(selectedConversation.history || []), tempMsg],
        messageCount: (selectedConversation.messageCount || 0) + 1
      };

      setSelectedConversation(updatedConv);
      setConversations(conversations.map(c => c.id === updatedConv.id ? updatedConv : c));

      // Then reload properly
      setTimeout(() => loadConversations(), 1000);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  function handleDownloadConversation() {
    if (!selectedConversation) return;
    downloadConversation(selectedConversation);
  }

  const listingMap = useMemo(() => {
    const map = new Map<string, Listing>();
    listings.forEach(l => {
      if (l.listingCode) map.set(l.listingCode, l);
    });
    return map;
  }, [listings]);

  const uniqueListingCodes = useMemo(() => {
    return Array.from(new Set(listings.map(l => l.listingCode).filter(Boolean))).sort();
  }, [listings]);

  const getConversationListingIdentifier = (conv: Conversation) => {
    const listing = conv.listingCode ? listingMap.get(conv.listingCode) : undefined;
    return listing?.description || conv.listingCode || "—";
  };

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const startOfDay = (date: Date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    const endOfDay = (date: Date) => {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
    };
    const now = new Date();
    let range: { start: Date; end: Date } | null = null;

    if (filterDate === "today") range = { start: startOfDay(now), end: endOfDay(now) };
    else if (filterDate === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      range = { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    } else if (filterDate === "last_7") {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      range = { start: startOfDay(past), end: endOfDay(now) };
    } else if (filterDate === "last_30") {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      range = { start: startOfDay(past), end: endOfDay(now) };
    }

    const isWithinRange = (ts: unknown) => {
      if (!range) return true;
      if (!ts) return false;
      const maybeTs = ts as { toDate?: () => Date };
      const date = maybeTs?.toDate ? maybeTs.toDate() : new Date(ts as string | number | Date);
      return date >= range.start && date <= range.end;
    };

    return conversations.filter((conv) => {
      const matchesSearch =
        !normalizedSearch ||
        (conv.phone || "").includes(normalizedSearch) ||
        (conv.name || "").toLowerCase().includes(normalizedSearch) ||
        (conv.listingCode || "").toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && !conv.isFinished) ||
        (filterStatus === "finished" && conv.isFinished);

      const matchesListing = filterListing === "all" || conv.listingCode === filterListing;

      const q = resolveConversationQualification(conv);
      const matchesQualified =
        filterQualified === "all" ||
        (filterQualified === "qualified" && q === "qualified") ||
        (filterQualified === "not_qualified" && q !== "qualified");

      const listing = conv.listingCode ? listingMap.get(conv.listingCode) : null;
      const matchesListingStatus =
        filterListingStatus === "all" ||
        (filterListingStatus === "active" && listing?.isActive !== false) ||
        (filterListingStatus === "inactive" && listing?.isActive === false);

      const matchesAssistantStatus =
        filterAssistantStatus === "all" ||
        (filterAssistantStatus === "active" && !conv.botDisabled) ||
        (filterAssistantStatus === "disabled" && conv.botDisabled);

      const matchesDate = isWithinRange(conv.lastMessage);

      const isUnidentified = conv.tags?.includes("non-lead");
      const matchesType = filterType === "leads" ? !isUnidentified : isUnidentified;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesListing &&
        matchesType &&
        matchesQualified &&
        matchesListingStatus &&
        matchesAssistantStatus &&
        matchesDate
      );
    });
  }, [
    conversations,
    search,
    filterStatus,
    filterListing,
    filterQualified,
    filterListingStatus,
    filterAssistantStatus,
    filterDate,
    filterType,
    listingMap,
  ]);

  if (loading) {
    return <PageLoading className="h-64" />;
  }

  return (
    <InboxShell>
      {/* Panel izquierdo - Lista de conversaciones */}
      <div className={cn(
        "flex flex-col border-r border-gray-200 bg-white transition-all",
        selectedConversation ? "hidden md:flex md:w-[450px]" : "w-full md:w-[450px]"
      )}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 font-heading">Conversaciones</h1>
            <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-full font-heading">
              {filteredConversations.length}
            </span>
          </div>

          {/* Selector de tipo de conversación (Leads / No identificados) */}
          <div className="flex bg-gray-100 p-1 rounded-lg w-full">
            <button
              onClick={() => {
                setFilterType("leads");
                setSelectedConversation(null); // Clear selection when switching modes to avoid context confusion
              }}
              className={cn(
                "flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all font-heading uppercase tracking-wider",
                filterType === "leads" 
                  ? "bg-white text-primary-700 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Leads
            </button>
            <button
              onClick={() => {
                setFilterType("unidentified");
                setSelectedConversation(null);
              }}
              className={cn(
                "flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all font-heading uppercase tracking-wider",
                filterType === "unidentified" 
                  ? "bg-white text-primary-700 shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              No identificados
            </button>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por teléfono o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow bg-white"
            />
          </div>

          {/* Filtros Avanzados */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <div 
                className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-btn border shadow-sm cursor-pointer select-none" 
                onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              >
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <div className="text-[10px] text-gray-700 font-medium flex-1 flex items-center justify-between truncate">
                  <span className="truncate font-heading font-black uppercase tracking-widest text-[10px] text-gray-400">
                    Fecha:
                  </span>
                  <span className="truncate font-heading font-bold text-gray-700 ml-1">
                    {filterDate === "today" ? "Hoy" : 
                     filterDate === "yesterday" ? "Ayer" : 
                     filterDate === "last_7" ? "7 días" : 
                     filterDate === "last_30" ? "30 días" : "Todos"}
                  </span>
                  <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isDateDropdownOpen && "rotate-180")} />
                </div>
              </div>
              {isDateDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDateDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { value: "all", label: "Todo" },
                      { value: "today", label: "Hoy" },
                      { value: "yesterday", label: "Ayer" },
                      { value: "last_7", label: "7 días" },
                      { value: "last_30", label: "30 días" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterDate(option.value);
                          setIsDateDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left"
                      >
                        {filterDate === option.value ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                        <span className="text-[10px] text-gray-700 font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative min-w-0">
              <div 
                className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-btn border shadow-sm cursor-pointer select-none" 
                onClick={() => setIsListingDropdownOpen(!isListingDropdownOpen)}
              >
                <Megaphone size={14} className="text-gray-400 shrink-0" />
                <div className="text-[10px] text-gray-700 font-medium flex-1 flex items-center justify-between truncate">
                  <span className="truncate font-heading font-black uppercase tracking-widest text-[10px] text-gray-400">Anuncio:</span>
                  <span className="truncate font-heading font-bold text-gray-700 ml-1">{filterListing === "all" ? "Todos" : filterListing}</span>
                  <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isListingDropdownOpen && "rotate-180")} />
                </div>
              </div>
              {isListingDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsListingDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-40 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-in fade-in zoom-in-95 duration-100 max-h-[200px] overflow-y-auto">
                    <button
                      onClick={() => {
                        setFilterListing("all");
                        setIsListingDropdownOpen(false);
                      }}
                      className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left font-bold"
                    >
                      {filterListing === "all" ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                      <span className="text-[10px] text-gray-700">Todos</span>
                    </button>
                    <div className="h-px bg-gray-50 my-1" />
                    {uniqueListingCodes.map(code => (
                      <button
                        key={code}
                        onClick={() => {
                          setFilterListing(code);
                          setIsListingDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left"
                      >
                        {filterListing === code ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                        <span className="text-[10px] text-gray-700 truncate">{code}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative min-w-0">
              <div 
                className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-btn border shadow-sm cursor-pointer select-none" 
                onClick={() => setIsQualifiedDropdownOpen(!isQualifiedDropdownOpen)}
              >
                <CheckCircle size={14} className="text-gray-400 shrink-0" />
                <div className="text-[10px] text-gray-700 font-medium flex-1 flex items-center justify-between truncate">
                  <span className="truncate font-heading font-black uppercase tracking-widest text-[10px] text-gray-400">Cualif:</span>
                  <span className="truncate font-heading font-bold text-gray-700 ml-1">
                    {filterQualified === "all" ? "Todos" : 
                     filterQualified === "qualified" ? "Sí" : "No"}
                  </span>
                  <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isQualifiedDropdownOpen && "rotate-180")} />
                </div>
              </div>
              {isQualifiedDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsQualifiedDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { value: "all", label: "Todo" },
                      { value: "qualified", label: "Cualificados" },
                      { value: "not_qualified", label: "No cualificados" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterQualified(option.value as any);
                          setIsQualifiedDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left"
                      >
                        {filterQualified === option.value ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                        <span className="text-[10px] text-gray-700 font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative min-w-0">
              <div 
                className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-btn border shadow-sm cursor-pointer select-none" 
                onClick={() => setIsListingStatusDropdownOpen(!isListingStatusDropdownOpen)}
              >
                <Activity size={14} className="text-gray-400 shrink-0" />
                <div className="text-[10px] text-gray-700 font-medium flex-1 flex items-center justify-between truncate">
                  <span className="truncate font-heading font-black uppercase tracking-widest text-[10px] text-gray-400">Anuncio:</span>
                  <span className="truncate font-heading font-bold text-gray-700 ml-1">
                    {filterListingStatus === "all" ? "Todos" : 
                     filterListingStatus === "active" ? "Activo" : "Inactivo"}
                  </span>
                  <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isListingStatusDropdownOpen && "rotate-180")} />
                </div>
              </div>
              {isListingStatusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsListingStatusDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { value: "all", label: "Todo" },
                      { value: "active", label: "Activos" },
                      { value: "inactive", label: "Inactivos" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterListingStatus(option.value as any);
                          setIsListingStatusDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left"
                      >
                        {filterListingStatus === option.value ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                        <span className="text-[10px] text-gray-700 font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative min-w-0">
              <div 
                className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-btn border shadow-sm cursor-pointer select-none" 
                onClick={() => setIsAssistantStatusDropdownOpen(!isAssistantStatusDropdownOpen)}
              >
                <Bot size={14} className="text-gray-400 shrink-0" />
                <div className="text-[10px] text-gray-700 font-medium flex-1 flex items-center justify-between truncate">
                  <span className="truncate font-heading font-black uppercase tracking-widest text-[10px] text-gray-400">Bot:</span>
                  <span className="truncate font-heading font-bold text-gray-700 ml-1">
                    {filterAssistantStatus === "all" ? "Todos" : 
                     filterAssistantStatus === "active" ? "Activo" : "Off"}
                  </span>
                  <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isAssistantStatusDropdownOpen && "rotate-180")} />
                </div>
              </div>
              {isAssistantStatusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAssistantStatusDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { value: "all", label: "Todo" },
                      { value: "active", label: "Activo" },
                      { value: "disabled", label: "Desactivado" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterAssistantStatus(option.value as any);
                          setIsAssistantStatusDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left"
                      >
                        {filterAssistantStatus === option.value ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                        <span className="text-[10px] text-gray-700 font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative min-w-0">
              <div 
                className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-btn border shadow-sm cursor-pointer select-none" 
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              >
                <MessageSquare size={14} className="text-gray-400 shrink-0" />
                <div className="text-[10px] text-gray-700 font-medium flex-1 flex items-center justify-between truncate">
                  <span className="truncate font-heading font-black uppercase tracking-widest text-[10px] text-gray-400">Estado:</span>
                  <span className="truncate font-heading font-bold text-gray-700 ml-1">
                    {filterStatus === "all" ? "Todos" : 
                     filterStatus === "active" ? "Activas" : "Fin"}
                  </span>
                  <ChevronDown size={12} className={cn("text-gray-400 transition-transform", isStatusDropdownOpen && "rotate-180")} />
                </div>
              </div>
              {isStatusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsStatusDropdownOpen(false)} />
                  <div className="absolute left-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1 animate-in fade-in zoom-in-95 duration-100">
                    {[
                      { value: "all", label: "Todo" },
                      { value: "active", label: "Activas" },
                      { value: "finished", label: "Finalizadas" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterStatus(option.value as any);
                          setIsStatusDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 w-full px-1.5 py-1 hover:bg-gray-50 rounded transition-colors text-left"
                      >
                        {filterStatus === option.value ? <CheckSquare size={12} className="text-primary-600" /> : <Square size={12} className="text-gray-300" />}
                        <span className="text-[10px] text-gray-700 font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageSquare className="text-gray-300 mb-3" size={48} />
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                {conversations.length === 0 ? "No hay conversaciones" : "No se encontraron resultados"}
              </h3>
              <p className="text-xs text-gray-500">
                {conversations.length === 0
                  ? "Las conversaciones aparecerán aquí"
                  : "Intenta con otros términos"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "px-3 py-2.5 border-b border-gray-100 hover:bg-gray-50 transition-colors",
                  selectedConversation?.id === conv.id && "bg-gray-100"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className="font-bold text-gray-900 text-sm truncate font-heading">
                          {conv.name || (conv.phone ? formatPhoneWhatsApp(conv.phone) : conv.id)}
                        </h3>
                        {(() => {
                          const q = resolveConversationQualification(conv);
                          if (q === "pending") return null;
                          return (
                            <span
                              className={cn(
                                "px-1 py-0.5 text-[10px] font-medium rounded",
                                q === "qualified" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                              )}
                            >
                              {q === "qualified" ? "✓" : "✗"}
                            </span>
                          );
                        })()}
                      </div>
                      {conv.phone && conv.name && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatPhoneWhatsApp(conv.phone)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="truncate max-w-[210px]">
                        {getConversationListingIdentifier(conv)}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className={cn("whitespace-nowrap inline-flex items-center gap-1", conv.messageCount ? metricTheme.messages.listValue : metricTheme.messages.listMuted)}>
                        <MessageSquare size={11} className={cn(conv.messageCount ? metricTheme.messages.listIcon : metricTheme.messages.listMuted)} />
                        {conv.messageCount || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {conv.lastMessage ? formatDate(conv.lastMessage.toDate()) : "—"}
                      </span>
                      {conv.isFinished && (
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">Finalizada</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded-btn transition-colors"
                      title="Eliminar conversación"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-1 overflow-hidden" onClick={() => setSelectedConversation(conv)}>
                  {(() => {
                    const tags = (conv.tags || []).filter((t) => t.toLowerCase() !== "lead");
                    return (
                      <>
                        {tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className={cn(
                              tag === "non-lead" ? "px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-600 border-slate-100" :
                                customLeadTagSm
                            )}
                          >
                            {tag}
                          </span>
                        ))}
                        {tags.length > 3 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded border bg-gray-50 text-gray-600 border-gray-200">
                            +{tags.length - 3}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                {conv.botDisabled && (
                  <div
                    className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer mt-1"
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <span className="flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">
                      <BotOff size={10} /> Asistente Off
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel derecho - Detalle de conversación */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header del chat */}
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden text-gray-600 hover:text-gray-900 p-1.5 rounded-btn hover:bg-gray-100"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                  {selectedConversation.name || (selectedConversation.phone ? formatPhoneWhatsApp(selectedConversation.phone) : selectedConversation.id)}
                </h2>
                {selectedConversation.phone && selectedConversation.name && (
                  <p className="text-xs text-gray-500 truncate">
                    {formatPhoneWhatsApp(selectedConversation.phone)}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{selectedConversation.listingCode}</span>
                  <span>•</span>
                  <span className={cn("whitespace-nowrap", selectedConversation.messageCount ? metricTheme.messages.listValue : metricTheme.messages.listMuted)}>
                    {selectedConversation.messageCount || 0} mensajes
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAssistant}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium transition-colors border",
                    selectedConversation.botDisabled
                      ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  )}
                  title={selectedConversation.botDisabled ? "Activar Asistente" : "Desactivar Asistente"}
                >
                  {selectedConversation.botDisabled ? (
                    <>
                      <BotOff size={14} />
                      Asistente Desactivado
                    </>
                  ) : (
                    <>
                      <Bot size={14} />
                      Asistente Activo
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadConversation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm"
                  title="Descargar conversación"
                >
                  <Download size={14} />
                  Descargar
                </button>
              </div>
            </div>
            {/* Badges - on separate line on mobile */}
            <div className="flex items-center gap-2 mt-2 ml-0 md:ml-0">
              {selectedConversation.isFinished && (
                <span className={conversationHeaderPills.finalized}>
                  Finalizada
                </span>
              )}
              {(() => {
                const q = resolveConversationQualification(selectedConversation);
                if (q === "pending") return null;
                return (
                  <span
                    className={cn(
                      q === "qualified" ? conversationHeaderPills.qualified : conversationHeaderPills.notInterested
                    )}
                  >
                    {q === "qualified" ? "Cualificado" : "No interesado"}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}>
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

          {/* Input de mensaje manual (solo cuando el asistente está desactivado) */}
          {
            selectedConversation.botDisabled && !selectedConversation.isFinished && (
              <div className="p-3 bg-white border-t border-gray-200">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje manual..."
                    className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-btn focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    loading={sending}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send size={18} />
                  </Button>
                </form>
                <p className="text-[10px] text-gray-400 mt-2 text-center italic">
                  El asistente está desactivado. Tus mensajes se enviarán directamente al cliente.
                </p>
              </div>
            )
          }

          {/* Lead Details (Notes/Tags) */}
          <div className="border-t border-gray-200 bg-white">
            <button 
              onClick={() => setShowDetailsMobile(!showDetailsMobile)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 md:hidden hover:bg-gray-50 transition-colors rounded-btn"
            >
              <span>Detalles del Lead (Notas/Tags)</span>
              {showDetailsMobile ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <div className={cn("md:block", showDetailsMobile ? "block" : "hidden")}>
              <LeadDetails
                conversation={selectedConversation || undefined}
                onUpdate={() => {
                  loadConversations();
                }}
              />
            </div>
          </div>
        </div >
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageSquare className="mx-auto text-gray-300 mb-4" size={64} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Selecciona una conversación
            </h3>
            <p className="text-sm text-gray-500">
              Elige una conversación de la lista para ver los mensajes
            </p>
          </div>
        </div>
      )
      }
    </InboxShell>
  );
}
