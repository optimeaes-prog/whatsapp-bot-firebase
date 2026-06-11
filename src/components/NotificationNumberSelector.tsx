import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { getVerifiedNotificationNumbers } from "../services/notificationNumbers";
import { getMaxListingNotificationNumbers } from "../utils/planLimits";
import type { NotificationNumber, SubscriptionPlanId } from "../types";

type Props = {
  planId: SubscriptionPlanId | undefined | null;
  value: string[];
  onChange: (next: string[]) => void;
  /** If true, the selector shows an "invalid" hint when nothing's selected. */
  showRequiredHint?: boolean;
  disabled?: boolean;
};

/**
 * Listings form selector for `notificationNumberIds`. Lists every VERIFIED
 * notification number in the org and lets the user pick one (or more, on
 * Pro+/Enterprise). Pre-backfill orgs may have zero verified numbers — in
 * that case the selector shows a clear CTA to the Team page.
 */
export function NotificationNumberSelector({
  planId,
  value,
  onChange,
  showRequiredHint,
  disabled,
}: Props) {
  const [numbers, setNumbers] = useState<NotificationNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const max = getMaxListingNotificationNumbers(planId);
  const multi = max > 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getVerifiedNotificationNumbers()
      .then((list) => {
        if (cancelled) return;
        setNumbers(list);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudieron cargar los números");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id: string) {
    if (disabled) return;
    if (!multi) {
      onChange([id]);
      return;
    }
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      if (value.length >= max) return;
      onChange([...value, id]);
    }
  }

  const showEmptyState = !loading && numbers.length === 0 && !error;
  const showRequired = showRequiredHint && !loading && numbers.length > 0 && value.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Phone size={14} className="text-gray-400" />
          Números de notificación
          <span className="text-red-500">*</span>
        </label>
        <span className="text-xs text-gray-400">
          {multi ? `Hasta ${max}` : "Solo 1 por anuncio"}
        </span>
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 italic flex items-center gap-2 py-3">
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : showEmptyState ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="mb-2">Aún no tienes ningún número verificado en esta organización.</p>
          <Link
            to="/organizacion#notification-numbers"
            className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-800 font-semibold"
          >
            Añadir y verificar un número
            <ExternalLink size={12} />
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {numbers.map((num) => {
            const checked = value.includes(num.id);
            const reachedCap = !checked && multi && value.length >= max;
            return (
              <li key={num.id}>
                <label
                  className={
                    "flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer " +
                    (checked
                      ? "border-primary-300 bg-primary-50"
                      : "border-gray-200 hover:bg-gray-50") +
                    (disabled || reachedCap ? " opacity-50 cursor-not-allowed" : "")
                  }
                >
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name="notificationNumberId"
                    checked={checked}
                    onChange={() => toggle(num.id)}
                    disabled={disabled || reachedCap}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-gray-900">{num.e164}</div>
                    {num.label ? (
                      <div className="text-xs text-gray-500 truncate">{num.label}</div>
                    ) : null}
                  </div>
                  {num.isOrgDefault ? (
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                      Por defecto
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {showRequired ? (
        <p className="text-xs text-red-600 mt-2">Selecciona al menos un número.</p>
      ) : null}

      {!multi && !loading && numbers.length > 0 ? (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-100 p-2 text-xs text-amber-800 flex items-start gap-2">
          <Sparkles size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <span>
            Tu plan permite enviar resúmenes a un solo número por anuncio.
            <Link to="/suscripcion" className="ml-1 underline font-semibold">
              Mejora a Pro+
            </Link>{" "}
            para notificar a varios números.
          </span>
        </div>
      ) : null}

      <p className="text-xs text-gray-500 mt-2">
        ¿No encuentras el número que buscas? Ve a{" "}
        <Link to="/organizacion#notification-numbers" className="underline">
          Organización → Números de notificación
        </Link>{" "}
        para añadirlo y verificarlo.
      </p>
    </div>
  );
}
