import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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

type OperationFilter = "todos" | "Venta" | "Alquiler";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Falta el enlace de acceso.",
  invalid_code: "Este enlace ya no es válido. Pídenos uno nuevo por WhatsApp.",
  rate_limited: "Demasiadas peticiones. Vuelve a intentarlo en un minuto.",
  query_failed: "No se pudieron cargar los anuncios.",
};

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
 * "3 hab · 115 m²" — solo con lo que el anuncio tenga relleno.
 *
 * Un "0" en habitaciones es un estudio, no un dato que falte; escribir "0 hab"
 * parecería un error de la página, así que en esos anuncios se queda solo con
 * los metros.
 */
function buildFeatureLine(card: CatalogCard): string {
  const parts: string[] = [];
  if (card.rooms && card.rooms !== "0") parts.push(`${card.rooms} hab`);
  if (card.m2) parts.push(`${card.m2} m²`);
  return parts.join(" · ");
}

function CopyReferenceButton({ listingCode }: { listingCode: string }) {
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
        aria-label={`Copiar la referencia ${listingCode}`}
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
            ¡Copiado!
          </>
        ) : (
          <>
            <Copy size={16} className="shrink-0" aria-hidden="true" />
            Copiar referencia
          </>
        )}
      </button>
      {failed && (
        <p className="mt-1.5 text-xs text-slate-500">
          No se ha podido copiar. Selecciona la referencia de arriba y cópiala a mano.
        </p>
      )}
    </div>
  );
}

function ListingCard({ card }: { card: CatalogCard }) {
  const featureLine = buildFeatureLine(card);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {/* El pin en naranja de marca: da color a la lista sin competir con
              el botón, que es lo que el lead tiene que pulsar. */}
          <MapPin size={16} className="mt-0.5 shrink-0 text-primary-500" aria-hidden="true" />
          <p className="min-w-0 text-sm font-semibold text-gray-900 break-words">
            {card.street || "Sin dirección"}
          </p>
        </div>
        {card.operationType && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {card.operationType}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {card.price && <p className="text-base font-semibold text-gray-900">{card.price}</p>}
        {featureLine && <p className="text-sm text-slate-600">{featureLine}</p>}
      </div>

      {/* La referencia, además de en el botón, como texto seleccionable: es el
          plan C si el portapapeles falla dentro del navegador de WhatsApp. */}
      <p className="mt-3 text-sm text-slate-600">
        Referencia: <span className="font-mono font-semibold text-gray-900 select-all">{card.listingCode}</span>
      </p>

      <div className="mt-3">
        <CopyReferenceButton listingCode={card.listingCode} />
      </div>

      {card.link && (
        <a
          href={card.link}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-heading font-semibold text-slate-700 underline"
        >
          <ExternalLink size={15} className="shrink-0" aria-hidden="true" />
          Ver el anuncio en Idealista
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
}: {
  value: OperationFilter;
  counts: Record<OperationFilter, number>;
  onChange: (next: OperationFilter) => void;
}) {
  const tabs: { key: OperationFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "Venta", label: "Venta" },
    { key: "Alquiler", label: "Alquiler" },
  ];

  return (
    <div className="mb-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Tipo de operación">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={
            // text-[13px] y px-2: con "Alquiler (11)" a 14px la pestaña parte la
            // palabra en dos líneas en una pantalla de 375 px.
            value === tab.key
              ? "rounded-btn bg-slate-900 px-2 py-2.5 text-[13px] font-heading font-semibold text-white whitespace-nowrap"
              : "rounded-btn border border-gray-200 bg-white px-2 py-2.5 text-[13px] font-heading font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          }
        >
          {tab.label} ({counts[tab.key]})
        </button>
      ))}
    </div>
  );
}

export function Anuncios() {
  const { code } = useParams<{ code?: string }>();
  const shortCode = code?.trim() ?? "";

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [filter, setFilter] = useState<OperationFilter>("todos");

  const load = useCallback(async () => {
    if (!shortCode) {
      setError(ERROR_MESSAGES.missing_code);
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
        setError(ERROR_MESSAGES[j.error] || "No se pudieron cargar los anuncios.");
        setCards([]);
        return;
      }
      if (!Array.isArray(j.listings)) {
        // 200 pero sin lista: decirlo es mejor que enseñar un "no hay anuncios"
        // que no es verdad.
        setError("No se pudieron cargar los anuncios.");
        setCards([]);
        return;
      }
      setCards(j.listings);
    } catch {
      setError("Error de red al cargar los anuncios.");
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [shortCode]);

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
          Nuestros anuncios
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Busca tu vivienda, copia su número de referencia y pégalo en el chat de WhatsApp para que
          podamos ayudarte.
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : error ? null : cards.length === 0 ? (
          <p className="text-sm text-slate-500">No hay anuncios disponibles ahora mismo.</p>
        ) : (
          <>
            <OperationTabs value={filter} counts={counts} onChange={setFilter} />
            {visible.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay anuncios de {filter === "Venta" ? "venta" : "alquiler"} ahora mismo.
              </p>
            ) : (
              <div className="space-y-3">
                {visible.map((card) => (
                  <ListingCard key={card.id} card={card} />
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
