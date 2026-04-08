import { useEffect, useState, Fragment, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Users, Phone, Search, User, ArrowUpDown, ArrowUp, ArrowDown, MessageSquare, X, Trash2, Download, Settings, Eye, EyeOff, CheckSquare, Square, XCircle, ExternalLink, ChevronDown, Calendar, FileText, Filter, Tags, RefreshCw, Hash } from "lucide-react";
import type { Lead, Conversation, QualificationStatus } from "../types";
import { getLeads, deleteLead, deleteLeads, bulkUpdateLeadsQualificationStatus, bulkAddLeadTags, bulkRemoveLeadTag, bulkUpdateLeadsListingCode } from "../services/leads";
import { getListings } from "../services/listings";
import { getConversationByChatId, sendMassMessageToWhatsApp } from "../services/conversations";

import { formatDate, formatPhone, cn, formatMessageTime } from "../lib/utils";
import { metricTheme, customLeadTagSm, conversationHeaderPills } from "../lib/metricTheme";
import { resolveConversationQualification } from "../lib/conversationQualification";
import { downloadConversation } from "../lib/export";
import { LeadDetails } from "../components/LeadDetails";
import { LeadEditModal } from "../components/LeadEditModal";
import { Send } from "lucide-react";
import { Button, PageHeader, PageLoading, FilterCard, SegmentedControl } from "../components/ui";
import { QualificationBadge, OperationTypeBadge } from "../components/StatusBadges";

/** `?status=non_qualified_all` (p. ej. desde Anuncios) = todos salvo cualificados */
const NON_QUALIFIED_ALL_STATUSES = ["not_qualified", "rejected", "no_response"] as const;

function filterStatusFromUrlParam(status: string | null): string[] {
  if (!status) return [];
  if (status === "non_qualified_all") return [...NON_QUALIFIED_ALL_STATUSES];
  return [status];
}

const COMPACT_STATUS_VISIBLE_COLUMNS: Record<string, boolean> = {
  name: true,
  phone: true,
  listingCode: false,
  listingDescription: true,
  operationType: false,
  qualificationStatus: true,
  qualifiedAt: true,
  lastMessageDate: false,
  messageCount: true,
  pets: true,
  income: true,
  paymentMethod: false,
  conversationSummary: true,
  notes: false,
  chat: true,
  tags: true,
  actions: false,
};

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
  const [filterStatus, setFilterStatus] = useState<string[]>(() =>
    filterStatusFromUrlParam(statusFromUrl)
  );
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
      actions: false
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
      const next = filterStatusFromUrlParam(statusFromUrl);
      setFilterStatus(next);
      if (next.length > 0) {
        setVisibleColumns(COMPACT_STATUS_VISIBLE_COLUMNS);
      }
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

  const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
  const [activeBulkModal, setActiveBulkModal] = useState<null | "delete" | "status" | "addTags" | "removeTag" | "listing">(null);

  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteAccepted, setBulkDeleteAccepted] = useState(false);

  const [bulkStatus, setBulkStatus] = useState<QualificationStatus>("not_qualified");
  const [bulkUpdatingStatus, setBulkUpdatingStatus] = useState(false);

  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkUpdatingTags, setBulkUpdatingTags] = useState(false);

  const [bulkRemoveTagInput, setBulkRemoveTagInput] = useState("");
  const [bulkRemovingTag, setBulkRemovingTag] = useState(false);

  const [bulkListingCode, setBulkListingCode] = useState("");
  const [bulkUpdatingListing, setBulkUpdatingListing] = useState(false);

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

  const selectedLeadList = useMemo(() => leads.filter((l) => selectedLeadIds.has(l.id)), [leads, selectedLeadIds]);

  function closeBulkModal() {
    setActiveBulkModal(null);
    setIsBulkActionsOpen(false);
  }

  function downloadSelectedLeadsCsv() {
    const rows = selectedLeadList;
    const headers = [
      "id",
      "name",
      "phone",
      "listingCode",
      "operationType",
      "qualificationStatus",
      "tags",
      "notes",
      "createdAt",
      "lastMessageDate",
      "chatId",
    ];

    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const lines = [
      headers.join(","),
      ...rows.map((l) => {
        const createdAt = (l as any).createdAt?.toDate ? (l as any).createdAt.toDate().toISOString() : (l as any).createdAt ? String((l as any).createdAt) : "";
        const lastMessageDate = (l as any).lastMessageDate?.toDate ? (l as any).lastMessageDate.toDate().toISOString() : (l as any).lastMessageDate ? String((l as any).lastMessageDate) : "";
        return [
          escape(l.id),
          escape(l.name || ""),
          escape(l.phone || ""),
          escape(l.listingCode || ""),
          escape(l.operationType || ""),
          escape(l.qualificationStatus || ""),
          escape((l.tags || []).join("|")),
          escape((l as any).notes || ""),
          escape(createdAt),
          escape(lastMessageDate),
          escape(l.chatId || ""),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleBulkDelete() {
    if (!bulkDeleteAccepted) {
      toast.error("Debes aceptar la advertencia para continuar");
      return;
    }

    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;

    setBulkDeleting(true);
    try {
      await deleteLeads(ids, 4);
      setLeads((prev) => prev.filter((l) => !selectedLeadIds.has(l.id)));
      setSelectedLeadIds(new Set());
      toast.success(`Eliminados ${ids.length} leads (y sus conversaciones)`);
      closeBulkModal();
      setBulkDeleteAccepted(false);
    } catch (err) {
      console.error("Error bulk deleting leads:", err);
      toast.error("Error al eliminar leads seleccionados");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function handleBulkUpdateStatus() {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;

    setBulkUpdatingStatus(true);
    try {
      await bulkUpdateLeadsQualificationStatus(ids, bulkStatus as any, 4);
      toast.success(`Actualizado estado en ${ids.length} leads`);
      closeBulkModal();
      setSelectedLeadIds(new Set());
      await loadLeads();
    } catch (err) {
      console.error("Error bulk updating status:", err);
      toast.error("Error al actualizar el estado");
    } finally {
      setBulkUpdatingStatus(false);
    }
  }

  async function handleBulkAddTags() {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;
    const tags = bulkTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .filter((t) => t.toLowerCase() !== "lead");
    if (tags.length === 0) {
      toast.error("Introduce al menos un tag valido (el tag 'lead' no se usa)");
      return;
    }

    setBulkUpdatingTags(true);
    try {
      await bulkAddLeadTags(ids, tags, 4);
      toast.success(`Añadidos tags en ${ids.length} leads`);
      closeBulkModal();
      setBulkTagsInput("");
      setSelectedLeadIds(new Set());
      await loadLeads();
    } catch (err) {
      console.error("Error bulk adding tags:", err);
      toast.error("Error al añadir tags");
    } finally {
      setBulkUpdatingTags(false);
    }
  }

  async function handleBulkRemoveTag() {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;
    const tag = bulkRemoveTagInput.trim();
    if (!tag) {
      toast.error("Introduce el tag a quitar");
      return;
    }

    setBulkRemovingTag(true);
    try {
      await bulkRemoveLeadTag(ids, tag, 4);
      toast.success(`Quitado tag en ${ids.length} leads`);
      closeBulkModal();
      setBulkRemoveTagInput("");
      setSelectedLeadIds(new Set());
      await loadLeads();
    } catch (err) {
      console.error("Error bulk removing tag:", err);
      toast.error("Error al quitar tag");
    } finally {
      setBulkRemovingTag(false);
    }
  }

  async function handleBulkUpdateListingCode() {
    const ids = Array.from(selectedLeadIds);
    if (ids.length === 0) return;
    const next = bulkListingCode.trim();
    if (!next) {
      toast.error("Introduce un código de anuncio");
      return;
    }

    setBulkUpdatingListing(true);
    try {
      await bulkUpdateLeadsListingCode(ids, next, 4);
      toast.success(`Actualizado anuncio en ${ids.length} leads`);
      closeBulkModal();
      setBulkListingCode("");
      setSelectedLeadIds(new Set());
      await loadLeads();
    } catch (err) {
      console.error("Error bulk updating listing:", err);
      toast.error("Error al cambiar el anuncio");
    } finally {
      setBulkUpdatingListing(false);
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

  const resetToAllLeadsView = useCallback(() => {
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
    setFilterStatus([]);
    setVisibleColumns((prev) =>
      Object.keys(prev).reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {})
    );
  }, [setSearchParams]);

  /** Varios estados a la vez (OR). Mismo estado otra vez = quita ese filtro. */
  const toggleQualificationFilter = useCallback((status: string) => {
    setFilterStatus((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status];
      setVisibleColumns((curr) =>
        next.length > 0
          ? COMPACT_STATUS_VISIBLE_COLUMNS
          : Object.keys(curr).reduce<Record<string, boolean>>((acc, key) => ({ ...acc, [key]: true }), {})
      );
      return next;
    });
  }, []);

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

  /** Última vez que la IA analizó alguna conversación (mascotas, ingresos, forma de pago, resumen…), según `lastAnalyzedAt` en Firestore. */
  const latestConversationAnalysisAt = useMemo(() => {
    let maxMs = 0;
    for (const lead of leads) {
      const ms = lead.lastAnalyzedAt?.toMillis?.() ?? 0;
      if (ms > maxMs) maxMs = ms;
    }
    return maxMs > 0 ? new Date(maxMs) : null;
  }, [leads]);

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
          subtitle={[
            `Mostrando ${filteredAndSortedLeads.length} de ${leads.length} leads`,
            latestConversationAnalysisAt
              ? `Último análisis: ${formatDate(latestConversationAnalysisAt)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <div className="max-w-full overflow-x-auto no-scrollbar">
              <SegmentedControl
                ariaLabel="Filtro de cualificación"
                colorScheme="amber"
                mode="multiple"
                values={
                  filterStatus.length === 0
                    ? new Set(["all"])
                    : new Set(filterStatus as Array<"not_qualified" | "no_response" | "qualified" | "rejected">)
                }
                onToggle={(v) => {
                  if (v === "all") {
                    resetToAllLeadsView();
                    return;
                  }
                  toggleQualificationFilter(v);
                }}
                options={[
                  {
                    value: "all",
                    label: "Todos",
                    selectedClassName: "bg-primary-500 text-gray-900",
                    unselectedClassName: "text-gray-600 hover:bg-gray-50",
                  },
                  {
                    value: "not_qualified",
                    label: <span className="normal-case">No cualificados</span>,
                    selectedClassName: "bg-slate-200 text-slate-900",
                    unselectedClassName: "text-gray-600 hover:bg-gray-50",
                  },
                  {
                    value: "no_response",
                    label: "Sin respuesta",
                    selectedClassName: "bg-sky-200 text-sky-900",
                    unselectedClassName: "text-gray-600 hover:bg-gray-50",
                  },
                  {
                    value: "qualified",
                    label: "Cualificados",
                    selectedClassName: "bg-emerald-200 text-emerald-900",
                    unselectedClassName: "text-gray-600 hover:bg-gray-50",
                  },
                  {
                    value: "rejected",
                    label: "Rechazados",
                    selectedClassName: "bg-rose-200 text-rose-900",
                    unselectedClassName: "text-gray-600 hover:bg-gray-50",
                  },
                ]}
                className="w-fit"
              />
            </div>
          }
        />
      </div>

      {/* Floating Action Bar for Mass Messaging */}
      {selectedLeadIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 border border-primary-100 rounded-lg flex items-center justify-center text-primary-700">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{selectedLeadIds.size} seleccionados</p>
                <button
                  onClick={() => setSelectedLeadIds(new Set())}
                  className="text-[11px] text-gray-600 font-semibold hover:text-gray-800 hover:underline"
                >
                  Deseleccionar todos
                </button>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsBulkActionsOpen((v) => !v)}
                className="px-4 py-2 bg-primary-600 text-white rounded-btn text-sm font-bold hover:bg-primary-700 transition-all shadow-sm active:scale-95 flex items-center gap-2"
              >
                <ChevronDown size={16} className={cn("transition-transform", isBulkActionsOpen && "rotate-180")} />
                <span>Acciones</span>
              </button>

              {isBulkActionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsBulkActionsOpen(false)} />
                  <div className="absolute right-0 bottom-12 z-50 w-56 bg-white rounded-xl shadow-xl border border-gray-200 p-1.5">
                    <button
                      onClick={() => {
                        setIsBulkActionsOpen(false);
                        setIsMassMessageModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <Send size={16} className="text-primary-600" />
                      Enviar mensaje
                    </button>
                    <button
                      onClick={() => {
                        setBulkStatus("not_qualified");
                        setActiveBulkModal("status");
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <RefreshCw size={16} className="text-gray-600" />
                      Cambiar estado
                    </button>
                    <button
                      onClick={() => setActiveBulkModal("addTags")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <Tags size={16} className="text-gray-600" />
                      Añadir tags
                    </button>
                    <button
                      onClick={() => setActiveBulkModal("removeTag")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <Tags size={16} className="text-gray-600" />
                      Quitar tag
                    </button>
                    <button
                      onClick={() => setActiveBulkModal("listing")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <Hash size={16} className="text-gray-600" />
                      Cambiar anuncio
                    </button>
                    <button
                      onClick={() => {
                        setIsBulkActionsOpen(false);
                        try {
                          downloadSelectedLeadsCsv();
                          toast.success("CSV descargado");
                        } catch (err) {
                          console.error("Error exporting CSV:", err);
                          toast.error("Error al exportar CSV");
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 rounded-btn transition-colors"
                    >
                      <Download size={16} className="text-gray-600" />
                      Exportar CSV
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button
                      onClick={() => setActiveBulkModal("delete")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 rounded-btn transition-colors"
                    >
                      <Trash2 size={16} className="text-rose-600" />
                      Borrar seleccionados
                    </button>
                  </div>
                </>
              )}
            </div>
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
                    <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-full shrink-0">
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
                          const allVisible = Object.keys(visibleColumns).reduce((acc, key) => ({ ...acc, [key]: key === "actions" ? false : true }), {});
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
                      { id: "tags", label: "Tags" }
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
                      <MessageSquare size={12} className={metricTheme.messages.listIconCard} />
                      <span className={cn(!lead.messageCount && metricTheme.messages.listMuted)}>
                        {lead.messageCount || 0} mensajes
                      </span>
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
              <div className="flex flex-1 min-h-0 min-w-0 flex-col">
                <div
                  ref={tableScrollRef}
                  className="min-h-0 flex-1 overflow-auto overscroll-contain"
                  style={{
                    boxShadow:
                      hScroll.canScroll
                        ? [
                            !hScroll.atStart ? "inset 14px 0 22px -10px rgba(15, 23, 42, 0.07)" : null,
                            !hScroll.atEnd ? "inset -14px 0 22px -10px rgba(15, 23, 42, 0.07)" : null,
                          ]
                            .filter((s): s is string => Boolean(s))
                            .join(", ") || undefined
                        : undefined,
                  }}
                >
                <table className="w-full text-sm border-collapse">
                  <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-gray-50 [&_th]:border-b [&_th]:border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-center w-8">
                        <Button
                          onClick={toggleAllSelection}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-primary-600 hover:bg-transparent"
                          title="Seleccionar todos"
                        >
                          {selectedLeadIds.size === filteredAndSortedLeads.length && filteredAndSortedLeads.length > 0 ? (
                            <CheckSquare size={16} className="text-primary-600" />
                          ) : (
                            <Square size={16} />
                          )}
                        </Button>
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
                          <Button
                            onClick={() => toggleLeadSelection(lead.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-primary-600 hover:bg-transparent"
                            title="Seleccionar lead"
                          >
                            {selectedLeadIds.has(lead.id) ? (
                              <CheckSquare size={16} className="text-primary-600" />
                            ) : (
                              <Square size={16} />
                            )}
                          </Button>
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
                              <span>{lead.listingCode === "__pending__" ? "Pend." : lead.listingCode}</span>
                              {lead.listingCode && lead.listingCode !== "__pending__" && (
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
                              )}
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
                            <span
                              className={cn(
                                "text-xs font-medium",
                                lead.messageCount && lead.messageCount > 0 ? metricTheme.messages.listValue : metricTheme.messages.listMuted
                              )}
                            >
                              {lead.messageCount || 0}
                            </span>
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
                                <span key={tag} className={customLeadTagSm}>
                                  {tag}
                                </span>
                              ))}
                              {(!lead.tags || lead.tags.length <= 1) && <span className="text-gray-400 text-xs">—</span>}
                            </div>
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
                    <span className={cn("whitespace-nowrap", selectedConversation.messageCount ? metricTheme.messages.listValue : metricTheme.messages.listMuted)}>
                      {selectedConversation.messageCount || 0} mensajes
                    </span>
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
                  <span className={conversationHeaderPills.finalized}>
                    Finalizada
                  </span>
                )}
                {(() => {
                  const q = resolveConversationQualification(selectedConversation, {
                    leadQualificationStatus: selectedLead?.qualificationStatus,
                  });
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

      {/* Modal: Borrado masivo */}
      {activeBulkModal === "delete" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 rounded-lg text-rose-700">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Borrar en lote</h3>
                  <p className="text-xs text-gray-600 font-medium">
                    Se borrarán permanentemente {selectedLeadIds.size} leads y sus conversaciones asociadas
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setBulkDeleteAccepted(false);
                  closeBulkModal();
                }}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-btn transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
                <p className="text-[11px] text-rose-800 font-semibold leading-relaxed">
                  ⚠️ ADVERTENCIA: esta acción elimina permanentemente los leads seleccionados y las conversaciones asociadas. No se puede deshacer.
                </p>
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={bulkDeleteAccepted}
                  onChange={(e) => setBulkDeleteAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="font-semibold">
                  Entiendo que esta acción es irreversible y borrará también las conversaciones asociadas.
                </span>
              </label>
            </div>

            <div className="p-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={() => {
                  setBulkDeleteAccepted(false);
                  closeBulkModal();
                }}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-btn transition-colors"
                disabled={bulkDeleting}
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting || !bulkDeleteAccepted}
                className="flex-[2] px-4 py-2.5 bg-rose-600 text-white rounded-btn text-sm font-bold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {bulkDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Borrando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Borrar {selectedLeadIds.size} leads</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cambiar estado */}
      {activeBulkModal === "status" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Cambiar estado</h3>
                  <p className="text-xs text-gray-500 font-medium">Aplicar a {selectedLeadIds.size} leads</p>
                </div>
              </div>
              <Button
                onClick={closeBulkModal}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-600"
                title="Cerrar"
              >
                <XCircle size={20} />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Nuevo estado</label>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as QualificationStatus)}
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all bg-white"
              >
                <option value="not_qualified">No cualificado</option>
                <option value="no_response">Sin respuesta</option>
                <option value="qualified">Cualificado</option>
                <option value="rejected">Rechazado</option>
              </select>
              <p className="text-[11px] text-gray-500">
                Esto también sincroniza la conversación asociada (campo “qualified”) para mantener coherencia en la app.
              </p>
            </div>

            <div className="p-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                onClick={closeBulkModal}
                variant="secondary"
                className="flex-1"
                disabled={bulkUpdatingStatus}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkUpdateStatus}
                loading={bulkUpdatingStatus}
                className="flex-[2]"
              >
                <RefreshCw size={16} />
                <span>Aplicar a {selectedLeadIds.size} leads</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Añadir tags */}
      {activeBulkModal === "addTags" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                  <Tags size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Añadir tags</h3>
                  <p className="text-xs text-gray-500 font-medium">Aplicar a {selectedLeadIds.size} leads</p>
                </div>
              </div>
              <Button
                onClick={closeBulkModal}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-600"
                title="Cerrar"
              >
                <XCircle size={20} />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Tags (separados por comas)</label>
              <input
                value={bulkTagsInput}
                onChange={(e) => setBulkTagsInput(e.target.value)}
                placeholder="ej: vip, urgente, piso-2h"
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
              <p className="text-[11px] text-gray-500">Los tags se combinan con los existentes (sin duplicados).</p>
            </div>

            <div className="p-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                onClick={closeBulkModal}
                variant="secondary"
                className="flex-1"
                disabled={bulkUpdatingTags}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkAddTags}
                loading={bulkUpdatingTags}
                className="flex-[2]"
              >
                <Tags size={16} />
                <span>Añadir a {selectedLeadIds.size} leads</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quitar tag */}
      {activeBulkModal === "removeTag" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                  <Tags size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Quitar tag</h3>
                  <p className="text-xs text-gray-500 font-medium">Aplicar a {selectedLeadIds.size} leads</p>
                </div>
              </div>
              <Button
                onClick={closeBulkModal}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-600"
                title="Cerrar"
              >
                <XCircle size={20} />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Tag a quitar</label>
              <input
                value={bulkRemoveTagInput}
                onChange={(e) => setBulkRemoveTagInput(e.target.value)}
                placeholder="ej: vip"
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
              <p className="text-[11px] text-gray-500">Se eliminará exactamente el tag escrito (match exacto).</p>
            </div>

            <div className="p-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                onClick={closeBulkModal}
                variant="secondary"
                className="flex-1"
                disabled={bulkRemovingTag}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkRemoveTag}
                loading={bulkRemovingTag}
                className="flex-[2]"
              >
                <Tags size={16} />
                <span>Quitar en {selectedLeadIds.size} leads</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cambiar anuncio */}
      {activeBulkModal === "listing" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                  <Hash size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Cambiar anuncio</h3>
                  <p className="text-xs text-gray-500 font-medium">Aplicar a {selectedLeadIds.size} leads</p>
                </div>
              </div>
              <Button
                onClick={closeBulkModal}
                variant="ghost"
                size="icon"
                className="text-gray-400 hover:text-gray-600"
                title="Cerrar"
              >
                <XCircle size={20} />
              </Button>
            </div>

            <div className="p-4 space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Nuevo `listingCode`</label>
              <input
                value={bulkListingCode}
                onChange={(e) => setBulkListingCode(e.target.value)}
                placeholder="ej: 123456"
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all"
              />
              <p className="text-[11px] text-gray-500">Esto también se sincroniza en la conversación asociada.</p>
            </div>

            <div className="p-4 bg-gray-50 flex flex-col-reverse sm:flex-row gap-2">
              <Button
                onClick={closeBulkModal}
                variant="secondary"
                className="flex-1"
                disabled={bulkUpdatingListing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkUpdateListingCode}
                loading={bulkUpdatingListing}
                className="flex-[2]"
              >
                <Hash size={16} />
                <span>Aplicar a {selectedLeadIds.size} leads</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
