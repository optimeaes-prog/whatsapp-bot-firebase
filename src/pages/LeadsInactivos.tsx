import { Fragment, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Phone, User } from "lucide-react";
import { WhatsAppIconLink } from "../components/WhatsAppIconLink";

const API_PATH = "/api/leads-inactivos";

/**
 * Página pública (sin login) con los leads de Venta y no cualificados de una
 * organización que llevan entre 2 y 14 días sin responder. El acceso se valida
 * con un token firmado que llega en la URL (?t=), no con sesión de usuario.
 *
 * Es informativa: no se envía nada desde aquí. Lo único que puede hacer el
 * agente es llamar o abrir el chat de WhatsApp del lead, porque casi siempre la
 * abrirá desde el móvil.
 */

type RecentMessage = {
  /** "user" es el lead; "assistant" somos nosotros. */
  role: "user" | "assistant";
  text: string;
  atMs: number;
};

type InactiveLeadRow = {
  id: string;
  name: string;
  phone: string;
  /** "Identificador Anuncio" en la tabla de Leads (descripción del anuncio). */
  listingDescription: string;
  listingCode: string;
  lastMessageAtMs: number;
  /** Mensajes totales, como la columna "Mensajes" de la tabla de Leads. */
  messageCount: number;
  recentMessages: RecentMessage[];
};

/** Código que lleva un lead que aún no tiene inmueble asignado. */
const PENDING_LISTING_CODE = "__pending__";

/**
 * Qué enseñar en la columna "Anuncio": la descripción del anuncio, igual que
 * "Identificador Anuncio" en la tabla de Leads. Nunca el código interno, que al
 * agente no le dice nada. Si el lead entró por llamada y todavía no tiene
 * inmueble asignado, lo decimos con palabras.
 */
function formatListing(row: InactiveLeadRow): string {
  if (row.listingDescription) return row.listingDescription;
  if (row.listingCode === PENDING_LISTING_CODE) return "Pendiente";
  return "—";
}

/** Mensajes de error legibles para lo que puede devolver el endpoint. */
const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Falta el enlace de acceso (token).",
  invalid_token: "El enlace ha caducado o no es válido. Pide uno nuevo.",
  rate_limited: "Demasiadas peticiones. Vuelve a intentarlo en un minuto.",
  not_configured: "El servicio no está disponible ahora mismo.",
  query_failed: "No se pudo cargar la lista.",
};

/**
 * Cuántos leads se ven de golpe. La lista se abre casi siempre desde el móvil,
 * así que preferimos una pantalla corta y un botón a un scroll interminable.
 */
const PAGE_SIZE = 10;

/** "2 días 5 h" / "51 h" — tiempo transcurrido desde el último mensaje. */
function formatTimeSince(fromMs: number, nowMs: number): string {
  const totalHours = Math.floor((nowMs - fromMs) / (60 * 60 * 1000));
  if (totalHours < 48) return `${totalHours} h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days} días` : `${days} días ${hours} h`;
}

/**
 * Teléfono del lead: se ve igual sea del país que sea ("+" y dígitos, sin
 * espacios). Agrupar en bloques obligaría a mantener una tabla de prefijos y a
 * que un número extranjero se viese distinto a uno español.
 *
 * Al tocarlo se llama; el icono de al lado abre el chat de WhatsApp.
 */
function PhoneActions({ phone }: { phone: string }) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <a
        href={`tel:+${digits}`}
        className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900"
      >
        <Phone size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
        <span>+{digits}</span>
      </a>
      <WhatsAppIconLink phone={digits} size={16} />
    </span>
  );
}

/**
 * Botón para ver el final de la conversación, con el total de mensajes al lado.
 * La idea es que el agente sepa por dónde se quedó la cosa antes de llamar.
 */
function ConversationToggle({
  messageCount,
  open,
  onToggle,
  disabled,
}: {
  messageCount: number;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={disabled ? "Sin mensajes guardados" : open ? "Ocultar conversación" : "Ver conversación"}
      className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:hover:text-slate-600"
    >
      <MessageSquare size={15} className="shrink-0" aria-hidden="true" />
      <span>{messageCount}</span>
    </button>
  );
}

/** Los últimos mensajes, en burbujas: el lead a la izquierda, nosotros a la derecha. */
function ConversationPreview({ messages }: { messages: RecentMessage[] }) {
  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      {messages.map((message, i) => (
        <div
          key={`${message.atMs}-${i}`}
          className={
            message.role === "user"
              ? "max-w-[85%] rounded-lg bg-slate-100 px-3 py-2"
              : "ml-auto max-w-[85%] rounded-lg bg-emerald-50 px-3 py-2"
          }
        >
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            {message.role === "user" ? "Lead" : "Proplead"}
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{message.text}</p>
        </div>
      ))}
    </div>
  );
}

/** Una tarjeta por lead. Es la vista de móvil, donde una tabla no cabe. */
function LeadCard({
  row,
  generatedAtMs,
  open,
  onToggle,
}: {
  row: InactiveLeadRow;
  generatedAtMs: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <User size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-900 break-words">
          {row.name || "Sin nombre"}
        </p>
      </div>

      <div className="mt-2 text-sm">
        <PhoneActions phone={row.phone} />
      </div>

      <p className="mt-2 text-sm text-slate-600 break-words">{formatListing(row)}</p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-2">
        <ConversationToggle
          messageCount={row.messageCount}
          open={open}
          onToggle={onToggle}
          disabled={row.recentMessages.length === 0}
        />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs uppercase tracking-wide text-slate-400 whitespace-nowrap">
            Sin responder
          </span>
          <span className="text-sm font-semibold text-red-600 whitespace-nowrap">
            {formatTimeSince(row.lastMessageAtMs, generatedAtMs)}
          </span>
        </div>
      </div>

      {open && row.recentMessages.length > 0 && <ConversationPreview messages={row.recentMessages} />}
    </div>
  );
}

const TH_CLASS =
  "px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap font-heading";

/** La misma lista en tabla, para pantallas anchas. */
function LeadsTable({
  rows,
  generatedAtMs,
  openIds,
  onToggle,
}: {
  rows: InactiveLeadRow[];
  generatedAtMs: number;
  openIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className={TH_CLASS}>Nombre</th>
            <th className={TH_CLASS}>Teléfono</th>
            <th className={TH_CLASS}>Anuncio</th>
            <th className={TH_CLASS}>Mensajes</th>
            <th className={`${TH_CLASS} text-right`}>Sin responder</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = openIds.has(row.id);
            return (
              <Fragment key={row.id}>
                <tr className={open ? "border-b border-gray-100" : "border-b border-gray-100 last:border-0"}>
                  <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                    {row.name || "Sin nombre"}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                    <PhoneActions phone={row.phone} />
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">{formatListing(row)}</td>
                  <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                    <ConversationToggle
                      messageCount={row.messageCount}
                      open={open}
                      onToggle={() => onToggle(row.id)}
                      disabled={row.recentMessages.length === 0}
                    />
                  </td>
                  <td className="px-3 py-3 text-sm text-red-600 text-right whitespace-nowrap">
                    {formatTimeSince(row.lastMessageAtMs, generatedAtMs)}
                  </td>
                </tr>
                {open && row.recentMessages.length > 0 && (
                  <tr className="border-b border-gray-100 last:border-0">
                    <td colSpan={5} className="px-3 pb-4">
                      <ConversationPreview messages={row.recentMessages} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LeadsInactivos() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t")?.trim() ?? "";

  // Página privada por enlace: pedimos a los buscadores que no la indexen.
  // La cabecera X-Robots-Tag del hosting es la defensa real; esta etiqueta
  // cubre el caso de un crawler que ejecute JS sobre el HTML servido.
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
  const [rows, setRows] = useState<InactiveLeadRow[]>([]);
  // Hora en la que el servidor generó la lista: los tiempos "sin responder" se
  // calculan contra ella, no contra el reloj del navegador.
  const [generatedAtMs, setGeneratedAtMs] = useState(() => Date.now());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Conversaciones desplegadas. Cerradas por defecto: la lista se lee de un
  // vistazo y el hilo solo interesa justo antes de llamar a ese lead.
  const [openConversations, setOpenConversations] = useState<Set<string>>(new Set());

  const toggleConversation = useCallback((id: string) => {
    setOpenConversations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    if (!token) {
      setError(ERROR_MESSAGES.missing_token);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_PATH}?token=${encodeURIComponent(token)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(ERROR_MESSAGES[j.error] || "No se pudo cargar la lista.");
        setRows([]);
        return;
      }
      if (!Array.isArray(j.leads)) {
        // Respuesta 200 pero sin la lista: mejor avisar que enseñar un "no hay
        // leads" que no es verdad.
        setError("No se pudo cargar la lista.");
        setRows([]);
        return;
      }
      setRows(j.leads);
      setVisibleCount(PAGE_SIZE);
      setOpenConversations(new Set());
      setGeneratedAtMs(typeof j.generatedAtMs === "number" ? j.generatedAtMs : Date.now());
    } catch {
      setError("Error de red al cargar la lista.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 font-body text-slate-800 py-8 px-4 sm:py-12">
      <div className="max-w-3xl mx-auto card p-5 sm:p-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--TITLE,#402e32)] mb-2">
          Leads sin respuesta
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Leads de venta no cualificados que llevan entre 2 y 14 días sin responder.
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : error ? null : rows.length === 0 ? (
          <p className="text-sm text-slate-500">No hay leads sin respuesta ahora mismo.</p>
        ) : (
          (() => {
            const visible = rows.slice(0, visibleCount);
            const remaining = rows.length - visible.length;
            return (
              <>
                <p className="text-sm text-slate-500 mb-3">
                  {remaining > 0
                    ? `Mostrando ${visible.length} de ${rows.length} leads`
                    : `${rows.length} ${rows.length === 1 ? "lead" : "leads"}`}
                </p>

                {/* Móvil: tarjetas. Escritorio: tabla. */}
                <div className="space-y-3 md:hidden">
                  {visible.map((row) => (
                    <LeadCard
                      key={row.id}
                      row={row}
                      generatedAtMs={generatedAtMs}
                      open={openConversations.has(row.id)}
                      onToggle={() => toggleConversation(row.id)}
                    />
                  ))}
                </div>
                <div className="hidden md:block">
                  <LeadsTable
                    rows={visible}
                    generatedAtMs={generatedAtMs}
                    openIds={openConversations}
                    onToggle={toggleConversation}
                  />
                </div>

                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="mt-4 w-full rounded-btn border border-gray-200 bg-white px-5 py-3 text-sm font-heading font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Ver más leads ({remaining} {remaining === 1 ? "restante" : "restantes"})
                  </button>
                )}
              </>
            );
          })()
        )}

        <p className="text-xs text-slate-400 mt-6">
          Esta lista se genera en el momento de abrir el enlace. El enlace caduca a las 48 horas.
        </p>
      </div>
    </div>
  );
}

export default LeadsInactivos;
