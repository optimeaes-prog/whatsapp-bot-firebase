import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Button } from "../components/ui";

const FUNCTIONS_BASE_URL = "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

type InvitationPreview = {
  orgId: string;
  orgName: string;
  email: string;
  name: string;
  role: string;
  status: string;
  expiresAt: string;
};

function mapSignupError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  const msg = error instanceof Error ? error.message : String(error);

  if (code === "auth/email-already-in-use") return "Este email ya tiene una cuenta. Inicia sesión.";
  if (code === "auth/weak-password") return "La contraseña es demasiado débil (mínimo 6 caracteres).";
  if (code === "auth/invalid-email") return "El formato del email no es válido.";
  if (msg.toLowerCase().includes("invitation expired")) return "La invitación ha expirado.";
  if (msg.toLowerCase().includes("already used")) return "La invitación ya fue usada.";
  if (msg.toLowerCase().includes("not found")) return "La invitación no existe o es inválida.";
  return "No se pudo completar el registro.";
}

export function SignupInvitation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPreview() {
      if (!token) {
        setError("Falta el token de invitación.");
        setLoadingPreview(false);
        return;
      }
      try {
        setLoadingPreview(true);
        const res = await fetch(`${FUNCTIONS_BASE_URL}/getInvitationPreview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Preview failed");
        setPreview(data as InvitationPreview);
        setName(typeof (data as any)?.name === "string" ? (data as any).name : "");
      } catch (err) {
        setError(mapSignupError(err));
      } finally {
        setLoadingPreview(false);
      }
    }
    loadPreview();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;
    setError("");
    if (!name.trim()) {
      setError("Introduce tu nombre.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, preview.email, password);
      await updateProfile(result.user, { displayName: name.trim() });
      const idToken = await result.user.getIdToken();
      const res = await fetch(`${FUNCTIONS_BASE_URL}/acceptInvitation`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Accept failed");
      navigate("/dashboard");
    } catch (err) {
      setError(mapSignupError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <img src="/logo.png" alt="Proplead" className="h-12 mx-auto my-8" />
          <p className="text-sm text-gray-600 font-heading font-medium tracking-wide uppercase">
            Completa tu invitación
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {loadingPreview ? (
            <div className="text-sm text-gray-600">Cargando invitación...</div>
          ) : !preview ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700">No pudimos cargar la invitación.</div>
              <Link to="/login" className="text-sm text-primary-700 font-heading font-semibold underline">
                Ir a login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="text-[10px] uppercase tracking-widest font-heading font-bold text-gray-500">
                  Organización
                </div>
                <div className="text-sm font-heading font-bold text-gray-900">{preview.orgName}</div>
                <div className="mt-2 text-[10px] uppercase tracking-widest font-heading font-bold text-gray-500">
                  Email
                </div>
                <div className="text-sm font-body text-gray-700">{preview.email}</div>
              </div>

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

                <div>
                  <label htmlFor="password2" className="block text-sm font-medium text-gray-700">
                    Repite la contraseña
                  </label>
                  <input
                    id="password2"
                    type="password"
                    required
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className="input mt-1"
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>

                <Button type="submit" loading={loading} className="w-full">
                  Crear cuenta y aceptar invitación
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

