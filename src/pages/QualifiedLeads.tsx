import { useEffect, useState } from "react";
import { CheckCircle, User, Phone, FileText, Clock, Search, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import type { QualifiedLead } from "../types";
import { getQualifiedLeads } from "../services/qualifiedLeads";
import { formatDate, formatPhone, cn } from "../lib/utils";

type SortField = "name" | "createdAt" | "listingCode";
type SortDirection = "asc" | "desc";

export function QualifiedLeads() {
  const [qualifiedLeads, setQualifiedLeads] = useState<QualifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"all" | "Venta" | "Alquiler">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadQualifiedLeads();
  }, []);

  async function loadQualifiedLeads() {
    try {
      const data = await getQualifiedLeads();
      setQualifiedLeads(data);
    } catch (error) {
      console.error("Error loading qualified leads:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredAndSortedLeads = qualifiedLeads
    .filter((lead) => {
      const matchesSearch =
        (lead.phone || "").includes(search) ||
        (lead.listingCode || "").toLowerCase().includes(search.toLowerCase()) ||
        (lead.name || "").toLowerCase().includes(search.toLowerCase());
      const matchesTipo = filterTipo === "all" || (lead as any).operationType === filterTipo;
      return matchesSearch && matchesTipo;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
          break;
        case "listingCode":
          aValue = a.listingCode;
          bValue = b.listingCode;
          break;
        case "createdAt":
          aValue = a.createdAt?.toMillis() || 0;
          bValue = b.createdAt?.toMillis() || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads Cualificados</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mostrando {filteredAndSortedLeads.length} de {qualifiedLeads.length} leads cualificados
          </p>
        </div>
        <div className="flex gap-2">
          {(search || filterTipo !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setFilterTipo("all");
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
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white w-full sm:w-auto sm:min-w-[140px]"
            >
              <option value="all">Todos los tipos</option>
              <option value="Venta">Venta</option>
              <option value="Alquiler">Alquiler</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-gray-600">Ordenar por:</span>
            <button
              onClick={() => {
                if (sortField === "createdAt") {
                  setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                } else {
                  setSortField("createdAt");
                  setSortDirection("desc");
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors",
                sortField === "createdAt"
                  ? "bg-primary-100 text-primary-700 font-medium"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <Clock size={14} />
              Fecha
              {sortField === "createdAt" && (
                <ArrowUpDown size={12} />
              )}
            </button>
            <button
              onClick={() => {
                if (sortField === "name") {
                  setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                } else {
                  setSortField("name");
                  setSortDirection("asc");
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors",
                sortField === "name"
                  ? "bg-primary-100 text-primary-700 font-medium"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <User size={14} />
              Nombre
              {sortField === "name" && (
                <ArrowUpDown size={12} />
              )}
            </button>
            <button
              onClick={() => {
                if (sortField === "listingCode") {
                  setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                } else {
                  setSortField("listingCode");
                  setSortDirection("asc");
                }
              }}
              className={cn(
                "px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors",
                sortField === "listingCode"
                  ? "bg-primary-100 text-primary-700 font-medium"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              <FileText size={14} />
              Anuncio
              {sortField === "listingCode" && (
                <ArrowUpDown size={12} />
              )}
            </button>
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
        <div className="grid gap-3 sm:gap-4">
          {filteredAndSortedLeads.map((lead) => (
            <div key={lead.id} className="card p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <User size={18} className="text-primary-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{lead.name}</h3>
                    <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 mt-0.5">
                      <Phone size={12} className="flex-shrink-0" />
                      <span className="truncate">{formatPhone(lead.phone)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                  <Clock size={12} className="flex-shrink-0" />
                  {lead.createdAt ? formatDate(lead.createdAt.toDate()) : "—"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs sm:text-sm text-gray-600">
                  <strong>Anuncio:</strong> {lead.listingCode}
                </p>
                {lead.qualified && (
                  <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    <CheckCircle size={12} />
                    Cualificado
                  </span>
                )}
              </div>

              {lead.conversationSummary && (
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      setExpandedSummaries(prev => {
                        const next = new Set(prev);
                        if (next.has(lead.id)) {
                          next.delete(lead.id);
                        } else {
                          next.add(lead.id);
                        }
                        return next;
                      });
                    }}
                    className="flex items-center gap-2 mb-2 hover:text-gray-900 transition-colors w-full text-left"
                  >
                    {expandedSummaries.has(lead.id) ? (
                      <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    )}
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Resumen de conversación</span>
                  </button>
                  {expandedSummaries.has(lead.id) && (
                    <pre className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap font-sans ml-6 sm:ml-8 overflow-x-auto">
                      {lead.conversationSummary}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
