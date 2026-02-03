import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, FileText, ExternalLink, Power, PowerOff, CheckCircle, XCircle, User } from "lucide-react";
import type { Listing, ListingFormData, OperationType, ListingClosureReason, QualifiedLead } from "../types";
import { getListings, createListing, updateListing, deleteListing, deactivateListing, reactivateListing } from "../services/listings";
import { getQualifiedLeadsByListingCode } from "../services/qualifiedLeads";
import { cn, formatDate } from "../lib/utils";

const emptyFormData: ListingFormData = {
  description: "",
  listingCode: "",
  link: "", // Se generará automáticamente al guardar
  operationType: "Venta",
  features: "",
  profitabilityReportAvailable: false,
  profitabilityReport: "",
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
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ListingFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  // Estado para filtro activo/inactivo
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  
  // Estado para modal de desactivación
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [deactivatingListing, setDeactivatingListing] = useState<Listing | null>(null);
  const [closureReason, setClosureReason] = useState<ListingClosureReason | "">("");
  const [selectedQualifiedLead, setSelectedQualifiedLead] = useState<QualifiedLead | null>(null);
  const [closureNotes, setClosureNotes] = useState("");
  const [qualifiedLeadsForListing, setQualifiedLeadsForListing] = useState<QualifiedLead[]>([]);
  const [loadingQualifiedLeads, setLoadingQualifiedLeads] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    loadListings();
  }, []);

  async function loadListings() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getListings();
      setListings(data);
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
  }

  function openEditModal(listing: Listing) {
    setFormData({
      description: listing.description,
      listingCode: listing.listingCode,
      link: "", // Se regenerará automáticamente al guardar
      operationType: listing.operationType,
      features: listing.features,
      profitabilityReportAvailable: listing.profitabilityReportAvailable,
      profitabilityReport: listing.profitabilityReport,
    });
    setEditingId(listing.id);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      // Auto-generar el enlace del anuncio a partir del listingCode
      const dataToSave = {
        ...formData,
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
      if (errorMessage.includes("timeout")) {
        setSaveError("El guardado está tardando demasiado. Tu conexión con Firebase es muy lenta. Por favor verifica la consola de Firebase.");
      } else {
        setSaveError("Error al guardar: " + errorMessage);
      }
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

  // Abrir modal de desactivación
  async function openDeactivateModal(listing: Listing) {
    setDeactivatingListing(listing);
    setClosureReason("");
    setSelectedQualifiedLead(null);
    setClosureNotes("");
    setDeactivateModalOpen(true);
    
    // Cargar leads cualificados de este anuncio
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

  // Procesar desactivación
  async function handleDeactivate() {
    if (!deactivatingListing || !closureReason) return;
    
    // Validar que se haya seleccionado un lead si la razón lo requiere
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

  // Reactivar un anuncio
  async function handleReactivate(id: string) {
    try {
      await reactivateListing(id);
      loadListings();
    } catch (error) {
      console.error("Error reactivating listing:", error);
      alert("Error al reactivar el anuncio");
    }
  }

  // Filtrar listings según el filtro de estado
  const filteredListings = listings.filter(listing => {
    const isActive = listing.isActive !== false; // compatibilidad con listings sin el campo
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

      {/* Filtro de estado */}
      <div className="card mb-6 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600">Filtrar por estado:</span>
          <button
            onClick={() => setFilterStatus("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm transition-colors",
              filterStatus === "all"
                ? "bg-primary-100 text-primary-700 font-medium"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors",
              filterStatus === "active"
                ? "bg-green-100 text-green-700 font-medium"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <CheckCircle size={14} />
            Activos
          </button>
          <button
            onClick={() => setFilterStatus("inactive")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors",
              filterStatus === "inactive"
                ? "bg-red-100 text-red-700 font-medium"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                    {/* Badges */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1",
                          isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}
                      >
                        {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {isActive ? "Activo" : "Inactivo"}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded-full",
                          listing.operationType === "Venta"
                            ? "bg-primary-100 text-primary-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {listing.operationType}
                      </span>
                      {listing.profitabilityReportAvailable && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                          <FileText size={12} />
                          Informe
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">ID: {listing.listingCode}</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {listing.features.split('\n').filter(line => line.trim()).slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary-500 mt-0.5">•</span>
                          <span>{feature.replace(/^[\u2022•*-]+\s*/u, '').trim()}</span>
                        </li>
                      ))}
                      {listing.features.split('\n').filter(line => line.trim()).length > 3 && (
                        <li className="text-gray-400 text-xs pl-4">
                          +{listing.features.split('\n').filter(line => line.trim()).length - 3} más...
                        </li>
                      )}
                    </ul>
                    {listing.link && (
                      <a
                        href={listing.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                      >
                        <ExternalLink size={14} />
                        Ver anuncio
                      </a>
                    )}
                    
                    {/* Info de cierre si está inactivo */}
                    {!isActive && listing.closureInfo && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm">
                          <p className="font-medium text-gray-700">
                            Razón de cierre: {closureReasonLabels[listing.closureInfo.reason]}
                          </p>
                          {listing.closureInfo.qualifiedLeadName && (
                            <p className="text-gray-600 flex items-center gap-1 mt-1">
                              <User size={14} />
                              Lead: {listing.closureInfo.qualifiedLeadName}
                            </p>
                          )}
                          {listing.closureInfo.notes && (
                            <p className="text-gray-500 mt-1">Notas: {listing.closureInfo.notes}</p>
                          )}
                          <p className="text-gray-400 text-xs mt-1">
                            Cerrado: {listing.closureInfo.closedAt ? formatDate(listing.closureInfo.closedAt.toDate()) : "—"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 sm:gap-2 sm:ml-4 border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                    {/* Botón de activar/desactivar */}
                    {isActive ? (
                      <button
                        onClick={() => openDeactivateModal(listing)}
                        className="p-2.5 sm:p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Desactivar anuncio"
                      >
                        <PowerOff size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(listing.id)}
                        className="p-2.5 sm:p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Reactivar anuncio"
                      >
                        <Power size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(listing)}
                      className="p-2.5 sm:p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(listing.id)}
                      className="p-2.5 sm:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {editingId ? "Editar Anuncio" : "Nuevo Anuncio"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="Ej: Piso 2 habitaciones en Fuengirola"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID del Anuncio en Idealista
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.listingCode}
                    onChange={(e) => setFormData({ ...formData, listingCode: e.target.value })}
                    className="input"
                    placeholder="Ej: 109766872"
                  />
                  <p className="mt-1 text-xs text-gray-500 break-all">
                    El enlace se generará automáticamente
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Operación
                  </label>
                  <select
                    value={formData.operationType}
                    onChange={(e) =>
                      setFormData({ ...formData, operationType: e.target.value as OperationType })
                    }
                    className="input"
                  >
                    <option value="Venta">Venta</option>
                    <option value="Alquiler">Alquiler</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Características (una por línea)
                </label>
                <textarea
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  className="input min-h-[120px] font-mono text-sm"
                  placeholder={"3 habitaciones\n2 baños\n90m²\nTerraza\nOrientación sur"}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Cada línea se mostrará como un punto en el mensaje al cliente.
                </p>
                {formData.features && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-2">Vista previa:</p>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {formData.features.split('\n').filter(line => line.trim()).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary-500">•</span>
                          <span>{feature.replace(/^[\u2022•*-]+\s*/u, '').trim()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {formData.operationType === "Venta" && (
                <>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="profitabilityReportAvailable"
                      checked={formData.profitabilityReportAvailable}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          profitabilityReportAvailable: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <label htmlFor="profitabilityReportAvailable" className="text-sm font-medium text-gray-700">
                      Informe de rentabilidad disponible
                    </label>
                  </div>

                  {formData.profitabilityReportAvailable && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Informe de Rentabilidad
                      </label>
                      <textarea
                        value={formData.profitabilityReport}
                        onChange={(e) =>
                          setFormData({ ...formData, profitabilityReport: e.target.value })
                        }
                        className="input min-h-[150px]"
                        placeholder="Incluye aquí el informe de rentabilidad que se enviará al cliente..."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Este texto se enviará tal cual al cliente cuando muestre interés en la
                        rentabilidad del inmueble.
                      </p>
                    </div>
                  )}
                </>
              )}

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {saveError}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setSaveError(null);
                  }}
                  className="btn-secondary w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50 w-full sm:w-auto">
                  {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear anuncio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Eliminar anuncio</h3>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar este anuncio? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de desactivación */}
      {deactivateModalOpen && deactivatingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Desactivar Anuncio</h2>
              <p className="text-sm text-gray-500 mt-1 truncate">
                {deactivatingListing.description} ({deactivatingListing.listingCode})
              </p>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              {/* Razón de cierre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Por qué se desactiva este anuncio?
                </label>
                <div className="space-y-2">
                  {deactivatingListing.operationType === "Venta" ? (
                    <>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="closureReason"
                          value="sold_to_qualified"
                          checked={closureReason === "sold_to_qualified"}
                          onChange={() => setClosureReason("sold_to_qualified")}
                          className="text-primary-600"
                        />
                        <span className="text-sm">Vendido a un lead cualificado</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="closureReason"
                          value="sold_to_other"
                          checked={closureReason === "sold_to_other"}
                          onChange={() => {
                            setClosureReason("sold_to_other");
                            setSelectedQualifiedLead(null);
                          }}
                          className="text-primary-600"
                        />
                        <span className="text-sm">Vendido a otra persona (externa)</span>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="closureReason"
                          value="rented_to_qualified"
                          checked={closureReason === "rented_to_qualified"}
                          onChange={() => setClosureReason("rented_to_qualified")}
                          className="text-primary-600"
                        />
                        <span className="text-sm">Alquilado a un lead cualificado</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input
                          type="radio"
                          name="closureReason"
                          value="rented_to_other"
                          checked={closureReason === "rented_to_other"}
                          onChange={() => {
                            setClosureReason("rented_to_other");
                            setSelectedQualifiedLead(null);
                          }}
                          className="text-primary-600"
                        />
                        <span className="text-sm">Alquilado a otra persona (externa)</span>
                      </label>
                    </>
                  )}
                  <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="closureReason"
                      value="other"
                      checked={closureReason === "other"}
                      onChange={() => {
                        setClosureReason("other");
                        setSelectedQualifiedLead(null);
                      }}
                      className="text-primary-600"
                    />
                    <span className="text-sm">Otros motivos</span>
                  </label>
                </div>
              </div>

              {/* Selector de lead cualificado */}
              {(closureReason === "sold_to_qualified" || closureReason === "rented_to_qualified") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecciona el lead cualificado
                  </label>
                  {loadingQualifiedLeads ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  ) : qualifiedLeadsForListing.length === 0 ? (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-700">
                        No hay leads cualificados para este anuncio. Puedes seleccionar otra razón de cierre.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {qualifiedLeadsForListing.map((lead) => (
                        <label
                          key={lead.id}
                          className={cn(
                            "flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50",
                            selectedQualifiedLead?.id === lead.id && "border-primary-500 bg-primary-50"
                          )}
                        >
                          <input
                            type="radio"
                            name="qualifiedLead"
                            checked={selectedQualifiedLead?.id === lead.id}
                            onChange={() => setSelectedQualifiedLead(lead)}
                            className="text-primary-600"
                          />
                          <div>
                            <p className="font-medium text-gray-900">{lead.name}</p>
                            <p className="text-sm text-gray-500">{lead.phone}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notas adicionales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Cualquier información adicional sobre el cierre..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 p-4 sm:p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setDeactivateModalOpen(false);
                  setDeactivatingListing(null);
                }}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeactivate}
                disabled={!closureReason || deactivating || 
                  ((closureReason === "sold_to_qualified" || closureReason === "rented_to_qualified") && !selectedQualifiedLead)}
                className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
