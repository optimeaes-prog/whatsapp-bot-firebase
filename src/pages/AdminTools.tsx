import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Rocket, 
  Search, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  RefreshCw,
  Info
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getLeads } from "../services/leads";
import { retryMissingLeads } from "../services/conversations";
import { getAllOrganizations } from "../services/organization";
import { Button, PageHeader, PageContainer, PageLoading } from "../components/ui";
import { cn } from "../lib/utils";
import { setOrganizationId } from "../lib/organization";
import type { Lead } from "../types";

interface LeadWithMessages extends Lead {
  messageCount?: number;
}

export function AdminTools() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<{ id: string; agencyName?: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  
  const [scanning, setScanning] = useState(false);
  const [stuckLeads, setStuckLeads] = useState<LeadWithMessages[]>([]);
  const [selectedStuckIds, setSelectedStuckIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    try {
      setLoadingOrgs(true);
      const data = await getAllOrganizations();
      setOrganizations(data);
    } catch (error) {
      console.error("Error loading organizations:", error);
      toast.error("Error al cargar inmobiliarias");
    } finally {
      setLoadingOrgs(false);
    }
  }

  async function handleScan() {
    if (!selectedOrgId) {
      toast.error("Selecciona una inmobiliaria primero");
      return;
    }

    setScanning(true);
    setStuckLeads([]);
    setSelectedStuckIds(new Set());

    try {
      // Temporarily set the organization ID to scan its leads
      setOrganizationId(selectedOrgId);
      const leads = await getLeads();
      
      // Filter leads with 0 messages (stuck)
      const stuck = leads.filter(l => (l.messageCount || 0) === 0 && l.qualificationStatus !== "rejected");
      setStuckLeads(stuck);
      setSelectedStuckIds(new Set(stuck.map(l => l.id)));
      
      if (stuck.length === 0) {
        toast.info("No se encontraron leads atascados en esta inmobiliaria.");
      } else {
        toast.success(`Encontrados ${stuck.length} leads sin mensajes.`);
      }
    } catch (error) {
      console.error("Error scanning organization:", error);
      toast.error("Error al escanear la inmobiliaria");
    } finally {
      setScanning(false);
    }
  }

  async function handleRetry() {
    if (!user || selectedStuckIds.size === 0) return;
    
    setRetrying(true);
    try {
      const token = await user.getIdToken();
      
      // Ensure we are in the right org context
      setOrganizationId(selectedOrgId);
      
      // Map IDs to chatIds
      const targetChatIds = Array.from(selectedStuckIds).map(id => {
        const lead = stuckLeads.find(l => l.id === id);
        return lead?.chatId || lead?.phone || "";
      }).filter(Boolean);

      const result = await retryMissingLeads(token, targetChatIds);
      toast.success(`Proceso completado: ${result.processed} leads recuperados.`);
      
      // Clear results after success
      setStuckLeads([]);
      setSelectedStuckIds(new Set());
    } catch (err) {
      console.error("Error in retry process:", err);
      toast.error("Error al ejecutar la recuperación");
    } finally {
      setRetrying(false);
    }
  }

  const formatPhone = (phone?: string) => {
    if (!phone) return "—";
    return phone.startsWith("+") ? phone : `+${phone}`;
  };

  if (loadingOrgs) {
    return <PageLoading message="Cargando panel de herramientas..." className="py-12" />;
  }

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title="Herramientas de Administración"
        subtitle="Utilidades avanzadas para mantenimiento del sistema y recuperación de datos."
        icon={<Rocket className="text-primary-600" size={28} />}
      />

      <div className="space-y-8">
        {/* Tool: Lead Recovery */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                <RefreshCw size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-heading">Recuperación de Leads Atascados</h2>
                <p className="text-sm text-gray-500">Detecta y reintenta el contacto inicial para leads que no recibieron mensaje (0 mensajes registrados).</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">
                  1. Seleccionar Inmobiliaria
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all appearance-none"
                  >
                    <option value="">Selecciona una cuenta...</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>
                        {org.agencyName} ({org.id})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <CheckCircle className="text-emerald-500 opacity-0 group-focus-within:opacity-100" size={16} />
                  </div>
                </div>
              </div>

              <div>
                <Button
                  onClick={handleScan}
                  loading={scanning}
                  disabled={!selectedOrgId}
                  className="w-full sm:w-auto h-11"
                >
                  <Search size={18} />
                  Escanear Inmobiliaria
                </Button>
              </div>
            </div>

            {stuckLeads.length > 0 && (
              <div className="mt-8 border border-primary-100 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-4 bg-primary-50 border-b border-primary-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="text-primary-600" size={18} />
                    <span className="font-bold text-primary-900 font-heading">
                      {stuckLeads.length} leads pendientes encontrados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary-700 font-medium">
                      {selectedStuckIds.size} seleccionados
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white border-b border-gray-100">
                        <th className="px-6 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selectedStuckIds.size === stuckLeads.length}
                            onChange={() => {
                              if (selectedStuckIds.size === stuckLeads.length) setSelectedStuckIds(new Set());
                              else setSelectedStuckIds(new Set(stuckLeads.map(l => l.id)));
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </th>
                        <th className="px-6 py-3 text-left font-bold text-gray-600 uppercase tracking-wider text-[10px]">Lead</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-600 uppercase tracking-wider text-[10px]">Anuncio</th>
                        <th className="px-6 py-3 text-left font-bold text-gray-600 uppercase tracking-wider text-[10px]">Estado Actual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {stuckLeads.map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedStuckIds.has(lead.id)}
                              onChange={() => {
                                setSelectedStuckIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(lead.id)) next.delete(lead.id);
                                  else next.add(lead.id);
                                  return next;
                                });
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{lead.name || "Sin nombre"}</span>
                              <span className="text-xs text-gray-500">{formatPhone(lead.phone)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-gray-100 px-2.5 py-1 rounded-lg text-[10px] font-black text-gray-600 border border-gray-200 uppercase">
                              {lead.listingCode}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span className="text-[11px] font-bold text-amber-700 uppercase">{lead.qualificationStatus}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-6 bg-gray-50 border-t border-primary-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary-800">
                    <Info size={16} />
                    <p className="text-xs font-medium">
                      Esta operación consumirá conversaciones del saldo de la inmobiliaria.
                    </p>
                  </div>
                  <Button
                    onClick={handleRetry}
                    loading={retrying}
                    disabled={selectedStuckIds.size === 0}
                    className="bg-primary-600 shadow-lg shadow-primary-200"
                  >
                    <RefreshCw size={18} />
                    Procesar {selectedStuckIds.size} Recuperaciones
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
        
        {/* Placeholder for future tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60 grayscale pointer-events-none">
          <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300">
            <h3 className="font-bold text-gray-400 mb-2 font-heading">Limpieza de Auditoría</h3>
            <p className="text-sm text-gray-400">Próximamente: Eliminar logs antiguos para optimizar almacenamiento.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-dashed border-gray-300">
            <h3 className="font-bold text-gray-400 mb-2 font-heading">Reset de Contraseñas</h3>
            <p className="text-sm text-gray-400">Próximamente: Gestión centralizada de credenciales de usuario.</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
