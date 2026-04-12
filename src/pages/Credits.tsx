import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Clock,
  MessageSquare,
  LayoutGrid,
} from "lucide-react";
import { PageHeader, SegmentedControl } from "../components/ui";
import { cn } from "../lib/utils";
import { getSubscription, getUserCredits, createSubscriptionCheckout } from "../services/credits";
import type { OrgSubscriptionInfo } from "../services/credits";

const TITLE = "#402e32";

const SUBSCRIPTION_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    priceMonthly: 0,
    benefits: [
      "Soporte hasta 72h",
      "Acceso: 1 agente",
      "Solo leads de mensajes",
    ],
  },
  {
    id: "plus" as const,
    name: "Plus",
    priceMonthly: 19,
    listingsIdeal: "2-4 anuncios activos/mes",
    benefits: [
      "Compra 40 conversaciones por 10€ cuando quieras",
      "Soporte hasta 24h",
      "Acceso: 1 agente",
      "Leads de mensajes y llamadas",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    priceMonthly: 69,
    listingsIdeal: "3–6 anuncios activos/mes",
    benefits: [
      "Compra 40 conversaciones por 10€ cuando quieras",
      "Soporte hasta 6h",
      "Acceso multi-agente",
      "Leads de mensajes y llamadas",
      "Promoción de marca en cualificación",
    ],
  },
  {
    id: "pro_plus" as const,
    name: "Pro+",
    priceMonthly: 99,
    listingsIdeal: "6–12 anuncios activos/mes",
    benefits: [
      "Compra 40 conversaciones por 10€ cuando quieras",
      "Soporte dedicado 1 a 1",
      "Acceso multi-agente",
      "Leads de mensajes y llamadas",
      "Promoción de marca en cualificación",
      "Avatar IA personalizado",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    priceMonthly: null as number | null,
    listingsIdeal: "A medida",
    benefits: [
      "Soporte dedicado SLA",
      "Funciones personalizadas",
      "Acceso a API y Webhooks",
      "Volumen a medida",
    ],
  },
] as const;

export function Credits() {
  const [numListings, setNumListings] = useState(3);
  const [demandValue, setDemandValue] = useState(40);
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);

  const conversations = numListings * demandValue;

  const annualTotalFromMonthly = (monthly: number | null) => {
    if (monthly === null) return 0;
    return (monthly * 12) * 0.85; // 15% discount
  };

  const formatEuroAmount = (amount: number) => amount.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  useEffect(() => {
    async function loadData() {
      try {
        const [sub, creds] = await Promise.all([
          getSubscription().catch(() => null),
          getUserCredits().catch(() => 0)
        ]);
        setSubscription(sub);
        setCredits(creds);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSubscribe = async (planId: string, billing: "monthly" | "annual", extraBlocks: number) => {
    setPurchaseLoading(planId);
    try {
      const url = await createSubscriptionCheckout(
        planId as any,
        billing === "annual" ? "year" : "month",
        extraBlocks,
        "/suscripcion"
      );
      window.location.href = url;
    } catch (error) {
      console.error(error);
      toast.error("Error iniciando pago");
      setPurchaseLoading(null);
    }
  };

  const currentPlanId = subscription?.planId ?? "free";
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-500 mb-4" size={32} />
        <p className="text-gray-500 font-medium">Cargando suscripción...</p>
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-7xl mx-auto">
      <PageHeader
        title="Suscripción"
        subtitle="Gestiona tu plan activo y volumen mensual"
        className="mb-8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 card p-6 bg-gradient-to-br from-white to-primary-50/30 border border-primary-100 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest font-heading mb-4">Balance de Conversaciones</h3>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 shrink-0 relative flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 absolute inset-0">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                  <circle 
                    cx="40" cy="40" r="36" fill="none" 
                    stroke={credits > 20 ? "#10B981" : credits > 5 ? "#F59E0B" : "#EF4444"} 
                    strokeWidth="6" strokeDasharray={226} 
                    strokeDashoffset={226 - (Math.min(100, (credits / 80) * 100) * 226) / 100} 
                    strokeLinecap="round" 
                  />
                </svg>
                <MessageSquare className={cn(credits > 20 ? "text-emerald-500" : "text-rose-500")} size={24} />
              </div>
              <div>
                <p className="text-4xl font-bold text-gray-900 font-heading tabular-nums">
                  {credits.toLocaleString()} <span className="text-xl font-medium text-gray-500">disponibles</span>
                </p>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                  Renovación: {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "Ilimitado"}
                </p>
              </div>
            </div>
        </div>

        <div className="card p-6 bg-white flex flex-col items-center justify-center border-2 border-primary-100">
           <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading mb-2">Tu Plan Actual</p>
           <h2 className="text-3xl font-extrabold text-primary-600 font-heading uppercase mb-1">
             {currentPlanId === "plus" ? "Plus" : currentPlanId === "pro" ? "Pro" : currentPlanId === "pro_plus" ? "Pro+" : "Free"}
           </h2>
           <p className="text-xs text-gray-400 font-medium">
             {subscription?.status === "active" ? "Suscripción activa" : "Plan gratuito"}
           </p>
           {subscription?.status === "active" && (
             <div className="mt-4 pt-4 border-t border-gray-100 w-full text-center">
               <a href="mailto:hola@proplead.com" className="text-xs text-primary-600 font-bold hover:underline">Solicitar historial de facturas</a>
             </div>
           )}
        </div>
      </div>


      {/* Simulator Section from Landing */}
      <div className="max-w-5xl mx-auto mb-10 relative px-4 sm:px-0">
          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold tracking-tight mb-2 font-heading" style={{ color: TITLE }}>
              Configurar o Actualizar Plan
            </h2>
            <p className="text-sm font-black uppercase tracking-[0.2em] opacity-50 font-heading" style={{ color: TITLE }}>
              Usa este simulador para ajustar tu suscripción
            </p>
          </div>
          <div className="bg-[#2d1b0d] rounded-2xl shadow-xl border border-[#3d2b1d] overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="flex-1 w-full lg:w-3/5 px-4 space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">Anuncios activos/mes</span>
                    <span className="text-primary-400 text-lg font-black font-heading tracking-tight">
                      {numListings} <span className="text-xs font-semibold text-[#8b6b47] tracking-widest uppercase">propiedades</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={numListings}
                    onChange={(e) => setNumListings(parseInt(e.target.value))}
                    className="w-full h-2 bg-[#3d2b1d] rounded-lg appearance-none cursor-pointer accent-primary-500 hover:accent-primary-400 transition-all border border-[#4d3b2d]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8b6b47] mt-2 font-bold font-heading">
                    <span>1</span>
                    <span>25</span>
                    <span>50+</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">Demanda esperada</span>
                    <span className="text-emerald-400 text-lg font-black font-heading tracking-tight">
                      {demandValue === 20 ? "Baja" : demandValue === 40 ? "Normal" : "Alta"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="80"
                    step="20"
                    value={demandValue}
                    onChange={(e) => setDemandValue(parseInt(e.target.value))}
                    className="w-full h-2 bg-[#3d2b1d] rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all border border-[#4d3b2d]"
                  />
                  <div className="flex justify-between text-[10px] text-[#8b6b47] mt-2 font-bold font-heading">
                    <span>Tranquilo (~20 leads/anuncio)</span>
                    <span className="text-right">Fuego (~80 leads/anuncio)</span>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-2/5 flex flex-col items-center border-t lg:border-t-0 lg:border-l border-[#3d2b1d] pt-8 lg:pt-0 lg:pl-10">
                <div className="text-center mb-6">
                  <span className="text-[11px] font-black text-[#8b6b47] uppercase tracking-widest font-heading block mb-2">Necesitarás aprox.</span>
                  <div className="flex items-baseline justify-center gap-1.5 text-white">
                    <span className="text-5xl font-black tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-br from-white to-[#d4bca4]">{conversations.toLocaleString()}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary-400 tracking-wide">conversaciones / mes</span>
                </div>
                
                <SegmentedControl
                  ariaLabel="Facturación"
                  colorScheme="amber"
                  value={planBilling}
                  onChange={setPlanBilling}
                  options={[
                    { value: "monthly", label: "Mensual" },
                    { value: "annual", label: "Anual", badge: "−15%" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 max-w-[1500px] mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isEnterprise = plan.id === "enterprise";
            const isFree = plan.id === "free";
            const extraConversations = isFree ? 0 : Math.max(0, conversations - 80);
            const extraBlocks = extraConversations / 40;
            const extraPrice = extraBlocks * 10;
            const currentPriceMonthly = plan.priceMonthly !== null ? plan.priceMonthly + extraPrice : null;

            const isRecommended = 
              (numListings <= 2 && plan.id === "plus") ||
              (numListings >= 3 && numListings <= 7 && plan.id === "pro") ||
              (numListings >= 8 && numListings <= 25 && plan.id === "pro_plus") ||
              (numListings > 25 && plan.id === "enterprise");
              
            const isCurrentPlan = currentPlanId === plan.id;

            return (
              <div key={plan.id} className="relative flex flex-col h-full">
                {isRecommended && (
                  <div className="absolute -top-8 left-0 right-0 bg-primary-500 text-white text-[10px] font-black h-8 flex items-center justify-center rounded-t-2xl uppercase tracking-widest border-2 border-primary-500 border-b-0 font-heading">
                    Recomendado
                  </div>
                )}
                <div 
                  className={cn(
                    "flex-1 flex flex-col p-4 transition-all duration-300 border-2",
                    isRecommended 
                      ? "border-primary-500 rounded-b-2xl bg-white" 
                      : isCurrentPlan
                        ? "border-amber-400 rounded-2xl bg-amber-50/30"
                        : "border-gray-100 rounded-2xl bg-white hover:border-gray-200"
                  )}
                >
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 text-base font-heading">{plan.name}</p>
                      {isCurrentPlan && <span className="ml-auto text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Activo</span>}
                    </div>

                    {isEnterprise ? (
                      <div className="mb-4">
                        <p className="text-sm text-gray-500">Personalizado</p>
                        <div className="flex items-start gap-1.5 mt-2">
                          <LayoutGrid size={12} className="text-gray-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-600">Ideal: {plan.listingsIdeal}</span>
                        </div>
                      </div>
                    ) : (currentPriceMonthly === 0 && !isFree) ? (
                      <p className="text-2xl font-bold text-gray-900 mb-4">Gratis</p>
                    ) : currentPriceMonthly != null ? (
                      planBilling === "monthly" ? (
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold text-gray-900">{formatEuroAmount(currentPriceMonthly)}€</span>
                            <span className="text-xs text-gray-500">/mes</span>
                          </div>
                          {extraPrice > 0 ? (
                            <p className="text-[10px] text-gray-500 mt-1 font-medium font-heading whitespace-nowrap">
                              (+{extraPrice}€ por {extraConversations} extra)
                            </p>
                          ) : (
                            <p className="text-[10px] text-transparent mt-1 font-medium font-heading whitespace-nowrap select-none" aria-hidden="true">
                              &nbsp;
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mb-4">
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                            <span className="text-2xl font-bold text-gray-900">{formatEuroAmount(annualTotalFromMonthly(currentPriceMonthly) / 12)}€</span>
                            <span className="text-xs text-gray-500">/mes</span>
                            <span className="text-[10px] font-bold text-gray-900 px-1.5 py-0.5 rounded bg-primary-200 font-heading">−15%</span>
                          </div>
                          {extraPrice > 0 ? (
                            <p className="text-[10px] text-gray-500 mt-1 font-medium font-heading whitespace-nowrap">
                              (+10€ por cada 40 exp)
                            </p>
                          ) : (
                            <p className="text-[10px] text-transparent mt-1 font-medium font-heading whitespace-nowrap select-none" aria-hidden="true">
                              &nbsp;
                            </p>
                          )}
                        </div>
                      )
                    ) : null}

                    {!isEnterprise && (
                      <div className="mb-4">
                        <div className="space-y-1 mb-3">
                          <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-heading">Consumo mensual</label>
                          <div className="flex items-start gap-1.5 pt-1">
                            <MessageSquare size={13} className="text-primary-500 shrink-0 mt-0.5" />
                            <span className="text-xs text-primary-600 font-bold leading-tight font-heading">
                              {(isFree ? 40 : Math.max(80, conversations)).toLocaleString()} conversaciones
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 group relative">
                            <Clock size={13} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-emerald-600 font-heading">
                              {Math.round(((isFree ? 40 : Math.max(80, conversations)) * 7) / 60)}h ahorradas
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <ul className={cn("mb-4 flex-1 space-y-2 pt-3", !isEnterprise && "border-t border-gray-100")}>
                      {plan.benefits.map((line) => (
                        <li key={line} className="flex gap-2 text-xs text-gray-600 leading-snug">
                          <Check className="shrink-0 text-emerald-500 mt-0.5" size={14} aria-hidden />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>

                    <button 
                      disabled={purchaseLoading === plan.id}
                      onClick={() => {
                        if (plan.priceMonthly === 0 || plan.id === "enterprise") {
                          if (plan.id === "enterprise") window.location.href = "mailto:hola@proplead.com";
                        } else {
                          handleSubscribe(plan.id, planBilling, extraBlocks);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 w-full py-2 rounded-btn border text-sm font-bold font-heading transition-colors",
                        isCurrentPlan ? "bg-amber-100 border-amber-300 text-amber-900 opacity-50 cursor-not-allowed" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      )}
                    >
                      {purchaseLoading === plan.id ? (
                        <><Loader2 className="animate-spin" size={14} /> Procesando...</>
                      ) : isCurrentPlan ? "Plan activo" : plan.id === "enterprise" ? "Contactar" : plan.priceMonthly === 0 ? "Gratis" : "Contratar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
}
