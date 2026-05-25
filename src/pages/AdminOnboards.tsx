import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Building2, Users, Phone, Mail } from "lucide-react";
import { getPendingOnboards, confirmOnboarding } from "../services/organization";
import type { OrganizationSettings } from "../services/organization";
import { Button, PageHeader, PageContainer, PageLoading } from "../components/ui";

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
          <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-emerald-500 w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 font-heading">Todo al día</h3>
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
                    <h3 className="font-bold text-gray-900 leading-tight font-heading">Pendiente de Activación</h3>
                    <p className="text-xs text-primary-800 font-heading font-bold">Paso 6 / 7</p>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col gap-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">Datos de la Inmobiliaria</p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Building2 size={16} className="text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-gray-900 font-heading">{org.agencyName || "Nombre no especificado"}</p>
                          <p className="text-xs text-gray-500 font-body mt-0.5 overflow-hidden text-ellipsis w-[200px]">ID: <span className="font-mono">{org.id}</span></p>
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
                          <Mail size={14} /> <span className="font-heading font-bold uppercase tracking-wider text-[10px]">Correo de reenvío (Idealista)</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 break-all bg-gray-50 p-2 rounded">
                          {org.forwardingEmail || "No especificado"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto">
                  <Button
                    type="button"
                    onClick={() => handleConfirm(org.id)}
                    loading={isProcessing}
                    className="w-full py-2.5 text-sm font-semibold"
                  >
                    <CheckCircle size={18} />
                    {isProcessing ? "Activando..." : "Confirmar y Activar Asistente"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
