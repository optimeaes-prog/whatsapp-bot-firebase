import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  Clock,
  MessageSquare,
  LayoutGrid,
  Info,
  Rocket,
  ExternalLink,
  Minus,
  Plus,
} from "lucide-react";
import { Button, PageHeader, SegmentedControl } from "../components/ui";
import { cn } from "../lib/utils";
  import { getSubscription, getAvailableConversations, createSubscriptionCheckout, createCheckoutSession, previewSubscriptionChange, createBillingPortalSession, activateFreePlanAndFetch } from "../services/subscription";
import type { OrgSubscriptionInfo, SubscriptionChangePreview } from "../services/subscription";
import { BreakdownModal, type SubscriptionChangeData } from "../components/BreakdownModal";
import { getActiveListings } from "../services/listings";
import { getLeads } from "../services/leads";
import { useSearchParams } from "react-router-dom";
import { analytics } from "../lib/analytics";
import { useAuth } from "../contexts/AuthContext";

const TITLE = "#402e32";

const PLAN_NAMES: Record<string, string> = {
  none: "Sin plan",
  free: "Free",
  plus: "Plus",
  pro: "Pro",
  pro_plus: "Pro+",
  enterprise: "Enterprise",
};

const SUBSCRIPTION_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    priceMonthly: 0,
    conversationsMonthly: 40,
    listingsIdeal: "1 anuncio activo/mes",
    benefits: [
      "Respuesta de soporte maximo 72h",
      "Acceso: 1 agente",
      "Solo leads de mensajes",
    ],
  },
  {
    id: "plus" as const,
    name: "Plus",
    priceMonthly: 39,
    conversationsMonthly: 80,
    listingsIdeal: "2-4 anuncios activos/mes",
    benefits: [
      "Compra 40 conversaciones por 10€ cuando quieras",
      "Respuesta de soporte maximo 24h",
      "Acceso: 1 agente",
      "Asistencia a leads provenientes de mensajes o llamadas",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    priceMonthly: 69,
    conversationsMonthly: 80,
    listingsIdeal: "3–6 anuncios activos/mes",
    benefits: [
      "Compra 40 conversaciones por 10€ cuando quieras",
      "Respuesta de soporte maximo 12h",
      "Acceso multi-agente",
      "Asistencia a leads provenientes de mensajes o llamadas",
      "Promoción de marca en cualificación",
    ],
  },
  {
    id: "pro_plus" as const,
    name: "Pro+",
    priceMonthly: 99,
    conversationsMonthly: 80,
    listingsIdeal: "6–12 anuncios activos/mes",
    benefits: [
      "Compra 40 conversaciones por 10€ cuando quieras",
      "Soporte dedicado 1 a 1",
      "Acceso multi-agente",
      "Asistencia a leads provenientes de mensajes o llamadas",
      "Promoción de marca en cualificación",
      "Tu propio Avatar en vez de Marcos.",
    ],
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    priceMonthly: null as number | null,
    conversationsMonthly: 0,
    listingsIdeal: "A medida",
    benefits: [
      "Soporte personalizado",
      "Acceso ilimitado",
      "Volumen a medida",
      "Integraciones API",
    ],
  },
] as const;

/** Round up to the next multiple of N */
function ceilToMultiple(value: number, multiple: number): number {
  return Math.ceil(value / multiple) * multiple;
}

export function Subscription() {
  const { organizationId, effectiveRole, isImpersonationReadOnly } = useAuth();
  const [numListings, setNumListings] = useState(3);
  const [numLeadsPerAd, setNumLeadsPerAd] = useState(20);
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  const [actualListings, setActualListings] = useState<number | null>(null);
  const [actualLeadsPerAd, setActualLeadsPerAd] = useState<number | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [availableConversations, setAvailableConversations] = useState<number>(0);
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const simulatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [subscriptionChangeData, setSubscriptionChangeData] = useState<SubscriptionChangeData | null>(null);
  const [planCustomConversations, setPlanCustomConversations] = useState<Record<string, number>>({ 
    plus: 80, 
    pro: 80, 
    pro_plus: 80 
  });
  const [extraPackQty, setExtraPackQty] = useState(1);

  // Conversations calculation: anuncios × leads/anuncio, rounded up to next multiple of 40
  const rawConversations = numListings * numLeadsPerAd;
  const conversations = ceilToMultiple(rawConversations, 40);

  const hasActivePlan = Boolean(subscription);

  // Contracted conversations from subscription
  const contractedConversations = !subscription
    ? 0
    : subscription.contractedConversations ?? (subscription.planId === "free" ? 40 : 80);

  const annualTotalFromMonthly = (monthly: number | null) => {
    if (monthly === null) return 0;
    return (monthly * 12) * 0.85;
  };

  const formatEuroAmount = (amount: number) => amount.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  useEffect(() => {
    async function loadData() {
      if (!organizationId) return;
      // Reset org-scoped UI state immediately when switching orgs.
      setSubscription(null);
      setAvailableConversations(0);
      setHasUserInteracted(false);
      setPlanCustomConversations({ plus: 80, pro: 80, pro_plus: 80 });
      setLoading(true);
      try {
        const [sub, creds, listings, leads] = await Promise.all([
          getSubscription().catch(() => null),
          getAvailableConversations().catch(() => 0),
          getActiveListings().catch(() => []),
          getLeads().catch(() => []),
        ]);
        setSubscription(sub);
        setAvailableConversations(creds);
        if (sub?.billingInterval) {
          setPlanBilling(sub.billingInterval === "year" ? "annual" : "monthly");
        }

        const activeCount = Math.max(listings.length, 1);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        const recentLeads = leads.filter(l => {
          const raw = l.createdAt ?? l.firstMessageDate ?? l.lastMessageDate;
          if (!raw) return false;
          const date = (raw as any)?.toDate ? (raw as any).toDate() : new Date(raw as any);
          return date >= thirtyDaysAgo;
        });

        const totalLeads = recentLeads.length;

        // Leads per ad: total leads / active listings, rounded to next multiple of 10
        const rawLeadsPerAd = totalLeads / activeCount;
        const leadsPerAd = Math.max(10, ceilToMultiple(rawLeadsPerAd, 10));

        setActualListings(activeCount);
        setActualLeadsPerAd(leadsPerAd);
        setNumListings(activeCount);
        setNumLeadsPerAd(leadsPerAd);

        // Initialize custom conversations with current subscription value if present
        if (sub?.planId && sub.planId !== "free" && sub.contractedConversations) {
          setPlanCustomConversations(prev => ({
            ...prev,
            [sub.planId as string]: sub.contractedConversations || 80
          }));
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [organizationId]);

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
      analytics.trackSimulatorAdjusted({ listings: numListings, leads: numLeadsPerAd, recommended_plan: recommendedPlan });
    }, 800);
    return () => {
      if (simulatorTimerRef.current) clearTimeout(simulatorTimerRef.current);
    };
  }, [numListings, numLeadsPerAd]);

  const handleSliderChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasUserInteracted) setHasUserInteracted(true);
    setter(parseInt(e.target.value));
  };

  const handleSubscribe = async (planId: string, billing: "monthly" | "annual", extraBlocks: number) => {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
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

  const handleActivateFree = async () => {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setPurchaseLoading("free");
    try {
      const result = await activateFreePlanAndFetch();
      analytics.trackCtaClick({ location: "pricing", label: "activate_free" });
      setSubscription(result.subscription);
      const balance = await getAvailableConversations().catch(() => 0);
      setAvailableConversations(balance);
      toast.success("Plan Free activado");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo activar el plan Free");
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleChangePlan = async (planId: string, planName: string, extraBlocks: number) => {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setPreviewLoading(planId);
    try {
      const billingInterval = planBilling === "annual" ? "year" as const : "month" as const;
      const preview: SubscriptionChangePreview = await previewSubscriptionChange(
        planId as any,
        extraBlocks,
        billingInterval,
      );

      setSubscriptionChangeData({
        preview,
        newPlanName: planName,
        currentPlanName: PLAN_NAMES[subscription?.planId ?? "none"] ?? "Sin plan",
        billingInterval,
        newExtraBlocks: extraBlocks,
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al previsualizar el cambio");
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setPortalLoading(true);
    try {
      const url = await createBillingPortalSession("/suscripcion");
      window.location.href = url;
    } catch (error) {
      console.error(error);
      toast.error("Error al acceder al portal de facturación");
    } finally {
      // url redirect will happen, but if it fails we reset
      setPortalLoading(false);
    }
  };

  const handleSubscriptionUpdated = () => {
    // Reload the page data after a successful subscription change
    setLoading(true);
    setHasUserInteracted(false);
    Promise.all([
      getSubscription().catch(() => null),
      getAvailableConversations().catch(() => 0),
    ]).then(([sub, convs]) => {
      setSubscription(sub);
      setAvailableConversations(convs);
    }).finally(() => setLoading(false));
  };

  const currentPlanId = subscription?.planId ?? "none";
  const hasActivePaidSub = subscription?.status === "active" && currentPlanId !== "free" && currentPlanId !== "none";
  const isNewUser = !hasActivePlan;
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary-500 mb-4" size={32} />
        <p className="text-gray-500 font-medium">Cargando detalles...</p>
      </div>
    );
  }

  // Display value for conversations in right panel
  const displayConversations = hasUserInteracted ? conversations : contractedConversations;
  const displayConversationsLabel = hasUserInteracted ? "Conversaciones mínimas a contratar" : "Conversaciones contratadas";
  const displayHoursSaved = Math.round((displayConversations * 7) / 60);

  return (
    <div className="pb-24 max-w-7xl mx-auto">
      <PageHeader
        title="Suscripción"
        subtitle="Gestiona tu plan activo y volumen mensual"
        className="mb-8"
      />

      {isNewUser && (
        <div className="card p-6 border-2 border-primary-200 bg-primary-50/50 mb-10 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 text-primary-100 opacity-20 pointer-events-none">
            <Rocket size={120} />
          </div>
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-[10px] font-black uppercase tracking-widest mb-4 font-heading">
              Bienvenido a Proplead
            </span>
            <h2 className="text-2xl font-black text-gray-900 mb-3 font-heading">Empieza a automatizar tus leads hoy mismo</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Actualmente <strong>no tienes ningún plan activo</strong>. Usa el simulador a continuación para elegir el plan que mejor se adapte a tu agencia y actívalo en pocos clics.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        <div className="lg:col-span-2 card p-6 bg-gradient-to-br from-white to-primary-50/30 border border-primary-100 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest font-heading mb-4">Balance de Conversaciones</h3>
            {(() => {
              const contracted = contractedConversations;
              const consumed = Math.max(0, contracted - availableConversations);
              const availablePct = contracted > 0 ? Math.min(100, (availableConversations / contracted) * 100) : 0;
              const consumedPct = contracted > 0 ? Math.min(100, (consumed / contracted) * 100) : 0;
              const strokeColor = "#F59E0B";
              return (
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 shrink-0 relative flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 absolute inset-0">
                      <circle cx="40" cy="40" r="36" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r="36" fill="none"
                        stroke="#FEF3C7"
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
                    <MessageSquare className="text-primary-600" size={24} />
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
                        <p className="text-2xl font-bold tabular-nums font-heading text-primary-600">{availableConversations.toLocaleString()}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 font-medium">
                      Renovación: {(() => {
                        const raw = subscription?.currentPeriodEnd;
                        if (!raw) return "Ilimitado";
                        const date = (raw as any)?.toDate ? (raw as any).toDate() : new Date(raw as any);
                        return isNaN(date.getTime()) ? "---" : date.toLocaleDateString("es-ES");
                      })()}
                    </p>
                  </div>

                  {/* Quantity Selector Style similar to Plans */}
                  <div className="shrink-0 border-l border-primary-100 pl-6 ml-6 flex flex-col justify-center min-w-[240px]">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-heading mb-3">Compra Puntual</p>
                    
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-heading">Añadir packs (40 convs.)</label>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                            <button 
                              onClick={() => setExtraPackQty(prev => Math.max(1, prev - 1))}
                              disabled={extraPackQty <= 1}
                              className="p-1 px-2 text-gray-400 hover:text-primary-600 disabled:opacity-30 transition-colors"
                            >
                              <Minus size={14} strokeWidth={3} />
                            </button>
                            <span className="text-sm font-black font-heading px-3 min-w-[40px] text-center text-primary-600">
                              {extraPackQty}
                            </span>
                            <button 
                              onClick={() => setExtraPackQty(prev => prev + 1)}
                              className="p-1 px-2 text-gray-400 hover:text-primary-600 transition-colors"
                            >
                              <Plus size={14} strokeWidth={3} />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-gray-900 font-heading">
                            {extraPackQty * 10}€
                          </span>
                        </div>
                      </div>

                      <Button
                        loading={purchaseLoading === "extra_40"}
                        disabled={effectiveRole === "member" || isImpersonationReadOnly}
                        onClick={async () => {
                          try {
                            setPurchaseLoading("extra_40");
                            analytics.trackPackagePurchaseInitiated("extra_40");
                            const checkoutUrl = await createCheckoutSession("extra_40", "/suscripcion", extraPackQty);
                            window.location.href = checkoutUrl;
                          } catch (err) {
                            console.error("Failed to buy extra pack", err);
                            toast.error("Error al iniciar la compra");
                            setPurchaseLoading(null);
                          }
                        }}
                        className="w-full"
                        size="md"
                      >
                        {!purchaseLoading && <Rocket size={16} />}
                        <span>Comprar {(extraPackQty * 40).toLocaleString()} convs.</span>
                      </Button>
                      <p className="text-[10px] text-gray-400 italic text-center">Las conversaciones extra no expiran</p>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>

        <div className="card p-6 bg-white flex flex-col items-center justify-center border-2 border-primary-100">
           <p className="text-xs font-bold text-gray-500 uppercase tracking-widest font-heading mb-2">Tu Plan Actual</p>
           <h2 className="text-3xl font-extrabold text-primary-600 font-heading uppercase mb-1">
             {PLAN_NAMES[currentPlanId] ?? "Free"}
           </h2>
           <p className="text-xs text-gray-400 font-medium">
             {subscription?.status === "active" ? "Suscripción activa" : "Plan gratuito"}
           </p>
           {subscription?.status === "active" && (
             <div className="mt-4 pt-4 border-t border-gray-100 w-full flex flex-col items-center">
               <button
                 disabled={portalLoading}
                 onClick={handleManageBilling}
                 className="text-xs text-primary-600 font-bold hover:underline flex items-center gap-1.5 transition-all disabled:opacity-50 h-6"
               >
                 {portalLoading ? (
                   <Loader2 size={12} className="animate-spin" />
                 ) : (
                   <ExternalLink size={12} />
                 )}
                 Ver facturas y recibos
               </button>
               {currentPlanId !== "free" && (
                 <button
                   disabled={portalLoading}
                   onClick={handleManageBilling}
                   className="mt-2 text-[10px] text-gray-400 hover:text-rose-500 font-medium hover:underline transition-all disabled:opacity-50"
                 >
                   Cancelar suscripción
                 </button>
               )}
             </div>
           )}
        </div>
      </div>


      {/* Simulator Section */}
      <div className="max-w-6xl mx-auto mb-10 relative px-4 sm:px-0">
          <div className="text-center mb-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] opacity-50 font-heading" style={{ color: TITLE }}>
              Usa este simulador para configurar o ajustar tu suscripción.
            </p>
          </div>
          <div className="bg-[#2d1b0d] rounded-xl shadow-xl border border-[#3d2b1d] overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-stretch gap-6 lg:gap-10">
              <div className="flex-1 w-full lg:w-2/3 px-2 space-y-5 flex flex-col justify-center">

                {/* Listings Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">¿Cuántos anuncios tendrás activos por mes?</span>
                    <div className="flex items-center gap-2">
                      {actualListings !== null && numListings !== actualListings && (
                        <div className="flex flex-col items-center opacity-40">
                          <span className="text-[8px] uppercase font-bold font-heading">actual</span>
                          <span className="text-xs font-black font-heading line-through">{actualListings}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] uppercase font-bold font-heading" style={{ color: numListings !== actualListings && actualListings !== null ? "#fbbf24" : "#6b5040" }}>
                          {numListings !== actualListings && actualListings !== null ? "nuevo" : "actual"}
                        </span>
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
                    onChange={handleSliderChange(setNumListings)}
                    className="w-full h-1 bg-[#4d3b2d] rounded-full appearance-none cursor-pointer accent-primary-400 hover:accent-primary-300 transition-all"
                  />
                  <div className="flex justify-between text-[8px] text-[#8b6b47] mt-1 font-bold font-heading uppercase tracking-tighter opacity-50">
                    <span>1</span>
                    <span>13</span>
                    <span>25+</span>
                  </div>
                </div>

                {/* Leads Per Ad Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">¿Cuántos leads recibes de media por anuncio?</span>
                    <div className="flex items-center gap-2">
                      {actualLeadsPerAd !== null && numLeadsPerAd !== actualLeadsPerAd && (
                        <div className="flex flex-col items-center opacity-40">
                          <span className="text-[8px] uppercase font-bold font-heading">actual</span>
                          <span className="text-xs font-black font-heading line-through">{actualLeadsPerAd}</span>
                        </div>
                      )}
                      <div className="flex flex-col items-center">
                        <span className="text-[8px] uppercase font-bold font-heading" style={{ color: numLeadsPerAd !== actualLeadsPerAd && actualLeadsPerAd !== null ? "#34d399" : "#6b5040" }}>
                          {numLeadsPerAd !== actualLeadsPerAd && actualLeadsPerAd !== null ? "nuevo" : "actual"}
                        </span>
                        <span className="text-emerald-400 text-lg font-black font-heading tracking-tight leading-none">
                          {numLeadsPerAd}
                        </span>
                      </div>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="400"
                    step="10"
                    value={numLeadsPerAd}
                    onChange={handleSliderChange(setNumLeadsPerAd)}
                    className="w-full h-1 bg-[#4d3b2d] rounded-full appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
                  />
                  <div className="flex justify-between text-[8px] text-[#8b6b47] mt-1 font-bold font-heading uppercase tracking-tighter opacity-50">
                    <span>10</span>
                    <span>200</span>
                    <span>400</span>
                  </div>
                </div>

              </div>

              {/* Metrics + Billing Toggle */}
              <div className="w-full lg:w-1/3 flex flex-col justify-center items-center gap-4 border-t lg:border-t-0 lg:border-l border-[#3d2b1d] pt-6 lg:pt-0 lg:pl-6">
                <div className="flex flex-row lg:flex-col items-center justify-center gap-x-12 gap-y-4 w-full">
                  <div className="text-center text-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-60 font-heading">
                      {displayConversationsLabel}
                    </p>
                    <p className="text-lg font-black font-heading leading-none tabular-nums text-primary-400">
                      {displayConversations.toLocaleString()}
                    </p>
                    {/* Show contracted reference when user has interacted */}
                    {hasUserInteracted && conversations !== contractedConversations && (
                      <p className="text-[9px] text-[#6b5040] font-bold font-heading mt-1.5">
                        Contratadas: {contractedConversations}
                      </p>
                    )}
                  </div>
                  <div className="text-center group relative">
                    <div className="flex items-center gap-1 mb-1 justify-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70 font-heading">Ahorro</p>
                      <Info size={10} className="text-slate-400 opacity-50 cursor-help" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-white rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center font-medium leading-tight">
                        Calculado en base a un tiempo estimado de 7 minutos ahorrados por cada conversación.
                      </div>
                    </div>
                    <p className="text-lg font-black text-emerald-400 font-heading leading-none tabular-nums">{displayHoursSaved}h/mes</p>
                  </div>
                </div>

                <SegmentedControl
                  ariaLabel="Facturación"
                  colorScheme="amber"
                  value={planBilling}
                  onChange={(v) => { setPlanBilling(v); analytics.trackBillingToggle(v); if (!hasUserInteracted) setHasUserInteracted(true); }}
                  options={[
                    { value: "monthly", label: "Mensual" },
                    { value: "annual", label: "Anual", badge: "−15%" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-100 mb-8">
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 max-w-[1500px] mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isEnterprise = plan.id === "enterprise";
            const isFree = plan.id === "free";
            
            // Simulator recommended value (for guidance only)
            const recommendedValue = conversations;
            
            // Actual contracted value (managed per plan card)
            const contractedValue = isFree ? 40 : (isEnterprise ? 0 : (planCustomConversations[plan.id as string] || 80));

            const extraConversations = isFree ? 0 : Math.max(0, contractedValue - 80);
            const extraBlocks = extraConversations / 40;
            const extraPrice = extraBlocks * 10;
            const currentPriceMonthly = plan.priceMonthly !== null ? plan.priceMonthly + extraPrice : null;

            const isRecommended =
              (numListings <= 2 && plan.id === "plus") ||
              (numListings >= 3 && numListings <= 7 && plan.id === "pro") ||
              (numListings >= 8 && numListings <= 25 && plan.id === "pro_plus") ||
              (numListings > 25 && plan.id === "enterprise");

            const isCurrentPlan = currentPlanId === plan.id;
            const isConfigurationChanged = isCurrentPlan && contractedValue !== (subscription?.contractedConversations ?? (isFree ? 40 : 80));
            const isBoth = isCurrentPlan && isRecommended;

            return (
              <div key={plan.id} className="relative flex flex-col h-full">
                {isRecommended && (
                  <div className="absolute -top-8 left-0 right-0 bg-primary-500 text-white text-[10px] font-black h-8 flex items-center justify-center rounded-t-xl uppercase tracking-widest border-2 border-primary-500 border-b-0 font-heading">
                    Recomendado
                  </div>
                )}
                <div
                  className={cn(
                    "flex-1 flex flex-col p-4 transition-all duration-300 border-2",
                    isBoth
                      ? "border-primary-500 rounded-b-xl bg-white"
                      : isRecommended
                        ? "border-primary-500 rounded-b-xl bg-white"
                        : isCurrentPlan
                          ? "border-primary-500 rounded-xl bg-white"
                          : "border-gray-100 rounded-xl bg-white hover:border-gray-200"
                  )}
                >
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 text-base font-heading">{plan.name}</p>
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
                        <div className="space-y-3 mb-3">
                          <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-heading">Conversaciones contratadas</label>
                            
                            <div className="flex items-center gap-3">
                              <div className="flex items-center bg-gray-50 border border-gray-100 rounded-lg p-1">
                                {!isFree && (
                                  <button 
                                    onClick={() => {
                                      const current = planCustomConversations[plan.id as string] || 80;
                                      if (current > 80) {
                                        setPlanCustomConversations(prev => ({
                                          ...prev,
                                          [plan.id]: current - 40
                                        }));
                                      }
                                    }}
                                    disabled={contractedValue <= 80}
                                    className="p-1 text-gray-400 hover:text-primary-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
                                  >
                                    <Minus size={14} strokeWidth={3} />
                                  </button>
                                )}
                                <span className={cn(
                                  "text-sm font-black font-heading px-2 min-w-[50px] text-center",
                                  !isFree ? "text-primary-600" : "text-gray-600"
                                )}>
                                  {contractedValue.toLocaleString()}
                                </span>
                                {!isFree && (
                                  <button 
                                    onClick={() => {
                                      const current = planCustomConversations[plan.id as string] || 80;
                                      setPlanCustomConversations(prev => ({
                                        ...prev,
                                        [plan.id]: current + 40
                                      }));
                                    }}
                                    className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                                  >
                                    <Plus size={14} strokeWidth={3} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Recommended Guidance Tag */}
                            {!isFree && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-gray-400">Recomendado x simulador:</span>
                                <span className={cn(
                                  "text-[10px] font-black px-1.5 py-0.5 rounded",
                                  contractedValue >= recommendedValue 
                                    ? "bg-emerald-50 text-emerald-600" 
                                    : "bg-amber-50 text-amber-600"
                                )}>
                                  {recommendedValue.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5 group relative">
                            <Clock size={13} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-emerald-600 font-heading">
                              {Math.round((contractedValue * 7) / 60)}h ahorradas
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
                      disabled={
                        effectiveRole === "member" ||
                        isImpersonationReadOnly ||
                        (isCurrentPlan && !isConfigurationChanged) ||
                        purchaseLoading === plan.id ||
                        previewLoading === plan.id
                      }
                      onClick={() => {
                        if (plan.id === "enterprise") {
                          analytics.trackCtaClick({ location: "pricing", label: "enterprise_contact" });
                          window.location.href = "mailto:hola@proplead.com";
                        } else if (plan.priceMonthly === 0 && !isConfigurationChanged) {
                          if (!isCurrentPlan) {
                            void handleActivateFree();
                          }
                        } else if (hasActivePaidSub || isConfigurationChanged) {
                          // Existing subscriber or update within same plan: show breakdown modal with proration preview
                          handleChangePlan(plan.id, plan.name, extraBlocks);
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
                        isCurrentPlan && !isConfigurationChanged
                          ? "bg-amber-100 border-amber-300 text-amber-900 opacity-50 cursor-not-allowed"
                          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      )}
                    >
                      {(purchaseLoading === plan.id || previewLoading === plan.id) ? (
                        <><Loader2 className="animate-spin" size={14} /> Procesando...</>
                      ) : isConfigurationChanged
                        ? "Actualizar plan"
                        : isCurrentPlan
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

        {/* Breakdown Modal for subscription changes */}
        <BreakdownModal
          data={null}
          subscriptionData={subscriptionChangeData}
          onClose={() => setSubscriptionChangeData(null)}
          onSubscriptionUpdated={handleSubscriptionUpdated}
        />
    </div>
  );
}
