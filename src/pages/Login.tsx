import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui";
import { Link } from "react-router-dom";

function mapAuthError(error: unknown, isSignUp: boolean): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code || "")
    : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (code === "auth/email-already-in-use") {
    return "Este email ya tiene una cuenta. Inicia sesión o usa otro correo.";
  }
  if (code === "auth/invalid-email") {
    return "El formato del email no es válido.";
  }
  if (code === "auth/weak-password") {
    return "La contraseña es demasiado débil. Usa al menos 6 caracteres.";
  }
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Email o contraseña incorrectos.";
  }
  if (code === "auth/user-not-found") {
    return "No encontramos una cuenta con ese email.";
  }
  if (code === "auth/network-request-failed") {
    return "No hay conexión o el servidor no responde. Inténtalo de nuevo.";
  }
  if (code === "auth/too-many-requests") {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "Cerraste la ventana de Google antes de completar el acceso.";
  }
  if (message.includes("insufficient permissions") || message.includes("permission-denied")) {
    return isSignUp
      ? "No pudimos terminar de crear tu cuenta. Vuelve a intentarlo en unos segundos."
      : "Tu sesión se creó, pero no pudimos cargar tu organización. Intenta entrar de nuevo.";
  }
  if (message.includes("bootstrap-failed")) {
    return "No pudimos inicializar tu cuenta en este momento. Inténtalo de nuevo.";
  }

  return isSignUp ? "No se pudo crear la cuenta." : "Error de autenticación.";
}

export function Login() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) throw new Error("Por favor, introduce tu nombre.");
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(mapAuthError(err, isSignUp));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(mapAuthError(err, false));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Proplead" className="h-12 mx-auto my-8" />
          <p className="mt-8 text-sm text-gray-600 font-heading font-medium tracking-wide uppercase">
            {isSignUp ? "Crear una cuenta nueva" : "Inicia sesión en tu cuenta"}
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nombre y Apellidos
                </label>
                <input
                  id="name"
                  type="text"
                  required={isSignUp}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input mt-1"
                  placeholder="Tu nombre completo"
                />
              </div>
            )}

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
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <Button type="submit" loading={loading} className="w-full">
              {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
            </Button>
          </form>

          <div className="mt-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500 font-heading font-medium uppercase tracking-widest text-[10px]">O continúa con</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleSignIn}
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
            {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
            <Button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              variant="ghost"
              size="sm"
              className="px-0 py-0 h-auto text-primary-600 hover:text-primary-700 hover:bg-transparent font-medium"
            >
              {isSignUp ? "Inicia sesión" : "Regístrate"}
            </Button>
          </p>

          <div className="mt-6 text-center text-[10px] text-gray-400 space-x-3 font-heading font-bold uppercase tracking-widest">
            <Link to="/legal/terms" className="hover:text-gray-900 transition-colors">
              Términos
            </Link>
            <Link to="/legal/privacy-policy" className="hover:text-gray-900 transition-colors">
              Privacidad
            </Link>
            <Link to="/cookies" className="hover:text-gray-900 transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
