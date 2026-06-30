import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Check, MessageSquare, Phone } from "lucide-react";
import type { BotConfig, BotStyle } from "../types";
import {
  getBotConfig,
  updateActiveStyle,
  updateVoiceNumber,
  updateInboundVoicePerOrgEnabled,
  DEFAULT_STYLES,
} from "../services/botConfig";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Button, PageHeader, PageLoading } from "../components/ui";
import { auth } from "../lib/firebase";

const FUNCTIONS_BASE_URL =
  (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
  "https://europe-west1-real-estate-idealista-bot.cloudfunctions.net";

async function callAuthed(path: string): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("No autenticado");
  const token = await user.getIdToken();
  return fetch(`${FUNCTIONS_BASE_URL}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function Configuracion() {
  const { organizationId, effectiveRole, isImpersonationReadOnly } = useAuth();
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<BotStyle | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [voiceNumberInput, setVoiceNumberInput] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);
  const [perOrgVoiceEnabled, setPerOrgVoiceEnabled] = useState(false);

  async function handleExportData() {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setExporting(true);
    try {
      const res = await callAuthed("exportMyData");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      toast.success("Exportación enviada a tu correo. Revisa tu bandeja de entrada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar los datos");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteOrganization() {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar tu organización? Se desconectará WhatsApp y tus datos se borrarán de forma definitiva en 30 días."
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      const res = await callAuthed("deleteMyOrganization");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      toast.success("Tu organización se ha marcado para eliminación. Se borrará definitivamente en 30 días.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar la organización");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (organizationId) {
      loadConfig();
    }
  }, [organizationId]);

  async function loadConfig() {
    console.log(`[Diagnostic] loadConfig() triggered. Current organizationId state: "${organizationId}"`);
    try {
      const data = await getBotConfig();
      console.log("[Diagnostic] loadConfig() success:", data);
      setConfig(data);
      setVoiceNumberInput(data.twilioConfig?.voiceNumber || "");
      setPerOrgVoiceEnabled(data.inboundVoicePerOrgEnabled === true);
    } catch (error: any) {
      console.error("[Diagnostic] loadConfig() FAILED:", error);
      if (error.code === "permission-denied") {
        console.warn("[Diagnostic] Permission Denied. This usually means the Firestore Security Rules are blocking the path or the user documentorgId doesn't match the path.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveVoiceNumber() {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setSavingVoice(true);
    try {
      await updateVoiceNumber(voiceNumberInput.trim());
      const normalized = voiceNumberInput.replace(/\D/g, "");
      setConfig((prev) =>
        prev ? { ...prev, twilioConfig: { ...prev.twilioConfig, voiceNumber: normalized } } : prev
      );
      toast.success("Número de voz guardado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el número de voz");
    } finally {
      setSavingVoice(false);
    }
  }

  async function handleTogglePerOrgVoice(next: boolean) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setPerOrgVoiceEnabled(next);
    try {
      await updateInboundVoicePerOrgEnabled(next);
      setConfig((prev) => (prev ? { ...prev, inboundVoicePerOrgEnabled: next } : prev));
      toast.success(next ? "Flujo de voz por organización activado" : "Flujo de voz por organización desactivado");
    } catch (e) {
      setPerOrgVoiceEnabled(!next); // revert optimistic toggle
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el ajuste");
    }
  }

  async function handleSelectStyle(styleId: string) {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    if (!config) return;
    setSaving(true);

    try {
      await updateActiveStyle(styleId);
      setConfig({ ...config, activeStyleId: styleId });
      toast.success("Estilo actualizado correctamente");
    } catch (error) {
      console.error("Error updating style:", error);
      toast.error("Error al actualizar el estilo");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageLoading className="h-64" />;
  }

  const styles = config?.styles || DEFAULT_STYLES;

  return (
    <div>
      <PageHeader className="mb-6" title="Configuración" icon={<Settings size={28} />} />

      {/* Asistente Style Section */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="text-primary-500" size={24} />
          <h2 className="text-lg font-bold text-gray-900 font-heading">Estilo del Asistente</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Selector de estilos */}
          <div>
            <p className="text-gray-600 mb-4">
              Selecciona el estilo de comunicación que el asistente utilizará al hablar con los clientes.
            </p>

            <div className="space-y-3">
              {styles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleSelectStyle(style.id)}
                  onMouseEnter={() => setPreviewStyle(style)}
                  onMouseLeave={() => setPreviewStyle(null)}
                  disabled={effectiveRole === "member" || isImpersonationReadOnly || saving}
                  className={cn(
                    "w-full text-left p-4 rounded-btn border-2 transition-all",
                    config?.activeStyleId === style.id
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 font-heading">{style.name}</h3>
                        {config?.activeStyleId === style.id && (
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-[10px] font-bold rounded-full font-heading uppercase tracking-wider">
                            Activo
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{style.description}</p>
                    </div>
                    {config?.activeStyleId === style.id && (
                      <Check className="text-primary-600 ml-2 flex-shrink-0" size={20} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="text-gray-600 mb-4">Vista previa del estilo seleccionado</p>
            <div className="card bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="text-primary-600" size={20} />
                <span className="font-bold text-gray-900 font-heading">
                  {previewStyle?.name || styles.find((s) => s.id === config?.activeStyleId)?.name}
                </span>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 font-heading">
                  Modificador del Prompt:
                </h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto">
                  {previewStyle?.promptModifier ||
                    styles.find((s) => s.id === config?.activeStyleId)?.promptModifier}
                </pre>
              </div>

              <div className="mt-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 font-heading">Ejemplo de respuesta:</h4>
                <div className="space-y-3">
                  {getExampleMessages(
                    previewStyle?.id || config?.activeStyleId || "directo"
                  ).map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "p-3 rounded-lg text-sm",
                        msg.role === "bot"
                          ? "bg-white border border-gray-200 mr-8"
                          : "bg-primary-100 text-primary-800 ml-8"
                      )}
                    >
                      <span className="text-[10px] font-bold text-gray-400 mb-1 block font-heading uppercase tracking-wider">
                        {msg.role === "bot" ? "Asistente" : "Cliente"}
                      </span>
                      {msg.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {effectiveRole !== "member" && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-1">
            <Phone className="text-primary-500" size={22} />
            <h3 className="text-lg font-bold text-gray-900 font-heading">Llamadas entrantes (voz)</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Número de teléfono dedicado donde tu organización recibe llamadas. Cuando el flujo por
            organización está activo, el asistente atiende la llamada, pide consentimiento y continúa
            por WhatsApp <strong>desde tu propio número</strong>, buscando el anuncio entre los tuyos
            (sin transferencias).
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 font-heading">
                Número de voz (E.164)
              </label>
              <input
                type="tel"
                value={voiceNumberInput}
                onChange={(e) => setVoiceNumberInput(e.target.value)}
                placeholder="+34 911 22 33 44"
                disabled={isImpersonationReadOnly || savingVoice}
                className="w-full px-3 py-2 border border-gray-300 rounded-btn focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>
            <Button onClick={handleSaveVoiceNumber} disabled={savingVoice || isImpersonationReadOnly} variant="secondary">
              {savingVoice ? "Guardando..." : "Guardar número"}
            </Button>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={perOrgVoiceEnabled}
              onChange={(e) => handleTogglePerOrgVoice(e.target.checked)}
              disabled={isImpersonationReadOnly}
              className="h-4 w-4 accent-primary-500"
            />
            <span className="text-sm text-gray-700">
              Activar flujo de voz por organización (sin transferencia). Si está desactivado, las
              llamadas usan el flujo clásico.
            </span>
          </label>
        </div>
      )}

      {effectiveRole === "owner" && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1 font-heading">Privacidad y datos</h3>
          <p className="text-sm text-gray-600 mb-4">
            Descarga una copia de los datos de tu organización o solicita su eliminación. Puedes consultar nuestra{" "}
            <a href="/legal/privacy-policy" className="underline">Política de Privacidad</a> y el proceso de{" "}
            <a href="/legal/data-deletion" className="underline">eliminación de datos</a>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleExportData} disabled={exporting || isImpersonationReadOnly} variant="secondary">
              {exporting ? "Preparando exportación..." : "Exportar mis datos"}
            </Button>
            <Button
              onClick={handleDeleteOrganization}
              disabled={deleting || isImpersonationReadOnly}
              variant="secondary"
            >
              {deleting ? "Procesando..." : "Eliminar mi organización"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function getExampleMessages(styleId: string): { role: "bot" | "user"; text: string }[] {
  switch (styleId) {
    case "amigable":
      return [
        { role: "bot", text: "¡Hola! 😊 Me llamo Ana, el asistente virtual de Paco Granados. ¿Con quién tengo el placer de hablar?" },
        { role: "user", text: "Hola, soy María" },
        { role: "bot", text: "¡Encantada, María! 🏠 Veo que te ha interesado este piso. ¿Has podido ver las características? ¡Tiene una terraza preciosa con vistas!" },
      ];
    case "formal":
      return [
        { role: "bot", text: "Buenos días. Soy el asistente virtual del agente inmobiliario Paco Granados. ¿Con quién tengo el gusto de comunicarme?" },
        { role: "user", text: "Hola, soy María" },
        { role: "bot", text: "Estimada María, le agradezco su interés en la propiedad. ¿Ha tenido oportunidad de revisar las características del inmueble?" },
      ];
    case "conciso":
      return [
        { role: "bot", text: "Asistente de Paco Granados. ¿Nombre?" },
        { role: "user", text: "Hola, soy María" },
        { role: "bot", text: "María, ¿viste las características del piso?" },
      ];
    default: // directo
      return [
        { role: "bot", text: "Hola, soy el asistente de Paco Granados. ¿Con quién hablo?" },
        { role: "user", text: "Hola, soy María" },
        { role: "bot", text: "Hola María. ¿Has revisado las características del piso? Si te encajan, necesito algunos datos para avanzar." },
      ];
  }
}
