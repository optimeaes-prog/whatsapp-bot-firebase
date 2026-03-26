import { useState, useEffect } from "react";
import { CheckCircle, Lock, ArrowRight, Calendar, Mail, Clock, Coins } from "lucide-react";
import { getOrganizationSettings, updateOrganizationSettings } from "../services/organization";
import type { OrganizationSettings } from "../services/organization";
import { PopupModal, useCalendlyEventListener } from "react-calendly";
import { useSearchParams } from "react-router-dom";
import { getUserCredits, getCreditPackages, createCheckoutSession, formatPrice } from "../services/credits";
import type { CreditPackage } from "../types";
import { CreditCard, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

export function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);

  // Form states for step 1
  const [agencyName, setAgencyName] = useState("");
  const [employeesCount, setEmployeesCount] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  
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
      onboardingStep: 5 // 5 means step 5: waiting for bot activation
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
      alert("Error al iniciar el pago. Inténtalo de nuevo.");
    } finally {
      setPurchaseLoading(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Cargando...</div>;
  }

  const isCompleted = currentStep >= 6;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración del Bot</h1>
        <p className="text-gray-600">Completa estos pasos para empezar a utilizar tu agente de inteligencia artificial.</p>
      </div>

      <div className="relative border-l-2 border-gray-200 ml-4 space-y-12 pb-4">
        
        {/* Paso 1 */}
        <div className={`ml-8 relative transition-all duration-300 ${currentStep >= 1 ? 'opacity-100' : 'opacity-60'}`}>
          <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
            currentStep > 1 ? 'border-green-500 text-green-500' : 
            currentStep === 1 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400'
          }`}>
            {currentStep > 1 ? <CheckCircle size={22} className="text-green-500" /> : <span className="font-bold text-lg">1</span>}
          </div>
          
          <div className={`card p-6 shadow-sm border ${currentStep === 1 ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                Datos de tu Inmobiliaria
              </h2>
            </div>
            
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
                    <select 
                      required
                      className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                      value={employeesCount} onChange={e => setEmployeesCount(e.target.value)}
                      disabled={currentStep > 1 && !saving}
                    >
                      <option value="" disabled>Selecciona un rango</option>
                      <option value="1">1</option>
                      <option value="2-5">2-5</option>
                      <option value="5-20">5-20</option>
                      <option value="20-50">20-50</option>
                      <option value="50-100">50-100</option>
                      <option value="+100">+100</option>
                    </select>
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
                <button 
                  type="submit" disabled={saving}
                  className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 mt-6"
                >
                  {saving ? "Guardando..." : "Guardar y Continuar"}
                  {!saving && <ArrowRight size={18} />}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Paso 2 */}
        <div className={`ml-8 relative transition-all duration-300 ${currentStep >= 2 ? 'opacity-100' : 'opacity-60'}`}>
          <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
            currentStep > 2 ? 'border-green-500 text-green-500' : 
            currentStep === 2 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
          }`}>
            {currentStep > 2 ? <CheckCircle size={22} className="text-green-500" /> : currentStep === 2 ? <span className="font-bold text-lg">2</span> : <Lock size={16} />}
          </div>
          
          <div className={`card p-6 shadow-sm border ${currentStep === 2 ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                Llamada de Onboarding
              </h2>
            </div>
            
            <p className="text-gray-600 mb-6">Agenda una llamada corta de 15 minutos para conectar el bot a tu WhatsApp y ultimar detalles técnicos.</p>
            
            {currentStep === 2 && (
              <button 
                onClick={() => setShowCalendlyModal(true)}
                className="btn-primary flex items-center justify-center w-full sm:w-auto gap-2"
              >
                <Calendar size={18} />
                Agendar Llamada
              </button>
            )}

            {currentStep > 2 && (
              <div className="bg-green-50 text-green-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-green-200">
                <CheckCircle size={20} className="text-green-600" />
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

        {/* Paso 3 */}
        <div className={`ml-8 relative transition-all duration-300 ${currentStep >= 3 ? 'opacity-100' : 'opacity-60'}`}>
          <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
            currentStep > 3 ? 'border-green-500 text-green-500' : 
            currentStep === 3 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
          }`}>
            {currentStep > 3 ? <CheckCircle size={22} className="text-green-500" /> : currentStep === 3 ? <span className="font-bold text-lg">3</span> : <Lock size={16} />}
          </div>

          <div className={`card p-6 shadow-sm border ${currentStep === 3 ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                Conectar con Idealista
              </h2>
            </div>
            
            {currentStep >= 3 && (
              <form onSubmit={handleSaveStep3} className={currentStep > 3 && !saving ? "pointer-events-none opacity-80" : ""}>
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 mb-6">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <Mail size={18} />
                    Guía de reenvío de correos
                  </h3>
                  <ol className="list-decimal list-inside text-sm text-blue-800 space-y-3 pl-2">
                    <li>Abre tu cuenta de correo electrónico de la Inmobiliaria.</li>
                    <li>Ve a los ajustes de <span className="font-bold">Filtros y direcciones bloqueadas</span>.</li>
                    <li>Crea un filtro para todos los correos que provengan de <code>idealista.com</code> con el asunto de nuevos contactos.</li>
                    <li>Configura el reenvío automático a: <code className="bg-white px-2 py-1 inline-block rounded font-mono font-bold border border-blue-200 mt-1">optimea.es@gmail.com</code></li>
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
                  <button 
                    type="submit" disabled={saving}
                    className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 mt-6"
                  >
                    {saving ? "Completando..." : "Completar Onboarding"}
                    {!saving && <CheckCircle size={18} />}
                  </button>
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
               <div className="mt-4 bg-green-50 text-green-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-green-200">
                <CheckCircle size={20} className="text-green-600" />
                <span className="font-medium">Sincronización de Idealista configurada.</span>
              </div>
            )}
          </div>
        </div>

        {/* Paso 4 - Créditos */}
        <div className={`ml-8 relative transition-all duration-300 ${currentStep >= 4 ? 'opacity-100' : 'opacity-60'}`}>
          <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
            currentStep > 4 ? 'border-green-500 text-green-500' : 
            currentStep === 4 ? 'border-primary-500 bg-primary-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
          }`}>
            {currentStep > 4 ? <CheckCircle size={22} className="text-green-500" /> : currentStep === 4 ? <span className="font-bold text-lg">4</span> : <Lock size={16} />}
          </div>

          <div className={`card p-6 shadow-sm border ${currentStep === 4 ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                Sistema de Créditos
              </h2>
            </div>
            
            {currentStep >= 4 && (
              <div className={currentStep > 4 && !saving ? "pointer-events-none opacity-80" : ""}>
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-100 mb-6">
                  <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <Coins size={18} />
                    Funciona con Créditos
                  </h3>
                  <p className="text-sm text-blue-800 mb-3">
                    Cada conversación (hilo completo) generada con tus leads cuesta <strong>2 créditos</strong>.
                  </p>
                  <p className="text-sm text-blue-800 bg-white p-3 rounded-lg border border-blue-200 shadow-sm">
                    <strong>Ejemplo práctico:</strong> Si para un anuncio recibes 100 personas interesadas que te escriben, se gestionarán 100 conversaciones automáticamente, usando <strong>200 créditos</strong>.
                  </p>
                </div>

                {searchParams.get("payment") === "success" && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <CheckCircle className="text-green-600" size={20} />
                    <div>
                      <p className="font-semibold text-green-800 text-sm">¡Pago completado!</p>
                      <p className="text-sm text-green-700">Tus créditos han sido añadidos a tu cuenta.</p>
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
                  <h4 className="text-md font-bold text-gray-800 mb-3">Adquiere un paquete inicial para activar tu bot</h4>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={cn(
                          "relative bg-white border-2 p-4 rounded-xl text-center transition-all cursor-pointer shadow-sm hover:shadow-md",
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
                        <button
                          disabled={purchaseLoading !== null || currentStep > 4}
                          className={cn(
                            "w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors border",
                            pkg.id === "credits_100"
                              ? "bg-primary-600 text-white border-primary-600 hover:bg-primary-700"
                              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                          )}
                        >
                          {purchaseLoading === pkg.id ? (
                            <><Loader2 className="animate-spin" size={12} /> Procesando</>
                          ) : (
                            <><CreditCard size={12} /> Comprar</>
                          )}
                        </button>
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
                      <button 
                        onClick={() => handleSaveStep4()}
                        disabled={saving || credits === 0}
                        className="btn-primary flex items-center justify-center gap-2 text-sm"
                        title={credits === 0 ? "Adquiere tu primer paquete para continuar" : ""}
                      >
                        {saving ? "Confirmando..." : "Confirmar saldo y continuar"}
                        {!saving && <ArrowRight size={16} />}
                      </button>
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
               <div className="mt-4 bg-green-50 text-green-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-green-200">
                <CheckCircle size={20} className="text-green-600" />
                <span className="font-medium">Has aceptado el funcionamiento de créditos.</span>
              </div>
            )}
          </div>
        </div>

        {/* Paso 5 */}
        <div className={`ml-8 relative transition-all duration-300 ${currentStep >= 5 ? 'opacity-100' : 'opacity-60'}`}>
          <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
            currentStep > 5 ? 'border-green-500 text-green-500' : 
            currentStep === 5 ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 text-gray-400 bg-gray-50'
          }`}>
            {currentStep > 5 ? <CheckCircle size={22} className="text-green-500" /> : currentStep === 5 ? <span className="font-bold text-lg">5</span> : <Lock size={16} />}
          </div>

          <div className={`card p-6 shadow-sm border ${currentStep === 5 ? 'border-orange-500 ring-1 ring-orange-500' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-3">
                Activación del Bot
              </h2>
            </div>
            
            {currentStep === 5 && (
               <div className="bg-orange-50 text-orange-800 p-5 rounded-lg border border-orange-200 animate-pulse">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Clock size={18} />
                  Estamos configurando tu bot
                </h3>
                <p className="text-sm">
                  Normalmente tardamos <strong>24 horas</strong> en conectar tu cuenta y probar que todo funciona correctamente. Te notificaremos en tu panel cuando esté activo, y este paso se completará automáticamente.
                </p>
              </div>
            )}
            
            {currentStep < 5 && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                Paso bloqueado. Completa los anteriores para solicitar la activación de tu bot.
              </div>
            )}
            {currentStep > 5 && (
               <div className="mt-4 bg-green-50 text-green-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-green-200">
                <CheckCircle size={20} className="text-green-600" />
                <span className="font-medium">¡Bot activado y funcionando!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {isCompleted && (
        <div className="mt-12 bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm ml-4 lg:ml-0">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-green-600 w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-green-900 mb-2">¡Todo Listo!</h3>
          <p className="text-green-800 mb-6 max-w-lg mx-auto text-sm sm:text-base">
            Has completado todos los pasos de configuración. Ahora Proplead está listo para atender y cualificar a tus leads automáticamente las 24 horas.
          </p>
          <a href="/dashboard" className="btn-primary inline-flex items-center gap-2">
            Ir al Dashboard <ArrowRight size={18} />
          </a>
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
