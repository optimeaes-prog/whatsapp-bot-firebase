import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Check, MessageSquare, Loader2, Phone, Home } from "lucide-react";
import type { BotConfig, BotStyle, MessagingProvider } from "../types";
import { getBotConfig, updateActiveStyle, updateMessagingProvider, updateOrgName, DEFAULT_STYLES } from "../services/botConfig";
import { cn } from "../lib/utils";
import { PageHeader, PageLoading } from "../components/ui";

export function Configuracion() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<BotStyle | null>(null);
  const [orgName, setOrgName] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await getBotConfig();
      setConfig(data);
      setOrgName(data.orgName || "");
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectStyle(styleId: string) {
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

  async function handleSelectProvider(provider: MessagingProvider) {
    if (!config || config.messagingProvider === provider) return;
    setSavingProvider(true);

    try {
      await updateMessagingProvider(provider);
      setConfig({ ...config, messagingProvider: provider });
      toast.success(`Proveedor cambiado a ${provider} correctamente`);
    } catch (error) {
      console.error("Error updating provider:", error);
      toast.error("Error al actualizar el proveedor");
    } finally {
      setSavingProvider(false);
    }
  }

  async function handleUpdateOrgName() {
    if (!config || orgName === config.orgName) return;
    setSavingOrg(true);

    try {
      console.log("Intentando guardar nombre de inmobiliaria:", orgName);
      await updateOrgName(orgName.trim());
      setConfig({ ...config, orgName: orgName.trim() });
      toast.success("Nombre de la inmobiliaria guardado correctamente");
    } catch (error) {
      console.error("Error updating org name:", error);
      toast.error("Error al actualizar el nombre de la inmobiliaria: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSavingOrg(false);
    }
  }

  if (loading) {
    return <PageLoading className="h-64" />;
  }

  const styles = config?.styles || DEFAULT_STYLES;

  return (
    <div>
      <PageHeader className="mb-6" title="Configuración" icon={<Settings size={28} />} />

      {/* Organization Info Section */}
      <div className="card mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Home className="text-primary-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Datos de la Inmobiliaria</h2>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Inmobiliaria
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="input"
              placeholder="Ej: Atlas Capital Group"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleUpdateOrgName}
              disabled={savingOrg || orgName === config?.orgName}
              className="btn-primary"
            >
              {savingOrg ? <Loader2 className="animate-spin" size={20} /> : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {/* Messaging Provider Section */}
      <div className="border-t pt-8 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="text-emerald-600" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Proveedor de Mensajería</h2>
        </div>

        <p className="text-gray-600 mb-4">
          Selecciona el servicio que se utilizará para enviar mensajes de WhatsApp.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Whapi Option */}
          <button
            onClick={() => handleSelectProvider("whapi")}
            disabled={savingProvider}
            className={cn(
              "w-full text-left p-5 rounded-btn border-2 transition-all",
              config?.messagingProvider === "whapi" || !config?.messagingProvider
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">Whapi</h3>
                  {(config?.messagingProvider === "whapi" || !config?.messagingProvider) && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Activo
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Envía mensajes a través de la API de Whapi Cloud.</p>
              </div>
              {(config?.messagingProvider === "whapi" || !config?.messagingProvider) && (
                <Check className="text-green-600 ml-2 flex-shrink-0" size={20} />
              )}
            </div>
          </button>

          {/* Twilio Option */}
          <button
            onClick={() => handleSelectProvider("twilio")}
            disabled={savingProvider}
            className={cn(
              "w-full text-left p-5 rounded-btn border-2 transition-all",
              config?.messagingProvider === "twilio"
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">Twilio</h3>
                  {config?.messagingProvider === "twilio" && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      Activo
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">Envía mensajes a través de la API de Twilio WhatsApp.</p>
              </div>
              {config?.messagingProvider === "twilio" && (
                <Check className="text-green-600 ml-2 flex-shrink-0" size={20} />
              )}
            </div>
          </button>
        </div>

        {savingProvider && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
            <Loader2 className="animate-spin" size={14} />
            Guardando...
          </div>
        )}
      </div>

      {/* Bot Style Section */}
      <div className="border-t pt-8">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="text-primary-500" size={24} />
          <h2 className="text-lg font-semibold text-gray-900">Estilo del Asistente</h2>
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
                  disabled={saving}
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
                        <h3 className="font-semibold text-gray-900">{style.name}</h3>
                        {config?.activeStyleId === style.id && (
                          <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
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
                <span className="font-medium text-gray-900">
                  {previewStyle?.name || styles.find((s) => s.id === config?.activeStyleId)?.name}
                </span>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Modificador del Prompt:
                </h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto">
                  {previewStyle?.promptModifier ||
                    styles.find((s) => s.id === config?.activeStyleId)?.promptModifier}
                </pre>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Ejemplo de respuesta:</h4>
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
                      <span className="text-xs font-medium text-gray-400 mb-1 block">
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
