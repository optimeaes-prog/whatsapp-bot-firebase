import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Building2, Users, Phone, Mail } from "lucide-react";
import { getPendingOnboards, confirmOnboarding } from "../services/organization";
import type { OrganizationSettings } from "../services/organization";
import { PageHeader, PageContainer, PageLoading } from "../components/ui";

export function AdminOnboards() {
  const [pending, setPending] = useState<(OrganizationSettings & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPending();
  }, []);

  async function loadPending() {
    try {
      setLoading(true);
      const data = await getPendingOnboards();
      setPending(data);
    } catch (error) {
      console.error("Error loading pending onboards:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(orgId: string) {
    if (!window.confirm(`¿Estás seguro de que quieres activar el asistente para esta inmobiliaria?`)) return;
    
    try {
      setProcessingId(orgId);
      await confirmOnboarding(orgId);
      // Remove from list
      setPending(prev => prev.filter(org => org.id !== orgId));
    } catch (error) {
      console.error("Error confirming onboarding:", error);
      toast.error("Hubo un error al confirmar. Inténtalo de nuevo.");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return <PageLoading message="Cargando solicitudes pendientes..." className="py-12" />;
  }

  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Activación de Asistentes (Onboards)"
        subtitle="Lista de usuarios e inmobiliarias que han completado su configuración inicial y esperan la activación manual de su agente."
      />

      {pending.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-green-500 w-8 h-8" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Todo al día</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            No hay solicitudes de onboarding pendientes. Cuando un nuevo usuario complete sus primeros 3 pasos, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pending.map(org => {
            const isProcessing = processingId === org.id;

            return (
              <div key={org.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col transition-all hover:shadow-lg">
                <div className="flex items-center gap-3 border-b border-primary-100 bg-primary-50 p-4">
                  <AlertCircle className="text-primary-600" size={24} />
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">Pendiente de Activación</h3>
                    <p className="text-xs text-primary-800">Paso 5 / 6</p>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Datos de la Inmobiliaria</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Building2 size={16} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{org.agencyName || "Nombre no especificado"}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5 overflow-hidden text-ellipsis w-[200px]">ID: {org.id}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-gray-400" />
                        <p className="text-sm text-gray-700">{org.employeesCount ? `${org.employeesCount} trabajadores` : "No especificado"}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Phone size={16} className="text-gray-400" />
                        <p className="text-sm text-gray-700">{org.whatsappSummariesPhone || "No especificado"}</p>
                      </div>
                      
                      <div className="flex flex-col gap-1 pt-2 border-t border-gray-50 mt-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Mail size={14} /> Correo de reenvío (Idealista)
                        </div>
                        <p className="text-sm font-medium text-gray-800 break-all bg-gray-50 p-2 rounded">
                          {org.forwardingEmail || "No especificado"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto">
                  <button
                    onClick={() => handleConfirm(org.id)}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-btn text-sm font-semibold transition-colors disabled:opacity-70"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Activando...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={18} />
                        Confirmar y Activar Asistente
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
