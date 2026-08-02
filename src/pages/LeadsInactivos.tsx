import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_PATH = "/api/leads-inactivos";

/**
 * Página pública (sin login) con los leads de Venta, no cualificados y sin
 * actividad en más de 48h de una organización. El acceso se valida con un token
 * firmado que llega en la URL (?t=), no con sesión de usuario.
 *
 * Es informativa: no hay botones de envío ni acciones sobre los leads.
 */

type InactiveLeadRow = {
  id: string;
  name: string;
  phone: string;
  /** "Identificador Anuncio" en la tabla de Leads (descripción del anuncio). */
  listingDescription: string;
  lastMessageAtMs: number;
};

/** Mensajes de error legibles para lo que puede devolver el endpoint. */
const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Falta el enlace de acceso (token).",
  invalid_token: "El enlace ha caducado o no es válido. Pide uno nuevo.",
  rate_limited: "Demasiadas peticiones. Vuelve a intentarlo en un minuto.",
  not_configured: "El servicio no está disponible ahora mismo.",
  query_failed: "No se pudo cargar la lista.",
};

/** "2 días 5 h" / "51 h" — tiempo transcurrido desde el último mensaje. */
function formatTimeSince(fromMs: number, nowMs: number): string {
  const totalHours = Math.floor((nowMs - fromMs) / (60 * 60 * 1000));
  if (totalHours < 48) return `${totalHours} h`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0 ? `${days} días` : `${days} días ${hours} h`;
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
    <div className="min-h-screen bg-slate-50 font-body text-slate-800 py-12 px-4">
      <div className="max-w-3xl mx-auto card p-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--TITLE,#402e32)] mb-2">
          Leads sin respuesta
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Leads de venta, no cualificados y sin actividad desde hace más de 48 horas.
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : error ? null : rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay leads sin respuesta ahora mismo.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-3">
              {rows.length} {rows.length === 1 ? "lead" : "leads"}
            </p>
            <div className="overflow-x-auto -mx-2">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap font-heading">
                      Nombre
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap font-heading">
                      Teléfono
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap font-heading">
                      Anuncio
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap font-heading">
                      Sin responder
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {row.name || "—"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {row.phone || "—"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {row.listingDescription || "—"}
                      </td>
                      <td className="px-3 py-3 text-sm text-red-600 text-right whitespace-nowrap">
                        {formatTimeSince(row.lastMessageAtMs, generatedAtMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-xs text-slate-400 mt-6">
          Esta lista se genera en el momento de abrir el enlace. El enlace caduca a los 7 días.
        </p>
      </div>
    </div>
  );
}

export default LeadsInactivos;
