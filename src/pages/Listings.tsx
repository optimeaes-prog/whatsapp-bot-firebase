import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, FileText, Power, PowerOff, CheckCircle, XCircle, User, Users, MapPin, ExternalLink, MessageCircle } from "lucide-react";
import type { Listing, ListingFormData, OperationType, ListingClosureReason, QualifiedLead } from "../types";
import { getListings, createListing, updateListing, deleteListing, deactivateListing, reactivateListing } from "../services/listings";
import { getConversations } from "../services/conversations";
import { getQualifiedLeadsByListingCode, getQualifiedLeads } from "../services/qualifiedLeads";
import { cn } from "../lib/utils";

const emptyFormData: ListingFormData = {
  description: "",
  listingCode: "",
  link: "", // Se generará automáticamente al guardar
  operationType: "Venta",
  features: "",
  idealistaDescription: "",
  price: "",
  m2: "",
  rooms: "",
  address: "",
  profitabilityReportAvailable: false,
  profitabilityReport: "",
  agentName: "",
};

// Razones de cierre con etiquetas para mostrar
const closureReasonLabels: Record<ListingClosureReason, string> = {
  sold_to_qualified: "Vendido a lead cualificado",
  rented_to_qualified: "Alquilado a lead cualificado",
  sold_to_other: "Vendido a otra persona",
  rented_to_other: "Alquilado a otra persona",
  other: "Otros motivos",
};

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
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Estado para filtro activo/inactivo
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");

  const [conversationCounts, setConversationCounts] = useState<Record<string, number>>({});
  const [qualifiedCounts, setQualifiedCounts] = useState<Record<string, number>>({});

  // Estado para modal de desactivación
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivatingListing, setDeactivatingListing] = useState<Listing | null>(null);
  const [closureReason, setClosureReason] = useState<ListingClosureReason | "">("");
  const [selectedQualifiedLead, setSelectedQualifiedLead] = useState<QualifiedLead | null>(null);
  const [closureNotes, setClosureNotes] = useState("");
  const [qualifiedLeadsForListing, setQualifiedLeadsForListing] = useState<QualifiedLead[]>([]);
  const [loadingQualifiedLeads, setLoadingQualifiedLeads] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Helper to format price with suffix
  const formatPrice = (price: string | undefined, type: OperationType): string => {
    if (!price) return "";
    // Remove existing € or €/mes
    let clean = price.split("€")[0].trim();
    if (!clean) return "";

    if (type === "Alquiler") {
      return `${clean} €/mes`;
    } else {
      return `${clean} €`;
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

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
        const [conversations, qualifieds] = await Promise.all([
          getConversations(),
          getQualifiedLeads()
        ]);
        
        const cCounts: Record<string, number> = {};
        conversations.forEach(conv => {
          if (conv.listingCode) {
            cCounts[conv.listingCode] = (cCounts[conv.listingCode] || 0) + 1;
          }
        });
        setConversationCounts(cCounts);

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
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setIsSelecting(false);
  }

  function openEditModal(listing: Listing) {
    setFormData({
      description: listing.description,
      listingCode: listing.listingCode,
      link: listing.link || "",
      operationType: listing.operationType,
      features: listing.features,
      idealistaDescription: listing.idealistaDescription || "",
      price: listing.price || "",
      m2: listing.m2 || "",
      rooms: listing.rooms || "",
      address: listing.address || "",
      profitabilityReportAvailable: listing.profitabilityReportAvailable,
      profitabilityReport: listing.profitabilityReport,
      agentName: listing.agentName || "",
    });
    setEditingId(listing.id);
    setModalOpen(true);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setIsSelecting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        price: formatPrice(formData.price, formData.operationType),
        link: `https://www.idealista.com/inmueble/${formData.listingCode}`
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
      alert("Error al guardar: " + errorMessage);
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
      alert("Error al eliminar el anuncio");
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
      alert("Debes seleccionar el lead cualificado al que se vendió/alquiló");
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
      alert("Error al desactivar el anuncio");
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
      alert("Error al reactivar el anuncio");
    }
  }

  async function searchAddress(query: string) {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      console.log("Searching address for:", query);
      // Remove trailing slash and lang param which might cause 400
      const response = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=10`);
      if (!response.ok) {
        console.error("Photon API error status:", response.status);
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      const suggestions = data.features
        .filter((f: any) => f.properties.city || f.properties.state) // Filter out very vague results
        .map((f: any) => {
          const { name, street, housenumber, city, postcode, state } = f.properties;

          // Construir dirección amigable
          const main = name || street;
          const detail = [housenumber, city, postcode, state].filter(Boolean).join(", ");

          return detail ? `${main}, ${detail}` : main;
        });

      const uniqueSuggestions = Array.from(new Set(suggestions as string[]));
      console.log("Found suggestions:", uniqueSuggestions.length);
      setAddressSuggestions(uniqueSuggestions);
      setShowSuggestions(uniqueSuggestions.length > 0);
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

    const timer = setTimeout(() => {
      if (formData.address && formData.address.length >= 3) {
        searchAddress(formData.address);
      } else {
        setAddressSuggestions([]);
        setShowSuggestions(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.address]);

  const filteredListings = listings.filter(listing => {
    const isActive = listing.isActive !== false;
    if (filterStatus === "active") return isActive;
    if (filterStatus === "inactive") return !isActive;
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="text-gray-500">Cargando anuncios...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-red-500 text-center">
          <p className="font-semibold mb-2">Error al cargar los anuncios</p>
          <p className="text-sm text-gray-600">{loadError}</p>
        </div>
        <button onClick={loadListings} className="btn-primary">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Anuncios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mostrando {filteredListings.length} de {listings.length} anuncios
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto">
          <Plus size={20} />
          <span>Nuevo Anuncio</span>
        </button>
      </div>

      <div className="card mb-6 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600">Filtrar por estado:</span>
          <button
            onClick={() => setFilterStatus("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm transition-colors",
              filterStatus === "all" ? "bg-primary-100 text-primary-700 font-medium" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors",
              filterStatus === "active" ? "bg-green-100 text-green-700 font-medium" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <CheckCircle size={14} />
            Activos
          </button>
          <button
            onClick={() => setFilterStatus("inactive")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors",
              filterStatus === "inactive" ? "bg-red-100 text-red-700 font-medium" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <XCircle size={14} />
            Inactivos
          </button>
        </div>
      </div>

      {filteredListings.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay anuncios</h3>
          <p className="text-gray-500 mb-4">Comienza creando tu primer anuncio</p>
          <button onClick={openCreateModal} className="btn-primary">
            Crear anuncio
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredListings.map((listing) => {
            const isActive = listing.isActive !== false;
            return (
              <div key={listing.id} className={cn("card p-4 sm:p-6", !isActive && "bg-gray-50 border-gray-300")}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className={cn("font-semibold text-sm sm:text-base", isActive ? "text-gray-900" : "text-gray-500")}>
                        {listing.description}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1", isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                        {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                      <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full", listing.operationType === "Venta" ? "bg-primary-100 text-primary-700" : "bg-green-100 text-green-700")}>
                        {listing.operationType}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                        <MessageCircle size={12} />
                        {conversationCounts[listing.listingCode] || 0} {(conversationCounts[listing.listingCode] === 1) ? "conversación" : "conversaciones"}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Users size={12} />
                        {qualifiedCounts[listing.listingCode] || 0} {(qualifiedCounts[listing.listingCode] === 1) ? "cualificado" : "cualificados"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                      <div>
                        <span className="text-gray-500 block text-xs mb-0.5">Precio</span>
                        <span className="font-semibold text-gray-900">{listing.price || "N/A"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs mb-0.5">Distribución</span>
                        <span className="font-medium text-gray-800">
                          {[listing.m2 && `${listing.m2} m²`, listing.rooms && `${listing.rooms} hab.`].filter(Boolean).join(" • ") || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-xs mb-0.5">ID Anuncio</span>
                        <div className="font-medium text-gray-800 flex items-center gap-1">
                          {listing.listingCode}
                          <a
                            href={listing.link || `https://www.idealista.com/inmueble/${listing.listingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 transition-colors hover:bg-primary-50 rounded p-0.5"
                            title="Ver en Idealista"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                      {listing.address && (
                        <div className="col-span-2 sm:col-span-4 border-t border-gray-200/60 pt-2 mt-1">
                          <span className="text-gray-500 block text-xs mb-0.5">Dirección</span>
                          <span className="font-medium text-gray-800 flex items-start gap-1">
                            <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-500" />
                            <span>{listing.address}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {listing.idealistaDescription && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1">
                          <FileText size={12} />
                          <span>Descripción Idealista</span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-3">
                          {listing.idealistaDescription}
                        </p>
                      </div>
                    )}

                    {!isActive && listing.closureInfo && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm">
                          <p className="font-medium text-gray-700">Razón de cierre: {closureReasonLabels[listing.closureInfo.reason]}</p>
                          {listing.closureInfo.qualifiedLeadName && <p className="text-gray-600 flex items-center gap-1 mt-1"><User size={14} /> Lead: {listing.closureInfo.qualifiedLeadName}</p>}
                          {listing.closureInfo.notes && <p className="text-gray-500 mt-1">Notas: {listing.closureInfo.notes}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mt-4 sm:mt-0 justify-end">
                    <button
                      onClick={() => navigate(`/cualificados?ad=${listing.listingCode}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-sm font-medium transition-colors mr-1 sm:mr-3"
                      title="Ver cualificados"
                    >
                      <Users size={16} />
                      <span className="whitespace-nowrap">Ver cualificados</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {isActive ? (
                        <button onClick={() => openDeactivateModal(listing)} className="p-2 text-gray-400 hover:text-orange-600" title="Desactivar anuncio"><PowerOff size={18} /></button>
                      ) : (
                        <button onClick={() => handleReactivate(listing.id)} className="p-2 text-gray-400 hover:text-green-600" title="Reactivar anuncio"><Power size={18} /></button>
                      )}
                      <button onClick={() => openEditModal(listing)} className="p-2 text-gray-400 hover:text-primary-600" title="Editar anuncio"><Edit size={18} /></button>
                      <button onClick={() => setDeleteConfirm(listing.id)} className="p-2 text-gray-400 hover:text-red-600" title="Eliminar anuncio"><Trash2 size={18} /></button>
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">{editingId ? "Editar Anuncio" : "Nuevo Anuncio"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre anuncio</label>
                <input type="text" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" placeholder="Ej: Piso 2 habitaciones en Fuengirola" />
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
                    onFocus={() => {
                      if (addressSuggestions.length > 0) setShowSuggestions(true);
                      else if (formData.address && formData.address.length >= 3) searchAddress(formData.address);
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

                {showSuggestions && addressSuggestions.length > 0 && (
                  <div ref={suggestionsRef} className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto py-1">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setIsSelecting(true);
                          setFormData({ ...formData, address: suggestion });
                          setShowSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-start gap-2 border-b border-gray-50 last:border-0"
                      >
                        <MapPin size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID del Anuncio en Idealista</label>
                  <input type="text" required value={formData.listingCode} onChange={(e) => setFormData({ ...formData, listingCode: e.target.value })} className="input" placeholder="Ej: 110595991" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Agente</label>
                  <input type="text" required value={formData.agentName} onChange={(e) => setFormData({ ...formData, agentName: e.target.value })} className="input" placeholder="Ej: Paco" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operación</label>
                  <select
                    value={formData.operationType}
                    onChange={(e) => {
                      const newType = e.target.value as OperationType;
                      setFormData({
                        ...formData,
                        operationType: newType,
                        price: formData.price ? formatPrice(formData.price, newType) : ""
                      });
                    }}
                    className="input"
                  >
                    <option value="Venta">Venta</option>
                    <option value="Alquiler">Alquiler</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Características importantes (una por línea)</label>
                <textarea value={formData.features} onChange={(e) => setFormData({ ...formData, features: e.target.value })} className="input min-h-[100px]" placeholder={"- Entrada a la vivienda de tierra\n- Vivienda ocupada\n- Vivienda de temporada"} />
              </div>
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
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar anuncio</h3>
            <p className="text-gray-600 mb-6 font-normal">¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">Eliminar</button>
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
                  <select value={closureReason} onChange={(e) => setClosureReason(e.target.value as ListingClosureReason)} className="input">
                    <option value="">Selecciona una razón...</option>
                    {deactivatingListing.operationType === "Venta" ? (
                      <>
                        <option value="sold_to_qualified">Vendido a un lead cualificado</option>
                        <option value="sold_to_other">Vendido a otra persona (externa)</option>
                      </>
                    ) : (
                      <>
                        <option value="rented_to_qualified">Alquilado a un lead cualificado</option>
                        <option value="rented_to_other">Alquilado a otra persona (externa)</option>
                      </>
                    )}
                    <option value="other">Otros motivos</option>
                  </select>
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
                    <select className="input" onChange={(e) => setSelectedQualifiedLead(qualifiedLeadsForListing.find(l => l.id === e.target.value) || null)}>
                      <option value="">Selecciona un lead...</option>
                      {qualifiedLeadsForListing.map(lead => (
                        <option key={lead.id} value={lead.id}>{lead.name} ({lead.phone})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas adicionales (opcional)</label>
                <textarea value={closureNotes} onChange={(e) => setClosureNotes(e.target.value)} className="input min-h-[80px]" placeholder="Cualquier información adicional..." />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button onClick={() => { setDeactivateModalOpen(false); setDeactivatingListing(null); }} className="btn-secondary">Cancelar</button>
              <button
                onClick={handleDeactivate}
                disabled={!closureReason || deactivating || ((closureReason === "sold_to_qualified" || closureReason === "rented_to_qualified") && !selectedQualifiedLead)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {deactivating ? "Desactivando..." : "Desactivar"}
              </button>
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
