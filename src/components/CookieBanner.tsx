import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCookieConsent } from "../contexts/CookieConsentContext";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

/**
 * Páginas a las que se llega por un enlace, sin sesión: se abren para mirar una
 * cosa concreta y ya. No cargan analítica (el consentimiento arranca denegado en
 * index.html y aquí nunca se concede), así que el banner solo estorbaría. En el
 * móvil, además, tapa media pantalla.
 */
const PATHS_WITHOUT_COOKIE_BANNER = ["/leads-inactivos", "/anuncios"];

/**
 * Si la ruta es una de esas páginas, contando las que llevan el código del
 * enlace corto detrás (`/anuncios/Xk7mQ2pRt9`).
 *
 * Antes se comparaba la ruta entera, así que el banner no salía en
 * `/leads-inactivos` pero sí en `/leads-inactivos/<código>`, que es justo la
 * versión que se manda por WhatsApp. Se compara con la barra incluida para que
 * `/anuncios-de-algo` no se cuele.
 */
function isPathWithoutCookieBanner(pathname: string): boolean {
  return PATHS_WITHOUT_COOKIE_BANNER.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function CookieBanner() {
  const { pathname } = useLocation();
  const {
    hasDecided,
    isPreferencesOpen,
    acceptAll,
    rejectAll,
    savePreferences,
    openPreferences,
    closePreferences,
    prefs,
  } = useCookieConsent();

  // Capa 1 visible when the user hasn't decided yet AND preferences modal is closed.
  const showLayer1 = !hasDecided && !isPreferencesOpen;
  // Capa 2 visible whenever user explicitly opens it (banner or footer link).
  const showLayer2 = isPreferencesOpen;

  if (isPathWithoutCookieBanner(pathname)) return null;
  if (!showLayer1 && !showLayer2) return null;

  return (
    <>
      {showLayer1 && <CookieBannerLayer1
        onAcceptAll={acceptAll}
        onRejectAll={rejectAll}
        onCustomize={openPreferences}
      />}
      {showLayer2 && <CookieBannerLayer2
        key={`${prefs.analytics}-${prefs.marketing}`}
        initial={{ analytics: prefs.analytics, marketing: prefs.marketing }}
        onAcceptAll={acceptAll}
        onSave={savePreferences}
        onClose={closePreferences}
      />}
    </>
  );
}

function CookieBannerLayer1({
  onAcceptAll,
  onRejectAll,
  onCustomize,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onCustomize: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-4 left-4 right-4 z-[100] max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)] sm:right-auto"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M21.598 11.063a1 1 0 0 0-.768-.25 4 4 0 0 1-4.45-4.45 1 1 0 0 0-1.018-1.018 4 4 0 0 1-4.45-4.45 1 1 0 0 0-1.25-.768A10 10 0 1 0 22 13a1 1 0 0 0-.402-1.937zM8 16a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm.5-5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM13 18a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5-2a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
          </svg>
        </span>
        <h2
          id="cookie-banner-title"
          className="font-heading text-base font-bold text-gray-900"
        >
          Usamos cookies
        </h2>
      </div>

      <p
        id="cookie-banner-desc"
        className="mt-3 text-sm leading-relaxed text-gray-600"
      >
        Usamos cookies para entender cómo se usa Proplead y mejorar la
        experiencia. Puedes aceptar todas, rechazar las no esenciales o
        gestionar tus preferencias.
      </p>

      <div className="mt-3 flex items-center gap-3 text-xs">
        <Link
          to="/legal/privacy-policy"
          className="text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
        >
          Política de privacidad
        </Link>
        <span aria-hidden className="text-gray-300">
          ·
        </span>
        <Link
          to="/legal/cookies"
          className="text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
        >
          Política de cookies
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="md" onClick={onRejectAll}>
          Rechazar
        </Button>
        <Button variant="primary" size="md" onClick={onAcceptAll}>
          Aceptar todas
        </Button>
      </div>

      <button
        type="button"
        onClick={onCustomize}
        className="mt-3 w-full text-center text-sm font-semibold text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline"
      >
        Gestionar preferencias
      </button>
    </div>
  );
}

function CookieBannerLayer2({
  initial,
  onAcceptAll,
  onSave,
  onClose,
}: {
  initial: { analytics: boolean; marketing: boolean };
  onAcceptAll: () => void;
  onSave: (next: { analytics: boolean; marketing: boolean }) => void;
  onClose: () => void;
}) {
  // We rely on the parent passing a fresh `key` each time the modal opens, so
  // the initial state below is always read from the latest `initial` prop.
  const [analyticsOn, setAnalyticsOn] = useState(initial.analytics);
  const [marketingOn, setMarketingOn] = useState(initial.marketing);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-prefs-title"
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2
              id="cookie-prefs-title"
              className="font-heading text-lg font-bold text-gray-900"
            >
              Preferencias de cookies
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Elige qué categorías quieres permitir. Puedes cambiarlo en
              cualquier momento desde el enlace «Gestionar cookies» del pie de
              página.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-2 rounded-btn p-2 text-gray-500 hover:bg-gray-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <CategoryRow
            title="Estrictamente necesarias"
            description="Imprescindibles para el inicio de sesión, la seguridad y el funcionamiento básico de la plataforma. No se pueden desactivar."
            checked={true}
            onChange={() => {}}
            disabled
          />
          <CategoryRow
            title="Analítica"
            description="Nos ayudan a entender cómo se usa Proplead para mejorar la experiencia. Proveedor: Google Analytics 4."
            checked={analyticsOn}
            onChange={setAnalyticsOn}
          />
          <CategoryRow
            title="Marketing"
            description="Medir la efectividad de nuestras campañas y mostrarte anuncios relevantes. Proveedores previstos: Google Ads y Meta Pixel."
            checked={marketingOn}
            onChange={setMarketingOn}
          />

          <p className="mt-4 text-xs text-gray-500">
            Consulta detalles en nuestra{" "}
            <Link
              to="/legal/cookies"
              className="text-primary-700 underline hover:text-primary-800"
              onClick={onClose}
            >
              Política de cookies
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            size="md"
            onClick={() => onSave({ analytics: analyticsOn, marketing: marketingOn })}
          >
            Guardar preferencias
          </Button>
          <Button variant="primary" size="md" onClick={onAcceptAll}>
            Aceptar todas
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-4 last:border-b-0">
      <div className="flex-1">
        <p className="font-heading text-sm font-bold text-gray-900">{title}</p>
        <p className="mt-1 text-xs text-gray-600">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-primary-500" : "bg-gray-300",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
