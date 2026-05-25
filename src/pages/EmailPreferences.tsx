import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_PATH = "/api/email-preferences";

type StatusResponse = { optedOut: boolean; emailMasked?: string };

export function EmailPreferences() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t")?.trim() ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("Falta el enlace de preferencias (token).");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `${API_PATH}?action=status&token=${encodeURIComponent(token)}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : "No se pudo cargar el estado.");
        setStatus(null);
        return;
      }
      setStatus({ optedOut: Boolean(j.optedOut), emailMasked: typeof j.emailMasked === "string" ? j.emailMasked : undefined });
    } catch {
      setError("Error de red al cargar preferencias.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function doUnsubscribe() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `${API_PATH}?action=unsubscribe&token=${encodeURIComponent(token)}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : "No se pudo completar la baja.");
        return;
      }
      setStatus({ optedOut: true, emailMasked: status?.emailMasked });
    } catch {
      setError("Error de red al darte de baja.");
    } finally {
      setBusy(false);
    }
  }

  async function doResubscribe() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(
        `${API_PATH}?action=resubscribe&token=${encodeURIComponent(token)}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === "string" ? j.error : "No se pudo reactivar.");
        return;
      }
      setStatus({ optedOut: false, emailMasked: status?.emailMasked });
    } catch {
      setError("Error de red al reactivar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-body text-slate-800 py-12 px-4">
      <div className="max-w-lg mx-auto card p-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--TITLE,#402e32)] mb-2">
          Preferencias de correo
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Gestiona si quieres recibir correos opcionales de Proplead (novedades, consejos). Los correos necesarios para el servicio pueden seguir enviándose.
        </p>

        {loading && <p className="text-sm text-slate-500">Cargando…</p>}
        {error && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {error}
          </p>
        )}

        {!loading && status && (
          <>
            {status.emailMasked && (
              <p className="text-sm text-slate-600 mb-4">
                Cuenta: <span className="text-slate-900">{status.emailMasked}</span>
              </p>
            )}
            <p className="text-sm text-slate-700 mb-6">
              Estado actual:{" "}
              {status.optedOut
                ? "No recibes correos opcionales."
                : "Recibes correos opcionales."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {!status.optedOut ? (
                <button
                  type="button"
                  disabled={busy || !token}
                  onClick={() => void doUnsubscribe()}
                  className="rounded-btn bg-slate-900 text-white font-heading font-semibold px-5 py-3 text-sm disabled:opacity-50"
                >
                  Darme de baja
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || !token}
                  onClick={() => void doResubscribe()}
                  className="rounded-btn bg-primary-500 text-[var(--TITLE,#402e32)] font-heading font-semibold px-5 py-3 text-sm disabled:opacity-50"
                >
                  Volver a recibir correos opcionales
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default EmailPreferences;
