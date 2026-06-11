import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { toast } from "sonner";
import { Button } from "../components/ui";
import { auth } from "../lib/firebase";
import { mapAuthError } from "../utils/authErrors";

type Status = "verifying" | "ready" | "invalid" | "submitting" | "done";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get("oobCode") || "";
  const [status, setStatus] = useState<Status>("verifying");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!oobCode) {
      setStatus("invalid");
      setError("Enlace de restablecimiento no válido o incompleto.");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setAccountEmail(email);
        setStatus("ready");
      })
      .catch((err) => {
        setStatus("invalid");
        setError(mapAuthError(err, false) || "El enlace ha expirado o ya no es válido.");
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setStatus("submitting");
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("done");
      toast.success("Contraseña restablecida. Ya puedes iniciar sesión.");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setStatus("ready");
      setError(mapAuthError(err, false));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img src="/logo.png" alt="Proplead" className="h-12 mx-auto my-8" />
          <p className="mt-8 text-sm text-gray-600 font-heading font-medium tracking-wide uppercase">
            Nueva contraseña
          </p>
        </div>

        <div className="card">
          {status === "verifying" && (
            <p className="text-sm text-gray-600">Verificando enlace…</p>
          )}

          {status === "invalid" && (
            <div className="space-y-4">
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
              <Link
                to="/forgot-password"
                className="inline-block text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Solicitar un nuevo enlace
              </Link>
            </div>
          )}

          {(status === "ready" || status === "submitting") && (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <p className="mb-4 text-sm text-gray-600">
                Restableciendo la contraseña de <strong>{accountEmail}</strong>.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Nueva contraseña
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
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input mt-1"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>

                <Button type="submit" loading={status === "submitting"} className="w-full">
                  Guardar contraseña
                </Button>
              </form>
            </>
          )}

          {status === "done" && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-sm">
              Contraseña restablecida. Redirigiendo al inicio de sesión…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
