import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Rocket, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  RefreshCw,
  Info,
  KeyRound,
  Radio,
  Globe,
  Settings2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getLeads } from "../services/leads";
import { retryMissingLeads } from "../services/conversations";
import {
  backfillPerOrgTemplateEligibility,
  clearOrgProviderOverride,
  getCallHandoffReadiness,
  getSuperAdminProviderOverview,
  setGlobalDefaultProvider,
  updateGlobalProviderBehavior,
  type HandoffReadinessResult,
  type GlobalMessagingPolicy,
} from "../services/organization";
import { Button, PageHeader, PageContainer, PageLoading } from "../components/ui";
import type { Lead, MessagingProvider } from "../types";
import { auth } from "../lib/firebase";

interface LeadWithMessages extends Lead {
  messageCount?: number;
}

export function AdminTools() {
  const { user, role, organizationId, switchOrganization } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const [organizations, setOrganizations] = useState<Array<{
    id: string;
    agencyName?: string;
    providerOverride?: MessagingProvider | null;
    effectiveProvider?: MessagingProvider;
    providerSource?: "org" | "global" | "fallback";
    platformDefaultProvider?: MessagingProvider;
  }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [globalPolicy, setGlobalPolicy] = useState<GlobalMessagingPolicy | null>(null);
  
  const [scanning, setScanning] = useState(false);
  const [stuckLeads, setStuckLeads] = useState<LeadWithMessages[]>([]);
  const [selectedStuckIds, setSelectedStuckIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualPhoneNumberId, setManualPhoneNumberId] = useState("");
  const [manualWabaId, setManualWabaId] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<MessagingProvider>("cloud_api");
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [updatingGlobalProvider, setUpdatingGlobalProvider] = useState(false);
  const [updatingGlobalBehavior, setUpdatingGlobalBehavior] = useState(false);
  const [clearingOrgOverride, setClearingOrgOverride] = useState(false);
  const [globalCloudHandoffEs, setGlobalCloudHandoffEs] = useState("");
  const [globalCloudHandoffEn, setGlobalCloudHandoffEn] = useState("");
  const [globalTwilioHandoffEs, setGlobalTwilioHandoffEs] = useState("");
  const [globalTwilioHandoffEn, setGlobalTwilioHandoffEn] = useState("");
  const [globalTwilioVoiceOptIn, setGlobalTwilioVoiceOptIn] = useState("");
  const [globalTwilioAgentNotification, setGlobalTwilioAgentNotification] = useState("");
  const [globalCloudAgentNotification, setGlobalCloudAgentNotification] = useState("");
  const [readiness, setReadiness] = useState<HandoffReadinessResult | null>(null);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [runningBackfill, setRunningBackfill] = useState(false);

  const FUNCTIONS_BASE_URL =
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
    "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (organizationId) {
      setSelectedOrgId(organizationId);
    }
  }, [organizationId]);

  async function loadOrgs() {
    try {
      setLoadingOrgs(true);
      const data = await getSuperAdminProviderOverview();
      setOrganizations(data.organizations);
      setGlobalPolicy(data.policy);
      setGlobalCloudHandoffEs(data.policy.cloudApi?.templates?.callHandoffOrgEs || "");
      setGlobalCloudHandoffEn(data.policy.cloudApi?.templates?.callHandoffOrgEn || "");
      setGlobalTwilioHandoffEs(data.policy.twilio?.templates?.callHandoffOrgEs || "");
      setGlobalTwilioHandoffEn(data.policy.twilio?.templates?.callHandoffOrgEn || "");
      setGlobalTwilioVoiceOptIn(data.policy.twilio?.templates?.voiceOptInConsent || "");
      setGlobalTwilioAgentNotification(data.policy.twilio?.templates?.agentNotification || "");
      setGlobalCloudAgentNotification(data.policy.cloudApi?.templates?.agentNotification || "");
    } catch (error) {
      console.error("Error loading organizations:", error);
      toast.error("Error al cargar la configuración de super-admin");
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
      // Switch active organization context before querying org-scoped services.
      switchOrganization(selectedOrgId);
      const leads = (await getLeads()) as LeadWithMessages[];
      
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
      
      // Ensure we are in the right org context.
      switchOrganization(selectedOrgId);
      
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

  async function handleSaveManualCloudApiConfig() {
    if (!isSuperAdmin) return;
    if (!manualToken.trim() || !manualPhoneNumberId.trim() || !manualWabaId.trim()) {
      toast.error("Completa access token, phone_number_id y waba_id.");
      return;
    }
    try {
      setSavingManual(true);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${FUNCTIONS_BASE_URL}/setManualCloudApiConfig`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: manualToken.trim(),
          phoneNumberId: manualPhoneNumberId.trim(),
          wabaId: manualWabaId.trim(),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Error ${response.status}`);
      }
      toast.success("Cloud API configurado manualmente para esta organización.");
      setManualToken("");
    } catch (error) {
      console.error("Error saving manual Cloud API config:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración manual");
    } finally {
      setSavingManual(false);
    }
  }

  async function handleSwitchProvider() {
    if (!isSuperAdmin) return;
    if (!selectedOrgId) {
      toast.error("Selecciona una inmobiliaria primero");
      return;
    }
    try {
      setSwitchingProvider(true);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("No autenticado");
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`${FUNCTIONS_BASE_URL}/setOrgMessagingProvider`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgId: selectedOrgId,
          provider: selectedProvider,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Error ${response.status}`);
      }
      toast.success(`Proveedor actualizado a ${selectedProvider} para la organización seleccionada.`);
      await loadOrgs();
    } catch (error) {
      console.error("Error switching provider:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el proveedor");
    } finally {
      setSwitchingProvider(false);
    }
  }

  async function handleSetPlatformDefaultProvider() {
    try {
      setUpdatingGlobalProvider(true);
      const policy = await setGlobalDefaultProvider(selectedProvider);
      setGlobalPolicy(policy);
      toast.success(`Proveedor por defecto actualizado a ${selectedProvider}`);
      await loadOrgs();
    } catch (error) {
      console.error("Error updating platform default provider:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el proveedor por defecto");
    } finally {
      setUpdatingGlobalProvider(false);
    }
  }

  async function handleSaveGlobalBehavior() {
    try {
      setUpdatingGlobalBehavior(true);
      const policy = await updateGlobalProviderBehavior({
        cloudApiCallHandoffOrgEs: globalCloudHandoffEs,
        cloudApiCallHandoffOrgEn: globalCloudHandoffEn,
        cloudApiAgentNotification: globalCloudAgentNotification,
        twilioCallHandoffOrgEs: globalTwilioHandoffEs,
        twilioCallHandoffOrgEn: globalTwilioHandoffEn,
        twilioVoiceOptInConsent: globalTwilioVoiceOptIn,
        twilioAgentNotification: globalTwilioAgentNotification,
      });
      setGlobalPolicy(policy);
      toast.success("Comportamiento global actualizado para todos los orgs");
      await loadOrgs();
    } catch (error) {
      console.error("Error saving global behavior:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la política global");
    } finally {
      setUpdatingGlobalBehavior(false);
    }
  }

  async function handleClearOrgOverride() {
    if (!selectedOrgId) {
      toast.error("Selecciona una inmobiliaria primero");
      return;
    }
    try {
      setClearingOrgOverride(true);
      await clearOrgProviderOverride(selectedOrgId);
      toast.success("Override eliminado. El org ahora hereda el proveedor global.");
      await loadOrgs();
    } catch (error) {
      console.error("Error clearing org provider override:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el override");
    } finally {
      setClearingOrgOverride(false);
    }
  }

  async function handleCheckReadiness() {
    if (!selectedOrgId) {
      toast.error("Selecciona una inmobiliaria primero");
      return;
    }
    try {
      setCheckingReadiness(true);
      const result = await getCallHandoffReadiness(selectedOrgId);
      setReadiness(result);
      if (result.eligible) toast.success("Org listo para plantillas per-org");
      else toast.error(`Org no listo. Faltan ${result.missingRequiredKeys.length} claves`);
    } catch (error) {
      console.error("Error checking readiness:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo comprobar readiness");
    } finally {
      setCheckingReadiness(false);
    }
  }

  async function handleRunBackfill() {
    try {
      setRunningBackfill(true);
      const result = await backfillPerOrgTemplateEligibility(selectedOrgId || undefined);
      toast.success(`Backfill OK: ${result.updated} orgs actualizados, ${result.blocked} bloqueados.`);
      if (selectedOrgId) {
        const refreshed = await getCallHandoffReadiness(selectedOrgId);
        setReadiness(refreshed);
      }
    } catch (error) {
      console.error("Error running backfill:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo ejecutar el backfill");
    } finally {
      setRunningBackfill(false);
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
    <PageContainer maxWidth="6xl">
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

        {isSuperAdmin && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                <CheckCircle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-heading">Readiness y bloqueo per-org</h2>
                <p className="text-sm text-gray-500">Comprueba elegibilidad y aplica bloqueo automático en orgs no listos.</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleCheckReadiness} loading={checkingReadiness} disabled={!selectedOrgId}>
                  Comprobar readiness del org
                </Button>
                <Button onClick={handleRunBackfill} loading={runningBackfill} variant="outline">
                  Ejecutar backfill/bloqueo {selectedOrgId ? "(org actual)" : "(todos)"}
                </Button>
              </div>
              {readiness && (
                <div className={`rounded-xl border p-4 ${readiness.eligible ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                  <p className="text-sm font-semibold">
                    Estado: {readiness.eligible ? "READY" : "BLOCKED"} | Proveedor: {readiness.provider}
                  </p>
                  {readiness.provider === "twilio" && (
                    <p className="mt-1 text-xs text-gray-700">
                      Twilio requiere transporte org-level (`twilioConfig.*`) y templates org-level (`twilioTemplates.*`).
                    </p>
                  )}
                  {!readiness.eligible && (
                    <p className="mt-2 text-xs text-amber-800">
                      Faltan: {readiness.missingRequiredKeys.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {isSuperAdmin && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-700">
                <Globe size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-heading">Política global de proveedor</h2>
                <p className="text-sm text-gray-500">
                  Define el comportamiento global de Cloud API/Twilio para todos los orgs.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor por defecto de plataforma</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as MessagingProvider)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  <option value="twilio">twilio</option>
                  <option value="cloud_api">cloud_api</option>
                  <option value="whapi">whapi</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Valor actual: <span className="font-semibold">{globalPolicy?.defaultProvider || "twilio"}</span>
                </p>
                <div className="mt-3">
                  <Button onClick={handleSetPlatformDefaultProvider} loading={updatingGlobalProvider}>
                    <Settings2 size={18} />
                    Guardar proveedor por defecto
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cloud API call_handoff ES</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalCloudHandoffEs} onChange={(e) => setGlobalCloudHandoffEs(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cloud API call_handoff EN</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalCloudHandoffEn} onChange={(e) => setGlobalCloudHandoffEn(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio call_handoff ES</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalTwilioHandoffEs} onChange={(e) => setGlobalTwilioHandoffEs(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio call_handoff EN</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalTwilioHandoffEn} onChange={(e) => setGlobalTwilioHandoffEn(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio voice opt-in consent</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalTwilioVoiceOptIn} onChange={(e) => setGlobalTwilioVoiceOptIn(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Twilio agent notification</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalTwilioAgentNotification} onChange={(e) => setGlobalTwilioAgentNotification(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cloud API agent_notification</label>
                  <input className="w-full rounded-xl border border-gray-300 px-3 py-2" value={globalCloudAgentNotification} onChange={(e) => setGlobalCloudAgentNotification(e.target.value)} />
                </div>
              </div>
              <div>
                <Button onClick={handleSaveGlobalBehavior} loading={updatingGlobalBehavior}>
                  Guardar comportamiento global
                </Button>
              </div>
            </div>
          </section>
        )}

        {isSuperAdmin && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-700">
                <Radio size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-heading">Asignación por organización</h2>
                <p className="text-sm text-gray-500">
                  Puedes forzar un proveedor por org o heredar el valor global.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor de mensajería</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as MessagingProvider)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                >
                  <option value="cloud_api">cloud_api (predeterminado)</option>
                  <option value="twilio">twilio</option>
                  <option value="whapi">whapi</option>
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Org actual:{" "}
                  <span className="font-semibold">
                    {organizations.find((org) => org.id === selectedOrgId)?.effectiveProvider || globalPolicy?.defaultProvider || "twilio"}
                  </span>{" "}
                  ({organizations.find((org) => org.id === selectedOrgId)?.providerSource || "global"})
                </p>
              </div>
              <div>
                <Button onClick={handleSwitchProvider} loading={switchingProvider} disabled={!selectedOrgId}>
                  Aplicar override a la inmobiliaria seleccionada
                </Button>
                <Button onClick={handleClearOrgOverride} loading={clearingOrgOverride} disabled={!selectedOrgId} variant="outline" className="ml-2">
                  Quitar override (heredar global)
                </Button>
              </div>
            </div>
          </section>
        )}

        {isSuperAdmin && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-heading">Cloud API Fallback (Admins internos)</h2>
                <p className="text-sm text-gray-500">
                  Ruta de respaldo para configurar token manualmente solo en soporte interno.
                </p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2"
                  placeholder="EAA..."
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                  <input
                    type="text"
                    value={manualPhoneNumberId}
                    onChange={(e) => setManualPhoneNumberId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    placeholder="123456789012345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WABA ID</label>
                  <input
                    type="text"
                    value={manualWabaId}
                    onChange={(e) => setManualWabaId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2"
                    placeholder="109876543210987"
                  />
                </div>
              </div>
              <div>
                <Button onClick={handleSaveManualCloudApiConfig} loading={savingManual}>
                  Guardar configuración manual
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
