import { useEffect, useRef, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";
import {
  checkVerification,
  startVerification,
} from "../services/notificationNumbers";

type Props = {
  /** Pre-filled phone (e.g. previously stored summaries phone). */
  initialPhone?: string;
  /** Show an extra "label" input (used in Organización page, not Onboarding). */
  allowLabel?: boolean;
  /** Where this verification was initiated, for analytics + backend source tag. */
  source?: "onboarding" | "team_add";
  /** Called once Twilio Verify approves the code (or short-circuits as already verified). */
  onVerified: (params: { numberId: string; e164: string }) => void;
  /** Optional — called when the user closes / resets. */
  onCancel?: () => void;
  /** Optional className for outer wrapper. */
  className?: string;
};

type Stage = "phone" | "code" | "verified";

const RESEND_COOLDOWN_SECONDS = 30;

export function PhoneVerifyFlow({
  initialPhone = "",
  allowLabel = false,
  source = "team_add",
  onVerified,
  onCancel,
  className,
}: Props) {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState(initialPhone);
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [numberId, setNumberId] = useState<string | null>(null);
  const [verifiedE164, setVerifiedE164] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (stage === "code" && codeInputRef.current) {
      codeInputRef.current.focus();
    }
  }, [stage]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  async function sendCode(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setError(null);
    setSubmitting(true);
    try {
      const result = await startVerification({
        phone: phone.trim(),
        label: allowLabel ? label.trim() || undefined : undefined,
        source,
      });
      setNumberId(result.numberId);
      if (result.alreadyVerified) {
        setVerifiedE164(result.e164);
        setStage("verified");
        onVerified({ numberId: result.numberId, e164: result.e164 });
        return;
      }
      setStage("code");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el código.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCode() {
    if (!numberId) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await checkVerification({ numberId, code: code.trim() });
      if (result.verified) {
        setVerifiedE164(phone.trim());
        setStage("verified");
        onVerified({ numberId, e164: phone.trim() });
        return;
      }
      setAttemptsRemaining(
        typeof result.attemptsRemaining === "number" ? result.attemptsRemaining : null
      );
      setError(
        result.attemptsRemaining === 0
          ? "Has agotado los intentos. Solicita un código nuevo."
          : "Código incorrecto. Inténtalo de nuevo."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo verificar el código.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStage("phone");
    setCode("");
    setNumberId(null);
    setVerifiedE164(null);
    setError(null);
    setAttemptsRemaining(null);
    setResendCooldown(0);
    onCancel?.();
  }

  if (stage === "verified") {
    return (
      <div
        className={
          "flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 " +
          (className || "")
        }
      >
        <div className="flex items-center gap-2">
          <Check size={18} className="text-emerald-600" aria-hidden />
          <div>
            <div className="font-semibold">Número verificado</div>
            <div className="font-mono text-emerald-800">{verifiedE164}</div>
          </div>
        </div>
        {onCancel ? (
          <button
            type="button"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
            onClick={reset}
          >
            Cambiar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={"space-y-3 " + (className || "")}>
      {stage === "phone" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de WhatsApp
            </label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="+34 XXX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Te enviaremos un código por SMS para verificarlo. Sólo verás números verificados al
              configurar anuncios.
            </p>
          </div>
          {allowLabel ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Etiqueta (opcional)
              </label>
              <input
                type="text"
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                placeholder="Ventas Madrid"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={submitting}
                maxLength={60}
              />
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => void sendCode()}
              loading={submitting}
              disabled={!phone.trim()}
            >
              Enviar código
            </Button>
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {stage === "code" ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Hemos enviado un código por SMS a{" "}
            <span className="font-mono font-semibold">{phone.trim()}</span>. Introdúcelo abajo
            para verificar este número.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código de verificación
            </label>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 font-mono tracking-widest text-center"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={submitting}
            />
            {attemptsRemaining !== null && attemptsRemaining > 0 ? (
              <p className="text-xs text-amber-700 mt-1">
                Te quedan {attemptsRemaining} intento{attemptsRemaining === 1 ? "" : "s"}.
              </p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() => void submitCode()}
              loading={submitting}
              disabled={code.trim().length < 4}
            >
              Verificar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void sendCode({ silent: true })}
              disabled={resendCooldown > 0 || submitting}
            >
              <RefreshCw size={14} className="mr-1" />
              {resendCooldown > 0 ? `Reenviar (${resendCooldown}s)` : "Reenviar código"}
            </Button>
            <button
              type="button"
              className="text-xs text-gray-500 underline hover:text-gray-700 ml-auto"
              onClick={() => setStage("phone")}
              disabled={submitting}
            >
              Cambiar número
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
