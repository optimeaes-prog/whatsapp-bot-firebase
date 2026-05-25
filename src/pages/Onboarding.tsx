import { useState, useEffect, useRef } from "react";
import { CheckCircle, Lock, ArrowRight, Mail, Clock, ChevronDown, CheckSquare, Square, MessageCircle, CalendarDays, XCircle } from "lucide-react";
import { getOrganizationSettings, updateOrganizationSettings } from "../services/organization";
import type { OrganizationSettings } from "../services/organization";
import { Link } from "react-router-dom";
import { analytics } from "../lib/analytics";
import { getSubscription } from "../services/subscription";
import type { OrgSubscriptionInfo } from "../services/subscription";
import { cn } from "../lib/utils";
import { Button, PageLoading } from "../components/ui";
import { getBotConfig } from "../services/botConfig";
import { ASSISTANT_AVATARS, getAssistantAvatarById, type AssistantAvatarId } from "../constants/assistantAvatars";
import { CalEuInlineEmbed } from "../components/CalEuInlineEmbed";
import { useAuth } from "../contexts/AuthContext";

export function Onboarding() {
  const { organizationId } = useAuth();
  const loadSeqRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Form states for step 2
  const [agencyName, setAgencyName] = useState("");
  const [employeesCount, setEmployeesCount] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [assistantAvatarId, setAssistantAvatarId] = useState<AssistantAvatarId | "">("");
  const [isEmployeesDropdownOpen, setIsEmployeesDropdownOpen] = useState(false);
  
  // Form state for step 4
  const [forwardingEmail, setForwardingEmail] = useState("");
  const [step5Error, setStep5Error] = useState<string | null>(null);

  const currentStep = settings?.onboardingStep || 1;
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const loadSettings = async (seq: number): Promise<OrganizationSettings | null> => {
    try {
      const s = await getOrganizationSettings();
      if (seq !== loadSeqRef.current) return null;

      setSettings(s);
      setAgencyName(s.agencyName || "");
      setEmployeesCount(s.employeesCount || "");
      setWhatsappPhone(s.whatsappSummariesPhone || "");
      setAssistantAvatarId(getAssistantAvatarById(s.assistantAvatarId)?.id || "");
      setForwardingEmail(s.forwardingEmail || "");
      
      // Migration: if they had scheduled a call before the steps logic
      if (!s.onboardingStep && s.onboardingCallScheduled) {
        const migrated = { ...s, onboardingStep: 2 };
        setSettings(migrated);
        return migrated;
      }
      return s;
    } catch (error) {
      console.error("Failed to load settings:", error);
      return null;
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  };

  async function refreshSubscription(seq: number, step: number) {
    try {
      setSubscriptionLoading(true);
      const sub = await getSubscription().catch(() => null);
      if (seq !== loadSeqRef.current) return;
      setSubscription(sub);
      const isActive =
        Boolean(sub) &&
        sub!.planId !== "free" &&
        (sub!.status === "active" || sub!.status === "trialing");

      if (isActive && step === 4) {
        await updateOrganizationSettings({ onboardingStep: 5 });
        await loadSettings(seq);
      }
    } catch (error) {
      console.error("Failed to load subscription:", error);
      if (seq !== loadSeqRef.current) return;
      setSubscription(null);
    } finally {
      if (seq === loadSeqRef.current) setSubscriptionLoading(false);
    }
  }

  async function refreshWhatsAppConnection(seq: number, step: number) {
    try {
      setCheckingConnection(true);
      const cfg = await getBotConfig();
      if (seq !== loadSeqRef.current) return;
      const cloudApiCfg = (cfg as unknown as { cloudApiConfig?: { phoneNumberId?: string; wabaId?: string } }).cloudApiConfig;
      const connected = Boolean(cloudApiCfg?.phoneNumberId && cloudApiCfg?.wabaId);
      setWhatsAppConnected(connected);
      if (connected && step < 4) {
        await updateOrganizationSettings({ onboardingStep: 4 });
        await loadSettings(seq);
      }
    } catch (error) {
      console.error("Failed to check WhatsApp connection:", error);
      if (seq !== loadSeqRef.current) return;
      setWhatsAppConnected(false);
    } finally {
      if (seq === loadSeqRef.current) setCheckingConnection(false);
    }
  }

  useEffect(() => {
    if (!organizationId) return;
    const seq = ++loadSeqRef.current;

    setLoading(true);
    setSettings(null);
    setSubscription(null);
    setSubscriptionLoading(true);
    setWhatsAppConnected(false);
    setCheckingConnection(true);
    setIsEmployeesDropdownOpen(false);

    (async () => {
      const s = await loadSettings(seq);
      const step = s?.onboardingStep || 1;
      await Promise.all([refreshSubscription(seq, step), refreshWhatsAppConnection(seq, step)]);
    })();
  }, [organizationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    if (!settings?.onboardingStep) return;
    const cs = settings.onboardingStep;
    setExpandedSteps((prev) => {
      const next: Record<number, boolean> = {};
      for (const key of Object.keys(prev)) {
        const n = Number(key);
        next[n] = n === cs;
      }
      return next;
    });
  }, [isDesktop, settings?.onboardingStep]);

  function toggleStep(step: number) {
    if (!isDesktop) return;
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  }

  const handleConfirmCallScheduled = async () => {
    setSaving(true);
    await updateOrganizationSettings({
      onboardingCallScheduled: true,
      onboardingStep: Math.max(currentStep, 2),
    });
    analytics.trackOnboardingStepComplete(1, "onboarding_call");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
    setIsCallModalOpen(false);
  };

  const handleSaveStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      agencyName,
      employeesCount,
      whatsappSummariesPhone: whatsappPhone,
      assistantAvatarId: assistantAvatarId || undefined,
      assistantAvatarName: getAssistantAvatarById(assistantAvatarId)?.name,
      assistantAvatarImagePath: getAssistantAvatarById(assistantAvatarId)?.imagePath,
      assistantAvatarUrl:
        typeof window !== "undefined" && assistantAvatarId
          ? `${window.location.origin}${getAssistantAvatarById(assistantAvatarId)?.imagePath || ""}`
          : undefined,
      onboardingStep: 3
    });
    analytics.trackOnboardingStepComplete(2, "agency_info");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  const handleSaveStep5 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      forwardingEmail,
      onboardingStep: 6
    });
    analytics.trackOnboardingStepComplete(5, "email_config");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  const handleMarkStep5Complete = async () => {
    if (!forwardingEmail.trim()) {
      setStep5Error("Indica el email desde el que se reenviarán los leads.");
      return;
    }
    setStep5Error(null);
    setSaving(true);
    await updateOrganizationSettings({
      forwardingEmail,
      onboardingStep: 6
    });
    analytics.trackOnboardingStepComplete(5, "email_config");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <PageLoading message="Cargando..." />
      </div>
    );
  }

  const isCompleted = currentStep >= 7;
  // Some legacy org docs may contain non-boolean values; only strict true counts.
  const callScheduled = settings?.onboardingCallScheduled === true;
  const step1Done = callScheduled;
  const hasActiveSubscription =
    Boolean(subscription) &&
    subscription!.planId !== "free" &&
    (subscription!.status === "active" || subscription!.status === "trialing");

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl font-heading">Configuración del Asistente</h1>
        <p className="text-gray-600 font-body">Completa estos pasos para empezar a utilizar tu agente de inteligencia artificial.</p>
      </div>

      {/* Paso 1 (sección separada) */}
      <div className="mb-8">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleStep(1)}
            className="w-full flex items-center justify-between text-left px-4 py-4 sm:px-6 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border",
                step1Done ? "border-primary-500 bg-primary-500 text-white" :
                currentStep === 1 ? "border-primary-500 bg-white text-primary-700" :
                "border-gray-200 text-gray-400 bg-gray-50"
              )}>
                <span className="font-bold">1</span>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-heading">Bookea tu onboarding call</h2>
                <p className="text-xs text-gray-500 font-medium">Te acompañamos para completar la activación sin complicaciones.</p>
              </div>
            </div>
            <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[1] ? "rotate-180" : "")} />
          </button>

          <div className={cn(expandedSteps[1] ? "" : "hidden", "px-4 pb-5 sm:px-6")}>
            <p className="text-gray-600 mb-4">
              Esta llamada es para ayudarte a completar el proceso de activación del asistente paso a paso: resolvemos dudas, revisamos la configuración y nos aseguramos de que todo quede funcionando.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={() => setIsCallModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <CalendarDays size={18} />
                Abrir calendario
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConfirmCallScheduled}
                loading={saving}
                disabled={step1Done}
                className="w-full sm:w-auto"
                title={step1Done ? "Este paso ya está completado" : "Si ya la has reservado en el calendario, marca este paso como completado"}
              >
                {step1Done ? "Paso completado" : "Ya la he reservado"}
              </Button>
            </div>

            {step1Done && (
              <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">Onboarding call reservada.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cn(
        "pb-4",
        isDesktop
          ? "rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100"
          : "relative border-l-2 border-gray-200 ml-4 space-y-12"
      )}>

        {/* Paso 2 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 2 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 2 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400'
            }`}>
              <span className="font-bold text-lg">2</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 2 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 2 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(2)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50 rounded-t-xl"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 2 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 2 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">2</span>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-heading">Datos de tu Inmobiliaria</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[2] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[2] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <form onSubmit={handleSaveStep2} className={currentStep > 2 && !saving ? "pointer-events-none opacity-80" : ""}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Inmobiliaria</label>
                  <input 
                    type="text" required
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    value={agencyName} onChange={e => setAgencyName(e.target.value)}
                    disabled={currentStep > 2 && !saving}
                    placeholder="Ej. Inmobiliaria Granados"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Elige tu avatar de asistente</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {ASSISTANT_AVATARS.map((avatar) => {
                      const isSelected = assistantAvatarId === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setAssistantAvatarId(avatar.id)}
                          disabled={currentStep > 2 && !saving}
                          className={cn(
                            "rounded-btn border p-2 text-center transition-all bg-white",
                            isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-gray-200 hover:border-primary-300",
                            currentStep > 2 && !saving && "cursor-not-allowed opacity-80 bg-gray-50"
                          )}
                        >
                          <img
                            src={avatar.imagePath}
                            alt={`Avatar ${avatar.name}`}
                            className="mx-auto h-16 w-16 rounded-full object-cover border border-gray-200"
                            loading="lazy"
                          />
                          <p className="mt-2 text-xs font-medium text-gray-700">{avatar.name}</p>
                        </button>
                      );
                    })}
                  </div>
                  {!assistantAvatarId && currentStep === 2 && (
                    <p className="text-xs text-red-600 mt-2">Selecciona un avatar para continuar.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Trabajadores</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsEmployeesDropdownOpen(!isEmployeesDropdownOpen)}
                        disabled={currentStep > 2 && !saving}
                        className={cn(
                          "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                          isEmployeesDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400",
                          currentStep > 2 && !saving && "bg-gray-50 opacity-80 cursor-not-allowed"
                        )}
                      >
                        <span className={!employeesCount ? "text-gray-400" : "text-gray-900"}>
                          {employeesCount || "Selecciona un rango"}
                        </span>
                        <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isEmployeesDropdownOpen && "rotate-180")} />
                      </button>
                      {isEmployeesDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsEmployeesDropdownOpen(false)} />
                          <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                            {["1", "2-5", "5-20", "20-50", "50-100", "+100"].map((range) => (
                              <button
                                key={range}
                                type="button"
                                onClick={() => {
                                  setEmployeesCount(range);
                                  setIsEmployeesDropdownOpen(false);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                              >
                                {employeesCount === range ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                <span className="text-sm text-gray-700 font-medium">{range}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp para Resúmenes</label>
                    <input 
                      type="tel" required
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)}
                      disabled={currentStep > 2 && !saving}
                      placeholder="+34 XXXXXXXX"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Donde recibirás alertas de leads cualificados. Podrás cambiar este número o añadir otros más adelante.
                    </p>
                  </div>
                </div>
              </div>
              
              {currentStep === 2 && (
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!assistantAvatarId}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 mt-6"
                >
                  Guardar y Continuar
                  <ArrowRight size={18} />
                </Button>
              )}
            </form>
            </div>
          </div>
        </div>

        {/* Paso 3 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 3 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 3 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">3</span>
            </div>
          )}
          
          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 3 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 3 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(3)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 3 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 3 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">3</span>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-heading">Conectar WhatsApp Business</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[3] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[3] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <p className="text-gray-600 mb-6">
              Conecta tu cuenta de WhatsApp Business con Meta Embedded Signup para activar la mensajería oficial en Proplead.
            </p>
            
            {!whatsAppConnected && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/connect-whatsapp" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
                    <MessageCircle size={18} />
                    Conectar con Facebook
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => refreshWhatsAppConnection(loadSeqRef.current, currentStep)}
                  loading={checkingConnection}
                  className="w-full sm:w-auto"
                >
                  Verificar conexión
                </Button>
              </div>
            )}

            {(currentStep > 3 || whatsAppConnected) && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">WhatsApp Business conectado correctamente.</span>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Paso 4 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 4 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 4 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">4</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 4 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 4 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(4)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 4 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 4 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">4</span>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-heading">Activar suscripción</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[4] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[4] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
              {
                <div className={currentStep > 4 && !saving ? "pointer-events-none opacity-80" : ""}>
                  <p className="text-gray-600 mb-4">
                    Para continuar, activa una suscripción. Desde ahí podrás elegir plan y completar el pago de forma segura.
                  </p>

                  {hasActiveSubscription ? (
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                      <CheckCircle size={20} className="text-emerald-600" />
                      <span className="font-medium">Suscripción activa detectada. Ya puedes continuar.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to="/suscripcion" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">
                          Ir a Suscripciones
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => refreshSubscription(loadSeqRef.current, currentStep)}
                        loading={subscriptionLoading}
                        className="w-full sm:w-auto"
                      >
                        Ya tengo suscripción (verificar)
                      </Button>
                    </div>
                  )}
                </div>
              }
            </div>
          </div>
        </div>

        {/* Paso 5 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 5 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 5 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">5</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 5 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 5 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(5)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 5 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 5 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">5</span>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-heading">Configurar email de leads</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[5] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[5] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
              <form onSubmit={handleSaveStep5} className={currentStep > 5 && !saving ? "pointer-events-none opacity-80" : ""}>
                  <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">Esto sirve para que el asistente responda automáticamente a los mensajes que entran desde Idealista (leads), no a llamadas al número de teléfono.</p>
                    <p className="mt-1 text-gray-600">
                      Nota: esta funcionalidad está activa por el momento <span className="font-semibold">solo para Idealista</span>.
                    </p>
                  </div>

                  <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50 p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-primary-900">
                      <Mail size={18} />
                      Guía de reenvío de correos (Idealista)
                    </h3>
                    <ol className="list-decimal list-inside space-y-3 pl-2 text-sm text-primary-800">
                      <li>Abre la cuenta de correo electrónico donde recibes las notificaciones de nuevos mensajes recibidos en Idealista.</li>
                      <li>Ve a los ajustes de <span className="font-bold">Filtros y direcciones bloqueadas</span> (o “Filtros”).</li>
                      <li>Crea un filtro para los correos que provengan de <code>idealista.com</code>.</li>
                      <li>Activa el reenvío automático a: <code className="mt-1 inline-block rounded border border-primary-200 bg-white px-2 py-1 font-mono font-bold">soporte@proplead.io</code></li>
                    </ol>
                  </div>

                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">¿Desde qué email se van a reenviar?</label>
                      <input
                        type="email"
                        required
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={forwardingEmail}
                        onChange={e => {
                          setForwardingEmail(e.target.value);
                          if (step5Error) setStep5Error(null);
                        }}
                        disabled={currentStep > 5 && !saving}
                        placeholder="tucorreo@inmobiliaria.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">Necesario para identificar tus leads y vincularlos a tu cuenta.</p>
                      {step5Error && <p className="text-xs text-red-600 mt-2">{step5Error}</p>}
                    </div>
                  </div>

                  {currentStep < 5 && (
                    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                      Paso bloqueado. Se desbloqueará al completar el paso anterior.
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Button
                        type="submit"
                        loading={saving}
                        className="w-full sm:w-auto flex items-center justify-center gap-2"
                      >
                        Guardar y continuar
                        <ArrowRight size={18} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleMarkStep5Complete}
                        loading={saving}
                        className="w-full sm:w-auto"
                      >
                        Ya está completado
                      </Button>
                    </div>
                  )}
              </form>

              {currentStep > 5 && (
                <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span className="font-medium">Email de leads configurado.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Paso 6 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 6 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 6 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 6 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {currentStep > 6 ? <span className="font-bold text-lg">6</span> : currentStep === 6 ? <span className="font-bold text-lg">6</span> : <Lock size={16} />}
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 6 ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 6 ? "border-orange-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(6)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 6 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 6 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 6 ? <span className="font-bold">6</span> : currentStep === 6 ? <span className="font-bold">6</span> : <Lock size={14} />}
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-heading">Activación del Asistente</h2>
                  {currentStep < 6 && (
                    <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                      Se desbloqueará al completar los pasos anteriores.
                    </p>
                  )}
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[6] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[6] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            {currentStep === 6 && (
               <div className="bg-primary-50 text-primary-700 p-5 rounded-lg border border-primary-100 animate-pulse">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Clock size={18} />
                  Estamos configurando tu asistente
                </h3>
                <p className="text-sm">
                  Normalmente tardamos <strong>24 horas</strong> en conectar tu cuenta y probar que todo funciona correctamente. Te notificaremos en tu panel cuando esté activo, y este paso se completará automáticamente.
                </p>
              </div>
            )}
            
            {currentStep < 6 && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                Paso bloqueado. Completa los anteriores para solicitar la activación de tu asistente.
              </div>
            )}
            {currentStep > 6 && (
               <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">¡Asistente activado y funcionando!</span>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {isCompleted && (
        <div className="mt-12 bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center shadow-sm ml-4 lg:ml-0">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-emerald-600 w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-900 mb-2">¡Todo Listo!</h3>
          <p className="text-emerald-800 mb-6 max-w-lg mx-auto text-sm sm:text-base">
            Has completado todos los pasos de configuración. Ahora Proplead está listo para atender y cualificar a tus leads automáticamente las 24 horas.
          </p>
          <Link to="/dashboard">
            <Button className="inline-flex items-center gap-2">
              Ir al Dashboard <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      )}

      {isCallModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-50/50">
              <div>
                <h3 className="font-bold text-gray-900 font-heading">Reserva tu onboarding call</h3>
                <p className="text-xs text-gray-600 font-medium">Elige un hueco en el calendario.</p>
              </div>
              <button
                onClick={() => setIsCallModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-btn transition-colors"
                aria-label="Cerrar"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-72px)]">
              <CalEuInlineEmbed
                namespace="onboarding"
                calLink="ejpr-proplead/onboarding"
                minHeight={isDesktop ? 520 : 650}
              />
              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-end">
                <Button variant="outline" onClick={() => setIsCallModalOpen(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleConfirmCallScheduled} loading={saving}>
                  Ya la he reservado
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
