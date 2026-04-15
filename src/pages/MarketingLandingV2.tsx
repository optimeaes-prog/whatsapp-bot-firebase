import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Star,
  LayoutGrid,
  Check,
  ChevronDown,
  Clock,
  Info,
  Minus,
  Plus
} from "lucide-react";

import idealistaLogo from "../../idealista.png";
import fotocasaLogo from "../../logo-fotocasa-min.png";
import pisosLogo from "../../logo-pisoscom.webp";
import metaVerifiedLogo from "../../meta-verified.png";
import nuevoAnuncioImg from "../../Nuevo_anuncio.png";
import demoAppVideo from "../../Demo_app.mp4";
import {
  WhatsAppAnimationShowcaseCallQualification,
  WhatsAppAnimationShowcaseSlow,
} from "./WhatsAppAnimationLab";
import { WhatsAppLeadsAnimationPhone } from "./WhatsAppLeadsAnimation";
import { SegmentedControl } from "../components/ui";
import { cn } from "../lib/utils";
import { analytics } from "../lib/analytics";
import whiteLogo from "../../proplead-high-resolution-logo-white.png";
import { BreakdownModal, type CheckoutBreakdownData } from "../components/BreakdownModal";

const TITLE = "#402e32";
const BODY = "#ab8b67";



const SUBSCRIPTION_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    priceMonthly: 0,
    assistancesMonthly: 40,
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
    assistancesMonthly: 80,
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
    assistancesMonthly: 80,
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
    assistancesMonthly: 80,
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
    assistancesMonthly: 0,
    listingsIdeal: "A medida",
    benefits: [
      "Soporte personalizado",
      "Acceso ilimitado",
      "Volumen a medida",
      "Integraciones API",
    ],
  },
] as const;




function formatEuroAmount(n: number): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}



function PricingSection() {
  const [numListings, setNumListings] = useState(3);
  const [demandValue, setDemandValue] = useState(40);
  const [planBilling, setPlanBilling] = useState<"monthly" | "annual">("monthly");
  const [checkoutData, setCheckoutData] = useState<CheckoutBreakdownData | null>(null);
  const [planCustomConversations, setPlanCustomConversations] = useState<Record<string, number>>({ 
    plus: 80, 
    pro: 80, 
    pro_plus: 80 
  });

  const conversations = numListings * demandValue;
  const hoursSaved = Math.round((conversations * 7) / 60);

  const annualTotalFromMonthly = (monthly: number | null) => {
    if (monthly === null) return 0;
    return (monthly * 12) * 0.85; // 15% discount
  };

  return (
    <section id="precios" className="relative pt-12 pb-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 relative z-10">

        {/* Header */}
        <div className="text-center mb-24 px-4">
          <h2 id="precios" className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 font-heading scroll-mt-32" style={{ color: TITLE }}>
            Precios
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
            Planes que escalan contigo. Sin permanencias.<br />
            Solo pagas por las conversaciones iniciadas con tus leads.
          </p>
        </div>



        {/* Integrated Control Bar */}
        <div className="max-w-5xl mx-auto mb-20 relative px-4 sm:px-0">
          <div className="text-center mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 font-heading" style={{ color: TITLE }}>
              Usa este simulador para descubrir tu plan ideal
            </p>
          </div>
          <div className="bg-[#2d1b0d] rounded-2xl shadow-2xl shadow-primary-900/10 border border-[#3d2b1d] overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

              {/* Volume & Demand Controls */}
              <div className="flex-1 w-full lg:w-2/3 px-4 space-y-6">
                {/* Listings Slider */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">¿Cuántos anuncios tienes activos por mes?</span>
                    <span className="text-primary-400 text-lg font-black font-heading tracking-tight">
                      {numListings > 25 ? "25+" : numListings} {numListings === 1 ? "anuncio" : "anuncios"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="26"
                    step="1"
                    value={numListings}
                    onChange={(e) => setNumListings(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#4d3b2d] rounded-full appearance-none cursor-pointer accent-primary-400 hover:accent-primary-300 transition-all slider-thumb"
                  />
                </div>

                {/* Demand Selector */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">¿Cuál es la demanda media de cada uno?</span>
                    <span className="text-primary-400 text-lg font-black font-heading tracking-tight">
                      {demandValue} leads
                    </span>
                  </div>
                  <SegmentedControl
                    value={demandValue.toString()}
                    onChange={(v) => setDemandValue(parseInt(v))}
                    ariaLabel="Seleccionar demanda"
                    options={[
                      { value: "20", label: "Baja" },
                      { value: "40", label: "Media" },
                      { value: "80", label: "Alta" },
                      { value: "160", label: "Muy alta" },
                    ]}
                  />
                </div>
              </div>

              {/* Metrics Short Summary */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 px-6 lg:border-l border-white/5 py-1">
                <div className="text-center lg:text-left text-white">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70 font-heading leading-tight">Conversaciones<br />necesarias por mes</p>
                  <p className="text-lg font-black font-heading leading-none tabular-nums text-primary-400">
                    {conversations}
                  </p>
                </div>
                <div className="text-center lg:text-left group relative">
                  <div className="flex items-center gap-1 mb-1 justify-center lg:justify-start">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70 font-heading leading-tight">Ahorro<br />estimado</p>
                    <Info size={10} className="text-slate-400 opacity-50 cursor-help" />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-white rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center font-medium leading-tight">
                      Calculado en base a un tiempo estimado de 7 minutos ahorrados por cada conversación.
                    </div>
                  </div>
                  <p className="text-lg font-black text-emerald-400 font-heading leading-none tabular-nums">{hoursSaved}h/mes</p>
                </div>
              </div>

              {/* Billing Toggle */}
              <div className="shrink-0 scale-90 sm:scale-100 lg:-translate-x-4">
                <SegmentedControl
                  ariaLabel="Facturación"
                  colorScheme="amber"
                  value={planBilling}
                  onChange={(v) => setPlanBilling(v as "monthly" | "annual")}
                  options={[
                    { value: "monthly", label: "Mensual" },
                    { value: "annual", label: "Anual", badge: "−15%" },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Extra conversations info banner */}
        <div className="max-w-xl mx-auto mb-4 mt-1 px-4">
          <div className="flex items-center justify-center gap-1.5 py-2 px-4 bg-[#6b5240] border border-[#7a6050] rounded-xl text-xs text-primary-400">
            <Info size={12} className="text-primary-400 shrink-0" />
            <span>Se añaden <strong className="text-primary-400">10€</strong> por cada 40 conversaciones extra</span>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 pt-8 max-w-[1500px] mx-auto">
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
                      : "border-gray-100 rounded-2xl bg-white hover:border-gray-200"
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
                            <Info size={10} className="text-emerald-500 opacity-40 cursor-help" />
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-white rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 text-center font-medium leading-tight">
                              Calculado en base a un tiempo estimado de 7 minutos ahorrados por cada conversación.
                            </div>
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
                      onClick={() => {
                        if (plan.priceMonthly === 0 || plan.id === "enterprise") {
                          analytics.trackCtaClick({
                            location: "pricing",
                            label: plan.id === "enterprise" ? "enterprise_contact" : "start_free",
                            source_page: "landingv3",
                          });
                          window.location.href = plan.id === "enterprise" ? "mailto:hola@proplead.com" : "/login";
                        } else {
                          analytics.trackPricingPlanClick({
                            plan_id: plan.id,
                            plan_name: plan.name,
                            billing_interval: planBilling,
                            source_page: "landingv3",
                          });
                          const basePrice = planBilling === "annual" ? annualTotalFromMonthly(plan.priceMonthly) : plan.priceMonthly;
                          const extraPriceTotal = planBilling === "annual" ? extraPrice * 12 * 0.85 : extraPrice;

                          setCheckoutData({
                            planId: plan.id,
                            planName: plan.name,
                            basePrice,
                            billing: planBilling === "annual" ? "year" : "monthly",
                            extraBlocks,
                            totalConversations: contractedValue,
                            totalPrice: basePrice + extraPriceTotal
                          });
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-btn border text-sm font-bold font-heading transition-colors border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                    >
                      {plan.id === "enterprise" ? "Contactar" : plan.priceMonthly === 0 ? "Empezar gratis" : "Contratar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <BreakdownModal 
        data={checkoutData} 
        onClose={() => setCheckoutData(null)} 
      />
    </section>
  );
}

function FAQSectionContent() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "¿En qué portales inmobiliarios puedo usar Proplead?",
      a: "Puedes usarlo en cualquier portal como Idealista, Fotocasa o Habitaclia. Solo tienes que añadir tu número de Proplead a tus anuncios o configurar el desvío de mensajes para que Marcos empiece a atender a tus leads automáticamente."
    },
    {
      q: "¿Cómo sabe Marcos qué preguntar a los interesados?",
      a: "Tú tienes el control total. Al crear cada anuncio en Proplead, defines los filtros de cualificación: ingresos mínimos, si se aceptan mascotas, número máximo de personas, etc. Marcos usará esa información para guiar la conversación con contexto real."
    },
    {
      q: "¿Puedo ver lo que Marcos está hablando con mis leads?",
      a: "¡Por supuesto! Desde tu panel de control puedes seguir todas las conversaciones en tiempo real. Además, si lo deseas, puedes pausar al asistente en una conversación específica y tomar tú el control por WhatsApp en cualquier momento."
    },
    {
      q: "¿Cómo funciona el sistema de asistencias?",
      a: `Cada lead atendido consume 1 asistencia. Los planes mensuales incluyen una cantidad fija de asistencias para tu operativa. Si necesitas más, puedes comprar packs extra que no caducan nunca y se acumulan en tu saldo.`
    },
    {
      q: "¿Qué recibo exactamente cuando un lead es cualificado?",
      a: "Recibirás una notificación instantánea con un resumen detallado generado por IA. En él verás directamente si el lead cumple tus requisitos y todas sus respuestas clave, para que solo tengas que contactar con los que realmente tienen potencial."
    }
  ];

  return (
    <div id="faq" className="scroll-mt-28 pt-4 lg:pt-6 pb-16 lg:pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 font-heading" style={{ color: TITLE }}>
            Preguntas frecuentes
          </h2>
          <p className="text-lg" style={{ color: BODY }}>
            Todo lo que necesitas saber para empezar a automatizar tu inmobiliaria.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <div key={i} className={cn("border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 bg-white", openIndex === i ? "ring-1 ring-primary-200 border-primary-200 shadow-md" : "hover:border-slate-300")}>
              <button className="w-full px-6 py-5 text-left flex justify-between items-center gap-4 focus:outline-none" onClick={() => { const next = openIndex !== i; setOpenIndex(next ? i : null); analytics.trackFaqToggle(i, next); }}>
                <span className="font-bold text-lg leading-tight" style={{ color: TITLE }}>{faq.q}</span>
                <ChevronDown className={cn("w-5 h-5 shrink-0 transition-transform duration-500", openIndex === i && "rotate-180")} style={{ color: BODY }} />
              </button>
              <div className={cn("overflow-hidden transition-all duration-500 ease-in-out", openIndex === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
                <div className="px-6 pb-6 pt-0">
                  <p className="text-base leading-relaxed" style={{ color: BODY }}>{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm font-bold mb-4 font-heading" style={{ color: BODY }}>¿Tienes más preguntas?</p>
          <a href="https://wa.me/34600000000" target="_blank" className="inline-flex items-center gap-2 text-primary-600 font-bold font-heading hover:text-primary-700 transition-colors">
            Hablar con soporte por WhatsApp
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}

/** Retratos fijos (sin enlaces ni tracking) */
const REVIEW_AVATAR_SRC = [
  "https://randomuser.me/api/portraits/women/65.jpg",
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/76.jpg",
  "https://randomuser.me/api/portraits/women/68.jpg",
] as const;

const STAR_GOLD = "#FFC107";

function HeroReviewsRow() {
  return (
    <div
      className="mt-8 flex flex-col items-center"
      role="img"
      aria-label="Valoración media 4,7 sobre 5 estrellas"
    >
      <div className="flex justify-center">
        {REVIEW_AVATAR_SRC.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={28}
            height={28}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={`h-7 w-7 shrink-0 rounded-full border-2 border-white object-cover shadow-md ${i > 0 ? "-ml-2" : ""}`}
            style={{ zIndex: i + 1 }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        <span className="text-xs font-bold tabular-nums leading-none" style={{ color: TITLE }}>
          4.7
        </span>
        <div className="flex items-center gap-0.5">
          {[0, 1, 2, 3].map((k) => (
            <Star key={k} className="h-3.5 w-3.5" fill={STAR_GOLD} color={STAR_GOLD} strokeWidth={0} />
          ))}
          <div className="relative h-3.5 w-3.5 shrink-0">
            <Star className="h-3.5 w-3.5" fill="#e5e7eb" color="#e5e7eb" strokeWidth={0} aria-hidden />
            <div className="absolute inset-0 overflow-hidden" style={{ width: "70%" }} aria-hidden>
              <Star className="h-3.5 w-3.5" fill={STAR_GOLD} color={STAR_GOLD} strokeWidth={0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRODUCT_FEATURES = [
  {
    title: "Respuesta inmediata 24/7",
    lines: [
      "Atiende consultas y agenda visitas al instante.",
      "Sin depender del teléfono, incluso fuera de horario.",
    ],
  },
  {
    title: "Voz e IA conversacional",
    lines: [
      "Capta leads que prefieren hablar por llamada.",
      "La IA guía la conversación y detecta intención real.",
    ],
  },
  {
    title: "Gestión centralizada",
    lines: [
      "Toda la información queda unificada en un solo lugar.",
      "Así ningún lead se enfría ni se pierde en el proceso.",
    ],
  },
] as const;



// UNIFIED_STORY_STEPS moved inside MarketingLandingV2 to access navigation functions


const DEMO_APP_TABS = [
  {
    title: "Revisa conversaciones",
    body: "Mira cómo Marcos va cualificando a tus leads en tiempo real. Si lo prefieres, desactívalo y sigue tú con la conversación.",
  },
  {
    title: "Analiza y filtra",
    body: "Ordena y prioriza tus leads: añade etiquetas, filtra por criterios y revisa resúmenes de los ya cualificados.",
  },
  {
    title: "Acciona en grupo",
    body: "Actúa sobre varios leads a la vez; por ejemplo, envía un mensaje a todos los que tengas marcados como finalistas.",
  },
  {
    title: "Revisa métricas",
    body: "Entiende el interés que despiertan tus anuncios y mide el éxito de la cualificación de tus leads.",
  },
] as const;





function TimedFeatureList({
  features = PRODUCT_FEATURES,
  onActiveStepChange,
  onStepSelect,
  activeIndex: externalActiveIndex,
  autoPlay = true,
  onUserInteract,
  step2SubProgress,
  onSubStepSelect,
  lightMode = true,
}: {
  features?: ReadonlyArray<{ title: string; lines?: readonly [ReactNode, ReactNode] | readonly ReactNode[]; durationMs?: number }>;
  onActiveStepChange?: (index: number) => void;
  onStepSelect?: (index: number) => void;
  activeIndex?: number;
  autoPlay?: boolean;
  onUserInteract?: () => void;
  step2SubProgress?: number;
  onSubStepSelect?: (slideIndex: number) => void;
  lightMode?: boolean;
}) {
  const [internalActiveIndex, setInternalActiveIndex] = useState(0);
  const activeIndex = externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;

  const [progress, setProgress] = useState(0);
  const stepStartedAtRef = useRef(Date.now());

  const setActiveIndex = (idx: number | ((prev: number) => number)) => {
    if (typeof idx === "function") {
      const next = idx(activeIndex);
      onActiveStepChange?.(next);
      if (externalActiveIndex === undefined) setInternalActiveIndex(next);
    } else {
      onActiveStepChange?.(idx);
      if (externalActiveIndex === undefined) setInternalActiveIndex(idx);
    }
  };

  useEffect(() => {
    if (!autoPlay) {
      setProgress(1);
      return;
    }
    setProgress(0);
    stepStartedAtRef.current = Date.now();
    const durationMs = features[activeIndex]?.durationMs ?? 10000;

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - stepStartedAtRef.current;
      const ratio = Math.min(elapsed / durationMs, 1);
      setProgress(ratio);
      if (elapsed >= durationMs) {
        const next = (activeIndex + 1) % features.length;
        setActiveIndex(next);
        stepStartedAtRef.current = Date.now();
        setProgress(0);
      }
    }, 50);

    return () => window.clearInterval(interval);
  }, [activeIndex, autoPlay]);

  const mensajesProgress = !autoPlay ? 1 : (activeIndex === 1 && step2SubProgress !== undefined
    ? Math.min(step2SubProgress * 2, 1)
    : (activeIndex === 1 ? Math.min(progress * 2, 1) : (activeIndex > 1 ? 1 : 0)));
  const llamadasProgress = !autoPlay ? 1 : (activeIndex === 1 && step2SubProgress !== undefined
    ? Math.min(Math.max(step2SubProgress * 2 - 1, 0), 1)
    : (activeIndex === 1 ? Math.min(Math.max(progress * 2 - 1, 0), 1) : (activeIndex > 1 ? 1 : 0)));

  return (
    <div className="flex flex-col gap-1">
      {features.map(({ title, lines }, index) => {
        const isActive = index === activeIndex;
        return (
          <div key={title} className="flex gap-4 items-start group">
            <span
              className={cn(
                "relative flex-shrink-0 w-1 rounded-full overflow-hidden transition-all duration-500",
                isActive
                  ? "h-24 mt-0.5 " + (lightMode ? "bg-primary-100" : "bg-white/10")
                  : "h-6 mt-1.5 " + (lightMode ? "bg-[#402e32]/10" : "bg-white/5")
              )}
              aria-hidden
            >
              {!isActive && index < activeIndex && (
                <span className="absolute inset-0 rounded-full" style={{ backgroundColor: lightMode ? "#402e32" : "#fff7e7", opacity: 0.15 }} />
              )}
              {isActive && (
                <span
                  className="absolute left-0 right-0 top-0 rounded-full"
                  style={{
                    height: `${progress * 100}%`,
                    backgroundColor: lightMode ? "#402e32" : "#fff7e7",
                    transition: autoPlay ? "height 0.05s linear" : "height 0.5s ease",
                  }}
                />
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                onUserInteract?.();
                onStepSelect?.(index);
                setActiveIndex(index);
              }}
              className="relative text-left flex-1 pb-6 transition-all duration-500"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "text-[11px] font-black font-heading tracking-widest transition-colors duration-300",
                      isActive
                        ? (lightMode ? "text-[#402e32]" : "text-[#fff7e7]")
                        : (lightMode ? "text-[#402e32]/20" : "text-[#fff7e7]/20")
                    )}
                  >
                    0{index + 1}
                  </span>
                  <h4
                    className={cn(
                      "text-base sm:text-lg font-bold leading-tight transition-colors duration-300 font-heading",
                      isActive
                        ? (lightMode ? "text-[#402e32]" : "text-primary-400")
                        : (lightMode ? "text-[#402e32]/40 group-hover:text-[#402e32]/60" : "text-[#fbbf24]/25 group-hover:text-[#fbbf24]/45")
                    )}
                  >
                    {title}
                  </h4>
                </div>

                {isActive && lines && (
                  <div className="pl-[30px] pt-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-500">
                    <p className="text-sm leading-relaxed" style={{ color: lightMode ? BODY : "rgba(255, 247, 231, 0.6)" }}>
                      {lines[0] ?? ""}
                    </p>
                    {lines[1] && (
                      index === 1 ? (
                        <>
                          <p className="text-sm leading-relaxed" style={{ color: lightMode ? BODY : "rgba(255, 247, 231, 0.6)" }}>
                            Atiende leads de <span className={cn("font-bold", lightMode ? "text-[#402e32]/80" : "text-[#fff7e7]")}>mensajes</span> recibidos en tus portales o de <span className={cn("font-bold", lightMode ? "text-[#402e32]/80" : "text-[#fff7e7]")}>llamadas</span> al número de Proplead (911&nbsp;676&nbsp;990).
                          </p>
                          <div className="flex gap-2.5 mt-3.5 mb-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); onUserInteract?.(); onSubStepSelect?.(1); }}
                              className={cn(
                                "group/btn flex-1 rounded-xl border p-2.5 transition-all text-left",
                                lightMode
                                  ? "bg-transparent border-[#402e32]/20 hover:bg-[#402e32]/5 hover:border-[#402e32]/40"
                                  : "bg-white/[0.05] border-primary-400/30 hover:bg-white/[0.08] hover:border-primary-400/60"
                              )}
                            >
                              <p className={cn("text-[10px] font-black uppercase tracking-wider font-heading mb-2", lightMode ? "text-[#402e32]/70 group-hover/btn:text-[#402e32]" : "text-primary-400 group-hover/btn:text-primary-300")}>Mensajes</p>
                              <div className={cn("h-1 w-full rounded-full overflow-hidden", lightMode ? "bg-[#402e32]/10" : "bg-white/10")}>
                                <div
                                  className={cn("h-full rounded-full", lightMode ? "bg-[#402e32]" : "bg-primary-500")}
                                  style={{
                                    width: `${mensajesProgress * 100}%`,
                                    transition: autoPlay ? "width 0.05s linear" : "width 0.5s ease",
                                  }}
                                />
                              </div>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onUserInteract?.(); onSubStepSelect?.(2); }}
                              className={cn(
                                "group/btn flex-1 rounded-xl border p-2.5 transition-all text-left",
                                lightMode
                                  ? "bg-transparent border-[#402e32]/20 hover:bg-[#402e32]/5 hover:border-[#402e32]/40"
                                  : "bg-white/[0.05] border-primary-400/30 hover:bg-white/[0.08] hover:border-primary-400/60"
                              )}
                            >
                              <p className={cn("text-[10px] font-black uppercase tracking-wider font-heading mb-2", lightMode ? "text-[#402e32]/70 group-hover/btn:text-[#402e32]" : "text-primary-400 group-hover/btn:text-primary-300")}>Llamadas</p>
                              <div className={cn("h-1 w-full rounded-full overflow-hidden", lightMode ? "bg-[#402e32]/10" : "bg-white/10")}>
                                <div
                                  className={cn("h-full rounded-full", lightMode ? "bg-[#402e32]" : "bg-primary-500")}
                                  style={{
                                    width: `${llamadasProgress * 100}%`,
                                    transition: autoPlay ? "width 0.05s linear" : "width 0.5s ease",
                                  }}
                                />
                              </div>
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm leading-relaxed" style={{ color: lightMode ? BODY : "rgba(255, 247, 231, 0.6)" }}>
                          {lines[1]}
                        </p>
                      )
                    )}
                  </div>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function MarketingLandingV2() {
  const storyCarouselRef = useRef<HTMLDivElement | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [demoTabIndex, setDemoTabIndex] = useState(0);

  const goToSlideRaw = (index: number) => {
    const el = storyCarouselRef.current;
    if (!el) return;
    el.scrollLeft = el.clientWidth * index;
  };

  const goToStorySlide = (index: number) => {
    // Map Step index to Carousel Slide index
    // 0 -> 0, 1 -> 1, 2 -> 3
    const targetSlide = index === 2 ? 3 : index;
    goToSlideRaw(targetSlide);
  };

  const UNIFIED_STORY_STEPS = useMemo(() => [
    {
      title: "Crea tu anuncio en Proplead",
      durationMs: 10000,
      lines: [
        "Importa la información del inmueble desde tus portales en segundos.",
        "Define las condiciones y filtros de cualificación que debe cumplir cada lead."
      ],
    },
    {
      title: "Ve a Marcos, tu asistente, en acción",
      durationMs: 20000,
      lines: [
        "Cualifica leads y resuelve dudas por WhatsApp 24/7, siguiendo tus condiciones y filtros.",
        "badges", // rendered dynamically by TimedFeatureList for step index 1
      ],
    },
    {
      title: "Recibe leads cualificados al instante",
      durationMs: 10000,
      lines: [
        "Con toda la información relevante que necesitas antes de contactarlos."
      ],
    },
  ], []);

  const [userInteracted, setUserInteracted] = useState(false);
  const autoPlay = !userInteracted;

  const handleUserInteract = useCallback(() => {
    setUserInteracted(true);
  }, []);

  // When autoPlay is running, sync the carousel with the active step
  // Step 2 has two sub-phases: 0..10s = slide 1, 10..20s = slide 2
  const [step2RawProgress, setStep2RawProgress] = useState(0); // 0..1

  // Listen to active step changes and sync carousel
  const prevStoryIndexRef = useRef(-1);
  useEffect(() => {
    if (!autoPlay) return;
    if (prevStoryIndexRef.current === activeStoryIndex) return;
    prevStoryIndexRef.current = activeStoryIndex;
    if (activeStoryIndex === 0) goToSlideRaw(0);
    if (activeStoryIndex === 1) { goToSlideRaw(1); setStep2RawProgress(0); }
    if (activeStoryIndex === 2) goToSlideRaw(3);
  }, [activeStoryIndex, autoPlay]);

  // Track step 2 internal progress to switch between slide 1 and slide 2
  const step2TimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (step2TimerRef.current) clearInterval(step2TimerRef.current);
    if (!autoPlay || activeStoryIndex !== 1) return;
    const start = Date.now();
    const total = 20000;
    step2TimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const ratio = Math.min(elapsed / total, 1);
      setStep2RawProgress(ratio);
      // Switch carousel slide at the halfway point
      if (elapsed >= 10000 && elapsed < 10100) {
        goToSlideRaw(2);
      }
      if (elapsed >= total) {
        if (step2TimerRef.current) clearInterval(step2TimerRef.current);
      }
    }, 50);
    return () => { if (step2TimerRef.current) clearInterval(step2TimerRef.current); };
  }, [activeStoryIndex, autoPlay]);

  // Video sync logic removed as step 1 is now an image
  const selectDemoTab = (index: number) => {
    setDemoTabIndex(index);
  };


  return (
    <div className="min-h-screen text-slate-900 font-body relative bg-white">
      {/* Absolute background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white to-[#fff7e7] pointer-events-none" aria-hidden />

      <div className="relative">
        <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-7xl rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-md shadow-lg">
          <div className="px-5 sm:px-6 lg:px-10 h-18 flex items-center justify-between">
            <div className="flex items-center shrink-0">
              <img
                src="/proplead-high-resolution-logo.png"
                alt="Proplead"
                className="h-7 w-auto sm:h-8"
                decoding="async"
              />
            </div>
            <div className="hidden md:flex items-center gap-10 text-base font-bold text-slate-600 font-heading tracking-tight">
              <a href="#" className="hover:text-primary-600 transition-colors">Home</a>
              <a href="#solucion" className="hover:text-primary-600 transition-colors">Solución</a>
              <a href="#precios" className="hover:text-primary-600 transition-colors">Precios</a>
              <a href="#faq" className="hover:text-primary-600 transition-colors">FAQs</a>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/login" className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-6 py-3 rounded-btn text-sm font-bold font-heading transition-all active:scale-95">
                Iniciar sesión
              </Link>
              <Link to="/login" className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-btn text-sm font-bold font-heading transition-all active:scale-95">
                Empezar ahora
              </Link>
            </div>
          </div>
        </nav>

        <section id="dolores" className="relative pt-36 pb-12 lg:pt-44 lg:pb-16 scroll-mt-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">

              <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight mx-auto font-special" style={{ color: TITLE }}>
                No pierdas más tiempo cualificando<br className="hidden lg:block" /> <span className="text-primary-500">leads desinteresados.</span>
              </h1>
              <p className="text-base sm:text-lg mb-8 leading-relaxed max-w-2xl mx-auto" style={{ color: BODY }}>
                Proplead es la plataforma definitiva para agentes inmobiliarios que cualifica leads 24/7 vía WhatsApp y llamadas de voz, permitiéndote cerrar más ventas y enfocarte en lo que te importa.
              </p>
              <div className="flex justify-center">
                <Link to="/login" className="inline-flex px-7 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold font-heading text-base transition-all items-center justify-center gap-1.5 group">
                  Empezar ahora <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
              <p className="mt-3 text-center text-[10px] text-slate-500 max-w-sm mx-auto leading-tight sm:text-[11px] font-heading">
                40 conversaciones gratis (5h ahorradas).<br />
                Cancela cuando quieras.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4 sm:gap-6">
                <p className="text-[10px] sm:text-xs font-medium text-slate-400 text-center sm:text-left uppercase tracking-widest translate-y-[1px] font-heading">Disponible para:</p>
                <div className="flex items-center justify-center gap-6 sm:gap-8 flex-wrap">
                  <span className="inline-flex h-[1.5rem] sm:h-[1.68rem] items-center justify-center -translate-y-[1px]">
                    <img src={idealistaLogo} alt="Idealista" className="max-h-full w-auto grayscale opacity-80" loading="lazy" />
                  </span>
                  <span className="inline-flex h-8 sm:h-9 items-center justify-center">
                    <img src={fotocasaLogo} alt="Fotocasa" className="max-h-full w-auto grayscale opacity-80" loading="lazy" />
                  </span>
                  <span className="inline-flex h-[2.3rem] sm:h-[2.6rem] items-center justify-center translate-y-[4px]">
                    <img src={pisosLogo} alt="Pisos.com" className="max-h-full w-auto grayscale opacity-80" loading="lazy" />
                  </span>
                  <span className="hidden sm:block h-5 w-px bg-slate-200" aria-hidden />
                  <span className="inline-flex h-9 w-24 items-center justify-center">
                    <img src={metaVerifiedLogo} alt="Meta Verified" className="max-h-[85%] w-auto" loading="lazy" />
                  </span>
                </div>
              </div>
              <HeroReviewsRow />
            </div>
          </div>
        </section>



        <section id="solucion" className="relative pt-6 pb-24 lg:pb-32 scroll-mt-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative h-10 sm:h-12 mb-16 lg:mb-20" aria-hidden="true">
              <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <path d="M0,110 C360,25 1080,25 1440,110" fill="none" stroke="#f4d9ad" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>

            {/* Centered heading */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-center font-heading mb-28" style={{ color: TITLE }}>
              Empieza a recibir leads cualificados<br />de forma automática en pocos pasos
            </h2>

            {/* 2-col grid: card+CTA left (lower), carousel right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">

              {/* Left: card + CTA, shifted down to align mid-carousel */}
              <div className="lg:col-span-5 flex flex-col gap-6 lg:pt-24 lg:pl-12">
                <TimedFeatureList 
                  features={UNIFIED_STORY_STEPS} 
                  activeIndex={activeStoryIndex}
                  autoPlay={autoPlay}
                  onUserInteract={handleUserInteract}
                  step2SubProgress={step2RawProgress}
                  onSubStepSelect={(slideIndex) => goToSlideRaw(slideIndex)}
                  onActiveStepChange={(idx) => {
                    setActiveStoryIndex(idx);
                    if (!autoPlay) goToStorySlide(idx);
                  }}
                  onStepSelect={(idx) => {
                    setActiveStoryIndex(idx);
                    goToStorySlide(idx);
                  }}
                />
                <div className="mt-8">
                  <Link to="/login" className="inline-flex px-7 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold font-heading text-base transition-all items-center justify-center gap-1.5 group">
                    Empezar ahora <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <p className="mt-3 text-[11px] text-slate-500 leading-tight block">
                    40 conversaciones gratis (5h ahorradas).<br />
                    Cancela cuando quieras.
                  </p>
                </div>
              </div>

              {/* Right column: Unified Carousel */}
              <div className="lg:col-span-7 w-full relative lg:translate-x-[1.5cm] lg:scale-110" onClick={handleUserInteract} onTouchStart={handleUserInteract}>
                <div ref={storyCarouselRef} onTouchStart={handleUserInteract} onMouseDown={handleUserInteract} className="flex overflow-hidden snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  
                  {/* Step 1: Video */}
                  <div className="min-w-full snap-center px-2">
                    <div className="lg:hidden mb-10 text-center">
                      <h4 className="text-2xl font-bold font-heading" style={{ color: TITLE }}>{UNIFIED_STORY_STEPS[0].title}</h4>
                    </div>
                    <div className="w-full flex justify-center">
                      <div className="inline-flex w-auto rounded-[1.75rem] sm:rounded-[2.1rem] px-12 sm:px-24 py-2 sm:py-2.5" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.04) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                        <div className="w-[min(100vw-3rem,352px)] aspect-[9/16] overflow-hidden rounded-[1.2rem] sm:rounded-[1.4rem] border border-slate-200/80">
                          <img 
                            className="block w-full h-full object-cover align-top" 
                            src={nuevoAnuncioImg} 
                            alt="Nuevo anuncio en Proplead"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2A: First Animation */}
                  <div className="min-w-full snap-center px-2">
                    <div className="lg:hidden mb-10 text-center">
                      <h4 className="text-2xl font-bold font-heading" style={{ color: TITLE }}>{UNIFIED_STORY_STEPS[1].title}</h4>
                    </div>
                    <div className="w-full flex justify-center">
                      <div className="inline-flex w-auto rounded-[1.75rem] sm:rounded-[2.1rem] px-12 sm:px-24 py-2 sm:py-2.5" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.04) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                        <div className="w-[min(100vw-3rem,352px)] aspect-[9/16] overflow-hidden rounded-2xl border border-slate-200/80">
                          <WhatsAppAnimationShowcaseSlow
                            progress={autoPlay ? Math.min(step2RawProgress * 2, 1) : 1}
                            autoScroll={autoPlay}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2B: Second Animation */}
                  <div className="min-w-full snap-center px-2">
                    <div className="lg:hidden mb-10 text-center">
                      <h4 className="text-2xl font-bold font-heading" style={{ color: TITLE }}>{UNIFIED_STORY_STEPS[1].title} (cont.)</h4>
                    </div>
                    <div className="w-full flex justify-center">
                      <div className="inline-flex w-auto rounded-[1.75rem] sm:rounded-[2.1rem] px-12 sm:px-24 py-2 sm:py-2.5" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.04) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                        <div className="w-[min(100vw-3rem,352px)] aspect-[9/16] overflow-hidden rounded-2xl border border-slate-200/80">
                          <WhatsAppAnimationShowcaseCallQualification
                            progress={autoPlay ? Math.min(Math.max(step2RawProgress * 2 - 1, 0), 1) : 1}
                            autoScroll={autoPlay}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Lead Animation */}
                  <div className="min-w-full snap-center px-2">
                    <div className="lg:hidden mb-10 text-center">
                      <h4 className="text-2xl font-bold font-heading" style={{ color: TITLE }}>{UNIFIED_STORY_STEPS[2].title}</h4>
                    </div>
                    <div className="w-full flex justify-center">
                      <div className="inline-flex w-auto rounded-[1.75rem] sm:rounded-[2.1rem] px-12 sm:px-24 py-2 sm:py-2.5" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.04) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                        <div className="w-[min(100vw-3rem,352px)] aspect-[9/16] overflow-hidden rounded-2xl border border-slate-200/80">
                          <WhatsAppLeadsAnimationPhone key={`leads-${activeStoryIndex === 2 ? "active" : "idle"}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Mobile Indicators */}
                <div className="mt-8 flex items-center justify-center gap-3 lg:hidden">
                  {UNIFIED_STORY_STEPS.map((_, idx) => (
                    <button 
                      key={idx} type="button" 
                      onClick={() => { setActiveStoryIndex(idx); goToStorySlide(idx); }}
                      className={cn("h-2.5 rounded-full transition-all duration-300", activeStoryIndex === idx ? "w-8 bg-primary-500" : "w-2.5 bg-slate-200")} 
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>


        <section id="demo" className="pt-0 scroll-mt-14">
          <div className="relative h-16 sm:h-20" aria-hidden>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <path d="M0,0 C320,95 1120,95 1440,0 L1440,120 L0,120 Z" className="fill-primary-500" />
            </svg>
          </div>
          <div className="bg-primary-500 pt-10 pb-10 sm:pt-12 sm:pb-12 lg:pt-16 lg:pb-14">
            <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-12">
              <div className="text-center mb-10 lg:mb-16">
                <h2 className="text-2xl lg:text-4xl font-bold tracking-tight mb-4" style={{ color: TITLE }}>
                  Control total de tu leads<br />y el trabajo de tu asistente, estés donde estés
                </h2>
                <p className="text-lg opacity-80 font-medium" style={{ color: TITLE }}>
                  Gestiona todo desde tu móvil u ordenador
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center lg:translate-x-12">
                {/* Left Side: Accordions (Outside the frame) */}
                <div className="lg:col-span-3 order-2 lg:order-1">
                  <div className="space-y-8">
                    {DEMO_APP_TABS.map((tab, i) => {
                      const isActive = i === demoTabIndex;
                      return (
                        <div key={i} className="flex gap-4 items-start">
                          <span
                            className={cn(
                              "relative flex-shrink-0 w-1 rounded-full overflow-hidden transition-all duration-300",
                              isActive ? "h-20 mt-0.5 bg-black/10" : "h-6 mt-1.5 bg-black/5"
                            )}
                            aria-hidden
                          >
                            <span
                              className="absolute left-0 right-0 top-0 rounded-full"
                              style={{
                                height: isActive ? "100%" : "0%",
                                backgroundColor: TITLE,
                              }}
                            />
                          </span>
                          <div className="w-full">
                            <button
                              type="button"
                              onClick={() => selectDemoTab(i)}
                              className="w-full text-left focus:outline-none"
                            >
                              <h4
                                className={cn(
                                  "text-lg lg:text-xl font-bold leading-tight transition-all duration-300",
                                  isActive ? "translate-x-1" : "opacity-40 hover:opacity-70"
                                )}
                                style={{ color: TITLE }}
                              >
                                {tab.title}
                              </h4>
                            </button>
                            <div className={cn("overflow-hidden transition-all duration-500", isActive ? "max-h-32 mt-2 opacity-100" : "max-h-0 opacity-0")}>
                              <p
                                className="text-base leading-relaxed font-medium"
                                style={{ color: TITLE, opacity: 0.85 }}
                              >
                                {tab.body}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right side: Decorative Frame with Video */}
                <div className="lg:col-span-9 order-1 lg:order-2 lg:-mr-24">
                  <div
                    className="rounded-[1.75rem] sm:rounded-[2.1rem] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-5"
                    style={{
                      border: "2px solid transparent",
                      background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.25) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.15) 0%, rgba(244, 217, 173, 0) 100%) padding-box",
                      backgroundClip: "border-box, padding-box"
                    }}
                  >
                    <div className="flex justify-center leading-none">
                      <div className="w-[90%] mx-auto overflow-hidden rounded-[1.35rem] sm:rounded-[1.6rem] shadow-2xl bg-black">
                        <video
                          className="block w-full h-auto align-top outline-none ring-0 focus:outline-none focus:ring-0"
                          src={demoAppVideo}
                          playsInline
                          autoPlay
                          muted
                          loop
                          preload="metadata"
                          aria-label="Proplead app demo"
                        >
                          Your browser does not support HTML5 video.
                        </video>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative h-16 sm:h-20 bg-primary-50" aria-hidden>
            <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <path d="M0,120 C320,25 1120,25 1440,120 L1440,0 L0,0 Z" className="fill-primary-500" />
            </svg>
          </div>
        </section>

        <div className="relative bg-gradient-to-b from-[#fff7e7] via-white via-[40%] to-white">
          <PricingSection />

          {/* Inverted Decorative Arc Line (Stroke) */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <div className="relative h-10 sm:h-12" aria-hidden="true">
              <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <path d="M0,10 C360,95 1080,95 1440,10" fill="none" stroke="#f4d9ad" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          <FAQSectionContent />
        </div>

        <footer className="bg-primary-500 pt-32 pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12">
              <div className="flex flex-col items-center md:items-start gap-6">
                <img
                  src={whiteLogo}
                  alt="Proplead"
                  className="h-9 w-auto"
                />
                <p className="text-sm font-bold text-slate-950/60 max-w-sm text-center md:text-left leading-relaxed font-heading">
                  Automatizando el sector inmobiliario con inteligencia artificial 24/7.
                </p>
              </div>
              <div className="flex flex-col items-center md:items-end gap-6 text-center md:text-right">
                <div className="flex flex-wrap justify-center md:justify-end gap-x-10 gap-y-4 text-sm font-bold text-slate-950 font-heading">
                  <a href="#dolores" className="hover:opacity-60 transition-opacity">Problemas</a>
                  <a href="#solucion" className="hover:opacity-60 transition-opacity">Solución</a>
                  <a href="#demo" className="hover:opacity-60 transition-opacity">Demostración</a>
                  <a href="#precios" className="hover:opacity-60 transition-opacity">Precios</a>
                  <a href="#faq" className="hover:opacity-60 transition-opacity">Faq</a>
                </div>
                <div className="flex flex-wrap justify-center md:justify-end gap-8 text-sm font-bold text-slate-950/70 font-heading">
                  <Link to="/terms" className="hover:text-slate-950 transition-colors">Términos</Link>
                  <Link to="/privacy" className="hover:text-slate-950 transition-colors">Privacidad</Link>
                  <a href="mailto:hola@proplead.com" className="hover:text-slate-950 transition-colors">Soporte</a>
                </div>
                <p className="text-[10px] font-black tracking-[0.2em] text-slate-950/40 font-heading">
                  © 2026 Proplead. Hecho con ❤️ para inmobiliarias.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
