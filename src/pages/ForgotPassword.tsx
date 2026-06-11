import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (response.status === 400) {
        setError("El formato del email no es válido.");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("No hay conexión o el servidor no responde. Inténtalo de nuevo.");
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
            Recuperar contraseña
          </p>
        </div>

        <div className="card">
          {submitted ? (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-sm">
                Si la dirección existe en Proplead, te enviaremos un correo con instrucciones para restablecer tu contraseña. Revisa también la carpeta de spam.
              </div>
              <Link
                to="/login"
                className="inline-block text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                ← Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <p className="mb-4 text-sm text-gray-600">
                Introduce el email de tu cuenta. Te enviaremos un enlace para crear una nueva contraseña.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <Button type="submit" loading={loading} className="w-full">
                  Enviar enlace
                </Button>
              </form>

              <p className="mt-4 text-center text-sm text-gray-600">
                <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  ← Volver al inicio de sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
