import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Power, PowerOff, CheckCircle, XCircle, Users, MapPin, ExternalLink, ChevronDown, ChevronRight, MessageSquare, CheckSquare, Square, Filter, Search } from "lucide-react";
import type { Listing, ListingFormData, OperationType, ListingClosureReason, Lead } from "../types";
import { getListings, createListing, updateListing, deleteListing, deactivateListing, reactivateListing } from "../services/listings";
import { getConversations } from "../services/conversations";
import {
  getQualifiedLeadsByListingCode,
  getLeads,
  filterQualifiedLeads,
} from "../services/leads";
import { cn } from "../lib/utils";
import { composeListingAddress, normalizeForSearch } from "../lib/addressNormalize";
import { metricTheme, qualificationStatusClasses } from "../lib/metricTheme";
import { PageHeader, PageLoading, Button, FilterCard } from "../components/ui";
import { OperationTypeBadge } from "../components/StatusBadges";

type AddressSuggestionOption = {
  label: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  countryCode: string;
};

function parsePhotonFeature(f: { properties?: Record<string, string | undefined> }): AddressSuggestionOption | null {
  const p = f.properties || {};
  const name = typeof p.name === "string" ? p.name : "";
  const street = typeof p.street === "string" ? p.street : "";
  const housenumber = typeof p.housenumber === "string" ? p.housenumber : "";
  const city = typeof p.city === "string" ? p.city : "";
  const postcode = typeof p.postcode === "string" ? p.postcode : "";
  const state = typeof p.state === "string" ? p.state : "";
  const rawCountryCode = typeof p.countrycode === "string" ? p.countrycode.toUpperCase() : "";
  const country =
    (typeof p.country === "string" && p.country) ||
    (rawCountryCode === "ES" ? "España" : rawCountryCode) ||
    "España";
  if (!city && !state) return null;
  const streetLine = [street, housenumber].filter(Boolean).join(" ").trim() || (name && !street ? name : street) || "";
  const label = [streetLine || name, city, postcode, state].filter(Boolean).join(", ");
  return {
    label,
    street: streetLine,
    city,
    province: state,
    postalCode: postcode,
    country,
    countryCode: rawCountryCode,
  };
}

const emptyFormData: ListingFormData = {
  description: "",
  listingCode: "",
  referencia: "",
  link: "", // Se generará automáticamente al guardar
  operationType: "Venta",
  features: "",
  idealistaDescription: "",
  quickQualificationEnabled: false,
  price: "",
  m2: "",
  rooms: "",
  address: "",
  street: "",
  city: "",
  province: "",
  postalCode: "",
  country: "España",
  provinceNormalized: "",
  profitabilityReportAvailable: false,
  profitabilityReport: "",
  agentName: "",
  minMonthlyIncome: undefined,
  maxPeople: undefined,
  requireMortgageApproved: false,
};

// Razones de cierre con etiquetas para mostrar
const closureReasonLabels: Record<ListingClosureReason, string> = {
  sold_to_qualified: "Vendido a lead cualificado",
  rented_to_qualified: "Alquilado a lead cualificado",
  sold_to_other: "Vendido a otra persona",
  rented_to_other: "Alquilado a otra persona",
  other: "Otros motivos",
};

type ListingSortOption = "default" | "updated_desc" | "conversations_desc" | "qualified_desc" | "title_asc";

export function Listings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ListingFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Estados para autocompletado de dirección
  const [addressSuggestionOptions, setAddressSuggestionOptions] = useState<AddressSuggestionOption[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [addressSearchEnabled, setAddressSearchEnabled] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLTextAreaElement>(null);
  const featuresGhostRef = useRef<HTMLDivElement>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");
  const [filterOperationType, setFilterOperationType] = useState<"all" | OperationType>("all");
  const [listingSearch, setListingSearch] = useState("");
  const [debouncedListingSearch, setDebouncedListingSearch] = useState("");
  const [sortBy, setSortBy] = useState<ListingSortOption>("default");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isListingTipoFilterOpen, setIsListingTipoFilterOpen] = useState(false);
  const [isSortFilterOpen, setIsSortFilterOpen] = useState(false);

  const [conversationCounts, setConversationCounts] = useState<Record<string, number>>({});
  const [respondedCounts, setRespondedCounts] = useState<Record<string, number>>({});
  const [qualifiedCounts, setQualifiedCounts] = useState<Record<string, number>>({});

  // Estado para modal de desactivación
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivatingListing, setDeactivatingListing] = useState<Listing | null>(null);
  const [closureReason, setClosureReason] = useState<ListingClosureReason | "">("");
  const [selectedQualifiedLead, setSelectedQualifiedLead] = useState<Lead | null>(null);
  const [closureNotes, setClosureNotes] = useState("");
  const [qualifiedLeadsForListing, setQualifiedLeadsForListing] = useState<Lead[]>([]);
  const [loadingQualifiedLeads, setLoadingQualifiedLeads] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [expandedAddresses, setExpandedAddresses] = useState<Record<string, boolean>>({});

  const [isOperationTypeDropdownOpen, setIsOperationTypeDropdownOpen] = useState(false);
  const [isClosureReasonDropdownOpen, setIsClosureReasonDropdownOpen] = useState(false);
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);

  // Helper to format price with suffix
  const formatPrice = (price: string | undefined, type: OperationType): string => {
    if (!price) return "";
    // Remove existing € or €/mes
    const clean = price.split("€")[0].trim();
    if (!clean) return "";

    if (type === "Alquiler") {
      return `${clean} €/mes`;
    } else {
      return `${clean} €`;
    }
  };

  const normalizeBulletsOnePerLine = (value: string): string => {
    return value
      .replaceAll("\r\n", "\n")
      .split("\n")
      .map((line) => {
        // Importante: no hacer `trim()` del final, porque si no el usuario no puede
        // escribir espacios (p.ej. el espacio entre palabras se vuelve "trailing"
        // hasta que se escriba el siguiente carácter).
        if (!line.trim()) return "";

        // Si la línea es solo un bullet (con o sin espacios), mantenla como "• "
        if (/^\s*([-*•–—]+)\s*$/.test(line)) return "• ";

        // Si ya trae bullet, lo sustituimos por "• " preservando el resto (incl. espacios finales)
        const bulletMatch = line.match(/^\s*([-*•–—]+)\s*(.*)$/);
        if (bulletMatch) return `• ${bulletMatch[2]}`;

        // Si no trae bullet, lo añadimos (quitando solo espacios iniciales)
        return `• ${line.replace(/^\s+/, "")}`;
      })
      .join("\n");
  };

  const updateFeaturesGhost = (value: string) => {
    const ghost = featuresGhostRef.current;
    if (!ghost) return;

    if (!value.trim()) {
      ghost.style.display = "none";
      return;
    }

    const lines = value.replaceAll("\r\n", "\n").split("\n").length;
    ghost.style.display = "block";
    ghost.style.top = `calc(0.5rem + ${lines} * 1.25rem)`;
  };

  const normalizeFeaturesTextareaInPlace = (el: HTMLTextAreaElement) => {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);

    const normalizedAll = normalizeBulletsOnePerLine(el.value);
    if (normalizedAll === el.value) {
      updateFeaturesGhost(el.value);
      return;
    }

    const normalizedBefore = normalizeBulletsOnePerLine(before);
    el.value = normalizedAll;
    const cursor = normalizedBefore.length;
    el.selectionStart = cursor;
    el.selectionEnd = cursor;
    // Si había selección, la perdemos por simplicidad (normalmente se escribe sin selección).
    // Mantener una selección exacta aquí implica mapear offsets entre strings.
    if (after.length === 0) {
      // no-op
    }
    updateFeaturesGhost(el.value);
  };

  const handleFeaturesKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);

    el.value = normalizeBulletsOnePerLine(`${before}\n• ${after}`);
    updateFeaturesGhost(el.value);

    requestAnimationFrame(() => {
      const target = featuresRef.current;
      if (!target) return;
      const cursor = start + "\n• ".length;
      target.selectionStart = cursor;
      target.selectionEnd = cursor;
    });
  };

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    const el = featuresRef.current;
    if (!el) return;
    // Mantener textarea sincronizado cuando se abre/edita el modal
    el.value = formData.features ?? "";
    updateFeaturesGhost(el.value);
  }, [modalOpen, editingId, formData.features]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedListingSearch(listingSearch), 300);
    return () => clearTimeout(t);
  }, [listingSearch]);

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadListings() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getListings();
      setListings(data);

      try {
        const [conversations, allLeads] = await Promise.all([
          getConversations(),
          getLeads(),
        ]);
        const qualifieds = filterQualifiedLeads(allLeads);
        
        const cCounts: Record<string, number> = {};
        const rCounts: Record<string, number> = {};
        conversations.forEach(conv => {
          if (conv.listingCode) {
            cCounts[conv.listingCode] = (cCounts[conv.listingCode] || 0) + 1;
            const hasUserMessage = conv.history?.some(h => h.role === "user");
            if (hasUserMessage) {
              rCounts[conv.listingCode] = (rCounts[conv.listingCode] || 0) + 1;
            }
          }
        });
        setConversationCounts(cCounts);
        setRespondedCounts(rCounts);

        const qCounts: Record<string, number> = {};
        qualifieds.forEach(qual => {
          if (qual.listingCode) {
            qCounts[qual.listingCode] = (qCounts[qual.listingCode] || 0) + 1;
          }
        });
        setQualifiedCounts(qCounts);
      } catch (err) {
        console.error("Error loading counts:", err);
      }

    } catch (error) {
      console.error("Error loading listings:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      if (errorMessage.includes("timeout")) {
        setLoadError("La carga está tardando demasiado (>60s). Tu conexión con Firebase es muy lenta. Verifica la configuración de tu proyecto en Firebase Console.");
      } else {
        setLoadError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setFormData(emptyFormData);
    setEditingId(null);
    setModalOpen(true);
    setAddressSuggestionOptions([]);
    setShowSuggestions(false);
    setIsSelecting(false);
    setAddressSearchEnabled(false);
  }

  function openEditModal(listing: Listing) {
    setFormData({
      description: listing.description,
      listingCode: listing.listingCode,
      referencia: listing.referencia,
      link: listing.link || "",
      operationType: listing.operationType,
      features: listing.features,
      idealistaDescription: listing.idealistaDescription || "",
    quickQualificationEnabled: listing.quickQualificationEnabled === true,
      price: listing.price || "",
      m2: listing.m2 || "",
      rooms: listing.rooms || "",
      address: listing.address || "",
      street: listing.street || "",
      city: listing.city || "",
      province: listing.province || "",
      postalCode: listing.postalCode || "",
      country: listing.country || "España",
      provinceNormalized: listing.provinceNormalized || "",
      profitabilityReportAvailable: listing.profitabilityReportAvailable,
      profitabilityReport: listing.profitabilityReport,
      agentName: listing.agentName || "",
    });
    setEditingId(listing.id);
    setModalOpen(true);
    setAddressSuggestionOptions([]);
    setShowSuggestions(false);
    setIsSelecting(false);
    setAddressSearchEnabled(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const composed =
        formData.street || formData.city || formData.province || formData.postalCode
          ? composeListingAddress({
              street: formData.street,
              postalCode: formData.postalCode,
              city: formData.city,
              province: formData.province,
              country: formData.country,
            })
          : "";
      const addressLine = composed.trim() || formData.address?.trim() || "";
      const provinceNorm = formData.province ? normalizeForSearch(formData.province) : "";

      const dataToSave = {
        ...formData,
        address: addressLine,
        provinceNormalized: provinceNorm,
        price: formatPrice(formData.price, formData.operationType),
        link: `https://www.idealista.com/inmueble/${formData.listingCode}`,
      };

      if (editingId) {
        await updateListing(editingId, dataToSave);
      } else {
        await createListing(dataToSave);
      }
      setModalOpen(false);
      loadListings();
    } catch (error) {
      console.error("Error saving listing:", error);
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      toast.error("Error al guardar: " + errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteListing(id);
      setDeleteConfirm(null);
      loadListings();
    } catch (error) {
      console.error("Error deleting listing:", error);
      toast.error("Error al eliminar el anuncio");
    }
  }

  async function openDeactivateModal(listing: Listing) {
    setDeactivatingListing(listing);
    setClosureReason("");
    setSelectedQualifiedLead(null);
    setClosureNotes("");
    setDeactivateModalOpen(true);
    setLoadingQualifiedLeads(true);
    try {
      const leads = await getQualifiedLeadsByListingCode(listing.listingCode);
      setQualifiedLeadsForListing(leads);
    } catch (error) {
      console.error("Error loading qualified leads:", error);
      setQualifiedLeadsForListing([]);
    } finally {
      setLoadingQualifiedLeads(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivatingListing || !closureReason) return;
    const requiresLead = closureReason === "sold_to_qualified" || closureReason === "rented_to_qualified";
    if (requiresLead && !selectedQualifiedLead) {
      toast.error("Debes seleccionar el lead cualificado al que se vendió/alquiló");
      return;
    }

    setDeactivating(true);
    try {
      await deactivateListing(
        deactivatingListing.id,
        closureReason,
        selectedQualifiedLead?.id,
        selectedQualifiedLead?.name,
        closureNotes || undefined
      );
      setDeactivateModalOpen(false);
      setDeactivatingListing(null);
      loadListings();
    } catch (error) {
      console.error("Error deactivating listing:", error);
      toast.error("Error al desactivar el anuncio");
    } finally {
      setDeactivating(false);
    }
  }

  async function handleReactivate(id: string) {
    try {
      await reactivateListing(id);
      loadListings();
    } catch (error) {
      console.error("Error reactivating listing:", error);
      toast.error("Error al reactivar el anuncio");
    }
  }

  async function searchAddress(query: string) {
    if (!query || query.length < 3) {
      setAddressSuggestionOptions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      console.log("Searching address for:", query);
      // Forzar idioma español y pedir más candidatos para filtrar mejor España.
      const response = await fetch(
        `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&lang=es&limit=25`
      );
      if (!response.ok) {
        console.error("Photon API error status:", response.status);
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      const options: AddressSuggestionOption[] = [];
      const seen = new Set<string>();
      for (const f of data.features as { properties?: Record<string, string | undefined> }[]) {
        const parsed = parsePhotonFeature(f);
        if (!parsed || seen.has(parsed.label)) continue;
        seen.add(parsed.label);
        options.push(parsed);
      }
      const optionsFromSpain = options.filter((opt) => opt.countryCode === "ES");
      const prioritizedOptions = (optionsFromSpain.length > 0 ? optionsFromSpain : options).slice(0, 10);
      console.log("Found suggestions:", options.length);
      setAddressSuggestionOptions(prioritizedOptions);
      setShowSuggestions(prioritizedOptions.length > 0);
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  // Debounce para la búsqueda de direcciones
  useEffect(() => {
    if (isSelecting) {
      setIsSelecting(false);
      return;
    }

    if (!addressSearchEnabled) {
      return;
    }

    const timer = setTimeout(() => {
      if (formData.address && formData.address.length >= 3) {
        searchAddress(formData.address);
      } else {
        setAddressSuggestionOptions([]);
        setShowSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.address, addressSearchEnabled, isSelecting]);

  const filteredListings = useMemo(() => {
    const q = debouncedListingSearch.trim().toLowerCase();
    let rows = listings.filter((listing) => {
      const isActive = listing.isActive !== false;
      if (filterStatus === "active" && !isActive) return false;
      if (filterStatus === "inactive" && isActive) return false;
      if (filterOperationType !== "all" && listing.operationType !== filterOperationType) return false;
      if (!q) return true;
      const haystack = [
        listing.description,
        listing.listingCode,
        listing.referencia,
        listing.address,
        listing.street,
        listing.city,
        listing.province,
        listing.postalCode,
        listing.agentName,
        listing.features,
        listing.idealistaDescription,
        listing.price,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    if (sortBy === "default") return rows;

    rows = [...rows];
    const code = (l: Listing) => l.listingCode;
    switch (sortBy) {
      case "updated_desc":
        rows.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
        break;
      case "conversations_desc":
        rows.sort(
          (a, b) =>
            (conversationCounts[code(b)] || 0) - (conversationCounts[code(a)] || 0)
        );
        break;
      case "qualified_desc":
        rows.sort(
          (a, b) =>
            (qualifiedCounts[code(b)] || 0) - (qualifiedCounts[code(a)] || 0)
        );
        break;
      case "title_asc":
        rows.sort((a, b) =>
          a.description.localeCompare(b.description, "es", { sensitivity: "base" })
        );
        break;
      default:
        break;
    }
    return rows;
  }, [
    listings,
    filterStatus,
    filterOperationType,
    debouncedListingSearch,
    sortBy,
    conversationCounts,
    qualifiedCounts,
  ]);

  const hasActiveFilters =
    listingSearch.trim() !== "" ||
    filterOperationType !== "all" ||
    filterStatus !== "active" ||
    sortBy !== "default";

  function resetListingFilters() {
    setListingSearch("");
    setDebouncedListingSearch("");
    setFilterOperationType("all");
    setFilterStatus("active");
    setSortBy("default");
  }

  const statusFilterLabel =
    filterStatus === "all" ? "Todos" : filterStatus === "active" ? "Activos" : "Inactivos";

  const sortOptionLabel: Record<ListingSortOption, string> = {
    default: "Orden por defecto",
    updated_desc: "Última actualización",
    conversations_desc: "Más conversaciones",
    qualified_desc: "Más cualificados",
    title_asc: "Título (A–Z)",
  };

  if (loading) {
    return <PageLoading message="Cargando anuncios..." className="h-64" />;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500 text-center">
          <p className="font-semibold mb-2">Error al cargar los anuncios</p>
          <p className="text-sm text-gray-600">{loadError}</p>
        </div>
        <Button onClick={loadListings}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Anuncios"
        subtitle={`Mostrando ${filteredListings.length} de ${listings.length} anuncios`}
        actions={
          <Button size="lg" onClick={openCreateModal} className="flex w-full items-center justify-center gap-2 sm:w-auto">
            <Plus size={20} />
            <span>Nuevo Anuncio</span>
          </Button>
        }
      />

      <FilterCard className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600" />
            <h2 className="font-semibold text-gray-900">Filtros</h2>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetListingFilters}
              className="inline-flex items-center gap-2 rounded-btn border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600"
              title="Restablecer filtros"
            >
              <XCircle size={18} />
              <span className="hidden sm:inline">Restablecer</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por título, ID, referencia, dirección, agente o descripción..."
              value={listingSearch}
              onChange={(e) => setListingSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-100 items-stretch w-full">
            {/* Estado */}
            <div className="relative flex-1 min-w-[160px]">
              <div
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full min-h-[42px]"
                onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-gray-600 shrink-0">Estado:</span>
                  <div className="flex items-center gap-1 justify-end flex-1 min-w-0">
                    <span className="truncate">{statusFilterLabel}</span>
                    <ChevronDown
                      size={14}
                      className={cn("text-gray-400 transition-transform ml-1 shrink-0", isStatusFilterOpen && "rotate-180")}
                    />
                  </div>
                </div>
              </div>
              {isStatusFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsStatusFilterOpen(false)} />
                  <div className="absolute left-0 mt-2 w-full min-w-[200px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    {(
                      [
                        { value: "all" as const, label: "Todos" },
                        { value: "active" as const, label: "Activos" },
                        { value: "inactive" as const, label: "Inactivos" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setFilterStatus(opt.value);
                          setIsStatusFilterOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterStatus === opt.value ? (
                          <CheckSquare size={16} className="text-primary-600 shrink-0" />
                        ) : (
                          <Square size={16} className="text-gray-300 shrink-0" />
                        )}
                        <span className="text-xs text-gray-700 font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Tipo operación */}
            <div className="relative flex-1 min-w-[160px]">
              <div
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full min-h-[42px]"
                onClick={() => setIsListingTipoFilterOpen(!isListingTipoFilterOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-gray-600 shrink-0">Tipo:</span>
                  <div className="flex items-center gap-1 justify-end flex-1">
                    {filterOperationType === "all" ? "Todos" : filterOperationType}
                    <ChevronDown
                      size={14}
                      className={cn("text-gray-400 transition-transform ml-1", isListingTipoFilterOpen && "rotate-180")}
                    />
                  </div>
                </div>
              </div>
              {isListingTipoFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsListingTipoFilterOpen(false)} />
                  <div className="absolute left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    {(
                      [
                        { value: "all" as const, label: "Todos" },
                        { value: "Venta" as OperationType, label: "Venta" },
                        { value: "Alquiler" as OperationType, label: "Alquiler" },
                      ] as const
                    ).map((tipo) => (
                      <button
                        key={tipo.value}
                        type="button"
                        onClick={() => {
                          setFilterOperationType(tipo.value);
                          setIsListingTipoFilterOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {filterOperationType === tipo.value ? (
                          <CheckSquare size={16} className="text-primary-600" />
                        ) : (
                          <Square size={16} className="text-gray-300" />
                        )}
                        <span className="text-xs text-gray-700 font-medium">{tipo.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Orden */}
            <div className="relative flex-1 min-w-[180px]">
              <div
                className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full min-h-[42px]"
                onClick={() => setIsSortFilterOpen(!isSortFilterOpen)}
              >
                <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span className="text-xs font-semibold text-gray-600 shrink-0">Orden:</span>
                  <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                    <span className="truncate text-right">{sortOptionLabel[sortBy]}</span>
                    <ChevronDown
                      size={14}
                      className={cn("text-gray-400 transition-transform ml-1 shrink-0", isSortFilterOpen && "rotate-180")}
                    />
                  </div>
                </div>
              </div>
              {isSortFilterOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSortFilterOpen(false)} />
                  <div className="absolute left-0 mt-2 w-[min(100%,280px)] bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                    {(Object.keys(sortOptionLabel) as ListingSortOption[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSortBy(key);
                          setIsSortFilterOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                      >
                        {sortBy === key ? (
                          <CheckSquare size={16} className="text-primary-600 shrink-0" />
                        ) : (
                          <Square size={16} className="text-gray-300 shrink-0" />
                        )}
                        <span className="text-xs text-gray-700 font-medium">{sortOptionLabel[key]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </FilterCard>

      {listings.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay anuncios</h3>
          <p className="text-gray-500 mb-4">Comienza creando tu primer anuncio</p>
          <Button onClick={openCreateModal}>Crear anuncio</Button>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="card text-center py-12">
          <Search className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ningún anuncio coincide</h3>
          <p className="text-gray-500 mb-4">Prueba a cambiar la búsqueda o los filtros.</p>
          <Button variant="outline" onClick={resetListingFilters}>
            Restablecer filtros
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredListings.map((listing) => {
            const isActive = listing.isActive !== false;
            const convCount = conversationCounts[listing.listingCode] || 0;
            const qualCount = qualifiedCounts[listing.listingCode] || 0;
            const respRate = convCount ? Math.round(((respondedCounts[listing.listingCode] || 0) / convCount) * 100) : 0;
            const qualRate = convCount ? Math.round((qualCount / convCount) * 100) : 0;
            return (
              <div key={listing.id} className={cn("card relative transition-all hover:shadow-md", !isActive && "bg-gray-50/50 border-gray-200")}>
                <div className="p-3 sm:p-4 flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                    {/* Header: Title & Badges */}
                    <div
                      className="flex items-center gap-2 flex-wrap cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => openEditModal(listing)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openEditModal(listing);
                        }
                      }}
                      title="Editar anuncio"
                    >
                      <h3 className={cn("font-bold text-lg leading-tight truncate", isActive ? "text-gray-900" : "text-gray-500")}>
                        {listing.description}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <OperationTypeBadge type={listing.operationType} />
                      </div>
                    </div>

                    {/* Primary Details: Price, Size, ID */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2.5 text-gray-500 font-medium text-xs">
                        <span className="text-sm font-bold text-gray-900">{listing.price || "—"}</span>
                        {listing.m2 && (
                          <>
                            <span className="text-gray-300 w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span>{listing.m2} m²</span>
                          </>
                        )}
                        {listing.rooms && (
                          <>
                            <span className="text-gray-300 w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span>{listing.rooms} hab.</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md text-[11px] font-bold text-gray-600 border border-gray-100 shadow-sm">
                          <span className="text-gray-400 font-medium">Ref</span>
                          <span className="text-gray-700">{listing.referencia || listing.listingCode}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md text-[11px] font-bold text-gray-600 border border-gray-100 shadow-sm">
                          <span className="text-gray-400 font-medium">ID</span>
                          <span className="text-gray-700">{listing.listingCode}</span>
                          <a
                            href={listing.link || `https://www.idealista.com/inmueble/${listing.listingCode}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-gray-400 hover:text-primary-600 transition-colors ml-0.5"
                            onClick={(e) => e.stopPropagation()}
                            title="Ver en Idealista"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Address & Description Toggle */}
                    <div className="flex flex-col gap-1.5">
                      {listing.address && (
                        <div>
                          <button
                            type="button"
                            aria-expanded={!!expandedAddresses[listing.id]}
                            onClick={() => setExpandedAddresses(prev => ({ ...prev, [listing.id]: !prev[listing.id] }))}
                            className="flex items-start gap-1 text-xs text-gray-500/80 hover:text-gray-700 transition-colors cursor-pointer"
                          >
                            <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className={expandedAddresses[listing.id] ? "" : "truncate"}>{listing.address}</span>
                          </button>
                        </div>
                      )}

                      {listing.idealistaDescription && (
                        <div className="mt-0.5">
                          <button
                            type="button"
                            aria-expanded={!!expandedDescriptions[listing.id]}
                            onClick={() => setExpandedDescriptions(prev => ({ ...prev, [listing.id]: !prev[listing.id] }))}
                            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary-600 font-semibold tracking-tight transition-colors"
                          >
                            {expandedDescriptions[listing.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{expandedDescriptions[listing.id] ? "Ocultar descripción" : "Mostrar descripción"}</span>
                            <span className="text-gray-400 font-normal">(Idealista)</span>
                          </button>
                          {expandedDescriptions[listing.id] && (
                            <div className="mt-1.5 pl-3 border-l-2 border-primary-50">
                              <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap">
                                {listing.idealistaDescription}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Closure info (inactive only) */}
                    {!isActive && listing.closureInfo && (
                      <div className={cn(qualificationStatusClasses.rejected, "mt-1 inline-flex flex-wrap items-center gap-x-1 self-start max-w-full text-left")}>
                        {closureReasonLabels[listing.closureInfo.reason]}
                        {listing.closureInfo.qualifiedLeadName && <> · {listing.closureInfo.qualifiedLeadName}</>}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Metrics & Actions */}
                  <div className="flex flex-col justify-end gap-2 md:items-end">
                    {/* Metrics Grid */}
                    <div className="flex items-center justify-center sm:justify-end w-full md:w-auto border-t border-gray-100 mt-2 pt-3 sm:border-0 sm:mt-0 sm:pt-0 gap-3 sm:gap-6 md:pr-4">
                      
                      {/* Counts Group */}
                      <div className="flex gap-5 sm:gap-6">
                        <div className="flex flex-col items-center md:items-end min-w-fit" title="Conversaciones">
                          <div className="flex items-baseline gap-1.5">
                            <MessageSquare size={20} className={metricTheme.conversations.listIcon} />
                            <span className={cn("text-xl font-bold tracking-tight", metricTheme.conversations.listValue)}>{convCount}</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 tracking-wide">Conversaciones</span>
                        </div>
                        <div className="flex flex-col items-center md:items-end min-w-fit" title="Cualificados">
                          <div className="flex items-baseline gap-1.5">
                            <CheckCircle size={20} className={metricTheme.qualified.iconSoft} />
                            <span className={cn("text-xl font-bold tracking-tight", metricTheme.qualified.value)}>{qualCount}</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 tracking-wide">Cualificados</span>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-10 bg-gray-200/80 mx-1"></div>

                      {/* Percentages Group */}
                      <div className="flex gap-5 sm:gap-6">
                        <div className="flex flex-col items-center md:items-end min-w-fit" title="% Respuesta">
                          <div className="flex items-baseline gap-1">
                            <div className="flex items-center">
                              <MessageSquare size={20} className={metricTheme.responded.iconSoft} />
                              <span className={cn("text-[10px] font-semibold ml-0.5", metricTheme.responded.value)}>%</span>
                            </div>
                            <span className={cn("text-xl font-bold tracking-tight ml-1", metricTheme.responded.value)}>{respRate}%</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 tracking-wide">% Respuesta</span>
                        </div>
                        <div className="flex flex-col items-center md:items-end min-w-fit" title="% Cualificación">
                          <div className="flex items-baseline gap-1">
                            <div className="flex items-center">
                              <CheckCircle size={20} className={metricTheme.qualificationRate.iconSoft} />
                              <span className={cn("text-[10px] font-semibold ml-0.5", metricTheme.qualificationRate.value)}>%</span>
                            </div>
                            <span className={cn("text-xl font-bold tracking-tight ml-1", metricTheme.qualificationRate.value)}>{qualRate}%</span>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 tracking-wide">% Cualificación</span>
                        </div>
                      </div>

                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t border-gray-50/50 md:border-0 pt-2 mt-1 sm:mt-2">
                      <div className="flex items-center gap-1.5 mr-2">
                        {isActive ? (
                          <button onClick={(e) => { e.stopPropagation(); openDeactivateModal(listing); }} className="p-2 text-gray-400 hover:text-primary-600 rounded-btn hover:bg-primary-50 transition-all active:scale-90" title="Desactivar"><PowerOff size={18} /></button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleReactivate(listing.id); }} className="p-2 text-gray-400 hover:text-emerald-600 rounded-btn hover:bg-emerald-50 transition-all active:scale-90" title="Reactivar"><Power size={18} /></button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(listing); }} className="p-2 text-gray-400 hover:text-primary-600 rounded-btn hover:bg-primary-50 transition-all active:scale-90" title="Editar"><Edit size={18} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(listing.id); }} className="p-2 text-gray-400 hover:text-red-500 rounded-btn hover:bg-red-50 transition-all active:scale-90" title="Eliminar"><Trash2 size={18} /></button>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <Button
                          variant="outline"
                          size="lg"
                          type="button"
                          onClick={() =>
                            navigate(
                              `/leads?status=non_qualified_all&ad=${encodeURIComponent(listing.listingCode)}`
                            )
                          }
                          className="font-bold active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200"
                        >
                          <Users size={18} className="text-gray-500" />
                          <span>No cualificados</span>
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          variant="success"
                          onClick={() =>
                            navigate(
                              `/leads?status=qualified&ad=${encodeURIComponent(listing.listingCode)}`
                            )
                          }
                          className="font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <span>Cualificados</span>
                          <ChevronRight size={20} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">{editingId ? "Editar Anuncio" : "Nuevo Anuncio"}</h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identificador Anuncio</label>
                <input type="text" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" placeholder="Ej: Piso 2 habitaciones en Fuengirola" />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
                <div className="min-w-0">
                  <label htmlFor="quickQualificationEnabled" className="text-sm font-medium text-gray-800">
                    Cualificación rápida
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Si está activado, cuando entre un interesado por este anuncio se notificará al agente y el asistente hará handoff sin cualificar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.quickQualificationEnabled === true}
                  onClick={() => setFormData((prev) => ({ ...prev, quickQualificationEnabled: prev.quickQualificationEnabled !== true }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
                    formData.quickQualificationEnabled === true ? "bg-primary-600" : "bg-gray-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                      formData.quickQualificationEnabled === true ? "translate-x-5" : "translate-x-1"
                    )}
                  />
                  <span className="sr-only">Activar cualificación rápida</span>
                </button>
                <input
                  type="checkbox"
                  id="quickQualificationEnabled"
                  checked={formData.quickQualificationEnabled === true}
                  onChange={(e) => setFormData({ ...formData, quickQualificationEnabled: e.target.checked })}
                  className="sr-only"
                  tabIndex={-1}
                />
              </div>

              {/* Campo de Dirección con Autocompletado */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección exacta</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                    }}
                    onClick={() => {
                      setAddressSearchEnabled(true);
                    }}
                    className="input !pl-10"
                    placeholder="Calle, número, ciudad..."
                    autoComplete="off"
                  />
                  {loadingSuggestions && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    </div>
                  )}
                </div>

                {showSuggestions && addressSuggestionOptions.length > 0 && (
                  <div ref={suggestionsRef} className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto py-1">
                    {addressSuggestionOptions.map((opt, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setIsSelecting(true);
                          setFormData({
                            ...formData,
                            address: opt.label,
                            street: opt.street,
                            city: opt.city,
                            province: opt.province,
                            postalCode: opt.postalCode,
                            country: opt.country,
                            provinceNormalized: opt.province ? normalizeForSearch(opt.province) : "",
                          });
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
                      >
                        <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-500 -mt-2">
                Busca y elige una sugerencia para rellenar calle, ciudad, provincia y CP; puedes editarlos abajo.
              </p>

              <details className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                <summary className="cursor-pointer select-none text-xs font-semibold text-gray-600">
                  Detalles de dirección (opcional)
                  <span className="ml-2 font-normal text-gray-400">Calle, ciudad, provincia, CP…</span>
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Calle y número</label>
                    <input
                      type="text"
                      value={formData.street || ""}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="input !text-xs !py-2 !bg-white/90"
                      placeholder="Ej: Calle Mayor 4"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Ciudad / municipio</label>
                    <input
                      type="text"
                      value={formData.city || ""}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="input !text-xs !py-2 !bg-white/90"
                      placeholder="Ej: Madrid"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Provincia</label>
                    <input
                      type="text"
                      value={formData.province || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          province: e.target.value,
                          provinceNormalized: e.target.value ? normalizeForSearch(e.target.value) : "",
                        })
                      }
                      className="input !text-xs !py-2 !bg-white/90"
                      placeholder="Ej: Madrid"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Código postal</label>
                    <input
                      type="text"
                      value={formData.postalCode || ""}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="input !text-xs !py-2 !bg-white/90"
                      placeholder="Ej: 28013"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">País</label>
                    <input
                      type="text"
                      value={formData.country || ""}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="input !text-xs !py-2 !bg-white/90"
                      placeholder="España"
                    />
                  </div>
                </div>
              </details>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID Idealista</label>
                  <input type="text" required value={formData.listingCode} onChange={(e) => setFormData({ ...formData, listingCode: e.target.value })} className="input" placeholder="Ej: 110595991" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                  <input 
                    type="text" 
                    required
                    value={formData.referencia} 
                    onChange={(e) => setFormData({ ...formData, referencia: e.target.value })} 
                    className="input" 
                    placeholder="Mismo que ID si no tienen CRM" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Agente</label>
                  <input type="text" required value={formData.agentName} onChange={(e) => setFormData({ ...formData, agentName: e.target.value })} className="input" placeholder="Ej: Paco" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operación</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsOperationTypeDropdownOpen(!isOperationTypeDropdownOpen)}
                      className={cn(
                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                        isOperationTypeDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                      )}
                    >
                      <span>{formData.operationType}</span>
                      <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isOperationTypeDropdownOpen && "rotate-180")} />
                    </button>
                    {isOperationTypeDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOperationTypeDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                          {["Venta", "Alquiler"].map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                const newType = type as OperationType;
                                setFormData({
                                  ...formData,
                                  operationType: newType,
                                  price: formData.price ? formatPrice(formData.price, newType) : ""
                                });
                                setIsOperationTypeDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                            >
                              {formData.operationType === type ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                              <span className="text-sm text-gray-700 font-medium">{type}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones a aceptar</label>
                <div className="relative">
                  <div
                    ref={featuresGhostRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 right-0 text-sm leading-5 text-gray-300"
                    style={{
                      display: "none",
                      top: "0.5rem",
                      paddingLeft: "0.75rem",
                      paddingRight: "0.75rem",
                    }}
                  >
                    •
                  </div>
                  <textarea
                    ref={featuresRef}
                    onKeyDown={handleFeaturesKeyDown}
                    onInput={(e) => normalizeFeaturesTextareaInPlace(e.currentTarget)}
                    onBlur={(e) => {
                      // Leer el valor aquí: si se usa e.currentTarget dentro del updater de setState,
                      // React puede ejecutarlo cuando el evento ya está reseteado (currentTarget === null).
                      const raw = e.currentTarget?.value ?? "";
                      setFormData((prev) => ({ ...prev, features: normalizeBulletsOnePerLine(raw) }));
                    }}
                    className="input min-h-[100px] text-sm leading-5"
                    placeholder={"• Entrada a la vivienda de tierra\n• Vivienda ocupada\n• Vivienda de temporada"}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">Una por línea.</p>
              </div>

              {/* Filtros de cualificación (opcionales) */}
              {formData.operationType === "Alquiler" && (
                <div className="border border-blue-100 rounded-lg p-4 bg-blue-50 space-y-3">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Filtros de cualificación (opcionales)</p>
                  <p className="text-xs text-blue-600">Si se rellenan, un agente IA decidirá automáticamente si el lead cumple los criterios antes de notificarte.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ingresos netos mensuales mínimos (€)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.minMonthlyIncome ?? ""}
                        onChange={(e) => setFormData({ ...formData, minMonthlyIncome: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="input"
                        placeholder="Ej: 2000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Máximo número de personas</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.maxPeople ?? ""}
                        onChange={(e) => setFormData({ ...formData, maxPeople: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="input"
                        placeholder="Ej: 3"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.operationType === "Venta" && (
                <div className="border border-blue-100 rounded-lg p-4 bg-blue-50">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Filtros de cualificación (opcionales)</p>
                  <p className="text-xs text-blue-600 mb-3">Si se activa, un agente IA descartará automáticamente leads sin hipoteca concedida ni pago al contado.</p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requireMortgageApproved ?? false}
                      onChange={(e) => setFormData({ ...formData, requireMortgageApproved: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Solo con hipoteca concedida o pago al contado</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    onBlur={() => {
                      if (formData.price) {
                        setFormData({
                          ...formData,
                          price: formatPrice(formData.price, formData.operationType)
                        });
                      }
                    }}
                    className="input"
                    placeholder={formData.operationType === "Venta" ? "Ej: 250.000 €" : "Ej: 965 €/mes"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metros cuadrados (m²)</label>
                  <input type="text" value={formData.m2} onChange={(e) => setFormData({ ...formData, m2: e.target.value })} className="input" placeholder="Ej: 35" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Habitaciones</label>
                  <input type="text" value={formData.rooms} onChange={(e) => setFormData({ ...formData, rooms: e.target.value })} className="input" placeholder="Ej: 1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción de anuncio en Idealista</label>
                <textarea value={formData.idealistaDescription} onChange={(e) => setFormData({ ...formData, idealistaDescription: e.target.value })} className="input min-h-[120px]" placeholder="Pega aquí la descripción completa del anuncio de Idealista..." />
              </div>

              {formData.operationType === "Venta" && (
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="profitabilityReportAvailable" checked={formData.profitabilityReportAvailable} onChange={(e) => setFormData({ ...formData, profitabilityReportAvailable: e.target.checked })} className="w-4 h-4 text-primary-600 rounded border-gray-300" />
                  <label htmlFor="profitabilityReportAvailable" className="text-sm font-medium text-gray-700">Informe de rentabilidad disponible</label>
                </div>
              )}

              {formData.profitabilityReportAvailable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Informe de Rentabilidad</label>
                  <textarea value={formData.profitabilityReport} onChange={(e) => setFormData({ ...formData, profitabilityReport: e.target.value })} className="input min-h-[120px]" placeholder="Incluye aquí el informe de rentabilidad..." />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={saving}>
                  Guardar
                </Button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar anuncio</h3>
            <p className="text-gray-600 mb-6 font-normal">¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => handleDelete(deleteConfirm)}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}

      {deactivateModalOpen && deactivatingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Desactivar Anuncio</h2>
              <p className="text-sm text-gray-500 mt-1 truncate">{deactivatingListing.description}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">¿Por qué se desactiva este anuncio?</label>
                <div className="space-y-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsClosureReasonDropdownOpen(!isClosureReasonDropdownOpen)}
                      className={cn(
                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white text-left",
                        isClosureReasonDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                      )}
                    >
                      <span className="truncate">
                        {closureReason ? closureReasonLabels[closureReason as ListingClosureReason] : "Selecciona una razón..."}
                      </span>
                      <ChevronDown size={16} className={cn("text-gray-400 transition-transform flex-shrink-0 ml-2", isClosureReasonDropdownOpen && "rotate-180")} />
                    </button>
                    {isClosureReasonDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsClosureReasonDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 max-h-[300px] overflow-y-auto">
                          {[
                            ...(deactivatingListing.operationType === "Venta" ? [
                              { value: "sold_to_qualified", label: "Vendido a un lead cualificado" },
                              { value: "sold_to_other", label: "Vendido a otra persona (externa)" }
                            ] : [
                              { value: "rented_to_qualified", label: "Alquilado a un lead cualificado" },
                              { value: "rented_to_other", label: "Alquilado a otra persona (externa)" }
                            ]),
                            { value: "other", label: "Otros motivos" }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                setClosureReason(opt.value as ListingClosureReason);
                                setIsClosureReasonDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                            >
                              {closureReason === opt.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                              <span className="text-xs text-gray-700 font-medium">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {(closureReason === "sold_to_qualified" || closureReason === "rented_to_qualified") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona el lead cualificado</label>
                  {loadingQualifiedLeads ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                  ) : qualifiedLeadsForListing.length === 0 ? (
                    <div className="p-4 bg-yellow-50 text-yellow-700 text-sm rounded-lg">No hay leads cualificados para este anuncio.</div>
                  ) : (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsLeadDropdownOpen(!isLeadDropdownOpen)}
                        className={cn(
                          "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white text-left",
                          isLeadDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                        )}
                      >
                        <span className="truncate">
                          {selectedQualifiedLead
                            ? `${selectedQualifiedLead.name || "Sin nombre"} (${selectedQualifiedLead.phone})`
                            : "Selecciona un lead..."}
                        </span>
                        <ChevronDown size={16} className={cn("text-gray-400 transition-transform flex-shrink-0 ml-2", isLeadDropdownOpen && "rotate-180")} />
                      </button>
                      {isLeadDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsLeadDropdownOpen(false)} />
                          <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 max-h-[250px] overflow-y-auto">
                            {qualifiedLeadsForListing.map(lead => (
                              <button
                                key={lead.id}
                                type="button"
                                onClick={() => {
                                  setSelectedQualifiedLead(lead);
                                  setIsLeadDropdownOpen(false);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                              >
                                {selectedQualifiedLead?.id === lead.id ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                <span className="text-xs text-gray-700 font-medium">{lead.name || "Sin nombre"} ({lead.phone})</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales (opcional)</label>
                <textarea value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} className="input min-h-[80px]" placeholder="Cualquier información adicional..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={() => {
                  setDeactivateModalOpen(false);
                  setDeactivatingListing(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeactivate}
                disabled={
                  !closureReason ||
                  ((closureReason === "sold_to_qualified" || closureReason === "rented_to_qualified") &&
                    !selectedQualifiedLead)
                }
                loading={deactivating}
              >
                Desactivar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Megaphone({ className, size }: { className?: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
