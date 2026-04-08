import { useState, useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle, Lock, ArrowRight, Calendar, Mail, Clock, Coins, ChevronDown, CheckSquare, Square } from "lucide-react";
import { getOrganizationSettings, updateOrganizationSettings } from "../services/organization";
import type { OrganizationSettings } from "../services/organization";
import { PopupModal, useCalendlyEventListener } from "react-calendly";
import { Link, useSearchParams } from "react-router-dom";
import { getUserCredits, getCreditPackages, createCheckoutSession, formatPrice } from "../services/credits";
import type { CreditPackage } from "../types";
import { CreditCard, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { Button, PageLoading } from "../components/ui";

export function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });

  // Form states for step 1
  const [agencyName, setAgencyName] = useState("");
  const [employeesCount, setEmployeesCount] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [isEmployeesDropdownOpen, setIsEmployeesDropdownOpen] = useState(false);
  
  // Form state for step 3
  const [forwardingEmail, setForwardingEmail] = useState("");

  const [searchParams, setSearchParams] = useSearchParams();
  const [credits, setCredits] = useState<number>(0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  const currentStep = settings?.onboardingStep || 1;

  useCalendlyEventListener({
    onEventScheduled: async () => {
      setShowCalendlyModal(false);
      // Update step to 3 if we were on step 2
      if (currentStep === 2) {
        setSaving(true);
        await updateOrganizationSettings({ 
          onboardingStep: 3,
          onboardingCallScheduled: true 
        });
        await loadSettings();
        setSaving(false);
      }
    }
  });

  const loadSettings = async () => {
    try {
      const s = await getOrganizationSettings();
      setSettings(s);
      setAgencyName(s.agencyName || "");
      setEmployeesCount(s.employeesCount || "");
      setWhatsappPhone(s.whatsappSummariesPhone || "");
      setForwardingEmail(s.forwardingEmail || "");
      
      // Migration: if they had scheduled a call before the steps logic
      if (!s.onboardingStep && s.onboardingCallScheduled) {
         setSettings({ ...s, onboardingStep: 3 });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  async function loadCreditsData() {
    try {
      setCreditsLoading(true);
      const [balance, pkgs] = await Promise.all([
        getUserCredits(),
        getCreditPackages(),
      ]);
      setCredits(balance);
      setPackages(pkgs);
    } catch (error) {
      console.error("Error loading credits:", error);
      // Fallback display
      setPackages([
        { id: "credits_50", name: "50 Créditos", amount: 500, credits: 50, currency: "eur" },
        { id: "credits_100", name: "100 Créditos", amount: 1000, credits: 100, currency: "eur" },
        { id: "credits_200", name: "200 Créditos", amount: 2000, credits: 200, currency: "eur" },
      ]);
    } finally {
      setCreditsLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadCreditsData();

    const payment = searchParams.get("payment");
    if (payment === "success") {
      updateOrganizationSettings({ onboardingStep: 5 }).then(() => {
        loadSettings();
        setTimeout(() => setSearchParams({}), 3000);
      });
    } else if (payment === "cancelled") {
      setTimeout(() => setSearchParams({}), 3000);
    }
  }, []);

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
    setExpandedSteps((prev) => ({ ...prev, [cs]: true }));
  }, [isDesktop, settings?.onboardingStep]);

  function toggleStep(step: number) {
    if (!isDesktop) return;
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  }

  const handleSaveStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      agencyName,
      employeesCount,
      whatsappSummariesPhone: whatsappPhone,
      onboardingStep: 2
    });
    await loadSettings();
    setSaving(false);
  };

  const handleSaveStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      forwardingEmail,
      onboardingStep: 4 // 4 means step 4: credits explanation
    });
    await loadSettings();
    setSaving(false);
  };

  const handleSaveStep4 = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      onboardingStep: 5 // 5 means step 5: waiting for assistant activation
    });
    await loadSettings();
    setSaving(false);
  };

  async function handlePurchase(packageId: string) {
    setPurchaseLoading(packageId);
    try {
      const checkoutUrl = await createCheckoutSession(packageId, "/onboarding");
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Error al iniciar el pago. Inténtalo de nuevo.");
    } finally {
      setPurchaseLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <PageLoading message="Cargando..." />
      </div>
    );
  }

  const isCompleted = currentStep >= 6;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">Configuración del Asistente</h1>
        <p className="text-gray-600">Completa estos pasos para empezar a utilizar tu agente de inteligencia artificial.</p>
      </div>

      <div className={cn(
        "pb-4",
        isDesktop
          ? "rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100"
          : "relative border-l-2 border-gray-200 ml-4 space-y-12"
      )}>
        
        {/* Paso 1 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 1 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 1 ? 'border-emerald-500 text-emerald-500' : 
              currentStep === 1 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400'
            }`}>
              {currentStep > 1 ? <CheckCircle size={22} className="text-emerald-500" /> : <span className="font-bold text-lg">1</span>}
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 1 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 1 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(1)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50 rounded-t-2xl"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 1 ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                  currentStep === 1 ? "border-primary-500 bg-primary-500 text-white" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 1 ? <CheckCircle size={18} className="text-emerald-600" /> : <span className="font-bold">1</span>}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Datos de tu Inmobiliaria</h2>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[1] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[1] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <form onSubmit={handleSaveStep1} className={currentStep > 1 && !saving ? "pointer-events-none opacity-80" : ""}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Inmobiliaria</label>
                  <input 
                    type="text" required
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    value={agencyName} onChange={e => setAgencyName(e.target.value)}
                    disabled={currentStep > 1 && !saving}
                    placeholder="Ej. Inmobiliaria Granados"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Trabajadores</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsEmployeesDropdownOpen(!isEmployeesDropdownOpen)}
                        disabled={currentStep > 1 && !saving}
                        className={cn(
                          "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                          isEmployeesDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400",
                          currentStep > 1 && !saving && "bg-gray-50 opacity-80 cursor-not-allowed"
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
                      disabled={currentStep > 1 && !saving}
                      placeholder="+34 XXXXXXXX"
                    />
                    <p className="text-xs text-gray-500 mt-1">Donde recibirás alertas de leads cualificados</p>
                  </div>
                </div>
              </div>
              
              {currentStep === 1 && (
                <Button
                  type="submit"
                  loading={saving}
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

        {/* Paso 2 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 2 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 2 ? 'border-emerald-500 text-emerald-500' : 
              currentStep === 2 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {currentStep > 2 ? <CheckCircle size={22} className="text-emerald-500" /> : currentStep === 2 ? <span className="font-bold text-lg">2</span> : <Lock size={16} />}
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
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 2 ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                  currentStep === 2 ? "border-primary-500 bg-primary-500 text-white" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 2 ? <CheckCircle size={18} className="text-emerald-600" /> : currentStep === 2 ? <span className="font-bold">2</span> : <Lock size={14} />}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Llamada de Onboarding</h2>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[2] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[2] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <p className="text-gray-600 mb-6">Agenda una llamada corta de 15 minutos para conectar el asistente a tu WhatsApp y ultimar detalles técnicos.</p>
            
            {currentStep === 2 && (
              <Button
                onClick={() => setShowCalendlyModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <Calendar size={18} />
                Agendar Llamada
              </Button>
            )}

            {currentStep > 2 && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">Llamada agendada correctamente.</span>
              </div>
            )}
            {currentStep < 2 && (
              <div className="text-sm text-gray-500 mt-2 bg-gray-50 p-3 rounded border border-gray-100">
                Completa el paso anterior para desbloquear la agenda.
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Paso 3 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 3 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 3 ? 'border-emerald-500 text-emerald-500' : 
              currentStep === 3 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {currentStep > 3 ? <CheckCircle size={22} className="text-emerald-500" /> : currentStep === 3 ? <span className="font-bold text-lg">3</span> : <Lock size={16} />}
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
                  currentStep > 3 ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                  currentStep === 3 ? "border-primary-500 bg-primary-500 text-white" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 3 ? <CheckCircle size={18} className="text-emerald-600" /> : currentStep === 3 ? <span className="font-bold">3</span> : <Lock size={14} />}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Conectar con Idealista</h2>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[3] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[3] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            {currentStep >= 3 && (
              <form onSubmit={handleSaveStep3} className={currentStep > 3 && !saving ? "pointer-events-none opacity-80" : ""}>
                <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-primary-900">
                    <Mail size={18} />
                    Guía de reenvío de correos
                  </h3>
                  <ol className="list-decimal list-inside space-y-3 pl-2 text-sm text-primary-800">
                    <li>Abre tu cuenta de correo electrónico de la Inmobiliaria.</li>
                    <li>Ve a los ajustes de <span className="font-bold">Filtros y direcciones bloqueadas</span>.</li>
                    <li>Crea un filtro para todos los correos que provengan de <code>idealista.com</code> con el asunto de nuevos contactos.</li>
                    <li>Configura el reenvío automático a: <code className="mt-1 inline-block rounded border border-primary-200 bg-white px-2 py-1 font-mono font-bold">optimea.es@gmail.com</code></li>
                  </ol>
                </div>

                <div className="space-y-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">¿Desde qué email se van a reenviar?</label>
                    <input 
                      type="email" required
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      value={forwardingEmail} onChange={e => setForwardingEmail(e.target.value)}
                      disabled={currentStep > 3 && !saving}
                      placeholder="tucorreo@inmobiliaria.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">Necesario para identificar tus leads y vincularlos a tu cuenta.</p>
                  </div>
                </div>

                {currentStep === 3 && (
                  <Button
                    type="submit"
                    loading={saving}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 mt-6"
                  >
                    Completar Onboarding
                    <CheckCircle size={18} />
                  </Button>
                )}
              </form>
            )}
            
            {currentStep <= 3 && (
              <div className="mt-2">
                {currentStep < 3 ? (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                    Completa los pasos anteriores para configurar la ingesta de leads.
                  </div>
                ) : null}
              </div>
            )}
            {currentStep > 3 && (
               <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">Sincronización de Idealista configurada.</span>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Paso 4 - Créditos */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 4 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 4 ? 'border-emerald-500 text-emerald-500' : 
              currentStep === 4 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {currentStep > 4 ? <CheckCircle size={22} className="text-emerald-500" /> : currentStep === 4 ? <span className="font-bold text-lg">4</span> : <Lock size={16} />}
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
                  currentStep > 4 ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                  currentStep === 4 ? "border-primary-500 bg-primary-500 text-white" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 4 ? <CheckCircle size={18} className="text-emerald-600" /> : currentStep === 4 ? <span className="font-bold">4</span> : <Lock size={14} />}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Sistema de Créditos</h2>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[4] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[4] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            {currentStep >= 4 && (
              <div className={currentStep > 4 && !saving ? "pointer-events-none opacity-80" : ""}>
                <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50 p-5">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-primary-900">
                    <Coins size={18} />
                    Funciona con Créditos
                  </h3>
                  <p className="mb-3 text-sm text-primary-800">
                    Cada conversación (hilo completo) generada con tus leads cuesta <strong>3 créditos</strong>.
                  </p>
                  <p className="rounded-lg border border-primary-200 bg-white p-3 text-sm text-primary-800 shadow-sm">
                    <strong>Ejemplo práctico:</strong> Si para un anuncio recibes 100 personas interesadas que te escriben, se gestionarán 100 conversaciones automáticamente, usando <strong>300 créditos</strong>.
                  </p>
                </div>

                {searchParams.get("payment") === "success" && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="text-emerald-600" size={20} />
                    <div>
                      <p className="font-semibold text-emerald-800 text-sm">¡Pago completado!</p>
                      <p className="text-sm text-emerald-700">Tus créditos han sido añadidos a tu cuenta.</p>
                    </div>
                  </div>
                )}
                {searchParams.get("payment") === "cancelled" && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="text-orange-600" size={20} />
                    <div>
                      <p className="font-semibold text-orange-800 text-sm">Pago cancelado</p>
                      <p className="text-sm text-orange-700">El proceso de pago no se completó.</p>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h4 className="text-md font-bold text-gray-800 mb-3">Adquiere un paquete inicial para activar tu asistente</h4>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={cn(
                          "relative bg-white border-2 p-4 rounded-btn text-center transition-all cursor-pointer shadow-sm hover:shadow-md",
                          pkg.id === "credits_100" ? "border-primary-400" : "border-gray-100 hover:border-primary-300"
                        )}
                        onClick={() => { if(currentStep === 4) handlePurchase(pkg.id) }}
                      >
                        {pkg.id === "credits_100" && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="px-2 py-0.5 bg-primary-600 text-white text-[10px] font-bold rounded-full shadow-sm uppercase tracking-wide">
                              Recomendado
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-center gap-1 mb-1 mt-2">
                          <Coins className="text-amber-500" size={18} />
                          <span className="text-xl font-bold text-gray-900">{pkg.credits}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 font-medium">créditos</p>
                        <p className="text-lg font-bold text-primary-600 mb-3">{formatPrice(pkg.amount, pkg.currency)}</p>
                        <Button
                          disabled={purchaseLoading !== null || currentStep > 4}
                          loading={purchaseLoading === pkg.id}
                          variant={pkg.id === "credits_100" ? "primary" : "outline"}
                          size="sm"
                          className="w-full text-xs font-semibold"
                        >
                          <CreditCard size={12} />
                          Comprar
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">1€ = 10 créditos • Pago 100% seguro con Stripe</p>
                </div>

                {currentStep === 4 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-100 mt-6 pt-5 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                      Saldo actual: <strong className="text-amber-600">{creditsLoading ? "..." : credits} créditos</strong>
                    </div>
                    <div className="flex flex-col items-end">
                      <Button
                        onClick={() => handleSaveStep4()}
                        disabled={credits === 0}
                        loading={saving}
                        className="flex items-center justify-center gap-2 text-sm"
                        title={credits === 0 ? "Adquiere tu primer paquete para continuar" : ""}
                      >
                        Confirmar saldo y continuar
                        <ArrowRight size={16} />
                      </Button>
                      {credits === 0 && (
                        <p className="text-xs text-orange-600 mt-1.5 font-medium">Requiere adquirir saldo primero</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {currentStep < 4 && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                Paso bloqueado. Completa las configuraciones para entender el sistema de pagos.
              </div>
            )}
            {currentStep > 4 && (
               <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">Has aceptado el funcionamiento de créditos.</span>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Paso 5 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 5 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 5 ? 'border-emerald-500 text-emerald-500' : 
              currentStep === 5 ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {currentStep > 5 ? <CheckCircle size={22} className="text-emerald-500" /> : currentStep === 5 ? <span className="font-bold text-lg">5</span> : <Lock size={16} />}
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 5 ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 5 ? "border-orange-300" : "border-gray-100")
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
                  currentStep > 5 ? "border-emerald-500 text-emerald-600 bg-emerald-50" :
                  currentStep === 5 ? "border-orange-500 bg-orange-500 text-white" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 5 ? <CheckCircle size={18} className="text-emerald-600" /> : currentStep === 5 ? <span className="font-bold">5</span> : <Lock size={14} />}
                </div>
                <h2 className="text-lg sm:text-xl font-semibold">Activación del Asistente</h2>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[5] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[5] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            {currentStep === 5 && (
               <div className="bg-orange-50 text-orange-800 p-5 rounded-lg border border-orange-200 animate-pulse">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Clock size={18} />
                  Estamos configurando tu asistente
                </h3>
                <p className="text-sm">
                  Normalmente tardamos <strong>24 horas</strong> en conectar tu cuenta y probar que todo funciona correctamente. Te notificaremos en tu panel cuando esté activo, y este paso se completará automáticamente.
                </p>
              </div>
            )}
            
            {currentStep < 5 && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                Paso bloqueado. Completa los anteriores para solicitar la activación de tu asistente.
              </div>
            )}
            {currentStep > 5 && (
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

      {showCalendlyModal && typeof window !== 'undefined' && (
        <PopupModal
          url="https://calendly.com/optimea-es"
          onModalClose={() => setShowCalendlyModal(false)}
          open={showCalendlyModal}
          rootElement={document.getElementById("root")!}
        />
      )}
    </div>
  );
}
