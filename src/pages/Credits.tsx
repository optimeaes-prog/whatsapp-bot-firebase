import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Clock,
  MessageSquare,
  LayoutGrid,
  Info,
} from "lucide-react";
import { PageHeader, SegmentedControl } from "../components/ui";
import { cn } from "../lib/utils";
import { getSubscription, getUserCredits, createSubscriptionCheckout, createBillingPortalSession } from "../services/credits";
import type { OrgSubscriptionInfo } from "../services/credits";
import { getActiveListings } from "../services/listings";
import { getLeads } from "../services/leads";
import { useSearchParams } from "react-router-dom";
import { analytics } from "../lib/analytics";

const TITLE = "#402e32";

const SUBSCRIPTION_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    priceMonthly: 0,
    assistancesMonthly: 40,
    listingsIdeal: "1 anuncio activo/mes",
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
    assistancesMonthly: 80,
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
    assistancesMonthly: 80,
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
    assistancesMonthly: 80,
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
    assistancesMonthly: 0,
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
  const [numLeads, setNumLeads] = useState(60);
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  const [actualListings, setActualListings] = useState<number | null>(null);
  const [actualLeads, setActualLeads] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const simulatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseListings = actualListings ?? numListings;
  const rawConversations = (numLeads / Math.max(baseListings, 1)) * numListings;
  const conversations = Math.ceil(rawConversations / 40) * 40;
  const hoursSaved = Math.round((conversations * 7) / 60);

  const annualTotalFromMonthly = (monthly: number | null) => {
    if (monthly === null) return 0;
    return (monthly * 12) * 0.85;
  };

  const formatEuroAmount = (amount: number) => amount.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  useEffect(() => {
    async function loadData() {
      try {
        const [sub, creds, listings, leads] = await Promise.all([
          getSubscription().catch(() => null),
          getUserCredits().catch(() => 0),
          getActiveListings().catch(() => []),
          getLeads().catch(() => []),
        ]);
        setSubscription(sub);
        setCredits(creds);
        if (sub?.billingInterval) {
          setPlanBilling(sub.billingInterval === "year" ? "annual" : "monthly");
        }

        const activeCount = listings.length;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        const recentLeads = leads.filter(l => {
          const raw = l.createdAt ?? l.firstMessageDate ?? l.lastMessageDate;
          if (!raw) return false;
          const date = raw?.toDate ? raw.toDate() : new Date(raw);
          return date >= thirtyDaysAgo;
        });

        const safeListings = Math.max(activeCount, 1);
        const safeLeads = recentLeads.length;

        setActualListings(safeListings);
        setActualLeads(safeLeads);
        setNumListings(safeListings);
        setNumLeads(safeLeads);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Track payment return from Stripe
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      analytics.trackPaymentSuccess("subscription");
      setSearchParams({}, { replace: true });
    } else if (payment === "cancelled") {
      analytics.trackPaymentCancelled("subscription");
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Debounced simulator tracking
  useEffect(() => {
    if (simulatorTimerRef.current) clearTimeout(simulatorTimerRef.current);
    simulatorTimerRef.current = setTimeout(() => {
      const recommendedPlan =
        numListings <= 2 ? "plus" :
        numListings <= 7 ? "pro" :
        numListings <= 25 ? "pro_plus" : "enterprise";
      analytics.trackSimulatorAdjusted({ listings: numListings, leads: numLeads, recommended_plan: recommendedPlan });
    }, 800);
    return () => {
      if (simulatorTimerRef.current) clearTimeout(simulatorTimerRef.current);
    };
  }, [numListings, numLeads]);

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

  const handleManageSubscription = async (planId: string) => {
    setPurchaseLoading(planId);
    analytics.trackBillingPortalOpened(planId);
    try {
      const url = await createBillingPortalSession("/suscripcion");
      window.location.href = url;
    } catch (error) {
      console.error(error);
      toast.error("Error abriendo el portal de facturación");
      setPurchaseLoading(null);
    }
  };

  const currentPlanId = subscription?.planId ?? "free";
  const hasActivePaidSub = subscription?.status === "active" && currentPlanId !== "free";
  
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
            {(() => {
              const contracted = subscription?.contractedConversations ?? (subscription?.planId === "free" ? 40 : 80);
              const consumed = Math.max(0, contracted - credits);
              const availablePct = contracted > 0 ? Math.min(100, (credits / contracted) * 100) : 0;
              const consumedPct = contracted > 0 ? Math.min(100, (consumed / contracted) * 100) : 0;
              const strokeColor = availablePct > 25 ? "#10B981" : availablePct > 10 ? "#F59E0B" : "#EF4444";
              return (
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 shrink-0 relative flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 absolute inset-0">
                      <circle cx="40" cy="40" r="36" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r="36" fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="6" strokeDasharray={226}
                        strokeDashoffset={226 - (consumedPct * 226) / 100}
                        strokeLinecap="round"
                      />
                      <circle
                        cx="40" cy="40" r="36" fill="none"
                        stroke={strokeColor}
                        strokeWidth="6" strokeDasharray={226}
                        strokeDashoffset={226 - (availablePct * 226) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                    <MessageSquare className={cn(availablePct > 25 ? "text-emerald-500" : "text-rose-500")} size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-x-8 gap-y-2">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Contratadas</p>
                        <p className="text-2xl font-bold text-gray-900 font-heading tabular-nums">{contracted.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Consumidas</p>
                        <p className="text-2xl font-bold text-gray-700 font-heading tabular-nums">{consumed.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading">Disponibles</p>
                        <p className="text-2xl font-bold tabular-nums font-heading" style={{ color: strokeColor }}>{credits.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-medium">
                      Renovación: {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES") : "Ilimitado"}
                    </p>
                  </div>
                </div>
              );
            })()}
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


      {/* Simulator Section */}
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

                {/* Listings Slider */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">Anuncios activos/mes</span>
                    <div className="flex items-end gap-2">
                      {actualListings !== null && numListings !== actualListings && (
                        <button
                          onClick={() => setNumListings(actualListings)}
                          className="flex flex-col items-center group"
                          title="Volver al valor actual"
                        >
                          <span className="text-[9px] text-[#6b5040] uppercase font-bold font-heading tracking-wide group-hover:text-[#ab8b67] transition-colors">actual</span>
                          <span className="text-sm font-black text-[#6b5040] font-heading group-hover:text-[#ab8b67] transition-colors line-through decoration-[#6b5040]">
                            {actualListings}
                          </span>
                        </button>
                      )}
                      <div className="flex flex-col items-center">
                        {numListings !== actualListings && actualListings !== null && (
                          <span className="text-[9px] text-primary-400 uppercase font-bold font-heading tracking-wide">nuevo</span>
                        )}
                        <span className="text-primary-400 text-lg font-black font-heading tracking-tight leading-none">
                          {numListings > 25 ? "25+" : numListings}
                        </span>
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="26"
                    step="1"
                    value={numListings}
                    onChange={(e) => setNumListings(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#4d3b2d] rounded-full appearance-none cursor-pointer accent-primary-400 hover:accent-primary-300 transition-all"
                  />
                  <div className="flex justify-between text-[10px] text-[#8b6b47] mt-2 font-bold font-heading">
                    <span>1</span>
                    <span>13</span>
                    <span>25+</span>
                  </div>
                </div>

                {/* Leads Slider */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">Leads / mes</span>
                    <div className="flex items-end gap-2">
                      {actualLeads !== null && numLeads !== actualLeads && (
                        <button
                          onClick={() => setNumLeads(actualLeads)}
                          className="flex flex-col items-center group"
                          title="Volver al valor actual"
                        >
                          <span className="text-[9px] text-[#6b5040] uppercase font-bold font-heading tracking-wide group-hover:text-[#ab8b67] transition-colors">actual</span>
                          <span className="text-sm font-black text-[#6b5040] font-heading group-hover:text-[#ab8b67] transition-colors line-through decoration-[#6b5040]">
                            {actualLeads}
                          </span>
                        </button>
                      )}
                      <div className="flex flex-col items-center">
                        {numLeads !== actualLeads && actualLeads !== null && (
                          <span className="text-[9px] text-emerald-400 uppercase font-bold font-heading tracking-wide">nuevo</span>
                        )}
                        <span className="text-emerald-400 text-lg font-black font-heading tracking-tight leading-none">
                          {numLeads}
                        </span>
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="5"
                    value={numLeads}
                    onChange={(e) => setNumLeads(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#4d3b2d] rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                  />
                  <div className="flex justify-between text-[10px] text-[#8b6b47] mt-2 font-bold font-heading">
                    <span>0</span>
                    <span>250</span>
                    <span>500+</span>
                  </div>
                </div>

              </div>

              {/* Metrics + Billing Toggle */}
              <div className="w-full lg:w-2/5 flex flex-col items-center gap-6 border-t lg:border-t-0 lg:border-l border-[#3d2b1d] pt-8 lg:pt-0 lg:pl-10">
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
                  <div className="text-center text-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70 font-heading">Conversaciones a contratar / mes</p>
                    <p className="text-lg font-black font-heading leading-none tabular-nums text-primary-400">
                      {conversations.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center group relative">
                    <div className="flex items-center gap-1 mb-1 justify-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70 font-heading">Ahorro</p>
                      <Info size={10} className="text-slate-400 opacity-50 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-white rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center font-medium leading-tight">
                        Calculado en base a un tiempo estimado de 7 minutos ahorrados por cada conversación.
                      </div>
                    </div>
                    <p className="text-lg font-black text-emerald-400 font-heading leading-none tabular-nums">{hoursSaved}h/mes</p>
                  </div>
                </div>

                <SegmentedControl
                  ariaLabel="Facturación"
                  colorScheme="amber"
                  value={planBilling}
                  onChange={(v) => { setPlanBilling(v); analytics.trackBillingToggle(v); }}
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
            const isBoth = isCurrentPlan && isRecommended;

            return (
              <div key={plan.id} className="relative flex flex-col h-full">
                {(isRecommended || isBoth) && (
                  <div className={cn(
                    "absolute -top-8 left-0 right-0 text-[10px] font-black h-8 flex items-center justify-center rounded-t-2xl uppercase tracking-widest border-2 border-b-0 font-heading",
                    isBoth
                      ? "bg-gradient-to-r from-amber-500 to-primary-500 text-white border-primary-500"
                      : "bg-primary-500 text-white border-primary-500"
                  )}>
                    {isBoth ? "Tu Plan · Recomendado" : "Recomendado"}
                  </div>
                )}
                <div
                  className={cn(
                    "flex-1 flex flex-col p-4 transition-all duration-300 border-2",
                    isBoth
                      ? "border-primary-500 rounded-b-2xl bg-white"
                      : isRecommended
                        ? "border-primary-500 rounded-b-2xl bg-white"
                        : isCurrentPlan
                          ? "border-amber-400 rounded-2xl bg-amber-50/30"
                          : "border-gray-100 rounded-2xl bg-white hover:border-gray-200"
                  )}
                >
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 text-base font-heading">{plan.name}</p>
                      {isCurrentPlan && !isBoth && <span className="ml-auto text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Activo</span>}
                      {isBoth && <span className="ml-auto text-[10px] uppercase font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">Activo</span>}
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
                        </div>
                      ) : (
                        <div className="mb-4">
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                            <span className="text-2xl font-bold text-gray-900">{formatEuroAmount(annualTotalFromMonthly(currentPriceMonthly) / 12)}€</span>
                            <span className="text-xs text-gray-500">/mes</span>
                            <span className="text-[10px] font-bold text-gray-900 px-1.5 py-0.5 rounded bg-primary-200 font-heading">−15%</span>
                          </div>
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
                      disabled={isCurrentPlan || purchaseLoading === plan.id}
                      onClick={() => {
                        if (plan.id === "enterprise") {
                          analytics.trackCtaClick({ location: "pricing", label: "enterprise_contact" });
                          window.location.href = "mailto:hola@proplead.com";
                        } else if (plan.priceMonthly === 0 || isCurrentPlan) {
                          // free or already on this plan — no action
                        } else if (hasActivePaidSub) {
                          handleManageSubscription(plan.id);
                        } else {
                          const value = planBilling === "annual"
                            ? annualTotalFromMonthly(currentPriceMonthly)
                            : (currentPriceMonthly ?? 0);
                          analytics.trackBeginCheckout({
                            plan_id: plan.id,
                            plan_name: plan.name,
                            billing_interval: planBilling,
                            value,
                          });
                          handleSubscribe(plan.id, planBilling, extraBlocks);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 w-full py-2 rounded-btn border text-sm font-bold font-heading transition-colors",
                        isCurrentPlan
                          ? "bg-amber-100 border-amber-300 text-amber-900 opacity-50 cursor-not-allowed"
                          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      )}
                    >
                      {purchaseLoading === plan.id ? (
                        <><Loader2 className="animate-spin" size={14} /> Procesando...</>
                      ) : isCurrentPlan
                        ? "Plan activo"
                        : plan.id === "enterprise"
                          ? "Contactar"
                          : plan.priceMonthly === 0
                            ? "Gratis"
                            : hasActivePaidSub
                              ? "Cambiar plan"
                              : "Contratar"}
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
