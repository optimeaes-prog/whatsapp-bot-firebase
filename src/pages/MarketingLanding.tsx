import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Star } from "lucide-react";

import dashboardImg from "../assets/landing/dashboard.png";
import calendlyLogo from "../../lg-677a5c89d313a-Calendly.png";
import whatsappBusinessLogo from "../../whatsapp_business_logo-freelogovectors.net_ (1).png";
import metaVerifiedLogo from "../../meta-verified.png";
import { WhatsAppAnimationShowcaseSlow } from "./WhatsAppAnimationLab";

const TITLE = "#402e32";
const BODY = "#ab8b67";
const CREAM = "#fff7e7";

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
      className="mt-3 flex flex-col items-center"
      role="img"
      aria-label="Valoración media 4,7 sobre 5 estrellas"
    >
      <div className="flex justify-center">
        {REVIEW_AVATAR_SRC.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={`h-5 w-5 shrink-0 rounded-full border border-white object-cover shadow-sm ${i > 0 ? "-ml-1" : ""}`}
            style={{ zIndex: i + 1 }}
          />
        ))}
      </div>
      <div className="mt-1 flex items-center justify-center gap-0.5">
        <span className="text-[10px] font-bold tabular-nums leading-none" style={{ color: TITLE }}>
          4.7
        </span>
        <div className="flex items-center gap-px">
          {[0, 1, 2, 3].map((k) => (
            <Star key={k} className="h-2.5 w-2.5" fill={STAR_GOLD} color={STAR_GOLD} strokeWidth={0} />
          ))}
          <div className="relative h-2.5 w-2.5 shrink-0">
            <Star className="h-2.5 w-2.5" fill="#e5e7eb" color="#e5e7eb" strokeWidth={0} aria-hidden />
            <div className="absolute inset-0 overflow-hidden" style={{ width: "70%" }} aria-hidden>
              <Star className="h-2.5 w-2.5" fill={STAR_GOLD} color={STAR_GOLD} strokeWidth={0} />
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
  },
  {
    title: "Especifica las condiciones a aceptar",
    lines: [
      "Marca los requisitos mínimos que debe cumplir cada interesado antes de avanzar.",
      "El asistente valida estas condiciones durante la conversación para evitar leads fríos.",
    ],
  },
  {
    title: "Determina los filtros de cualificación",
    lines: [
      "Define reglas claras para filtrar mejor: ingresos mínimos, número máximo de personas o tenencia de mascotas.",
      "El asistente aplicará estos criterios en cada conversación para enviarte solo leads con mayor potencial de cierre.",
    ],
  },
  {
    title: "Pega la descripción del anuncio",
    lines: [
      "Usa tu texto del portal para que la IA responda dudas con contexto real.",
      "Con esto mantienes respuestas precisas y alineadas con tu oferta.",
    ],
  },
] as const;

const STORY_FEATURES_STEP_TWO = [
  {
    title: "Responde leads de llamadas y mensajes en tus plataformas",
    lines: [
      <>
        Asigna el numero de Proplead a tus anuncios para que Marcos atienda por voz y redirija al interesado a WhatsApp; pruebalo llamando al{" "}
        <strong>XXXX</strong>.
      </>,
      "Además, puede iniciar conversaciones automáticamente con quienes escriben desde tus portales activos.",
    ],
  },
  {
    title: "Cualifica según tus anuncios y filtros",
    lines: [
      "Pregunta ingresos, número de habitantes, fecha de entrada y cualquier requisito que definas.",
      "Así solo recibes contactos que realmente encajan con el perfil que te interesa.",
    ],
  },
  {
    title: "Recibes al instante los leads cualificados",
    lines: [
      "Te llega un resumen claro de cada conversación junto con las respuestas a todos tus criterios de cualificación.",
      "Decides más rápido, priorizas mejor y aumentas la probabilidad de cierre desde el primer contacto.",
    ],
  },
] as const;

const FEATURE_STEP_MS = 7000;

function TimedFeatureList({
  features = PRODUCT_FEATURES,
}: {
  features?: ReadonlyArray<{ title: string; lines: readonly [ReactNode, ReactNode] | readonly ReactNode[] }>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [stepStartedAt, setStepStartedAt] = useState(() => Date.now());
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - stepStartedAt;
      const ratio = Math.min(elapsed / FEATURE_STEP_MS, 1);
      setProgress(ratio);

      if (elapsed >= FEATURE_STEP_MS) {
        setActiveIndex((prev) => (prev + 1) % features.length);
        setStepStartedAt(Date.now());
        setProgress(0);
      }
    }, 100);

    return () => window.clearInterval(interval);
  }, [features.length, stepStartedAt]);

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
                <p className="text-base leading-relaxed" style={{ color: BODY }}>
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
  return (
    <div className="min-h-screen text-slate-900 font-sans relative bg-white">
      {/* Mismo fondo que Landing (/) */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-primary-50 to-slate-50 pointer-events-none" aria-hidden />
      <div className="relative">
      <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] max-w-7xl rounded-2xl border border-slate-200 bg-white/85 backdrop-blur-md shadow-lg">
        <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center shrink-0">
            <img
              src="/proplead-high-resolution-logo.png"
              alt="Proplead"
              className="h-6 w-auto sm:h-7"
              decoding="async"
            />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#dolores" className="hover:text-primary-600 transition-colors">
              Problemas
            </a>
            <a href="#solucion" className="hover:text-primary-600 transition-colors">
              Solución
            </a>
            <a href="#demo" className="hover:text-primary-600 transition-colors">
              Demostración
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-5 py-2.5 rounded-btn text-sm font-semibold transition-all shadow-none active:scale-95"
            >
              Iniciar sesión
            </Link>
            <Link to="/login" className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2.5 rounded-btn text-sm font-semibold transition-all shadow-none active:scale-95">
              Empezar ahora
            </Link>
          </div>
        </div>
      </nav>

      <section id="dolores" className="relative pt-36 pb-20 lg:pt-40 lg:pb-28 scroll-mt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="group inline-flex items-center gap-2 rounded-full border border-primary-200/80 bg-white/85 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 mb-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-sm">
                <Sparkles className="h-3 w-3" aria-hidden />
              </span>
              <span className="tracking-[0.01em]">
                El asistente virtual para agentes inmobiliarios
              </span>
            </p>
            <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 leading-[1.15] mb-6 tracking-tight max-w-[18ch] mx-auto">
              No pierdas ni un solo lead más <span className="text-primary-500">por falta de tiempo.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed max-w-2xl mx-auto">
              Proplead es la plataforma definitiva que utiliza IA para calificar leads 24/7 vía WhatsApp y llamadas de voz, permitiéndote cerrar más
              ventas mientras te enfocas en lo que importa.
            </p>
            <div className="flex justify-center">
              <Link
                to="/login"
                className="inline-flex px-7 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-semibold text-base transition-all shadow-none items-center justify-center gap-1.5 group"
              >
                Empezar ahora <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            <p className="mt-3 text-center text-[10px] text-slate-500 max-w-sm mx-auto leading-tight sm:text-[11px]">
              60 cualificaciones gratis. Cancela cuando quieras.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-5">
              <p className="text-xs sm:text-sm font-semibold text-slate-700 text-center sm:text-left">Integrado con:</p>
              <div className="flex items-center justify-center gap-4 sm:gap-5 flex-wrap">
                <span className="inline-flex h-9 w-28 items-center justify-center">
                  <img src={calendlyLogo} alt="Calendly" className="max-h-[65%] max-w-[65%] object-contain grayscale" loading="lazy" decoding="async" />
                </span>
                <span className="inline-flex h-9 w-28 items-center justify-center">
                  <img
                    src={whatsappBusinessLogo}
                    alt="WhatsApp Business"
                    className="max-h-full max-w-full object-contain grayscale"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="hidden sm:block h-5 w-px bg-slate-300" aria-hidden />
                <span className="inline-flex h-9 w-28 items-center justify-center">
                  <img src={metaVerifiedLogo} alt="Meta Verified" className="max-h-[80%] max-w-[80%] object-contain" loading="lazy" decoding="async" />
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
              <path
                d="M0,110 C360,25 1080,25 1440,110"
                fill="none"
                stroke="#f4d9ad"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center" style={{ color: TITLE }}>
            Empieza a recibir leads cualificados
            <br />
            de forma automática en pocos pasos
          </h2>
        </div>
      </section>

      <section id="solucion" className="relative pt-10 pb-20 lg:pt-14 lg:pb-28 scroll-mt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12 lg:gap-16">
            {/* Video: marco exterior separado del frame del video */}
            <div className="w-full flex justify-center">
              <div className="w-full max-w-[min(100%,448px)]">
                <div
                  className="rounded-[1.75rem] sm:rounded-[2.1rem] p-2.5 sm:p-3"
                  style={{
                    border: "2px solid transparent",
                    background:
                      "linear-gradient(to bottom right, rgba(244, 217, 173, 0.35) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.22) 0%, rgba(244, 217, 173, 0) 100%) padding-box",
                    backgroundClip: "border-box, padding-box",
                  }}
                >
                  <div className="bg-transparent">
                    <div className="flex justify-center leading-none">
                      <video
                        className="block max-h-[min(57.6vh,704px)] w-auto max-w-full h-auto align-top rounded-[1.35rem] sm:rounded-[1.6rem] shadow-[0_12px_24px_rgba(2,6,23,0.18)] outline-none ring-0 focus:outline-none focus:ring-0"
                        src="/marketing/anunciosolomodal.mp4"
                        playsInline
                        autoPlay
                        muted
                        loop
                        preload="metadata"
                        tabIndex={-1}
                      >
                        Tu navegador no reproduce vídeo HTML5.
                      </video>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explainer */}
            <div className="w-full flex flex-col justify-center text-left max-w-xl justify-self-center lg:translate-x-12">
              <div className="relative mb-5">
                <span
                  className="pointer-events-none select-none absolute -top-12 sm:-top-14 lg:-top-16 -left-2 sm:-left-3 lg:-left-4 text-[7rem] sm:text-[9rem] lg:text-[11rem] font-extrabold leading-none"
                  style={{ color: "#f4d9ad", opacity: 0.40 }}
                  aria-hidden
                >
                  01
                </span>
                <h3 className="relative z-10 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-primary-500">
                  Crea tu anuncio en Proplead.
                </h3>
              </div>
              <TimedFeatureList features={STORY_FEATURES_STEP_ONE} />
            </div>
          </div>
        </div>
      </section>

      <section className="relative pb-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:gap-10">
            {/* Explainer (izquierda) */}
            <div className="w-full flex flex-col justify-center text-left max-w-xl justify-self-center">
              <div className="relative mb-5">
                <span
                  className="pointer-events-none select-none absolute -top-12 sm:-top-14 lg:-top-16 -left-2 sm:-left-3 lg:-left-4 text-[7rem] sm:text-[9rem] lg:text-[11rem] font-extrabold leading-none"
                  style={{ color: "#f4d9ad", opacity: 0.40 }}
                  aria-hidden
                >
                  02
                </span>
                <h3 className="relative z-10 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-primary-500">
                  Ve a Marcos, tu asistente, en acción.
                </h3>
              </div>
              <TimedFeatureList features={STORY_FEATURES_STEP_TWO} />
            </div>

            {/* Video (derecha) */}
            <div className="w-full flex justify-center">
              <div className="inline-flex w-auto max-w-full">
                <div
                  className="inline-flex w-auto rounded-[1.75rem] sm:rounded-[2.1rem] p-2.5 sm:p-3"
                  style={{
                    border: "2px solid transparent",
                    background:
                      "linear-gradient(to bottom right, rgba(244, 217, 173, 0.35) 0%, rgba(244, 217, 173, 0) 100%) border-box, linear-gradient(to bottom right, rgba(244, 217, 173, 0.22) 0%, rgba(244, 217, 173, 0) 100%) padding-box",
                    backgroundClip: "border-box, padding-box",
                  }}
                >
                  <WhatsAppAnimationShowcaseSlow />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo" className="pt-0 scroll-mt-14">
        {/* Separacion curva real entre secciones */}
        <div className="relative h-16 sm:h-20" aria-hidden>
          <svg
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <path
              d="M0,0 C320,95 1120,95 1440,0 L1440,120 L0,120 Z"
              className="fill-primary-500"
            />
          </svg>
        </div>
        <div className="bg-primary-500 pb-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl lg:text-4xl font-bold mb-4 tracking-tight">Control total en la palma de tu mano</h2>
            <p className="text-base text-slate-600 max-w-2xl mx-auto">Interfaz pensada para decidir rápido con datos claros.</p>
          </div>
          <div className="bg-white p-4 lg:p-8 rounded-[40px] shadow-2xl border border-slate-200">
            <img src={dashboardImg} alt="Proplead Dashboard" className="rounded-[32px] w-full" />
          </div>
          </div>
        </div>
      </section>

      <section className="py-24 relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="bg-slate-900 rounded-[48px] p-12 lg:p-20 shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-8">¿Listo para escalar tus operaciones?</h2>
            <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
              Únete a inmobiliarias que ya ahorran tiempo con automatización inteligente.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-12 py-6 bg-primary-500 hover:bg-primary-600 text-white rounded-btn font-bold text-xl transition-all shadow-none active:scale-95"
            >
              Empieza ahora gratis <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-slate-200/80 bg-white/50 backdrop-blur-[6px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold tracking-tighter">P</div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Proplead</span>
            </div>
            <div className="flex gap-8 text-sm font-medium text-slate-500">
              <Link to="/terms" className="hover:text-primary-600 transition-colors">
                Términos
              </Link>
              <Link to="/privacy" className="hover:text-primary-600 transition-colors">
                Privacidad
              </Link>
              <a href="#" className="hover:text-primary-600 transition-colors">
                Contacto
              </a>
            </div>
            <p className="text-sm text-slate-400 underline underline-offset-4">© 2026 Proplead. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
