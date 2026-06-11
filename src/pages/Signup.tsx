import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui";
import { auth, db } from "../lib/firebase";
import { mapAuthError } from "../utils/authErrors";

const LEGAL_VERSIONS = {
  terms: "1.0",
  privacy: "1.0",
  dpa: "1.0",
} as const;

interface ConsentState {
  legal: boolean;
  marketing: boolean;
}

async function recordConsent(
  uid: string,
  email: string,
  consents: ConsentState,
  method: "email" | "google",
) {
  await addDoc(collection(db, "userConsents"), {
    uid,
    email,
    acceptedAt: serverTimestamp(),
    termsVersion: LEGAL_VERSIONS.terms,
    privacyVersion: LEGAL_VERSIONS.privacy,
    dpaVersion: LEGAL_VERSIONS.dpa,
    termsAndPrivacyConsent: consents.legal,
    gdprConsent: consents.legal,
    dpaConsent: consents.legal,
    marketingOptIn: consents.marketing,
    source: "signup_page",
    method,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
  });
}

export function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consents, setConsents] = useState<ConsentState>({
    legal: false,
    marketing: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const missingRequiredConsent = !consents.legal;

  const toggleConsent = (key: keyof ConsentState) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (missingRequiredConsent) {
      setError("Debes aceptar los términos legales para continuar.");
      return;
    }
    if (!name.trim()) {
      setError("Por favor, introduce tu nombre.");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name);
      const currentUser = auth.currentUser;
      if (currentUser) {
        await recordConsent(currentUser.uid, currentUser.email ?? email, consents, "email");
      }
      navigate("/onboarding");
    } catch (err: unknown) {
      setError(mapAuthError(err, true));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    if (missingRequiredConsent) {
      setError("Acepta los términos legales antes de continuar con Google.");
      return;
    }
    setLoading(true);
    try {
      await signInWithGoogle();
      const currentUser = auth.currentUser;
      if (currentUser) {
        await recordConsent(currentUser.uid, currentUser.email ?? "", consents, "google");
      }
      navigate("/onboarding");
    } catch (err: unknown) {
      setError(mapAuthError(err, true));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <Link to="/">
            <img src="/logo.png" alt="Proplead" className="h-12 mx-auto my-6" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Crea tu cuenta</h1>
          <p className="mt-2 text-sm text-gray-600">40 conversaciones gratis. Cancela cuando quieras.</p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nombre y Apellidos
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input mt-1"
                placeholder="Tu nombre completo"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input mt-1"
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input mt-1"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <fieldset className="space-y-3 pt-2">
              <legend className="sr-only">Consentimientos</legend>

              <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.legal}
                  onChange={() => toggleConsent("legal")}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  required
                />
                <span>
                  He leído y acepto los{" "}
                  <Link to="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">
                    Términos y Condiciones
                  </Link>
                  , la{" "}
                  <Link to="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">
                    Política de Privacidad
                  </Link>
                  {" "}y el{" "}
                  <Link to="/legal/dpa" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">
                    DPA
                  </Link>
                  , y doy mi consentimiento al tratamiento de mis datos conforme al RGPD. <span className="text-red-500" aria-hidden="true">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consents.marketing}
                  onChange={() => toggleConsent("marketing")}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-gray-600">
                  Quiero recibir novedades y comunicaciones comerciales por email (opcional, revocable en cualquier momento).
                </span>
              </label>
            </fieldset>

            <Button type="submit" loading={loading} className="w-full">
              Crear cuenta
            </Button>
          </form>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500 font-heading font-medium uppercase tracking-widest text-[10px]">O regístrate con</span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleGoogleSignUp}
              loading={loading}
              variant="outline"
              className="mt-4 w-full flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-gray-700 font-medium">Google</span>
            </Button>
          </div>

          <p className="mt-4 text-center text-sm text-gray-600">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Inicia sesión
            </Link>
          </p>

          <div className="mt-6 text-center text-xs text-gray-400 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-heading font-bold uppercase tracking-widest">
            <Link to="/legal/terms" className="hover:text-gray-900 transition-colors inline-flex items-center min-h-[44px] px-1">
              Términos
            </Link>
            <Link to="/legal/privacy-policy" className="hover:text-gray-900 transition-colors inline-flex items-center min-h-[44px] px-1">
              Privacidad
            </Link>
            <Link to="/cookies" className="hover:text-gray-900 transition-colors inline-flex items-center min-h-[44px] px-1">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
