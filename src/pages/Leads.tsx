import { useEffect, useState, Fragment, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Users, Phone, Search, User, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, X, Trash2, Download, Settings, Eye, EyeOff, CheckSquare, Square, XCircle, ExternalLink, ChevronDown, ChevronLeft, ChevronRight, Calendar, FileText, Filter } from "lucide-react";
import type { Lead, Conversation } from "../types";
import { getLeads, deleteLead } from "../services/leads";
import { getListings } from "../services/listings";
import { getConversationByChatId, sendMassMessageToWhatsApp } from "../services/conversations";

import { formatDate, formatPhone, cn, formatMessageTime } from "../lib/utils";
import { downloadConversation } from "../lib/export";
import { LeadDetails } from "../components/LeadDetails";
import { LeadEditModal } from "../components/LeadEditModal";
import { Send } from "lucide-react";
import { PageHeader, PageLoading, FilterCard } from "../components/ui";
import { QualificationBadge, OperationTypeBadge } from "../components/StatusBadges";

type SortField = "name" | "phone" | "listingCode" | "operationType" | "qualificationStatus" | "lastMessageDate" | "messageCount" | "income";
type SortDirection = "asc" | "desc";

type LeadWithMessages = Lead & {
  messageCount?: number;
  listingDescription?: string;
};

export function Leads() {
  const [leads, setLeads] = useState<LeadWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const [searchParams, setSearchParams] = useSearchParams();
  const adFromUrl = searchParams.get("ad");
  const statusFromUrl = searchParams.get("status");
  const [filterTipo, setFilterTipo] = useState<"all" | "Venta" | "Alquiler">("all");
  const [filterStatus, setFilterStatus] = useState<string[]>(statusFromUrl ? [statusFromUrl] : []);
  const [filterAnuncio, setFilterAnuncio] = useState<string[]>(adFromUrl ? [adFromUrl] : []);
  const [filterPets, setFilterPets] = useState<"all" | "yes" | "no">("all");
  const [filterPayment, setFilterPayment] = useState<"all" | "Contado" | "Hipoteca">("all");
  const [filterMinIncome, setFilterMinIncome] = useState<string>("");
  const [filterMaxIncome, setFilterMaxIncome] = useState<string>("");
  const [filterTags, setFilterTags] = useState<string>("");

  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [isAnuncioDropdownOpen, setIsAnuncioDropdownOpen] = useState(false);
  const [isIncomeDropdownOpen, setIsIncomeDropdownOpen] = useState(false);
  const [isTipoDropdownOpen, setIsTipoDropdownOpen] = useState(false);
  const [isPetsDropdownOpen, setIsPetsDropdownOpen] = useState(false);
  const [isPaymentDropdownOpen, setIsPaymentDropdownOpen] = useState(false);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("leads_visible_columns");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing visible columns", e);
      }
    }
    return {
      name: true,
      phone: true,
      listingCode: true,
      listingDescription: true,
      operationType: true,
      qualificationStatus: true,
      qualifiedAt: false,
      lastMessageDate: true,
      messageCount: true,
      pets: false,
      income: false,
      paymentMethod: false,
      conversationSummary: true,
      notes: true,
      chat: true,
      tags: true,
      actions: true
    };
  });

  useEffect(() => {
    localStorage.setItem("leads_visible_columns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    if (adFromUrl) {
      setFilterAnuncio([adFromUrl]);
    }
    if (statusFromUrl) {
      setFilterStatus([statusFromUrl]);
    }
  }, [adFromUrl, statusFromUrl]);
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

  const [isMobileView, setIsMobileView] = useState(false);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [hScroll, setHScroll] = useState({ canScroll: false, atStart: true, atEnd: true });

  const updateHorizontalScrollState = useCallback(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const epsilon = 2;
    const canScroll = scrollWidth > clientWidth + epsilon;
    const atStart = scrollLeft <= epsilon;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - epsilon;
    setHScroll((prev) =>
      prev.canScroll === canScroll && prev.atStart === atStart && prev.atEnd === atEnd
        ? prev
        : { canScroll, atStart, atEnd }
    );
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    try {
      const [data, listingsData] = await Promise.all([
        getLeads(),
        getListings()
      ]);

      // Create a map of listing info
      const listingsMap = new Map(
        listingsData.map(l => [l.listingCode, { description: l.description, operationType: l.operationType }])
      );

      // Load message count and listing description for each lead
      const leadsWithMessages = await Promise.all(
        data.map(async (lead) => {
          const listingInfo = listingsMap.get(lead.listingCode);
          try {
            const conversation = await getConversationByChatId(lead.chatId);
            return {
              ...lead,
              messageCount: conversation?.messageCount || 0,
              listingDescription: listingInfo?.description,
              operationType: listingInfo?.operationType || lead.operationType,
              notes: conversation?.notes || lead.notes
            };
          } catch {
            return {
              ...lead,
              messageCount: 0,
              listingDescription: listingInfo?.description,
              operationType: listingInfo?.operationType || lead.operationType,
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
        toast.error("No hay conversación disponible para este lead. El cliente aún no ha enviado mensajes.");
        return;
      }
      setSelectedLead(lead);
      setSelectedConversation(conversation);
      setLeadToEdit(null); // Close edit modal if open
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Error al cargar la conversación");
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
      toast.error("Error al eliminar el lead y su conversación");
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
      setSelectedLeadIds(new Set(filteredAndSortedLeads.map((l: LeadWithMessages) => l.id)));
    }
  }

  async function handleSendMassMessage() {
    if (!massMessageText.trim()) {
      toast.error("Por favor introduce un mensaje");
      return;
    }

    const selectedChatIds = leads
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
      loadLeads(); // Refresh leads to show updated history
    } catch (error) {
      console.error("Error sending mass message:", error);
      toast.error("Error al enviar el mensaje masivo");
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

  const applyViewShortcut = (status: string | "all") => {
    // Reset basic filters
    setSearch("");
    setFilterTipo("all");
    setFilterAnuncio([]);
    setFilterPets("all");
    setFilterPayment("all");
    setFilterMinIncome("");
    setFilterMaxIncome("");
    setFilterTags("");
    setSearchParams({});
    setSelectedLeadIds(new Set());

    if (status === "all") {
      setFilterStatus([]);
      // SHOW ALL COLUMNS for "Todos"
      setVisibleColumns(Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    } else {
      setFilterStatus([status]);
      // CONFIGURE SPECIFIC COLUMNS for status views (hiding non-requested ones)
      setVisibleColumns({
        name: true,
        phone: true,
        listingCode: false, // Hidden
        listingDescription: true,
        operationType: false, // Hidden
        qualificationStatus: true,
        qualifiedAt: true,
        lastMessageDate: false, // Hidden
        messageCount: true,
        pets: true,
        income: true,
        paymentMethod: false, // Hidden
        conversationSummary: true,
        notes: false, // Hidden
        chat: true,
        tags: true,
        actions: true
      });
    }
  };

  const filteredAndSortedLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const matchesSearch = !debouncedSearch ||
          lead.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          lead.phone?.includes(debouncedSearch) ||
          lead.listingCode?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          lead.chatId?.includes(debouncedSearch) ||
          lead.listingDescription?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          lead.notes?.toLowerCase().includes(debouncedSearch.toLowerCase());
        const matchesTipo = filterTipo === "all" || lead.operationType === filterTipo;
        const matchesStatus = filterStatus.length === 0 || filterStatus.includes(lead.qualificationStatus || "not_qualified");
        const matchesAnuncio = filterAnuncio.length === 0 || (lead.listingCode && filterAnuncio.includes(lead.listingCode));
        const matchesPets = filterPets === "all" || 
          (filterPets === "yes" && lead.pets === true) || 
          (filterPets === "no" && (lead.pets === false || lead.pets === undefined));
        const matchesPayment = filterPayment === "all" || lead.paymentMethod === filterPayment;
        const matchesMinIncome = !filterMinIncome || (lead.income !== undefined && lead.income >= parseInt(filterMinIncome));
        const matchesMaxIncome = !filterMaxIncome || (lead.income !== undefined && lead.income <= parseInt(filterMaxIncome));
        const matchesTags = !filterTags ? true : 
          lead.tags?.some(tag => tag.toLowerCase().includes(filterTags.toLowerCase()));
        
        return matchesSearch && matchesTipo && matchesStatus && matchesAnuncio && matchesPets && matchesPayment && matchesMinIncome && matchesMaxIncome && matchesTags;
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
          case "lastMessageDate":
            aValue = a.lastMessageDate?.toMillis() || 0;
            bValue = b.lastMessageDate?.toMillis() || 0;
            break;
          case "messageCount":
            aValue = a.messageCount || 0;
            bValue = b.messageCount || 0;
            break;
          case "income":
            aValue = a.income || 0;
            bValue = b.income || 0;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [leads, debouncedSearch, filterTipo, filterStatus, filterAnuncio, filterPets, filterPayment, filterMinIncome, filterMaxIncome, filterTags, sortField, sortDirection]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    updateHorizontalScrollState();
    const onScroll = () => updateHorizontalScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => updateHorizontalScrollState());
    ro.observe(el);
    window.addEventListener("resize", updateHorizontalScrollState);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.removeEventListener("resize", updateHorizontalScrollState);
    };
  }, [updateHorizontalScrollState, filteredAndSortedLeads, visibleColumns, isMobileView]);

  useEffect(() => {
    const t = requestAnimationFrame(updateHorizontalScrollState);
    return () => cancelAnimationFrame(t);
  }, [updateHorizontalScrollState, filteredAndSortedLeads.length]);

  const hasActiveLeadsFilters =
    search.trim() !== "" ||
    filterTipo !== "all" ||
    filterStatus.length > 0 ||
    filterAnuncio.length > 0 ||
    filterPets !== "all" ||
    filterPayment !== "all" ||
    Boolean(filterTags) ||
    Boolean(filterMinIncome) ||
    (Boolean(filterMaxIncome) && filterMaxIncome !== "10000") ||
    selectedLeadIds.size > 0 ||
    Object.values(visibleColumns).some((v) => !v);

  function resetLeadsFilters() {
    setSearch("");
    setFilterTipo("all");
    setFilterStatus([]);
    setFilterAnuncio([]);
    setFilterPets("all");
    setFilterPayment("all");
    setFilterMinIncome("");
    setFilterMaxIncome("");
    setFilterTags("");
    setSearchParams({});
    setSelectedLeadIds(new Set());
    setVisibleColumns(
      Object.keys(visibleColumns).reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {})
    );
  }

  if (loading) {
    return <PageLoading className="h-64" />;
  }

  return (
    <div className="md:flex md:flex-col md:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)] md:min-h-0">
      <div className="mb-8 space-y-6 md:shrink-0">
        <PageHeader
          className="flex-col md:flex-row md:items-end"
          title="Leads"
          subtitle={`Mostrando ${filteredAndSortedLeads.length} de ${leads.length} leads`}
          actions={
            <div className="flex bg-slate-100 p-1 rounded-btn border border-slate-200 shadow-inner w-fit max-w-full overflow-x-auto no-scrollbar">
                  <button
                    onClick={() => applyViewShortcut("all")}
                    className={cn(
                      "px-5 py-2.5 rounded-btn text-sm font-bold transition-all flex items-center gap-2.5 whitespace-nowrap",
                      filterStatus.length === 0 
                        ? "bg-slate-800 text-white shadow-md ring-1 ring-black/5" 
                        : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                    )}
                  >
                    <span>Todos</span>
                  </button>
                  <button
                    onClick={() => applyViewShortcut("not_qualified")}
                    className={cn(
                      "px-5 py-2.5 rounded-btn text-sm font-bold transition-all flex items-center gap-2.5 whitespace-nowrap",
                      filterStatus.length === 1 && filterStatus[0] === "not_qualified" 
                        ? "bg-slate-100 text-slate-700 shadow-md ring-1 ring-slate-200/50" 
                        : "text-slate-400 hover:text-slate-600 hover:bg-white/40"
                    )}
                  >
                    No Cualificados
                  </button>
                  <button
                    onClick={() => applyViewShortcut("no_response")}
                    className={cn(
                      "px-5 py-2.5 rounded-btn text-sm font-bold transition-all flex items-center gap-2.5 whitespace-nowrap",
                      filterStatus.length === 1 && filterStatus[0] === "no_response" 
                        ? "bg-sky-100 text-sky-800 shadow-md ring-1 ring-sky-200/50" 
                        : "text-sky-700/60 hover:text-sky-800 hover:bg-sky-100/50"
                    )}
                  >
                    Sin respuesta
                  </button>
                  <button
                    onClick={() => applyViewShortcut("qualified")}
                    className={cn(
                      "px-5 py-2.5 rounded-btn text-sm font-bold transition-all flex items-center gap-2.5 whitespace-nowrap",
                      filterStatus.length === 1 && filterStatus[0] === "qualified" 
                        ? "bg-emerald-100 text-emerald-700 shadow-md ring-1 ring-emerald-200/50" 
                        : "text-emerald-600/60 hover:text-emerald-600 hover:bg-emerald-100/40"
                    )}
                  >
                    Cualificados
                  </button>
                  <button
                    onClick={() => applyViewShortcut("rejected")}
                    className={cn(
                      "px-5 py-2.5 rounded-btn text-sm font-bold transition-all flex items-center gap-2.5 whitespace-nowrap",
                      filterStatus.length === 1 && filterStatus[0] === "rejected" 
                        ? "bg-rose-100 text-rose-700 shadow-md ring-1 ring-rose-200/50" 
                        : "text-rose-600/60 hover:text-rose-600 hover:bg-rose-100/40"
                    )}
                  >
                    Rechazados
                  </button>
            </div>
          }
        />
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
              className="px-5 py-2.5 bg-primary-600 text-white rounded-btn text-sm font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 active:scale-95 flex items-center gap-2"
            >
              <Send size={16} />
              <span>Enviar Mensaje</span>
            </button>
          </div>
        </div>
      )}

      <FilterCard className="mb-6 md:shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <h2 className="font-semibold text-gray-900">Filtros</h2>
          </div>
          {hasActiveLeadsFilters && (
            <button
              type="button"
              onClick={resetLeadsFilters}
              className="inline-flex items-center gap-2 rounded-btn border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
              title="Restablecer filtros"
            >
              <XCircle size={18} />
              <span className="hidden sm:inline">Restablecer</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
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
              <div 
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full" 
                onClick={() => setIsAnuncioDropdownOpen(!isAnuncioDropdownOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span className="text-xs font-semibold text-gray-600 shrink-0">Anuncio:</span>
                  <div className="flex items-center gap-1 flex-1 overflow-hidden justify-end">
                    <span className="truncate">
                      {filterAnuncio.length === 0 ? "Todos" : `${filterAnuncio.length} seleccionados`}
                    </span>
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-2 shrink-0", isAnuncioDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isAnuncioDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsAnuncioDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-[300px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-1 max-h-[280px] overflow-y-auto">
                      <button
                        onClick={() => setFilterAnuncio([])}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterAnuncio.length === 0 ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                        <span className="text-xs text-gray-700 font-medium">Todos</span>
                      </button>
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
                            <span className="text-xs text-gray-700 font-medium">
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
            

            <div className="relative flex-1">
              <div 
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full" 
                onClick={() => setIsPetsDropdownOpen(!isPetsDropdownOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-gray-600">Mascota:</span>
                  <div className="flex items-center gap-1 justify-end flex-1">
                    {filterPets === "all" ? "Todos" : (filterPets === "yes" ? "Sí" : "No")}
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isPetsDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isPetsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPetsDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-1">
                    {[
                      { value: "all", label: "Todos" },
                      { value: "yes", label: "Con mascotas" },
                      { value: "no", label: "Sin mascotas" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterPets(option.value as any);
                          setIsPetsDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterPets === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                        <span className="text-xs text-gray-700 font-medium">{option.label}</span>
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
                onClick={() => setIsPaymentDropdownOpen(!isPaymentDropdownOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">Pago:</span>
                  <div className="flex items-center gap-1 justify-end flex-1">
                    {filterPayment === "all" ? "Todos" : filterPayment}
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isPaymentDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isPaymentDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPaymentDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-1">
                    {[
                      { value: "all", label: "Todos" },
                      { value: "Contado", label: "Contado" },
                      { value: "Hipoteca", label: "Hipoteca" }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFilterPayment(option.value as any);
                          setIsPaymentDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterPayment === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                        <span className="text-xs text-gray-700 font-medium">{option.label}</span>
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
                onClick={() => setIsIncomeDropdownOpen(!isIncomeDropdownOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span className="text-xs font-semibold text-gray-600 shrink-0">Ingresos:</span>
                  <div className="flex items-center gap-1 flex-1 overflow-hidden">
                    <span className="truncate">
                      {!filterMinIncome && (!filterMaxIncome || filterMaxIncome === "10000") ? "Todos" : `${filterMinIncome || 0}€ - ${filterMaxIncome || 10000}€`}
                    </span>
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1 shrink-0", isIncomeDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isIncomeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsIncomeDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-[280px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-100">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600 uppercase">Rango de ingresos</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterMinIncome("");
                            setFilterMaxIncome("");
                          }}
                          className="text-[10px] text-primary-600 hover:text-primary-700 font-bold uppercase transition-colors"
                        >
                          Limpiar
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 pt-2">
                        <div className="range-slider-container">
                          <div className="range-slider-track"></div>
                          <input 
                            type="range" 
                            min="0" 
                            max="10000" 
                            step="500" 
                            value={filterMinIncome || 0}
                            onChange={(e) => {
                              const val = Math.min(Number(e.target.value), Number(filterMaxIncome || 10000));
                              setFilterMinIncome(val.toString());
                            }}
                            className="range-slider-input"
                          />
                          <input 
                            type="range" 
                            min="0" 
                            max="10000" 
                            step="500" 
                            value={filterMaxIncome || 10000}
                            onChange={(e) => {
                              const val = Math.max(Number(e.target.value), Number(filterMinIncome || 0));
                              setFilterMaxIncome(val.toString());
                            }}
                            className="range-slider-input"
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-gray-700 font-bold px-0.5">
                          <span className="bg-gray-50 px-2 py-1 rounded border overflow-hidden truncate max-w-[80px]">{filterMinIncome || 0} €</span>
                          <span className="bg-gray-50 px-2 py-1 rounded border overflow-hidden truncate max-w-[80px]">{filterMaxIncome || 10000} €</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Separator */}
            <div className="w-[1px] h-6 bg-slate-200 mx-2 self-center hidden lg:block" />

            {/* Column Visibility Filter */}
            <div className="relative flex-1 min-w-[140px]">
              <div 
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full group/filter" 
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <Settings size={14} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-gray-600 shrink-0">Columnas:</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end flex-1">
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-md font-black shrink-0">
                      {Object.values(visibleColumns).filter(Boolean).length}/{Object.keys(visibleColumns).length}
                    </span>
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-2 shrink-0", isColumnDropdownOpen && "rotate-180")} />
                  </div>
                </div>
              </div>
              {isColumnDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsColumnDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between mb-2 px-2 pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mostrar/Ocultar</span>
                      <button 
                        onClick={() => {
                          const allVisible = Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: true }), {});
                          setVisibleColumns(allVisible);
                        }}
                        className="text-[10px] text-primary-600 font-bold hover:underline"
                      >
                        Mostrar todo
                      </button>
                    </div>
                    <div className="space-y-0.5">
                    {[
                      { id: "name", label: "Nombre" },
                      { id: "phone", label: "Teléfono" },
                      { id: "listingCode", label: "ID Idealista" },
                      { id: "listingDescription", label: "Identificador Anuncio" },
                      { id: "operationType", label: "Tipo" },
                      { id: "qualificationStatus", label: "Estado" },
                      { id: "qualifiedAt", label: "Cualificacion" },
                      { id: "lastMessageDate", label: "Último Mensaje" },
                      { id: "messageCount", label: "Mensajes" },
                      { id: "pets", label: "Mascotas" },
                      { id: "income", label: "Ingresos mensuales" },
                      { id: "paymentMethod", label: "Método de Pago" },
                      { id: "conversationSummary", label: "Ver resumen" },
                      { id: "notes", label: "Notas" },
                      { id: "chat", label: "Chat" },
                      { id: "tags", label: "Tags" },
                      { id: "actions", label: "Acciones" }
                    ].map((col) => (
                      <button
                        key={col.id}
                        onClick={() => setVisibleColumns(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                        className="flex items-center justify-between w-full px-2 py-1.5 hover:bg-slate-50 rounded-btn transition-colors group"
                      >
                        <span className={cn("text-xs transition-colors", visibleColumns[col.id] ? "text-slate-900 font-medium" : "text-slate-400")}>
                          {col.label}
                        </span>
                        {visibleColumns[col.id] ? (
                          <Eye size={14} className="text-primary-600" />
                        ) : (
                          <EyeOff size={14} className="text-slate-200" />
                        )}
                      </button>
                    ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
      </FilterCard>

      {filteredAndSortedLeads.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {leads.length === 0 ? "No hay leads" : "No se encontraron resultados"}
          </h3>
          <p className="text-gray-500">
            {leads.length === 0
              ? "Los leads aparecerán aquí cuando los clientes interactúen con el asistente"
              : "Intenta con otros términos de búsqueda"}
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

          {/* Conditional View Rendering */}
          {isMobileView ? (
            <div className="md:hidden space-y-3">
              {filteredAndSortedLeads.map((lead: LeadWithMessages) => (
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
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-btn transition-colors flex-shrink-0 z-10"
                      title="Eliminar lead"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <QualificationBadge status={lead.qualificationStatus} />
                    <OperationTypeBadge type={lead.operationType} />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 border border-gray-200 shadow-sm w-fit">
                        <span className="text-gray-400 font-medium">ID</span>
                        <span>{lead.listingCode}</span>
                      </div>
                      {lead.listingDescription && (
                        <span className="text-[10px] text-gray-500 line-clamp-1 italic px-1">
                          {lead.listingDescription}
                        </span>
                      )}
                    </div>
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
          ) : (
            <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 card overflow-hidden p-0 min-h-[200px]">
              {hScroll.canScroll && (
                <div
                  className="shrink-0 flex items-center justify-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/95 text-[11px] sm:text-xs text-gray-600"
                  role="status"
                >
                  <ChevronLeft size={14} className="text-primary-500/70 shrink-0 motion-safe:animate-pulse" aria-hidden />
                  <span className="font-medium text-center leading-snug">
                    Desplázate horizontalmente para ver todas las columnas
                  </span>
                  <ChevronRight size={14} className="text-primary-500/70 shrink-0 motion-safe:animate-pulse" aria-hidden />
                </div>
              )}
              <div className="relative flex flex-1 min-h-0 min-w-0 flex-col">
                <div
                  ref={tableScrollRef}
                  className="min-h-0 flex-1 overflow-auto overscroll-contain"
                >
                <table className="w-full text-sm border-collapse">
                  <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-gray-50 [&_th]:border-b [&_th]:border-gray-200">
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
                      {visibleColumns.name && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Nombre
                            {getSortIcon("name")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.phone && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("phone")}
                        >
                          <div className="flex items-center gap-1">
                            Teléfono
                            {getSortIcon("phone")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.listingCode && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("listingCode")}
                        >
                          <div className="flex items-center gap-1">
                            ID Idealista
                            {getSortIcon("listingCode")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.listingDescription && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Identificador Anuncio
                        </th>
                      )}
                      {visibleColumns.operationType && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("operationType")}
                        >
                          <div className="flex items-center gap-1">
                            Tipo
                            {getSortIcon("operationType")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.qualificationStatus && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("qualificationStatus")}
                        >
                          <div className="flex items-center gap-1">
                            Estado
                            {getSortIcon("qualificationStatus")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.qualifiedAt && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("lastMessageDate")}
                        >
                          <div className="flex items-center gap-1">
                            <Calendar size={13} className="text-gray-400" />
                            Cualificacion
                            {getSortIcon("lastMessageDate")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.lastMessageDate && (
                        <th
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("lastMessageDate")}
                        >
                          <div className="flex items-center gap-1">
                            <Calendar size={13} className="text-gray-400" />
                            Último Mensaje
                            {getSortIcon("lastMessageDate")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.messageCount && (
                        <th
                          className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("messageCount")}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Mensajes
                            {getSortIcon("messageCount")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.conversationSummary && (
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Resumen
                        </th>
                      )}
                      {visibleColumns.pets && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Mascotas
                        </th>
                      )}
                      {visibleColumns.income && (
                        <th 
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                          onClick={() => handleSort("income")}
                        >
                          <div className="flex items-center gap-1">
                            Ingresos mensuales
                            {getSortIcon("income")}
                          </div>
                        </th>
                      )}
                      {visibleColumns.paymentMethod && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Método de Pago
                        </th>
                      )}
                      {visibleColumns.notes && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Notas
                        </th>
                      )}
                      {visibleColumns.chat && (
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Chat
                        </th>
                      )}
                      {visibleColumns.tags && (
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Tags
                        </th>
                      )}
                      {visibleColumns.actions && (
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAndSortedLeads.map((lead: LeadWithMessages) => (
                      <Fragment key={lead.id}>
                      <tr
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
                        {visibleColumns.name && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <div className="flex items-center gap-1.5">
                              <User size={14} className="text-gray-400 flex-shrink-0" />
                              <span className="font-medium text-gray-900 truncate max-w-[120px]" title={lead.name || "—"}>
                                {lead.name || "—"}
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.phone && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <div className="flex items-center gap-1.5">
                              <Phone size={14} className="text-gray-400 flex-shrink-0" />
                              <span className="text-gray-900 text-xs">
                                {formatPhone(lead.phone)}
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.listingCode && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-[11px] font-bold text-gray-600 border border-gray-200 shadow-sm w-fit">
                              <span className="text-gray-400 font-medium">ID</span>
                              <span>{lead.listingCode}</span>
                              <a
                                href={`https://www.idealista.com/inmueble/${lead.listingCode}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-primary-700 transition-colors ml-0.5"
                                title="Ver en Idealista"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          </td>
                        )}
                        {visibleColumns.listingDescription && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            {lead.listingDescription ? (
                              <span className="text-xs text-gray-900 truncate max-w-[150px] inline-block align-bottom" title={lead.listingDescription}>
                                {lead.listingDescription}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.operationType && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <OperationTypeBadge type={lead.operationType} />
                          </td>
                        )}
                        {visibleColumns.qualificationStatus && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <QualificationBadge status={lead.qualificationStatus} />
                          </td>
                        )}
                        {visibleColumns.qualifiedAt && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => openEditModal(lead)}>
                            {lead.qualificationStatus === "qualified" && lead.lastMessageDate ? formatDate(lead.lastMessageDate.toDate()) : "—"}
                          </td>
                        )}
                        {visibleColumns.lastMessageDate && (
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 cursor-pointer" onClick={() => openEditModal(lead)}>
                            {lead.lastMessageDate ? formatDate(lead.lastMessageDate.toDate()) : "—"}
                          </td>
                        )}
                        {visibleColumns.messageCount && (
                          <td className="px-3 py-3 whitespace-nowrap text-center cursor-pointer" onClick={() => openEditModal(lead)}>
                            <span className="text-xs font-medium text-gray-900">{lead.messageCount || 0}</span>
                          </td>
                        )}
                        {visibleColumns.conversationSummary && (
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
                        )}
                        {visibleColumns.pets && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <span className="text-xs text-gray-900">{lead.pets ? "Sí" : "No"}</span>
                          </td>
                        )}
                        {visibleColumns.income && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <span className="text-xs text-gray-900">{lead.income ? `${lead.income} €` : "—"}</span>
                          </td>
                        )}
                        {visibleColumns.paymentMethod && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <span className="text-xs text-gray-900">{lead.paymentMethod || "—"}</span>
                          </td>
                        )}
                        {visibleColumns.notes && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <span className="text-xs text-gray-500 truncate max-w-[100px] inline-block" title={lead.notes || ""}>
                              {lead.notes || "—"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.chat && (
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openConversation(lead);
                              }}
                              className="text-primary-600 hover:text-primary-700 hover:bg-primary-50 p-2 rounded-btn transition-colors"
                              title="Ver chat"
                            >
                              <MessageSquare size={16} />
                            </button>
                          </td>
                        )}
                        {visibleColumns.tags && (
                          <td className="px-3 py-3 whitespace-nowrap cursor-pointer" onClick={() => openEditModal(lead)}>
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {lead.tags?.filter((tag: string) => tag.toLowerCase() !== 'lead').map((tag: string) => (
                                <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary-50 text-primary-600 border border-primary-100">
                                  {tag}
                                </span>
                              ))}
                              {(!lead.tags || lead.tags.length <= 1) && <span className="text-gray-400 text-xs">—</span>}
                            </div>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={(e) => handleDeleteLead(e, lead)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-btn transition-colors"
                              title="Eliminar lead"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                      
                      {/* Render expanded summary row underneath */}
                      {expandedSummaries.has(lead.id) && lead.conversationSummary && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={24} className="px-4 py-3 border-b border-gray-100">
                             <div className="flex items-start gap-2 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border border-gray-100 mx-8">
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
                {hScroll.canScroll && !hScroll.atStart && (
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 w-10 z-[15] bg-gradient-to-r from-white via-white/90 to-transparent"
                    aria-hidden
                  />
                )}
                {hScroll.canScroll && !hScroll.atEnd && (
                  <div
                    className="pointer-events-none absolute inset-y-0 right-0 w-10 z-[15] bg-gradient-to-l from-white via-white/90 to-transparent"
                    aria-hidden
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de conversación */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white sm:rounded-lg shadow-xl max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header del modal */}
            <div className="p-3 sm:p-4 border-b border-gray-200 bg-white">
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
