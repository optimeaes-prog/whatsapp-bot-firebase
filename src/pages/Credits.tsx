import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Coins,
  CreditCard,
  Check,
  CheckCircle,
  XCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Phone,
  Zap,
  Star,
  TrendingUp,
  Building2,
  RefreshCcw,
  MessageSquare,
  LayoutGrid,
  Clock,
  Minus,
  Plus,
  Calculator,
  ArrowDownRight,
} from "lucide-react";
import type { CreditPackage, SubscriptionPlanId } from "../types";
import {
  getUserCredits,
  getCreditPackages,
  createCheckoutSession,
  createSubscriptionCheckout,
  getSubscription,
  getAutoRecharge,
  saveAutoRecharge,
  formatPrice,
} from "../services/credits";
import type { OrgSubscriptionInfo } from "../services/credits";
import { PageHeader, Button, SegmentedControl } from "../components/ui";
import { cn } from "../lib/utils";
import {
  CREDITS_PER_CONVERSATION,
  NORMAL_DEMAND_CONVERSATIONS_PER_LISTING,
  TOP_UP_MAX_SETS,
} from "../lib/creditPricing";

const FALLBACK_CREDITS_100: CreditPackage = {
  id: "credits_100",
  name: "100 Créditos",
  amount: 1000,
  credits: 100,
  currency: "eur",
};

const SUBSCRIPTION_PLANS = [
  {
    id: "free" as SubscriptionPlanId,
    name: "Free",
    priceMonthly: 0,
    creditsMonthly: 90,
    bonusCredits: 0,
    conversationsMonthly: 30,
    listingsIdeal: "1 anuncio activo/mes",
    Icon: null,
    benefits: [
      "Incluye créditos cada mes según el plan gratuito",
      "Los créditos del plan Free no se acumulan al mes siguiente",
      "Los créditos que compres aparte sí se acumulan en tu saldo",
    ],
  },
  {
    id: "plus" as SubscriptionPlanId,
    name: "Plus",
    priceMonthly: 59,
    creditsMonthly: 600,
    bonusCredits: 60,
    conversationsMonthly: 220,
    listingsIdeal: "1–3 anuncios activos/mes",
    Icon: Zap,
    benefits: [
      "Puedes comprar créditos extra cuando los necesites",
      "Renovación mensual automática por Stripe",
    ],
  },
  {
    id: "pro" as SubscriptionPlanId,
    name: "Pro",
    priceMonthly: 119,
    creditsMonthly: 1200,
    bonusCredits: 120,
    conversationsMonthly: 440,
    listingsIdeal: "3–6 anuncios activos/mes",
    Icon: Star,
    benefits: [
      "Puedes comprar créditos extra cuando los necesites",
      "Renovación mensual automática por Stripe",
    ],
  },
  {
    id: "pro_plus" as SubscriptionPlanId,
    name: "Pro+",
    priceMonthly: 239,
    creditsMonthly: 2400,
    bonusCredits: 240,
    conversationsMonthly: 880,
    listingsIdeal: "6–12 anuncios activos/mes",
    Icon: TrendingUp,
    benefits: [
      "Puedes comprar créditos extra cuando los necesites",
      "Renovación mensual automática por Stripe",
    ],
  },
  {
    id: "enterprise" as SubscriptionPlanId,
    name: "Enterprise",
    priceMonthly: null,
    creditsMonthly: 0,
    bonusCredits: 0,
    conversationsMonthly: 0,
    listingsIdeal: "A medida",
    Icon: Building2,
    benefits: [
      "Créditos según contrato y compras a medida",
      "Volumen y condiciones a medida",
      "Soporte dedicado",
    ],
  },
] as const;

function formatHoursSavedLabel(conversationsMonthly: number): string {
  const minutesTotal = conversationsMonthly * 5;
  const hours = minutesTotal / 60;
  if (hours < 1) return `~${minutesTotal} min`;
  return `~${Math.round(hours)}h`;
}

function planTimeSavedCopy(plan: (typeof SUBSCRIPTION_PLANS)[number]): string | null {
  if (plan.id === "enterprise") return "Tiempo ahorrado según tu volumen de conversaciones.";
  if (plan.conversationsMonthly <= 0) return null;
  return `${formatHoursSavedLabel(plan.conversationsMonthly)} ahorradas · ~5 min × ${plan.conversationsMonthly} conversaciones`;
}

const ANNUAL_DISCOUNT = 0.15;

function annualTotalFromMonthly(monthly: number): number {
  return Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT) * 100) / 100;
}

/** 12 × mensual, sin aplicar el descuento anual (referencia). */
function annualListPriceFromMonthly(monthly: number): number {
  return Math.round(monthly * 12 * 100) / 100;
}

function formatEuroAmount(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function Credits() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [credits, setCredits] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"success" | "cancelled" | null>(null);
  const [autoRecharge, setAutoRecharge] = useState(false);
  const [autoRechargeMeta, setAutoRechargeMeta] = useState({
    thresholdCredits: 20,
    rechargeCredits: 100,
    hasSavedCard: false,
  });
  const [autoRechargeLoading, setAutoRechargeLoading] = useState(false);
  const [showCreditInfo, setShowCreditInfo] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo>({
    planId: "free",
    status: "active",
    currentPeriodEnd: null,
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const [calcListings, setCalcListings] = useState(1);
  const [topUpQuantity, setTopUpQuantity] = useState(1);

  const currentPlanId: SubscriptionPlanId = subscription.planId;
  const currentPlan = SUBSCRIPTION_PLANS.find((p) => p.id === currentPlanId)!;

  const package100 = useMemo(
    () => packages.find((p) => p.id === "credits_100") ?? FALLBACK_CREDITS_100,
    [packages]
  );

  const calcConversationsMonth = Math.max(0, calcListings) * NORMAL_DEMAND_CONVERSATIONS_PER_LISTING;
  const calcCreditsNeeded = calcConversationsMonth * CREDITS_PER_CONVERSATION;
  const calcEurosEstimate = calcCreditsNeeded / 10;
  const balanceCoversConversations =
    !creditsLoading && credits > 0 ? Math.floor(credits / CREDITS_PER_CONVERSATION) : 0;

  useEffect(() => {
    loadCredits();
    loadSubscription();
    loadAutoRecharge();

    const payment = searchParams.get("payment");
    if (payment === "success") {
      setPaymentStatus("success");
      setTimeout(() => {
        loadCredits();
        loadSubscription();
        loadAutoRecharge();
      }, 1500);
      setTimeout(() => {
        setSearchParams({});
        setPaymentStatus(null);
      }, 5000);
    } else if (payment === "cancelled") {
      setPaymentStatus("cancelled");
      setTimeout(() => {
        setSearchParams({});
        setPaymentStatus(null);
      }, 5000);
    }
  }, [searchParams, setSearchParams]);

  async function loadCredits() {
    try {
      setCreditsLoading(true);
      const [balance, pkgs] = await Promise.all([getUserCredits(), getCreditPackages()]);
      setCredits(balance);
      setPackages(pkgs);
    } catch {
      setPackages([
        { id: "credits_50", name: "50 Créditos", amount: 500, credits: 50, currency: "eur" },
        { id: "credits_100", name: "100 Créditos", amount: 1000, credits: 100, currency: "eur" },
        { id: "credits_200", name: "200 Créditos", amount: 2000, credits: 200, currency: "eur" },
      ]);
    } finally {
      setCreditsLoading(false);
    }
  }

  async function loadSubscription() {
    try {
      setSubscriptionLoading(true);
      const sub = await getSubscription();
      setSubscription(sub);
    } catch {
      /* keep default */
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function loadAutoRecharge() {
    try {
      const s = await getAutoRecharge();
      setAutoRecharge(s.enabled);
      setAutoRechargeMeta({
        thresholdCredits: s.thresholdCredits,
        rechargeCredits: s.rechargeCredits,
        hasSavedCard: s.hasSavedCard,
      });
    } catch {
      /* keep local defaults */
    }
  }

  async function handleTopUpPurchase() {
    const id = "credits_100";
    setPurchaseLoading(id);
    try {
      const url = await createCheckoutSession(id, "/creditos", topUpQuantity);
      window.location.href = url;
    } catch {
      toast.error("Error al crear la sesión de pago. Por favor, inténtalo de nuevo.");
    } finally {
      setPurchaseLoading(null);
    }
  }

  async function handleSubscribe(planId: string) {
    setPurchaseLoading(planId);
    try {
      const url = await createSubscriptionCheckout(
        planId,
        "/creditos",
        planBilling === "annual" ? "year" : "month"
      );
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      toast.error(msg.length > 160 ? `${msg.slice(0, 157)}…` : msg);
    } finally {
      setPurchaseLoading(null);
    }
  }

  async function handleToggleAutoRecharge() {
    setAutoRechargeLoading(true);
    try {
      const next = !autoRecharge;
      await saveAutoRecharge({
        enabled: next,
        thresholdCredits: autoRechargeMeta.thresholdCredits,
        rechargeCredits: autoRechargeMeta.rechargeCredits,
      });
      setAutoRecharge(next);
      await loadAutoRecharge();
      toast.success(next ? "Auto-compra activada" : "Auto-compra desactivada");
    } catch {
      toast.error("Error al actualizar la configuración.");
    } finally {
      setAutoRechargeLoading(false);
    }
  }

  const totalTopUpCredits = package100.credits * topUpQuantity;
  const totalTopUpCents = package100.amount * topUpQuantity;

  return (
    <div>
      <PageHeader
        className="mb-6"
        title="Créditos"
        icon={<Coins className="text-primary-500" size={28} />}
      />

      {paymentStatus === "success" && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
          <CheckCircle className="text-emerald-600 shrink-0" size={22} />
          <div>
            <p className="font-semibold text-emerald-800">¡Pago completado!</p>
            <p className="text-sm text-emerald-700">Tus créditos se han añadido a tu cuenta.</p>
          </div>
        </div>
      )}
      {paymentStatus === "cancelled" && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
          <XCircle className="text-amber-600 shrink-0" size={22} />
          <div>
            <p className="font-semibold text-amber-800">Pago cancelado</p>
            <p className="text-sm text-amber-700">El proceso de pago ha sido cancelado.</p>
          </div>
        </div>
      )}

      <div className="card mb-6 divide-y divide-gray-100 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Mi plan</span>
            {subscriptionLoading ? (
              <div className="h-7 w-32 animate-pulse rounded-full bg-gray-100" />
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold",
                    currentPlanId === "free"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-primary-100 text-gray-900"
                  )}
                >
                  {currentPlan.name}
                  {currentPlanId !== "free" && (
                    <span className="text-xs font-normal">
                      · {(currentPlan.creditsMonthly + currentPlan.bonusCredits).toLocaleString()} créditos/mes
                    </span>
                  )}
                </span>
                {subscription.status === "past_due" && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-700">
                    Pago pendiente
                  </span>
                )}
                {subscription.currentPeriodEnd && subscription.status === "active" && (
                  <span className="text-xs text-gray-400">
                    Renueva el{" "}
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowCreditInfo((v) => !v)}
            aria-expanded={showCreditInfo}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            <Info size={13} />
            ¿Cómo funcionan los créditos?
            {showCreditInfo ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            showCreditInfo ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4 space-y-4">
              <p className="text-sm text-gray-700">
                <strong>{CREDITS_PER_CONVERSATION} créditos</strong> por conversación · <strong>10 créditos</strong> por
                €. Los créditos que compres aparte se suman a tu saldo; el plan <strong>Free</strong> no acumula al mes
                siguiente.
              </p>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
                  <Calculator size={16} className="text-gray-500" />
                  Estimación mensual
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Cálculo con demanda <strong>normal</strong> media: ~{NORMAL_DEMAND_CONVERSATIONS_PER_LISTING}{" "}
                  conversaciones/mes por anuncio.
                </p>
                <label htmlFor="calc-listings" className="block text-xs font-medium text-gray-600 mb-1.5">
                  Anuncios activos
                </label>
                <input
                  id="calc-listings"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  value={calcListings}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setCalcListings(Number.isFinite(n) ? Math.min(999, Math.max(1, n)) : 1);
                  }}
                  className="w-full max-w-[8rem] rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <div className="mt-3 rounded-md bg-gray-50 border border-gray-100 px-3 py-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2 text-gray-600">
                    <span>Conversaciones / mes</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {calcConversationsMonth.toLocaleString("es-ES")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-gray-600">
                    <span>Créditos / mes</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {calcCreditsNeeded.toLocaleString("es-ES")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 text-gray-600">
                    <span>~Compra suelta</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {calcEurosEstimate.toLocaleString("es-ES", { maximumFractionDigits: 0 })}€
                    </span>
                  </div>
                  {!creditsLoading && (
                    <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                      Saldo actual: ~{balanceCoversConversations.toLocaleString("es-ES")} conversaciones.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Créditos</span>
            {creditsLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin text-amber-500" size={16} />
                <span className="text-sm text-gray-400">Cargando...</span>
              </div>
            ) : (
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {credits.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-gray-500">disponibles</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {currentPlan.creditsMonthly > 0
                    ? `Tu plan incluye ${currentPlan.creditsMonthly.toLocaleString()} créditos/mes`
                    : "Plan gratuito · 90 créditos al mes"}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowTopUp((v) => !v)}
            aria-expanded={showTopUp}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
          >
            <CreditCard size={15} />
            Comprar créditos extra
            {showTopUp ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            showTopUp ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
              <p className="text-xs text-gray-500 mb-4 max-w-2xl">
                Packs de <strong>100 créditos</strong> (10€/pack). Se acumulan en tu saldo (~
                {Math.floor(100 / CREDITS_PER_CONVERSATION)} conversaciones por pack).
              </p>
              <div className="max-w-2xl">
                <div className="rounded-xl border-2 border-primary-200 bg-white p-5 sm:p-6 shadow-md">
                  <div className="grid md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Coins size={22} />
                        <span className="text-2xl font-bold text-gray-900">100 créditos</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Precio unitario: <strong>{formatPrice(package100.amount, package100.currency)}</strong> por
                        pack (~{Math.floor(100 / CREDITS_PER_CONVERSATION)} conversaciones).
                      </p>
                      <p className="text-xs text-gray-500">1€ = 10 créditos · Pago seguro con Stripe</p>
                    </div>
                    <div className="flex flex-col justify-center gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-5 md:pt-0 md:pl-8">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">Número de packs (× 100 créditos)</p>
                        <div className="flex items-center justify-center sm:justify-start gap-3">
                          <button
                            type="button"
                            aria-label="Menos packs"
                            disabled={topUpQuantity <= 1 || purchaseLoading !== null}
                            onClick={() => setTopUpQuantity((q) => Math.max(1, q - 1))}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50",
                              (topUpQuantity <= 1 || purchaseLoading !== null) && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <Minus size={18} />
                          </button>
                          <span className="min-w-[3rem] text-center text-xl font-bold tabular-nums text-gray-900">
                            {topUpQuantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Más packs"
                            disabled={topUpQuantity >= TOP_UP_MAX_SETS || purchaseLoading !== null}
                            onClick={() => setTopUpQuantity((q) => Math.min(TOP_UP_MAX_SETS, q + 1))}
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50",
                              (topUpQuantity >= TOP_UP_MAX_SETS || purchaseLoading !== null) && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="rounded-lg bg-primary-50 border border-primary-100 px-4 py-3 text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-600">Total créditos</span>
                          <span className="font-bold text-gray-900">{totalTopUpCredits.toLocaleString("es-ES")}</span>
                        </div>
                        <div className="flex justify-between gap-2 mt-1">
                          <span className="text-gray-600">Total a pagar</span>
                          <span className="font-bold text-primary-700">
                            {formatPrice(totalTopUpCents, package100.currency)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          ≈ {Math.floor(totalTopUpCredits / CREDITS_PER_CONVERSATION).toLocaleString("es-ES")}{" "}
                          conversaciones
                        </p>
                      </div>
                      <Button
                        onClick={handleTopUpPurchase}
                        disabled={purchaseLoading !== null}
                        variant="primary"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        {purchaseLoading === "credits_100" ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <CreditCard size={16} />
                            Comprar {topUpQuantity === 1 ? "1 pack" : `${topUpQuantity} packs`}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-500 w-32 shrink-0">Auto-compra</span>
            <div>
              <div className="flex items-center gap-2">
                <RefreshCcw size={13} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-800">Auto-compra de créditos</p>
                {autoRecharge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">
                    Activa
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Compra {autoRechargeMeta.rechargeCredits} créditos automáticamente cuando el saldo sea de{" "}
                {autoRechargeMeta.thresholdCredits} o menos (pack de 100 créditos).
              </p>
              {autoRecharge && !autoRechargeMeta.hasSavedCard && (
                <p className="text-xs text-amber-800 mt-1.5 max-w-md">
                  Para que el cobro automático funcione, primero haz una compra de créditos con tarjeta: así Stripe
                  guarda el método de pago para cargos posteriores sin pasar por Checkout.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoRecharge}
            disabled={autoRechargeLoading}
            role="switch"
            aria-checked={autoRecharge}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
              autoRecharge ? "bg-amber-500" : "bg-gray-200",
              autoRechargeLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ease-in-out",
                autoRecharge ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Comparar planes</h2>
            <p className="text-sm text-gray-500 max-w-xl">
              Elige el plan que mejor se adapte a tu volumen de leads. Quedarte sin créditos no implica subir de plan:
              puedes comprar packs extra arriba.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 self-start lg:self-center">
            <div className="flex items-center gap-0.5 pr-0.5" aria-live="polite">
              <span className="text-[11px] font-bold tracking-tight text-emerald-700 whitespace-nowrap">
                Ahorra 15% al año
              </span>
              <ArrowDownRight
                size={16}
                className="shrink-0 text-emerald-600 -mb-0.5"
                strokeWidth={2.25}
                aria-hidden
              />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isActive = plan.id === currentPlanId;
            const isEnterprise = plan.id === "enterprise";
            const timeSaved = planTimeSavedCopy(plan);
            const paidMonthly = plan.priceMonthly;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative card flex flex-col transition-all",
                  isActive
                    ? "border-2 border-primary-500 shadow-md"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                )}
              >
                {isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="px-3 py-1 text-xs font-bold rounded-full shadow-sm bg-primary-500 text-gray-900">
                      Tu plan actual
                    </span>
                  </div>
                )}

                <div className="flex-1 flex flex-col">
                  <p className="font-bold text-gray-900 text-base mb-1">{plan.name}</p>

                  {isEnterprise ? (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500">Personalizado</p>
                      <div className="flex items-start gap-1.5 mt-2">
                        <LayoutGrid size={12} className="text-gray-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-600">Ideal: {plan.listingsIdeal}</span>
                      </div>
                    </div>
                  ) : paidMonthly === 0 ? (
                    <p className="text-2xl font-bold text-gray-900 mb-4">Gratis</p>
                  ) : paidMonthly != null ? (
                    planBilling === "monthly" ? (
                      <div className="mb-4">
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-2xl font-bold text-gray-900">{formatEuroAmount(paidMonthly)}€</span>
                          <span className="text-xs text-gray-500">/mes</span>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                          <span className="text-2xl font-bold text-gray-900">
                            {formatEuroAmount(annualTotalFromMonthly(paidMonthly))}€
                          </span>
                          <span className="text-xs text-gray-500">/año</span>
                          <span className="text-[10px] font-bold text-gray-900 px-1.5 py-0.5 rounded bg-primary-200">
                            −15%
                          </span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">
                          Sin el 15%:{" "}
                          <span className="line-through decoration-gray-300 text-gray-500">
                            {formatEuroAmount(annualListPriceFromMonthly(paidMonthly))}€
                          </span>
                          /año
                        </p>
                      </div>
                    )
                  ) : null}

                  {!isEnterprise ? (
                    <div className="space-y-1.5 mb-3 flex-1">
                      <div className="flex items-start gap-1.5">
                        <Coins size={13} className="text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-700 leading-tight">
                          <strong>{plan.creditsMonthly.toLocaleString()}</strong> créditos/mes
                        </span>
                      </div>
                      {plan.bonusCredits > 0 && (
                        <p className="text-xs text-emerald-600 font-semibold pl-5">
                          +{plan.bonusCredits} créditos de regalo
                        </p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <MessageSquare size={12} className="text-primary-400 shrink-0" />
                        <span className="text-xs text-primary-600 font-medium">
                          {plan.conversationsMonthly} conversaciones/mes
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <LayoutGrid size={12} className="text-gray-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-600 leading-tight">Ideal: {plan.listingsIdeal}</span>
                      </div>
                    </div>
                  ) : null}

                  {timeSaved && (
                    <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2 mb-3">
                      <Clock size={14} className="text-gray-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-gray-700 leading-snug">{timeSaved}</p>
                    </div>
                  )}

                  <ul
                    className={cn(
                      "mb-4 flex-1 space-y-2 pt-3",
                      !isEnterprise && "border-t border-gray-100"
                    )}
                  >
                    {plan.benefits.map((line) => (
                      <li key={line} className="flex gap-2 text-xs text-gray-600 leading-snug">
                        <Check className="shrink-0 text-emerald-500 mt-0.5" size={14} aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  {isEnterprise ? (
                    <a
                      href="tel:+34600000000"
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-btn border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Phone size={14} />
                      Contactar
                    </a>
                  ) : isActive ? (
                    <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-btn bg-primary-50 border border-primary-400 text-sm font-medium text-gray-800 cursor-default">
                      <CheckCircle size={14} />
                      Plan activo
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={purchaseLoading !== null}
                      variant="outline"
                      className="w-full flex items-center justify-center gap-1.5 text-sm"
                    >
                      {purchaseLoading === plan.id ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Procesando...
                        </>
                      ) : plan.priceMonthly === 0 ? (
                        "Empezar gratis"
                      ) : (
                        "Contratar"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
