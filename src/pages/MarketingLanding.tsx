import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Star,
  MessageSquare,
  LayoutGrid,
  Check,
  ChevronDown,
  Clock,
} from "lucide-react";

import idealistaLogo from "../../idealista.png";
import fotocasaLogo from "../../logo-fotocasa-min.png";
import pisosLogo from "../../logo-pisoscom.webp";
import metaVerifiedLogo from "../../meta-verified.png";
import nuevoAnuncioVideo from "../../Nuevo_anuncio2.mp4";
import demoAppVideo from "../../Demo_app.mp4";
import {
  WhatsAppAnimationShowcaseCallQualification,
  WhatsAppAnimationShowcaseSlow,
} from "./WhatsAppAnimationLab";
import { WhatsAppLeadsAnimationPhone } from "./WhatsAppLeadsAnimation";
import { SegmentedControl } from "../components/ui";
import { cn } from "../lib/utils";
import whiteLogo from "../../proplead-high-resolution-logo-white.png";

const TITLE = "#402e32";
const BODY = "#ab8b67";
const CREAM = "#fff7e7";



const SUBSCRIPTION_PLANS = [
  {
    id: "free" as const,
    name: "Free",
    priceMonthly: 0,
    assistancesMonthly: 40,
    listingsIdeal: "1 anuncio activo",
    benefits: [
      "Respuesta de soporte maximo 72h",
      "Acceso: 1 agente",
      "Solo leads de mensajes",
    ],
  },
  {
    id: "advance" as const, // Keeping 'advance' ID for local consistency
    name: "Plus",
    priceMonthly: 39,
    assistancesMonthly: 80,
    listingsIdeal: "Hasta 3 anuncios activos",
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
    listingsIdeal: "4–12 anuncios activos",
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
    listingsIdeal: "13–25 anuncios activos",
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
    listingsIdeal: "Más de 25 (a medida)",
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

  const conversations = numListings * demandValue;
  const hoursSaved = Math.round((conversations * 5) / 60);

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
            Planes que escalan con tus necesidades. Sin permanencias.<br />
            Solo pagas por el volumen que gestionas.
          </p>
        </div>



        {/* Integrated Control Bar */}
        <div className="max-w-5xl mx-auto mb-20">
          <div className="bg-[#2d1b0d] rounded-2xl shadow-2xl shadow-primary-900/10 border border-[#3d2b1d] overflow-hidden">
            {/* High Hierarchy Banner */}
            <div className="bg-primary-500/10 border-b border-white/5 px-6 py-3 flex flex-col sm:flex-row items-center justify-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2 text-primary-400 font-extrabold text-[10px] uppercase tracking-[0.15em] font-heading">
                <MessageSquare size={14} className="shrink-0" />
                <span>1 Lead = 1 Conversación</span>
              </div>
              <div className="h-3 w-px bg-white/10 hidden sm:block" />
              <p className="text-white font-bold text-sm font-heading">
                Paga <span className="text-primary-400 font-black">10€</span> por cada <span className="text-primary-400 font-black">40 conversaciones</span> extra
              </p>
            </div>

            <div className="p-5 sm:p-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-12">

              {/* Volume & Demand Controls */}
              <div className="flex-1 w-full lg:w-3/5 px-4 space-y-6">
                {/* Listings Slider */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">Anuncios activos/mes</span>
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
                    <span className="text-[10px] font-black text-[#ab8b67] uppercase tracking-widest font-heading">Demanda media por anuncio</span>
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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70 font-heading">Conversaciones/mes</p>
                  <p className="text-lg font-black font-heading leading-none tabular-nums text-primary-400">
                    {conversations}<span className="text-primary-400 ml-0.5">*</span>
                  </p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70 font-heading">Ahorro</p>
                  <p className="text-lg font-black text-emerald-400 font-heading leading-none tabular-nums">{hoursSaved}h/mes</p>
                </div>
              </div>

              {/* Billing Toggle */}
              <div className="shrink-0 scale-90 sm:scale-100">
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



        {/* Pricing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-8 max-w-[1400px] mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isEnterprise = plan.id === "enterprise";
            const isFree = plan.id === "free";
            const extraConversations = isFree ? 0 : Math.max(0, conversations - 80);
            const extraPrice = (extraConversations / 40) * 10;
            const currentPriceMonthly = plan.priceMonthly !== null ? plan.priceMonthly + extraPrice : null;

            const isRecommended = 
              (numListings <= 2 && plan.id === "advance") ||
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
                    "flex-1 flex flex-col p-5 transition-all duration-300",
                    isRecommended 
                      ? "border-primary-500 border-2 rounded-b-2xl bg-white" 
                      : "border-gray-200 border rounded-2xl bg-white hover:border-gray-300"
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
                      <div className="space-y-1 mb-3">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-heading">Consumo mensual</label>
                        <div className="flex items-start gap-1.5 min-h-[32px] pt-1">
                          <MessageSquare size={13} className="text-primary-500 shrink-0 mt-0.5" />
                            <span className="text-xs text-primary-600 font-bold leading-tight font-heading">
                              {(isFree ? 40 : Math.max(80, conversations)).toLocaleString()} conversaciones
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock size={13} className="text-emerald-500 shrink-0" />
                            <span className="text-xs font-bold text-emerald-600 font-heading">
                              {Math.round(((isFree ? 40 : Math.max(80, conversations)) * 5) / 60)}h ahorradas
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

                  <Link to="/login" className="flex items-center justify-center gap-1.5 w-full py-2 rounded-btn border text-sm font-bold font-heading transition-colors border-gray-300 bg-white text-gray-800 hover:bg-gray-50">
                    {plan.id === "enterprise" ? "Contactar" : plan.priceMonthly === 0 ? "Empezar gratis" : "Contratar"}
                  </Link>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </div>
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
              <button className="w-full px-6 py-5 text-left flex justify-between items-center gap-4 focus:outline-none" onClick={() => setOpenIndex(openIndex === i ? null : i)}>
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
          <a href="https://wa.me/34681106443" target="_blank" className="inline-flex items-center gap-2 text-primary-600 font-bold font-heading hover:text-primary-700 transition-colors">
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

const STORY_FEATURES_STEP_ONE = [
  {
    title: "Indica las características básicas",
    lines: [
      "Define los datos clave del inmueble como en tus portales inmobiliarios.",
      "Así Proplead arranca con la misma base de información que ya publicas.",
    ],
    durationMs: 14000,
  },
  {
    title: "Especifica las condiciones a aceptar",
    lines: [
      "Marca los requisitos mínimos que debe cumplir cada interesado antes de avanzar, para que el asistente los valide y evite leads fríos.",
      "",
    ],
    durationMs: 11000,
  },
  {
    title: "Determina los filtros de cualificación",
    lines: [
      "Configura filtros clave, como ingresos mínimos y número máximo de personas, para que el asistente te envíe solo leads con mayor potencial de cierre.",
      "",
    ],
    durationMs: 8500,
  },
  {
    title: "Pega la descripción del anuncio",
    lines: [
      "Usa tu texto del portal para que la IA responda dudas con contexto real.",
      "Con esto mantienes respuestas precisas y alineadas con tu oferta.",
    ],
    durationMs: 8234,
  },
] as const;

const STORY_FEATURES_STEP_TWO = [
  {
    title: "Responde a leads provenientes de llamadas o mensajes recibidos en tus portales inmobiliarios",
    lines: [
      <>
        Asigna el numero de Proplead a tus anuncios para que Marcos atienda por voz y redirija al interesado a WhatsApp; pruebalo llamando al{" "}
        <strong>911676990</strong>.
      </>,
      "También responde a mensajes enviados a tu portal.",
    ],
    durationMs: 8000,
  },
  {
    title: "Cualifica siguiendo las condiciones y filtros establecidos",
    lines: [
      "Pregunta ingresos, número de habitantes, fecha de entrada y se asegura que se acepten las condiciones de la vivienda.",
      "Así solo recibes contactos que realmente encajan con el perfil que te interesa.",
    ],
    durationMs: 8000,
  },
] as const;

const STORY_FEATURES_STEP_THREE = [
  {
    title: "Recibe al instante los leads cualificados",
    lines: [
      "Te llega un resumen claro de cada conversación junto con las respuestas a todos tus criterios de cualificación.",
      "Decides más rápido, priorizas mejor y aumentas la probabilidad de cierre desde el primer contacto.",
    ],
  },
] as const;

const FEATURE_STEP_MS = 7000;

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

const DEMO_TAB_STEP_MS = 7000;



function TimedFeatureList({
  features = PRODUCT_FEATURES,
  onActiveStepChange,
  onStepSelect,
  activeIndex: externalActiveIndex,
}: {
  features?: ReadonlyArray<{ title: string; lines: readonly [ReactNode, ReactNode] | readonly ReactNode[]; durationMs?: number }>;
  onActiveStepChange?: (index: number) => void;
  onStepSelect?: (index: number) => void;
  activeIndex?: number;
}) {
  const [internalActiveIndex, setInternalActiveIndex] = useState(0);
  const activeIndex = externalActiveIndex !== undefined ? externalActiveIndex : internalActiveIndex;
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

  const [stepStartedAt, setStepStartedAt] = useState(() => Date.now());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - stepStartedAt;
      const currentDurationMs = features[activeIndex]?.durationMs ?? FEATURE_STEP_MS;
      const ratio = Math.min(elapsed / currentDurationMs, 1);
      setProgress(ratio);

      if (elapsed >= currentDurationMs) {
        setActiveIndex((prev) => (prev + 1) % features.length);
        setStepStartedAt(Date.now());
        setProgress(0);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [activeIndex, features, stepStartedAt]);

  // When external index changes (e.g. manual scroll), reset progress and timer
  useEffect(() => {
    if (externalActiveIndex !== undefined && externalActiveIndex !== activeIndex) {
      setStepStartedAt(Date.now());
      setProgress(0);
    }
  }, [externalActiveIndex]);

  return (
    <ul className="flex flex-col gap-6">
      {features.map(({ title, lines }, index) => {
        const isActive = index === activeIndex;
        return (
          <li key={title} className="flex gap-4 items-start">
            <span
              className={`relative flex-shrink-0 w-1.5 rounded-full overflow-hidden transition-all duration-300 ${isActive ? "h-16 mt-0.5" : "h-7 mt-1"}`}
              style={{ backgroundColor: CREAM, opacity: 0.9 }}
              aria-hidden
            >
              <span
                className="absolute left-0 right-0 top-0 rounded-full transition-[height] duration-100 ease-linear"
                style={{
                  height: `${isActive ? progress * 100 : index < activeIndex ? 100 : 0}%`,
                  backgroundColor: TITLE,
                }}
              />
            </span>
            <div className="pt-0.5 w-full">
              <button
                type="button"
                onClick={() => {
                  onStepSelect?.(index);
                  setActiveIndex(index);
                  setStepStartedAt(Date.now());
                  setProgress(0);
                }}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-md"
                aria-expanded={isActive}
              >
                <h4 className={`text-lg sm:text-xl font-bold leading-tight transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-85"}`} style={{ color: TITLE }}>
                  {title}
                </h4>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-out ${isActive ? "max-h-28 mt-2 opacity-100" : "max-h-0 mt-0 opacity-0"}`}>
                <p className="text-base leading-relaxed" style={{ color: BODY }}>
                  {lines[0] ?? ""}
                </p>
                <p className="text-base leading-relaxed mt-2" style={{ color: BODY }}>
                  {lines[1] ?? ""}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MarketingLanding() {
  const stepOneVideoRef = useRef<HTMLVideoElement | null>(null);
  const phoneCarouselRef = useRef<HTMLDivElement | null>(null);
  const [activePhoneSlide, setActivePhoneSlide] = useState(0);

  const [demoTabIndex, setDemoTabIndex] = useState(0);
  const [demoTabStartedAt, setDemoTabStartedAt] = useState(() => Date.now());
  const [demoTabProgress, setDemoTabProgress] = useState(0);

  const stepOneStartSeconds = useMemo(() => {
    const starts: number[] = [];
    let accMs = 0;
    for (const feature of STORY_FEATURES_STEP_ONE) {
      starts.push(accMs / 1000);
      accMs += feature.durationMs ?? FEATURE_STEP_MS;
    }
    return starts;
  }, []);

  const syncStepOneVideoToIndex = useCallback((index: number) => {
    const video = stepOneVideoRef.current;
    if (!video) return;
    
    const targetSecond = stepOneStartSeconds[index] ?? 0;
    
    const applySync = () => {
      // Increased threshold to 2s to avoid jittering
      if (Math.abs(video.currentTime - targetSecond) > 2) {
        video.currentTime = targetSecond;
      }
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Silent catch for auto-play blocks
          video.muted = true;
        });
      }
    };

    if (video.readyState >= 2) {
      applySync();
    } else {
      const onCanPlay = () => {
        applySync();
        video.removeEventListener("canplay", onCanPlay);
      };
      video.addEventListener("canplay", onCanPlay);
    }
  }, [stepOneStartSeconds]);

  useEffect(() => {
    const el = phoneCarouselRef.current;
    if (!el) return;

    const onScroll = () => {
      const width = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / width);
      setActivePhoneSlide(Math.max(0, Math.min(2, idx)));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const goToPhoneSlide = (index: number) => {
    const el = phoneCarouselRef.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: "smooth" });
  };

  const selectDemoTab = (index: number) => {
    setDemoTabIndex(index);
    setDemoTabStartedAt(Date.now());
    setDemoTabProgress(0);
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - demoTabStartedAt;
      const ratio = Math.min(elapsed / DEMO_TAB_STEP_MS, 1);
      setDemoTabProgress(ratio);
      if (elapsed >= DEMO_TAB_STEP_MS) {
        setDemoTabIndex((prev) => (prev + 1) % DEMO_APP_TABS.length);
        setDemoTabStartedAt(Date.now());
        setDemoTabProgress(0);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [demoTabIndex, demoTabStartedAt]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActivePhoneSlide((prev) => {
        const next = (prev + 1) % 2;
        goToPhoneSlide(next);
        return next;
      });
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen text-slate-900 font-body relative bg-white">
      {/* Absolute background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-primary-50 to-slate-50 pointer-events-none" aria-hidden />

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

        <section id="dolores" className="relative pt-44 pb-20 lg:pt-52 lg:pb-28 scroll-mt-28">
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

        <section className="pt-8 pb-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative h-10 sm:h-12 mb-4" aria-hidden>
              <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <path d="M0,110 C360,25 1080,25 1440,110" fill="none" stroke="#f4d9ad" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center font-heading" style={{ color: TITLE }}>
              Empieza a recibir leads cualificados<br />de forma automática en pocos pasos
            </h2>
          </div>
        </section>

        <section id="solucion" className="relative pt-10 pb-10 lg:pt-14 lg:pb-14 scroll-mt-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-16">
              <div className="w-full flex justify-center">
                <div className="w-full max-w-[min(100%,560px)]">
                  <div className="rounded-[1.75rem] sm:rounded-[2.1rem] p-2.5 sm:p-3" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.12) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                    <div className="flex justify-center leading-none">
                      <div className="w-[min(100vw-4rem,440px)] h-[min(calc((100vw-4rem)*16/9),640px)] overflow-hidden rounded-[1.35rem] sm:rounded-[1.6rem] border border-slate-200/80">
                        <video 
                          ref={stepOneVideoRef} 
                          className="block w-full h-full object-cover align-top outline-none ring-0 pointer-events-none" 
                          src={nuevoAnuncioVideo} 
                          playsInline 
                          muted 
                          loop 
                          preload="auto" 
                          tabIndex={-1}
                        >
                          Tu navegador no reproduce vídeo HTML5.
                        </video>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full flex flex-col justify-center text-left max-w-xl justify-self-center lg:translate-x-12">
                <div className="relative mb-5">
                  <span className="pointer-events-none select-none absolute -top-12 sm:-top-14 lg:-top-16 -left-2 sm:-left-3 lg:-left-4 text-[7rem] sm:text-[9rem] lg:text-[11rem] font-extrabold leading-none" style={{ color: "#f4d9ad", opacity: 0.40 }} aria-hidden>01</span>
                  <h3 className="relative z-10 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-primary-500 font-heading">Crea tu anuncio en Proplead.</h3>
                </div>
                <TimedFeatureList features={STORY_FEATURES_STEP_ONE} onActiveStepChange={syncStepOneVideoToIndex} onStepSelect={syncStepOneVideoToIndex} />
              </div>
            </div>
          </div>
        </section>

        <section className="relative pb-10 lg:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:gap-10">
              <div className="w-full flex flex-col justify-center text-left max-w-xl justify-self-center">
                <div className="relative mb-5">
                  <span className="pointer-events-none select-none absolute -top-12 sm:-top-14 lg:-top-16 -left-2 sm:-left-3 lg:-left-4 text-[7rem] sm:text-[9rem] lg:text-[11rem] font-extrabold leading-none" style={{ color: "#f4d9ad", opacity: 0.40 }} aria-hidden>02</span>
                  <h3 className="relative z-10 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-primary-500 font-heading">Ve a Marcos, tu asistente, en acción.</h3>
                </div>
                <TimedFeatureList 
                  features={STORY_FEATURES_STEP_TWO} 
                />
              </div>
              <div className="w-full flex justify-center">
                <div className="inline-flex w-auto max-w-[min(100%,600px)] rounded-[1.75rem] sm:rounded-[2.1rem] p-2.5 sm:p-3" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.12) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                  <div className="w-full">
                    <div ref={phoneCarouselRef} className="w-[min(100vw-4rem,470px)] h-[min(calc((100vw-4rem)*16/9),640px)] overflow-hidden rounded-2xl snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <div className="flex h-full">
                        <div className="min-w-full h-full snap-center"><WhatsAppAnimationShowcaseSlow /></div>
                        <div className="min-w-full h-full snap-center"><WhatsAppAnimationShowcaseCallQualification /></div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {[0, 1].map((idx) => (
                        <button key={idx} type="button" onClick={() => goToPhoneSlide(idx)} aria-label={`Ir a animacion ${idx + 1}`} className={cn("h-2.5 rounded-full transition-all duration-200", activePhoneSlide === idx ? "w-6 bg-primary-500" : "w-2.5 bg-slate-300 hover:bg-slate-400")} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative pb-10 lg:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-16">
              <div className="w-full flex justify-center">
                <div className="inline-flex w-auto max-w-[min(100%,600px)] rounded-[1.75rem] sm:rounded-[2.1rem] p-2.5 sm:p-3" style={{ border: "2px solid transparent", background: "linear-gradient(to bottom right, rgba(244, 217, 173, 0.2) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.12) 0%, rgba(244, 217, 173, 0) 100%) padding-box", backgroundClip: "border-box, padding-box" }}>
                  <div className="w-full">
                    <div className="w-[min(100vw-4rem,440px)] h-[min(calc((100vw-4rem)*16/9),640px)] overflow-hidden rounded-2xl">
                      <WhatsAppLeadsAnimationPhone />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full flex flex-col justify-center text-left max-w-xl justify-self-center lg:translate-x-12">
                <div className="relative mb-5">
                  <span className="pointer-events-none select-none absolute -top-12 sm:-top-14 lg:-top-16 -left-2 sm:-left-3 lg:-left-4 text-[7rem] sm:text-[9rem] lg:text-[11rem] font-extrabold leading-none" style={{ color: "#f4d9ad", opacity: 0.40 }} aria-hidden>03</span>
                  <h3 className="relative z-10 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-primary-500 font-heading">Recibe al instante los leads cualificados.</h3>
                </div>
                <TimedFeatureList features={STORY_FEATURES_STEP_THREE} />

                <div className="mt-14">
                  <Link to="/login" className="inline-flex px-7 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold font-heading text-base transition-all items-center justify-center gap-1.5 group">
                    Empezar ahora <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <p className="mt-4 text-[11px] text-slate-500 leading-tight">
                    40 conversaciones gratis (5h ahorradas).<br />
                    Cancela cuando quieras.
                  </p>
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
                  Tanto desde tu móvil como ordenador
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center lg:translate-x-12">
                {/* Left side: Accordions (Outside the frame) */}
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
                              className="absolute left-0 right-0 top-0 rounded-full transition-[height] duration-100 ease-linear"
                              style={{
                                height: `${isActive ? demoTabProgress * 100 : i < demoTabIndex ? 100 : 0}%`,
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
                  <Link to="/legal/terms" className="hover:text-slate-950 transition-colors">Términos</Link>
                  <Link to="/legal/privacy-policy" className="hover:text-slate-950 transition-colors">Privacidad</Link>
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

