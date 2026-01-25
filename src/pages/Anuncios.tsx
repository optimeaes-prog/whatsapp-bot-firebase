import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, FileText, ExternalLink } from "lucide-react";
import type { Anuncio, AnuncioFormData, TipoOperacion } from "../types";
import { getAnuncios, createAnuncio, updateAnuncio, deleteAnuncio } from "../services/anuncios";
import { cn } from "../lib/utils";

const emptyFormData: AnuncioFormData = {
  descripcion: "",
  anuncio: "",
  enlace: "",
  tipoOperacion: "Venta",
  caracteristicas: "",
  informeRentabilidadDisponible: false,
  informeRentabilidad: "",
};

export function Anuncios() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnuncioFormData>(emptyFormData);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadAnuncios();
  }, []);

  async function loadAnuncios() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAnuncios();
      setAnuncios(data);
    } catch (error) {
      console.error("Error loading anuncios:", error);
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

  function openEditModal(anuncio: Anuncio) {
    setFormData({
      descripcion: anuncio.descripcion,
      anuncio: anuncio.anuncio,
      enlace: anuncio.enlace,
      tipoOperacion: anuncio.tipoOperacion,
      caracteristicas: anuncio.caracteristicas,
      informeRentabilidadDisponible: anuncio.informeRentabilidadDisponible,
      informeRentabilidad: anuncio.informeRentabilidad,
    });
    setEditingId(anuncio.id);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      if (editingId) {
        await updateAnuncio(editingId, formData);
      } else {
        await createAnuncio(formData);
      }
      setModalOpen(false);
      loadAnuncios();
    } catch (error) {
      console.error("Error saving anuncio:", error);
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
      await deleteAnuncio(id);
      setDeleteConfirm(null);
      loadAnuncios();
    } catch (error) {
      console.error("Error deleting anuncio:", error);
      alert("Error al eliminar el anuncio");
    }
  }

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
        <button onClick={loadAnuncios} className="btn-primary">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Anuncios</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Nuevo Anuncio
        </button>
      </div>

      {anuncios.length === 0 ? (
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
          {anuncios.map((anuncio) => (
            <div key={anuncio.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{anuncio.descripcion}</h3>
                    <span
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        anuncio.tipoOperacion === "Venta"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      )}
                    >
                      {anuncio.tipoOperacion}
                    </span>
                    {anuncio.informeRentabilidadDisponible && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                        <FileText size={12} />
                        Informe
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-2">ID: {anuncio.anuncio}</p>
                  <p className="text-sm text-gray-600 line-clamp-2">{anuncio.caracteristicas}</p>
                  {anuncio.enlace && (
                    <a
                      href={anuncio.enlace}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 mt-2"
                    >
                      <ExternalLink size={14} />
                      Ver anuncio
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => openEditModal(anuncio)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(anuncio.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? "Editar Anuncio" : "Nuevo Anuncio"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  required
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="input"
                  placeholder="Ej: Piso 3 habitaciones en el centro"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID del Anuncio
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.anuncio}
                    onChange={(e) => setFormData({ ...formData, anuncio: e.target.value })}
                    className="input"
                    placeholder="Ej: PISO-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Operación
                  </label>
                  <select
                    value={formData.tipoOperacion}
                    onChange={(e) =>
                      setFormData({ ...formData, tipoOperacion: e.target.value as TipoOperacion })
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
                  Enlace del Anuncio
                </label>
                <input
                  type="url"
                  value={formData.enlace}
                  onChange={(e) => setFormData({ ...formData, enlace: e.target.value })}
                  className="input"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Características
                </label>
                <textarea
                  value={formData.caracteristicas}
                  onChange={(e) => setFormData({ ...formData, caracteristicas: e.target.value })}
                  className="input min-h-[100px]"
                  placeholder="3 habitaciones, 2 baños, 90m², terraza..."
                />
              </div>

              {formData.tipoOperacion === "Venta" && (
                <>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="informeDisponible"
                      checked={formData.informeRentabilidadDisponible}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          informeRentabilidadDisponible: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <label htmlFor="informeDisponible" className="text-sm font-medium text-gray-700">
                      Informe de rentabilidad disponible
                    </label>
                  </div>

                  {formData.informeRentabilidadDisponible && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Informe de Rentabilidad
                      </label>
                      <textarea
                        value={formData.informeRentabilidad}
                        onChange={(e) =>
                          setFormData({ ...formData, informeRentabilidad: e.target.value })
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

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setSaveError(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
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
