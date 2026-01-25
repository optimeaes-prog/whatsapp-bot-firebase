import { useEffect, useState } from "react";
import { Settings, Check, MessageSquare } from "lucide-react";
import type { BotConfig, BotStyle } from "../types";
import { getBotConfig, updateActiveStyle, DEFAULT_STYLES } from "../services/botConfig";
import { cn } from "../lib/utils";

export function Configuracion() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewStyle, setPreviewStyle] = useState<BotStyle | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await getBotConfig();
      setConfig(data);
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
    } catch (error) {
      console.error("Error updating style:", error);
      alert("Error al actualizar el estilo");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const styles = config?.styles || DEFAULT_STYLES;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="text-gray-400" size={28} />
        <h1 className="text-2xl font-bold text-gray-900">Configuración del Bot</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Selector de estilos */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Estilo de Comunicación</h2>
          <p className="text-gray-600 mb-6">
            Selecciona el estilo de comunicación que el bot utilizará al hablar con los clientes.
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
                  "w-full text-left p-4 rounded-xl border-2 transition-all",
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vista Previa del Estilo</h2>
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
                      {msg.role === "bot" ? "Bot" : "Cliente"}
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
