import { useEffect, useRef } from "react";
import marcosAvatar from "../../Marcos.png";
import waDarkPattern from "../../68747470733a2f2f7765622e77686174736170702e636f6d2f696d672f62672d636861742d74696c652d6461726b5f61346265353132653731393562366237333364393131306234303866303735642e706e67.png";

const AYER_MESSAGES = [
  {
    id: "s1",
    at: "09:14",
    text: `Lead cualificado ✅

Teléfono: 645******
Nombre: Lucía
Propiedad: Calle Pizarra (Cuarto piso)
Operación: Venta
Forma de pago: Con hipoteca (aún no solicitada)
Disponibilidad visita: Por las mañanas
Notas: Le preocupa que al ser finca rústica no sea hipotecable al 100%. Quiere que le expliquen más y solicita llamada. Tiene otra vivienda que quiere ver.`,
  },
  {
    id: "s3",
    at: "16:03",
    text: `Lead cualificado ✅

Teléfono: 633******
Nombre: Patricia
Propiedad: Benajarafe
Operación: Alquiler
Personas: 1 persona
Ingresos: 1.800-2.000 €/mes
Mascotas: Sin mascotas
Fechas: Entrada mayo-junio 2026 (también le vale ahora)
Disponibilidad visita: Cualquier momento; mejor a las 14:00 o después de las 19:00
Notas: Busca alquiler de larga duración (no temporada). Presupuesto hasta 750 €. Zonas: entre Torre del Mar, Benajarafe, Málaga, Torremolinos, Fuengirola y Benalmádena. Mínimo 1 dormitorio. Prefiere amueblado; si es sin amueblar espera precio mucho más bajo.`,
  },
];

const INCOMING_MESSAGE = {
  id: "new1",
  at: "15:32",
  text: `Lead cualificado ✅

Teléfono: 633******
Nombre: Carlos
Propiedad: Torremolinos
Operación: Alquiler
Personas: Son 3 personas (2 adultos y un niño)
Ingresos: 3.500 €
Mascotas: Sin mascotas
Fechas: Les gustaría entrar en 2 semanas
Disponibilidad visita: Sin datos
Notas: Le gustaría extender el contrato temporal un mes más. Se le ha confirmado que no habría problema en base a la descripción de la vivienda en Idealista.`,
};

/* Blurs phone numbers, bolds field labels, and bolds+uppercases the first line */
function renderLeadText(text: string) {
  const phoneRegex = /(\d{8,15})/g;

  return text.split("\n").map((line, li) => {
    const colonIdx = line.indexOf(":");
    const isField = colonIdx > 0 && colonIdx < 30;
    const isTitle = li === 0;

    const label = isField ? line.slice(0, colonIdx + 1) : null;
    const value = isField ? line.slice(colonIdx + 1) : line;

    const renderValue = (str: string) => {
      const parts = str.split(phoneRegex);
      return parts.map((part, pi) =>
        phoneRegex.test(part) ? (
          <span key={`ph-${li}-${pi}`}>{part}</span>
        ) : (
          <span key={`tx-${li}-${pi}`}>{part}</span>
        )
      );
    };

    if (isTitle) {
      return (
        <span key={`line-${li}`} className="font-bold">
          {line}
        </span>
      );
    }

    return (
      <span key={`line-${li}`}>
        {"\n"}
        {label ? (
          <>
            <span className="font-semibold">{label}</span>
            {renderValue(value)}
          </>
        ) : (
          renderValue(value)
        )}
      </span>
    );
  });
}

/* Date separator pill — same style as WhatsApp */
function DateSep({ label, animateIn = false }: { label: string; animateIn?: boolean }) {
  return (
    <div
      className={[
        "mx-auto my-3 w-fit rounded-md bg-[#1f2c33] px-3 py-1 text-[10px] text-[#d9fdd3]",
        animateIn ? "wa-msg-enter" : "",
      ].join(" ")}
    >
      {label}
    </div>
  );
}

function LeadBubble({
  text,
  at,
  animateIn = false,
  phase = 0,
}: {
  text: string;
  at: string;
  animateIn?: boolean;
  phase?: number;
}) {
  return (
    <div
      key={animateIn ? `anim-${phase}` : undefined}
      className={[
        "mr-auto w-fit max-w-[88%] rounded-[8px] rounded-tl-[2px] bg-white px-[9px] pt-[6px] pb-[4px] text-[12.5px] leading-[1.35] text-[#111b21] shadow-sm",
        animateIn ? "wa-msg-enter" : "",
      ].join(" ")}
      style={animateIn ? { animationDelay: `${phase * 420}ms`, animationFillMode: "both" } : undefined}
    >
      <div className="relative">
        <p className="whitespace-pre-line [word-break:break-word]">
          {renderLeadText(text)}
          {/* invisible spacer so timestamp never overlaps last word */}
          <span className="inline-block w-[46px] h-[1px] align-bottom" aria-hidden="true" />
        </p>
        <span className="absolute bottom-[2px] right-0 tabular-nums text-[10px] leading-none text-[#667781]">
          {at}
        </span>
      </div>
    </div>
  );
}

export function WhatsAppLeadsAnimationPhone() {
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight });
  }, []);

  return (
      <div className="mx-auto w-full aspect-[9/16] overflow-hidden rounded-2xl border border-[#1f2c33] shadow-[0_12px_24px_rgba(2,6,23,0.18)]">
        <div className="relative z-10 flex h-full flex-col">
          {/* Header */}
          <div className="flex h-[52px] shrink-0 items-center gap-3 bg-[#202c33] px-3 text-white">
            <img src={marcosAvatar} alt="Marcos" className="h-9 w-9 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">Marcos - Asistente virtual inmobiliario</p>
              <p className="text-[11px] text-[#9eb3bd]">en linea</p>
            </div>
          </div>

          {/* Chat area */}
          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0b141a] p-3 scroll-smooth"
            style={{
              backgroundImage: `linear-gradient(rgba(11,20,26,0.75), rgba(11,20,26,0.75)), url(${waDarkPattern})`,
              backgroundRepeat: "repeat",
              backgroundSize: "280px auto",
              backgroundPosition: "center",
            }}
          >
            {/* Ayer section */}
            <DateSep label="Ayer" />
            <div className="space-y-3">
              {AYER_MESSAGES.map((m) => (
                <LeadBubble key={m.id} text={m.text} at={m.at} />
              ))}
            </div>

            {/* Hoy section — animates in staggered */}
            <div style={{ animation: "waMsgEnter 360ms cubic-bezier(0.22, 1, 0.36, 1) 200ms both" }}>
              <DateSep label="Hoy" />
            </div>
            <div className="pb-5">
              <LeadBubble
                text={INCOMING_MESSAGE.text}
                at={INCOMING_MESSAGE.at}
                animateIn
                phase={1}
              />
            </div>
          </div>
        </div>
      </div>
  );
}

/* ─── Main component ───────────────────────────────────── */
export function WhatsAppLeadsAnimation() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[500px]">
        <header className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Internal test page</p>
          <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Leads Animation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Notificaciones de leads cualificados. Teléfonos ocultos.
          </p>
        </header>
        <WhatsAppLeadsAnimationPhone />
      </div>
    </main>
  );
}
