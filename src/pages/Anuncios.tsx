import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Check, Copy, ExternalLink, MapPin } from "lucide-react";

const API_PATH = "/api/anuncios";

/**
 * Página pública (sin login) con los anuncios activos de una agencia.
 *
 * La abre el lead desde WhatsApp cuando el bot no ha conseguido identificar la
 * vivienda por la que llama. Aquí busca la suya, copia el número de referencia
 * de un toque y lo pega en el chat, que es lo que el bot sí sabe reconocer.
 *
 * Se abre casi siempre desde el navegador dentro de WhatsApp y en móvil, así
 * que manda la lectura rápida: tarjetas grandes, un solo botón importante por
 * tarjeta y nada de tablas.
 *
 * Idioma: `?lang=en` la enseña en inglés; sin parámetro va en castellano. Lo
 * pone la plantilla de WhatsApp que manda el enlace, que es quien ya sabe en qué
 * idioma se está hablando con ese lead.
 */

type CatalogCard = {
  id: string;
  listingCode: string;
  operationType: string;
  street: string;
  price: string;
  rooms: string;
  m2: string;
  link: string;
};

/**
 * Las claves del filtro son los valores que guarda Firestore ("Venta",
 * "Alquiler"), no lo que se enseña. Así el filtrado no depende del idioma y
 * traducir es solo cambiar la etiqueta.
 */
type OperationFilter = "todos" | "Venta" | "Alquiler";

type Lang = "es" | "en";

type Strings = {
  title: string;
  intro: string;
  tabs: Record<OperationFilter, string>;
  tabsLabel: string;
  noAddress: string;
  reference: string;
  copy: string;
  copied: string;
  copyAria: (listingCode: string) => string;
  copyFailed: string;
  viewOnIdealista: string;
  loading: string;
  empty: string;
  emptyFiltered: (operation: string) => string;
  /** Cómo se nombra la operación dentro de la frase de "no hay anuncios de …". */
  operationInSentence: Record<"Venta" | "Alquiler", string>;
  rooms: (rooms: string) => string;
  errors: Record<string, string>;
};

const STRINGS: Record<Lang, Strings> = {
  es: {
    title: "Nuestros anuncios",
    intro:
      "Busca tu vivienda, copia su número de referencia y pégalo en el chat de WhatsApp para que podamos ayudarte.",
    tabs: { todos: "Todos", Venta: "Venta", Alquiler: "Alquiler" },
    tabsLabel: "Tipo de operación",
    noAddress: "Sin dirección",
    reference: "Referencia:",
    copy: "Copiar referencia",
    copied: "¡Copiado!",
    copyAria: (listingCode) => `Copiar la referencia ${listingCode}`,
    copyFailed: "No se ha podido copiar. Selecciona la referencia de arriba y cópiala a mano.",
    viewOnIdealista: "Ver el anuncio en Idealista",
    loading: "Cargando…",
    empty: "No hay anuncios disponibles ahora mismo.",
    emptyFiltered: (operation) => `No hay anuncios de ${operation} ahora mismo.`,
    operationInSentence: { Venta: "venta", Alquiler: "alquiler" },
    rooms: (rooms) => `${rooms} hab`,
    errors: {
      missing_code: "Falta el enlace de acceso.",
      invalid_code: "Este enlace ya no es válido. Pídenos uno nuevo por WhatsApp.",
      rate_limited: "Demasiadas peticiones. Vuelve a intentarlo en un minuto.",
      query_failed: "No se pudieron cargar los anuncios.",
      network: "Error de red al cargar los anuncios.",
      generic: "No se pudieron cargar los anuncios.",
    },
  },
  en: {
    title: "Our properties",
    intro:
      "Find your property, copy its reference number and paste it into the WhatsApp chat so we can help you.",
    tabs: { todos: "All", Venta: "For sale", Alquiler: "To rent" },
    tabsLabel: "Operation type",
    noAddress: "No address",
    reference: "Reference:",
    copy: "Copy reference",
    copied: "Copied!",
    copyAria: (listingCode) => `Copy reference ${listingCode}`,
    copyFailed: "Couldn't copy it. Select the reference above and copy it by hand.",
    viewOnIdealista: "View the listing on Idealista",
    loading: "Loading…",
    empty: "No properties available right now.",
    emptyFiltered: (operation) => `No properties ${operation} right now.`,
    operationInSentence: { Venta: "for sale", Alquiler: "to rent" },
    // "bed." es como lo abrevia Idealista, y el lead viene de ahí.
    rooms: (rooms) => `${rooms} bed.`,
    errors: {
      missing_code: "This link is incomplete.",
      invalid_code: "This link is no longer valid. Ask us for a new one on WhatsApp.",
      rate_limited: "Too many requests. Please try again in a minute.",
      query_failed: "The properties couldn't be loaded.",
      network: "Network error while loading the properties.",
      generic: "The properties couldn't be loaded.",
    },
  },
};

/** Sin parámetro, o con cualquier otra cosa, se queda en castellano. */
function resolveLang(raw: string | null): Lang {
  return (raw || "").trim().toLowerCase().startsWith("en") ? "en" : "es";
}

/** Cuánto se queda el botón en "¡Copiado!" antes de volver a su estado normal. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * Copia al portapapeles.
 *
 * El navegador de dentro de WhatsApp no siempre deja usar la API moderna, y ahí
 * el botón fallaría en silencio justo en el sitio donde más se usa. Por eso el
 * apaño del textarea + execCommand como plan B, y por eso la referencia también
 * se enseña como texto: si las dos fallan, el lead siempre puede seleccionarla a
 * mano.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cae al plan B.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // Fuera de la vista, pero enfocable: si no, iOS no copia.
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * "3 hab · 115 m²" / "3 bed. · 115 m²" — solo con lo que el anuncio tenga
 * relleno.
 *
 * Un "0" en habitaciones es un estudio, no un dato que falte; escribir "0 hab"
 * parecería un error de la página, así que en esos anuncios se queda solo con
 * los metros.
 */
function buildFeatureLine(card: CatalogCard, t: Strings): string {
  const parts: string[] = [];
  if (card.rooms && card.rooms !== "0") parts.push(t.rooms(card.rooms));
  if (card.m2) parts.push(`${card.m2} m²`);
  return parts.join(" · ");
}

/**
 * El precio llega tal cual lo escribió el agente ("2500 €/mes"), así que el
 * "/mes" viene dentro del dato. En la página en inglés se cambia solo al
 * enseñarlo; en Firestore se queda como está.
 */
function formatPrice(price: string, lang: Lang): string {
  if (lang !== "en") return price;
  return price.replace(/\s*\/\s*mes\b/i, "/month");
}

function CopyReferenceButton({ listingCode, t }: { listingCode: string; t: Strings }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const onCopy = useCallback(async () => {
    const ok = await copyToClipboard(listingCode);
    setCopied(ok);
    setFailed(!ok);
  }, [listingCode]);

  return (
    <div>
      <button
        type="button"
        onClick={() => void onCopy()}
        aria-label={t.copyAria(listingCode)}
        className={
          // Naranja de marca en la acción principal, con texto oscuro: sobre
          // #FFB03F el blanco se lee mal, y esta página se abre en la calle y a
          // pleno sol. El verde de "¡Copiado!" se queda: ahí el color está
          // diciendo "ha funcionado", no de qué marca es la página.
          copied
            ? "inline-flex w-full items-center justify-center gap-2 rounded-btn bg-emerald-600 px-4 py-3 text-sm font-heading font-semibold text-white"
            : "inline-flex w-full items-center justify-center gap-2 rounded-btn bg-primary-500 px-4 py-3 text-sm font-heading font-semibold text-slate-900 hover:bg-primary-400"
        }
      >
        {copied ? (
          <>
            <Check size={16} className="shrink-0" aria-hidden="true" />
            {t.copied}
          </>
        ) : (
          <>
            <Copy size={16} className="shrink-0" aria-hidden="true" />
            {t.copy}
          </>
        )}
      </button>
      {failed && <p className="mt-1.5 text-xs text-slate-500">{t.copyFailed}</p>}
    </div>
  );
}

function ListingCard({ card, t, lang }: { card: CatalogCard; t: Strings; lang: Lang }) {
  const featureLine = buildFeatureLine(card, t);
  // La etiqueta traducida solo si la operación es una de las conocidas; si
  // llegara cualquier otra cosa se enseña tal cual antes que dejar el hueco.
  const operationLabel =
    card.operationType === "Venta" || card.operationType === "Alquiler"
      ? t.tabs[card.operationType]
      : card.operationType;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {/* El pin en naranja de marca: da color a la lista sin competir con
              el botón, que es lo que el lead tiene que pulsar. */}
          <MapPin size={16} className="mt-0.5 shrink-0 text-primary-500" aria-hidden="true" />
          <p className="min-w-0 text-sm font-semibold text-gray-900 break-words">
            {card.street || t.noAddress}
          </p>
        </div>
        {card.operationType && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {operationLabel}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {card.price && (
          <p className="text-base font-semibold text-gray-900">{formatPrice(card.price, lang)}</p>
        )}
        {featureLine && <p className="text-sm text-slate-600">{featureLine}</p>}
      </div>

      {/* La referencia, además de en el botón, como texto seleccionable: es el
          plan C si el portapapeles falla dentro del navegador de WhatsApp. */}
      <p className="mt-3 text-sm text-slate-600">
        {t.reference}{" "}
        <span className="font-mono font-semibold text-gray-900 select-all">{card.listingCode}</span>
      </p>

      <div className="mt-3">
        <CopyReferenceButton listingCode={card.listingCode} t={t} />
      </div>

      {card.link && (
        <a
          href={card.link}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-heading font-semibold text-slate-700 underline"
        >
          <ExternalLink size={15} className="shrink-0" aria-hidden="true" />
          {t.viewOnIdealista}
        </a>
      )}
    </div>
  );
}

/** Venta / Alquiler / todos. Los contadores evitan pulsar en una pestaña vacía. */
function OperationTabs({
  value,
  counts,
  onChange,
  t,
}: {
  value: OperationFilter;
  counts: Record<OperationFilter, number>;
  onChange: (next: OperationFilter) => void;
  t: Strings;
}) {
  const tabs: OperationFilter[] = ["todos", "Venta", "Alquiler"];

  return (
    <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label={t.tabsLabel}>
      {tabs.map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={
            // Mismo naranja de marca y mismo texto oscuro que el botón de
            // copiar, para que la página tenga un solo color de acento.
            // text-[13px] y px-2: con "Alquiler (11)" a 14px la pestaña parte la
            // palabra en dos líneas en una pantalla de 375 px.
            value === key
              ? "rounded-btn bg-primary-500 px-2 py-2.5 text-[13px] font-heading font-semibold text-slate-900 whitespace-nowrap"
              : "rounded-btn border border-gray-200 bg-white px-2 py-2.5 text-[13px] font-heading font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          }
        >
          {t.tabs[key]} ({counts[key]})
        </button>
      ))}
    </div>
  );
}

export function Anuncios() {
  const { code } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const shortCode = code?.trim() ?? "";
  const lang = resolveLang(searchParams.get("lang"));
  const t = STRINGS[lang];

  // Es la cartera de una agencia concreta, no un portal: que no la indexe nadie.
  // La cabecera X-Robots-Tag del hosting es la defensa real; esto cubre al
  // crawler que ejecute JS.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // El idioma del documento, para lectores de pantalla y para que el navegador
  // no ofrezca traducir una página que ya está en su idioma. Se restaura al
  // salir porque el resto de la aplicación está en castellano.
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [filter, setFilter] = useState<OperationFilter>("todos");

  const load = useCallback(async () => {
    if (!shortCode) {
      setError(t.errors.missing_code);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_PATH}?code=${encodeURIComponent(shortCode)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(t.errors[j.error] || t.errors.generic);
        setCards([]);
        return;
      }
      if (!Array.isArray(j.listings)) {
        // 200 pero sin lista: decirlo es mejor que enseñar un "no hay anuncios"
        // que no es verdad.
        setError(t.errors.generic);
        setCards([]);
        return;
      }
      setCards(j.listings);
    } catch {
      setError(t.errors.network);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [shortCode, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo<Record<OperationFilter, number>>(
    () => ({
      todos: cards.length,
      Venta: cards.filter((c) => c.operationType === "Venta").length,
      Alquiler: cards.filter((c) => c.operationType === "Alquiler").length,
    }),
    [cards]
  );

  const visible = useMemo(
    () => (filter === "todos" ? cards : cards.filter((c) => c.operationType === filter)),
    [cards, filter]
  );

  return (
    <div className="min-h-screen bg-slate-50 font-body text-slate-800 py-8 px-4 sm:py-12">
      <div className="max-w-2xl mx-auto card p-5 sm:p-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--TITLE,#402e32)] mb-2">
          {t.title}
        </h1>
        <p className="text-sm text-slate-600 mb-6">{t.intro}</p>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">{t.loading}</p>
        ) : error ? null : cards.length === 0 ? (
          <p className="text-sm text-slate-500">{t.empty}</p>
        ) : (
          <>
            <OperationTabs value={filter} counts={counts} onChange={setFilter} t={t} />
            {visible.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t.emptyFiltered(
                  t.operationInSentence[filter === "Venta" ? "Venta" : "Alquiler"]
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {visible.map((card) => (
                  <ListingCard key={card.id} card={card} t={t} lang={lang} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Anuncios;
