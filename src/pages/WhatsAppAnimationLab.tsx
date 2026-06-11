import { useEffect, useRef, useState } from "react";
import marcosAvatar from "../../Marcos.png";
import waDarkPattern from "../../68747470733a2f2f7765622e77686174736170702e636f6d2f696d672f62672d636861742d74696c652d6461726b5f61346265353132653731393562366237333364393131306234303866303735642e706e67.png";

type MsgDirection = "in" | "out";

type Message = {
  id: string;
  text: string;
  at: string;
  dir: MsgDirection;
  quickReplies?: string[];
};

type Variant = {
  id: string;
  title: string;
  subtitle: string;
  cycleMs: number;
  typingMs: number;
  staggerMs: number;
  messages: Message[];
};

const baseMessages: Message[] = [
  {
    id: "m1",
    dir: "in",
    at: "10:31",
    text:
      "Hola Carlos. Soy Marcos, tu asistente virtual inmobiliario.\n\nLe has escrito a María por tu interés en esta vivienda: idealista.com/inmueble/111070704\n\n¿Es correcto?",
    quickReplies: ["Si", "No"],
  },
  {
    id: "m2",
    dir: "out",
    at: "10:32",
    text: "Si",
  },
  {
    id: "m3",
    dir: "in",
    at: "10:33",
    text:
      "Estupendo. ¿Has visto las características?\n· Alquiler de temporada\n· No hay parking\n· No acepta mascotas",
  },
  {
    id: "m4",
    dir: "out",
    at: "10:34",
    text: "Sí, todo claro. Lo único, ¿se podría ampliar el alquiler un mes más?",
  },
  {
    id: "m5",
    dir: "in",
    at: "10:35",
    text:
      "Sí, Carlos. Acabo de consultar la descripción del anuncio y no habría ningún problema en extenderlo un mes más.\n\nPara avanzar, ¿me podrías decir para cuántas personas sería, los ingresos netos mensuales de estas y la fecha de entrada deseada?",
  },
  {
    id: "m6",
    dir: "out",
    at: "10:36",
    text:
      "Seríamos 3 personas (2 adultos y un niño), con unos ingresos mensuales netos de unos 3.500 €. Nos gustaría entrar en 2 semanas.",
  },
  {
    id: "m7",
    dir: "in",
    at: "10:37",
    text:
      "Genial, con esos datos es suficiente. Se los paso al comercial para que te llame y agendar una visita. ¡Un saludo, Carlos!",
  },
];

const callQualificationMessages: Message[] = [
  {
    id: "q1",
    dir: "in",
    at: "10:31",
    text:
      "Hola! Soy el asistente virtual de María. Acabamos de hablar por teléfono.\n\nPara localizar el anuncio por el que nos contactas, ¿me pasas por favor alguno de estos datos?:\n\n· Número de referencia (9 dígitos)\n· La calle o zona\n· El precio\n· El enlace al anuncio",
  },
  {
    id: "q2",
    dir: "out",
    at: "10:32",
    text: "Es el de la Cala del Moral, en Avenida Picasso 21",
  },
  {
    id: "q3",
    dir: "in",
    at: "10:33",
    text:
      "Estupendo, creo que ya lo tengo: idealista.com/inmueble/111070704\n¿Es esta la vivienda por la que nos contactas?",
  },
  {
    id: "q4",
    dir: "out",
    at: "10:34",
    text: "Sí, esa misma",
  },
  {
    id: "q5",
    dir: "in",
    at: "10:35",
    text:
      "Genial. Por confirmar, ¿has visto las características?\n· Alquiler de temporada\n· No hay parking\n· No acepta mascotas",
  },
  {
    id: "q6",
    dir: "out",
    at: "10:36",
    text: "Sí, me encaja",
  },
  {
    id: "q7",
    dir: "in",
    at: "10:37",
    text:
      "Para avanzar, necesito: ¿cuántas personas viviréis?, ¿ingresos netos mensuales?, ¿fecha de entrada? y ¿tenéis mascotas?",
  },
  {
    id: "q8",
    dir: "out",
    at: "10:38",
    text:
      "Seríamos 3 personas (2 adultos y un niño), con unos ingresos mensuales netos de unos 3.500 €. Nos gustaría entrar en 2 semanas",
  },
  {
    id: "q9",
    dir: "in",
    at: "10:39",
    text: "Estupendo, con esos datos es suficiente. Se los paso al comercial para que te llame y agendar una visita. ¡Un saludo, Carlos!",
  },
];

function renderMessageText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+|idealista\.com\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, idx) => {
    if (!part) return null;
    const isUrl = /^(https?:\/\/[^\s]+|idealista\.com\/[^\s]+)$/.test(part);
    if (!isUrl) return <span key={`txt-${idx}`}>{part}</span>;

    const href = part.startsWith("http") ? part : `https://${part}`;
    return (
      <a
        key={`url-${idx}`}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[#53bdeb] underline underline-offset-2"
      >
        {part}
      </a>
    );
  });
}

const variants: Variant[] = [
  {
    id: "v1",
    title: "Opcion 1 - Story Clean",
    subtitle: "Flujo equilibrado con entrada suave",
    cycleMs: 15500,
    typingMs: 1900,
    staggerMs: 1700,
    messages: baseMessages,
  },
  {
    id: "v2",
    title: "Opcion 2 - Fast Sales",
    subtitle: "Ritmo comercial, mas dinamico",
    cycleMs: 14500,
    typingMs: 1750,
    staggerMs: 1600,
    messages: baseMessages,
  },
  {
    id: "v3",
    title: "Opcion 3 - Premium Slow",
    subtitle: "Mas lenta + pausa final para lectura",
    cycleMs: 17500,
    typingMs: 2200,
    staggerMs: 2000,
    messages: baseMessages,
  },
  {
    id: "v4",
    title: "Opcion 4 - Showcase Slow",
    subtitle: "Ritmo tranquilo + espera antes de reiniciar",
    cycleMs: 21000,
    typingMs: 2400,
    staggerMs: 2300,
    messages: baseMessages,
  },
  {
    id: "v5",
    title: "Opcion 5 - Call Qualification Success",
    subtitle: "Mismo estilo que opcion 4 con pausas mas largas",
    cycleMs: 30000,
    typingMs: 2850,
    staggerMs: 2625,
    messages: callQualificationMessages,
  },
];

/**
 * progress: 0..1 — controls how many messages are visible.
 * - undefined → all messages shown (static / legacy mode)
 * - 0..1 → messages reveal one by one as progress increases
 * Each message appears when progress >= (index+1) / totalMessages.
 */
function ConversationVariant({
  variant,
  hideMeta = false,
  progress,
  autoScroll = true,
}: {
  variant: Variant;
  hideMeta?: boolean;
  progress?: number;
  autoScroll?: boolean;
}) {
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const total = variant.messages.length;

  const visibleCount =
    progress === undefined
      ? total
      : Math.min(total, Math.max(1, Math.ceil(progress * total)));

  // Auto-scroll to bottom when new messages appear, if enabled
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el || !autoScroll) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visibleCount, autoScroll]);

  const phoneView = (
    <div className="mx-auto w-full aspect-[9/16] overflow-hidden rounded-2xl border border-[#1f2c33] shadow-[0_12px_24px_rgba(2,6,23,0.18)]">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex h-[52px] items-center gap-3 bg-[#202c33] px-3 text-white">
          <img src={marcosAvatar} alt="Marcos" className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">Marcos - Asistente virtual inmobiliario</p>
            <p className="text-[11px] text-[#9eb3bd]">en linea</p>
          </div>
        </div>

        <div
          ref={chatScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#0b141a] p-3 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{
            backgroundImage: `linear-gradient(rgba(11,20,26,0.75), rgba(11,20,26,0.75)), url(${waDarkPattern})`,
            backgroundRepeat: "repeat",
            backgroundSize: "280px auto",
            backgroundPosition: "center",
          }}
        >
          <div className="space-y-2 pb-5">
            {variant.messages.slice(0, visibleCount).map((msg, msgIdx) => {
              const isIn = msg.dir === "in";
              const isQuickReplyTemplate = isIn && Boolean(msg.quickReplies?.length);
              const isNewest = msgIdx === visibleCount - 1 && progress !== undefined && progress < 1;
              return (
                <div
                  key={msg.id}
                  className={[
                    "text-[12.5px] leading-[1.35]",
                    isNewest ? "animate-[msgAppear_0.35s_ease_forwards]" : "",
                    isQuickReplyTemplate
                      ? "mr-auto w-fit min-w-0 max-w-[82%] overflow-hidden rounded-[14px] rounded-tl-[2px] bg-white text-[#111b21]"
                      : isIn
                      ? "mr-auto w-fit max-w-[83%] rounded-[8px] rounded-tl-[2px] bg-[#ffffff] px-[9px] pt-[6px] pb-[4px] text-[#111b21]"
                      : "ml-auto w-fit max-w-[83%] rounded-[8px] rounded-tr-[2px] bg-[#dcf8c6] px-[9px] pt-[6px] pb-[4px] text-[#111b21]",
                  ].join(" ")}
                >
                  {isQuickReplyTemplate ? (
                    <>
                      <div className="px-3 pb-1.5 pt-2.5">
                        <p className="whitespace-pre-line text-[12.5px] leading-[1.35]">{renderMessageText(msg.text)}</p>
                        <p className="mt-1 text-right text-[10px] text-[#667781]">{msg.at}</p>
                      </div>
                      <div className="border-t border-[#e9edef]">
                        {msg.quickReplies?.map((reply, replyIdx) => (
                          <div
                            key={reply}
                            className={[
                              "flex h-10 items-center justify-center gap-2 text-[11px] font-medium",
                              replyIdx === 0 ? "text-[#667781]" : "text-[#1f8f66]",
                              replyIdx > 0 ? "border-t border-[#e9edef]" : "",
                            ].join(" ")}
                          >
                            <span aria-hidden="true" className="text-[13px]">↩</span>
                            <span>{reply}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      <p className="whitespace-pre-line [word-break:break-word]">
                        {renderMessageText(msg.text)}
                        <span className="inline-block w-[46px] h-[1px] align-bottom" aria-hidden="true" />
                      </p>
                      <span className="absolute bottom-[2px] right-0 tabular-nums text-[10px] leading-none text-[#667781]">
                        {msg.at}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (hideMeta) return phoneView;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{variant.title}</h3>
        <p className="text-xs text-slate-500">{variant.subtitle}</p>
      </div>
      {phoneView}
    </div>
  );
}

/** progress 0..1: messages revealed progressively. undefined = all shown. */
export function WhatsAppAnimationShowcaseSlow({ progress, autoScroll }: { progress?: number; autoScroll?: boolean }) {
  return <ConversationVariant variant={variants[3]} hideMeta progress={progress} autoScroll={autoScroll} />;
}

/** progress 0..1: messages revealed progressively. undefined = all shown. */
export function WhatsAppAnimationShowcaseCallQualification({ progress, autoScroll }: { progress?: number; autoScroll?: boolean }) {
  return <ConversationVariant variant={variants[4]} hideMeta progress={progress} autoScroll={autoScroll} />;
}

export function WhatsAppAnimationLab() {
  const [testProgress, setTestProgress] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTestProgress((p) => p >= 1 ? 0 : p + 0.01), 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-[1300px]">
        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Internal test page</p>
          <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Conversation Animation Lab</h1>
          <p className="mt-1 text-sm text-slate-600">5 variantes sin marco de telefono: solo conversacion y avatar.</p>
        </header>
        <section className="grid gap-4 md:grid-cols-2">
          {variants.map((variant) => (
            <ConversationVariant key={variant.id} variant={variant} progress={testProgress} />
          ))}
        </section>
      </div>
    </main>
  );
}
