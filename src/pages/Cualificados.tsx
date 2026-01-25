import { useEffect, useState } from "react";
import { CheckCircle, Phone, User, Search, FileText } from "lucide-react";
import type { Cualificado } from "../types";
import { getCualificados } from "../services/cualificados";
import { formatDate, formatPhone } from "../lib/utils";

export function Cualificados() {
  const [cualificados, setCualificados] = useState<Cualificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCualificado, setSelectedCualificado] = useState<Cualificado | null>(null);

  useEffect(() => {
    loadCualificados();
  }, []);

  async function loadCualificados() {
    try {
      const data = await getCualificados();
      setCualificados(data);
    } catch (error) {
      console.error("Error loading cualificados:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCualificados = cualificados.filter((c) => {
    return (
      c.telefono.includes(search) ||
      c.anuncio.toLowerCase().includes(search.toLowerCase()) ||
      c.nombre.toLowerCase().includes(search.toLowerCase())
    );
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Leads Cualificados</h1>
        <span className="text-sm text-gray-500">{cualificados.length} cualificados</span>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o anuncio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {filteredCualificados.length === 0 ? (
        <div className="card text-center py-12">
          <CheckCircle className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {cualificados.length === 0
              ? "No hay leads cualificados"
              : "No se encontraron resultados"}
          </h3>
          <p className="text-gray-500">
            {cualificados.length === 0
              ? "Los leads cualificados aparecerán aquí cuando completen el proceso"
              : "Intenta con otros términos de búsqueda"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCualificados.map((cualificado) => (
            <div key={cualificado.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <User className="text-green-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {cualificado.nombre || "Sin nombre"}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone size={14} />
                        {formatPhone(cualificado.telefono)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">Anuncio:</span>
                      <span className="ml-2 font-medium text-gray-900">{cualificado.anuncio}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Fecha:</span>
                      <span className="ml-2 text-gray-900">
                        {cualificado.createdAt ? formatDate(cualificado.createdAt.toDate()) : "—"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      setSelectedCualificado(
                        selectedCualificado?.id === cualificado.id ? null : cualificado
                      )
                    }
                    className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <FileText size={16} />
                    {selectedCualificado?.id === cualificado.id
                      ? "Ocultar resumen"
                      : "Ver resumen de cualificación"}
                  </button>

                  {selectedCualificado?.id === cualificado.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Resumen de Cualificación</h4>
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">
                        {cualificado.resumenConversacion}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="ml-4">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1">
                    <CheckCircle size={14} />
                    Cualificado
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
