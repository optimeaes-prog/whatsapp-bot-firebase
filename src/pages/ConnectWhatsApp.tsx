import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle, CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, PageContainer, PageHeader } from "../components/ui";
import { runEmbeddedSignup } from "../services/embeddedSignup";
import { getBotConfig } from "../services/botConfig";
import { getOrganizationSettings, updateOrganizationSettings } from "../services/organization";

type ConnectedState = {
  phoneNumberId: string;
  wabaId: string;
};

export function ConnectWhatsApp() {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState<ConnectedState | null>(null);

  async function advanceOnboardingAfterConnect() {
    try {
      const settings = await getOrganizationSettings();
      const currentStep = settings.onboardingStep || 1;
      if (currentStep <= 3) {
        await updateOrganizationSettings({ onboardingStep: 4 });
      }
    } catch (error) {
      console.error("Could not update onboarding step after connection:", error);
    }
  }

  async function handleConnect() {
    setLoading(true);
    try {
      const settings = await getOrganizationSettings();
      const result = await runEmbeddedSignup({
        assistantAvatarId: settings.assistantAvatarId,
        assistantAvatarUrl: settings.assistantAvatarUrl,
      });
      setConnected({ phoneNumberId: result.phoneNumberId, wabaId: result.wabaId });
      await advanceOnboardingAfterConnect();
      toast.success("WhatsApp Business conectado correctamente");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al conectar con Meta";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getBotConfig();
        const cloudApiCfg = (cfg as unknown as { cloudApiConfig?: { phoneNumberId?: string; wabaId?: string } }).cloudApiConfig;
        if (cloudApiCfg?.phoneNumberId && cloudApiCfg?.wabaId) {
          setConnected({ phoneNumberId: cloudApiCfg.phoneNumberId, wabaId: cloudApiCfg.wabaId });
        }
      } catch (error) {
        console.error("Failed loading existing Cloud API config:", error);
      }
    })();
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Conectar WhatsApp Business"
        subtitle="Vincula tu cuenta de WhatsApp Business a Proplead a través de Meta."
      />

      <div className="max-w-2xl">
        {connected ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="text-emerald-600" size={24} />
              <h2 className="text-lg font-bold text-emerald-900">Cuenta conectada</h2>
            </div>
            <p className="text-sm text-emerald-800 mb-3">
              Ya puedes enviar y recibir mensajes a través de tu número oficial de WhatsApp Business.
            </p>
            <dl className="text-xs text-emerald-900/80 space-y-1 font-mono">
              <div><dt className="inline font-bold">Phone Number ID:</dt> <dd className="inline">{connected.phoneNumberId}</dd></div>
              <div><dt className="inline font-bold">WABA ID:</dt> <dd className="inline">{connected.wabaId}</dd></div>
            </dl>
            <div className="mt-5">
              <Link to="/onboarding">
                <Button variant="primary">Volver al onboarding</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <MessageCircle className="text-primary-600" size={24} />
              <h2 className="text-lg font-bold text-gray-900">Inicia sesión con Facebook</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Se abrirá una ventana de Meta donde podrás seleccionar (o crear) tu cuenta de
              WhatsApp Business y autorizar a Proplead a enviar mensajes en tu nombre.
            </p>

            <ol className="space-y-3 mb-6 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">1</span>
                <span>Haz clic en <strong>"Continuar con Facebook"</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">2</span>
                <span>Selecciona o crea la cuenta de WhatsApp Business de tu inmobiliaria.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">3</span>
                <span>Añade o elige el número de teléfono que usarás con tus clientes.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">4</span>
                <span>Acepta los permisos para que Proplead pueda gestionar plantillas y mensajes.</span>
              </li>
            </ol>

            <Button onClick={handleConnect} disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
              {loading ? "Conectando..." : "Continuar con Facebook"}
            </Button>

            <div className="mt-6 flex gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
              <ShieldCheck size={16} className="shrink-0 mt-0.5 text-gray-500" />
              <p>
                Proplead nunca almacena tu contraseña de Facebook. El acceso que concedes está
                limitado a tu WhatsApp Business Account y puedes revocarlo en cualquier momento
                desde Meta Business Suite.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
