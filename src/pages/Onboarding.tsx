import { useState, useEffect, useRef } from "react";
import { CheckCircle, Lock, ArrowRight, Mail, Clock, ChevronDown, CheckSquare, Square, MessageCircle, CalendarDays, XCircle, Upload, Loader2, Camera } from "lucide-react";
import { getOrganizationSettings, updateOrganizationSettings } from "../services/organization";
import type { OrganizationSettings } from "../services/organization";
import { Link } from "react-router-dom";
import { analytics } from "../lib/analytics";
import { getSubscription } from "../services/subscription";
import type { OrgSubscriptionInfo } from "../services/subscription";
import { cn } from "../lib/utils";
import { Button, PageLoading } from "../components/ui";
import { getBotConfig } from "../services/botConfig";
import {
  ASSISTANT_AVATARS,
  ASSISTANT_NAME_OPTIONS,
  getAssistantAvatarById,
  type AssistantAvatarId,
} from "../constants/assistantAvatars";
import { uploadAssistantPhoto } from "../services/storage";
import { CalEuInlineEmbed } from "../components/CalEuInlineEmbed";
import { useAuth } from "../contexts/AuthContext";
import { isNotificationNumbersV2Enabled } from "../lib/featureFlags";
import { PhoneVerifyFlow } from "../components/PhoneVerifyFlow";
import { getVerifiedNotificationNumbers } from "../services/notificationNumbers";

export function Onboarding() {
  const { organizationId } = useAuth();
  const loadSeqRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
  });

  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Form states for step 2
  const [agencyName, setAgencyName] = useState("");
  const [agencyTaxId, setAgencyTaxId] = useState("");
  const [agencyAddress, setAgencyAddress] = useState("");
  const [employeesCount, setEmployeesCount] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const notificationNumbersV2 = isNotificationNumbersV2Enabled();
  /**
   * When v2 is on, step 2 requires the WhatsApp summaries phone to be verified
   * via Twilio Verify before advancing. `verifiedNumberId` is the id of the
   * notificationNumbers doc; we also keep `whatsappPhone` in sync (canonical
   * E.164) for the legacy dual-write to OrganizationSettings.whatsappSummariesPhone.
   */
  const [verifiedNumberId, setVerifiedNumberId] = useState<string | null>(null);
  const [checkingVerifiedMatch, setCheckingVerifiedMatch] = useState(false);
  const [assistantAvatarId, setAssistantAvatarId] = useState<AssistantAvatarId | "">("");
  const [assistantName, setAssistantName] = useState<string>("");
  const [photoMode, setPhotoMode] = useState<"avatar" | "logo">("avatar");
  const [assistantPhotoUrl, setAssistantPhotoUrl] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoWarning, setPhotoWarning] = useState<string | null>(null);
  const [isEmployeesDropdownOpen, setIsEmployeesDropdownOpen] = useState(false);
  const [isAssistantNameDropdownOpen, setIsAssistantNameDropdownOpen] = useState(false);
  
  // Form state for step 4
  const [forwardingEmail, setForwardingEmail] = useState("");
  const [step5Error, setStep5Error] = useState<string | null>(null);

  const currentStep = settings?.onboardingStep || 1;
  const [subscription, setSubscription] = useState<OrgSubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const loadSettings = async (seq: number): Promise<OrganizationSettings | null> => {
    try {
      let s = await getOrganizationSettings();
      if (seq !== loadSeqRef.current) return null;

      // One-time migration to the 7-step layout: split old step 2 (data + assistant)
      // into new step 2 (agency) and new step 3 (assistant), shifting everything past
      // step 3 up by one. Orgs already on the new layout carry onboardingStepsV2: true.
      if (!s.onboardingStepsV2 && typeof s.onboardingStep === "number") {
        const bumped = s.onboardingStep >= 3 ? s.onboardingStep + 1 : s.onboardingStep;
        await updateOrganizationSettings({
          onboardingStep: bumped,
          onboardingStepsV2: true,
        });
        s = { ...s, onboardingStep: bumped, onboardingStepsV2: true };
      } else if (!s.onboardingStepsV2) {
        await updateOrganizationSettings({ onboardingStepsV2: true });
        s = { ...s, onboardingStepsV2: true };
      }

      setSettings(s);
      setAgencyName(s.agencyName || "");
      setAgencyTaxId(s.agencyTaxId || "");
      setAgencyAddress(s.agencyAddress || "");
      setEmployeesCount(s.employeesCount || "");
      setWhatsappPhone(s.whatsappSummariesPhone || "");
      const loadedAvatarId = getAssistantAvatarById(s.assistantAvatarId)?.id || "";
      setAssistantAvatarId(loadedAvatarId);
      const loadedPhotoUrl = s.assistantPhotoUrl || "";
      setAssistantPhotoUrl(loadedPhotoUrl);
      // Fallback: derive name from the stock avatar id when assistantName isn't set yet.
      setAssistantName(
        s.assistantName ||
          s.assistantAvatarName ||
          getAssistantAvatarById(s.assistantAvatarId)?.name ||
          ""
      );
      if (loadedPhotoUrl) setPhotoMode("logo");
      else if (loadedAvatarId) setPhotoMode("avatar");
      else setPhotoMode("avatar");
      setForwardingEmail(s.forwardingEmail || "");
      
      // Migration: if they had scheduled a call before the steps logic
      if (!s.onboardingStep && s.onboardingCallScheduled) {
        const migrated = { ...s, onboardingStep: 2 };
        setSettings(migrated);
        return migrated;
      }
      return s;
    } catch (error) {
      console.error("Failed to load settings:", error);
      return null;
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  };

  // When v2 is on and the org has a saved summaries phone, check whether it
  // already matches a verified notification number. If it does, treat it as
  // verified so refreshing step 2 doesn't force a re-verification of a number
  // the user has already confirmed.
  useEffect(() => {
    if (!notificationNumbersV2) return;
    if (!organizationId) return;
    if (!whatsappPhone || verifiedNumberId) return;
    const targetDigits = whatsappPhone.replace(/\D/g, "");
    if (targetDigits.length < 8) return;
    let cancelled = false;
    setCheckingVerifiedMatch(true);
    getVerifiedNotificationNumbers()
      .then((list) => {
        if (cancelled) return;
        const match = list.find((n) => n.phoneDigests === targetDigits);
        if (match) setVerifiedNumberId(match.id);
      })
      .catch((error) => console.warn("Could not check verified numbers:", error))
      .finally(() => {
        if (!cancelled) setCheckingVerifiedMatch(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notificationNumbersV2, organizationId, whatsappPhone, verifiedNumberId]);

  async function refreshSubscription(seq: number, step: number) {
    try {
      setSubscriptionLoading(true);
      const sub = await getSubscription().catch(() => null);
      if (seq !== loadSeqRef.current) return;
      setSubscription(sub);
      const isActive =
        Boolean(sub) &&
        sub!.planId !== "free" &&
        (sub!.status === "active" || sub!.status === "trialing");

      if (isActive && step === 5) {
        await updateOrganizationSettings({ onboardingStep: 6 });
        await loadSettings(seq);
      }
    } catch (error) {
      console.error("Failed to load subscription:", error);
      if (seq !== loadSeqRef.current) return;
      setSubscription(null);
    } finally {
      if (seq === loadSeqRef.current) setSubscriptionLoading(false);
    }
  }

  async function refreshWhatsAppConnection(seq: number, step: number) {
    try {
      setCheckingConnection(true);
      const cfg = await getBotConfig();
      if (seq !== loadSeqRef.current) return;
      const cloudApiCfg = (cfg as unknown as { cloudApiConfig?: { phoneNumberId?: string; wabaId?: string } }).cloudApiConfig;
      const connected = Boolean(cloudApiCfg?.phoneNumberId && cloudApiCfg?.wabaId);
      setWhatsAppConnected(connected);
      if (connected && step < 5) {
        await updateOrganizationSettings({ onboardingStep: 5 });
        await loadSettings(seq);
      }
    } catch (error) {
      console.error("Failed to check WhatsApp connection:", error);
      if (seq !== loadSeqRef.current) return;
      setWhatsAppConnected(false);
    } finally {
      if (seq === loadSeqRef.current) setCheckingConnection(false);
    }
  }

  useEffect(() => {
    if (!organizationId) return;
    const seq = ++loadSeqRef.current;

    setLoading(true);
    setSettings(null);
    setSubscription(null);
    setSubscriptionLoading(true);
    setWhatsAppConnected(false);
    setCheckingConnection(true);
    setIsEmployeesDropdownOpen(false);
    setIsAssistantNameDropdownOpen(false);
    setPhotoError(null);
    setPhotoWarning(null);

    (async () => {
      const s = await loadSettings(seq);
      const step = s?.onboardingStep || 1;
      await Promise.all([refreshSubscription(seq, step), refreshWhatsAppConnection(seq, step)]);
    })();
  }, [organizationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    if (!settings?.onboardingStep) return;
    const cs = settings.onboardingStep;
    setExpandedSteps((prev) => {
      const next: Record<number, boolean> = {};
      for (const key of Object.keys(prev)) {
        const n = Number(key);
        next[n] = n === cs;
      }
      return next;
    });
  }, [isDesktop, settings?.onboardingStep]);

  function toggleStep(step: number) {
    if (!isDesktop) return;
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  }

  const handleConfirmCallScheduled = async () => {
    setSaving(true);
    await updateOrganizationSettings({
      onboardingCallScheduled: true,
      onboardingStep: Math.max(currentStep, 2),
    });
    analytics.trackOnboardingStepComplete(1, "onboarding_call");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
    setIsCallModalOpen(false);
  };

  const handleSaveStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      agencyName,
      agencyTaxId: agencyTaxId.trim() || null,
      agencyAddress: agencyAddress.trim() || null,
      employeesCount,
      onboardingStep: 3,
    });
    analytics.trackOnboardingStepComplete(2, "agency_info");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  const handleSaveStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const usingAvatar = photoMode === "avatar" && !!assistantAvatarId;
    const usingLogo = photoMode === "logo" && !!assistantPhotoUrl;
    const stockAvatar = usingAvatar ? getAssistantAvatarById(assistantAvatarId) : undefined;
    await updateOrganizationSettings({
      whatsappSummariesPhone: whatsappPhone,
      assistantName: assistantName || null,
      assistantAvatarId: usingAvatar ? (stockAvatar?.id as AssistantAvatarId) : null,
      assistantAvatarName: assistantName || null,
      assistantAvatarImagePath: usingAvatar ? stockAvatar?.imagePath || null : null,
      assistantAvatarUrl:
        usingAvatar && typeof window !== "undefined" && stockAvatar
          ? `${window.location.origin}${stockAvatar.imagePath}`
          : null,
      assistantPhotoUrl: usingLogo ? assistantPhotoUrl : null,
      onboardingStep: 4,
    });
    analytics.trackOnboardingStepComplete(3, "assistant_config");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  const handlePhotoUpload = async (file: File) => {
    setPhotoError(null);
    setPhotoWarning(null);
    if (!organizationId) {
      setPhotoError("Necesitas estar autenticado para subir la foto.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Formato no soportado. Sube un JPG o PNG.");
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPhotoError("La imagen supera los 5 MB. Comprime el archivo e inténtalo de nuevo.");
      return;
    }

    // Non-blocking dimension check.
    try {
      const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        img.src = objectUrl;
      });
      if (dims) {
        if (dims.w !== dims.h) {
          setPhotoWarning(
            "Sugerencia: usa una imagen cuadrada — WhatsApp la recortará en círculo."
          );
        } else if (dims.w < 640) {
          setPhotoWarning(
            `Sugerencia: tu imagen es ${dims.w}×${dims.h}. WhatsApp recomienda mínimo 640×640 px.`
          );
        }
      }
    } catch {
      /* dimension check is best-effort */
    }

    setUploadingPhoto(true);
    try {
      const url = await uploadAssistantPhoto({ organizationId, file });
      setAssistantPhotoUrl(url);
    } catch (err) {
      console.error("Failed to upload assistant photo:", err);
      setPhotoError("No se pudo subir la imagen. Inténtalo de nuevo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveStep6 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await updateOrganizationSettings({
      forwardingEmail,
      onboardingStep: 7,
    });
    analytics.trackOnboardingStepComplete(6, "email_config");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  const handleMarkStep6Complete = async () => {
    if (!forwardingEmail.trim()) {
      setStep5Error("Indica el email desde el que se reenviarán los leads.");
      return;
    }
    setStep5Error(null);
    setSaving(true);
    await updateOrganizationSettings({
      forwardingEmail,
      onboardingStep: 7,
    });
    analytics.trackOnboardingStepComplete(6, "email_config");
    await loadSettings(loadSeqRef.current);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <PageLoading message="Cargando..." />
      </div>
    );
  }

  const isCompleted = currentStep >= 8;
  // Some legacy org docs may contain non-boolean values; only strict true counts.
  const callScheduled = settings?.onboardingCallScheduled === true;
  const step1Done = callScheduled;
  const hasActiveSubscription =
    Boolean(subscription) &&
    subscription!.planId !== "free" &&
    (subscription!.status === "active" || subscription!.status === "trialing");

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl font-heading">Configuración del Asistente</h1>
        <p className="text-gray-600 font-body">Completa estos pasos para empezar a utilizar tu agente de inteligencia artificial.</p>
      </div>

      {/* Paso 1 (sección separada) */}
      <div className="mb-8">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleStep(1)}
            className="w-full flex items-center justify-between text-left px-4 py-4 sm:px-6 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border",
                step1Done ? "border-primary-500 bg-primary-500 text-white" :
                currentStep === 1 ? "border-primary-500 bg-white text-primary-700" :
                "border-gray-200 text-gray-400 bg-gray-50"
              )}>
                <span className="font-bold">1</span>
              </div>
              <div>
                <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Agenda tu onboarding</h2>
                <p className="text-xs text-gray-500 font-medium mt-1">Te acompañamos para completar la activación sin complicaciones.</p>
              </div>
            </div>
            <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[1] ? "rotate-180" : "")} />
          </button>

          <div className={cn(expandedSteps[1] ? "" : "hidden", "px-4 pb-5 sm:px-6")}>
            <p className="text-gray-600 mb-4">
              Esta llamada es para ayudarte a completar el proceso de activación del asistente paso a paso: resolvemos dudas, revisamos la configuración y nos aseguramos de que todo quede funcionando.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={() => setIsCallModalOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <CalendarDays size={18} />
                Abrir calendario
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleConfirmCallScheduled}
                loading={saving}
                disabled={step1Done}
                className="w-full sm:w-auto"
                title={step1Done ? "Este paso ya está completado" : "Si ya la has reservado en el calendario, marca este paso como completado"}
              >
                {step1Done ? "Paso completado" : "Ya la he reservado"}
              </Button>
            </div>

            {step1Done && (
              <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">Onboarding call reservada.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cn(
        "pb-4",
        isDesktop
          ? "rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100"
          : "relative border-l-2 border-gray-200 ml-4 space-y-12"
      )}>

        {/* Paso 2 */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 2 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 2 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400'
            }`}>
              <span className="font-bold text-lg">2</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 2 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 2 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(2)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50 rounded-t-xl"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 2 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 2 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">2</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Datos de tu Inmobiliaria</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[2] ? "rotate-180" : "")} />
              )}
            </button>
            
            <div className={cn(isDesktop && !expandedSteps[2] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <form onSubmit={handleSaveStep2} className={currentStep > 2 && !saving ? "pointer-events-none opacity-80" : ""}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Inmobiliaria</label>
                  <input
                    type="text" required
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    value={agencyName} onChange={e => setAgencyName(e.target.value)}
                    disabled={currentStep > 2 && !saving}
                    placeholder="Ej. Inmobiliaria Granados"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CIF / NIF <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    value={agencyTaxId} onChange={e => setAgencyTaxId(e.target.value)}
                    disabled={currentStep > 2 && !saving}
                    placeholder="Ej. B12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                    value={agencyAddress} onChange={e => setAgencyAddress(e.target.value)}
                    disabled={currentStep > 2 && !saving}
                    placeholder="Calle, número, ciudad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Trabajadores</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEmployeesDropdownOpen(!isEmployeesDropdownOpen)}
                      disabled={currentStep > 2 && !saving}
                      className={cn(
                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                        isEmployeesDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400",
                        currentStep > 2 && !saving && "bg-gray-50 opacity-80 cursor-not-allowed"
                      )}
                    >
                      <span className={!employeesCount ? "text-gray-400" : "text-gray-900"}>
                        {employeesCount || "Selecciona un rango"}
                      </span>
                      <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isEmployeesDropdownOpen && "rotate-180")} />
                    </button>
                    {isEmployeesDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsEmployeesDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                          {["1", "2-5", "5-20", "20-50", "50-100", "+100"].map((range) => (
                            <button
                              key={range}
                              type="button"
                              onClick={() => {
                                setEmployeesCount(range);
                                setIsEmployeesDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                            >
                              {employeesCount === range ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                              <span className="text-sm text-gray-700 font-medium">{range}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {currentStep === 2 && (
                <Button
                  type="submit"
                  loading={saving}
                  disabled={!agencyName || !employeesCount}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 mt-6"
                >
                  Guardar y Continuar
                  <ArrowRight size={18} />
                </Button>
              )}
            </form>
            </div>
          </div>
        </div>

        {/* Paso 3 — Configurar tu asistente */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 3 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 3 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">3</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 3 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 3 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(3)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 3 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 3 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">3</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Configurar tu asistente</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[3] ? "rotate-180" : "")} />
              )}
            </button>

            <div className={cn(isDesktop && !expandedSteps[3] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <form onSubmit={handleSaveStep3} className={currentStep > 3 && !saving ? "pointer-events-none opacity-80" : ""}>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del asistente</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsAssistantNameDropdownOpen(!isAssistantNameDropdownOpen)}
                      disabled={currentStep > 3 && !saving}
                      className={cn(
                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                        isAssistantNameDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400",
                        currentStep > 3 && !saving && "bg-gray-50 opacity-80 cursor-not-allowed"
                      )}
                    >
                      <span className={!assistantName ? "text-gray-400" : "text-gray-900"}>
                        {assistantName || "Elige un nombre"}
                      </span>
                      <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isAssistantNameDropdownOpen && "rotate-180")} />
                    </button>
                    {isAssistantNameDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsAssistantNameDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-auto">
                          {ASSISTANT_NAME_OPTIONS.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setAssistantName(name);
                                setIsAssistantNameDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                            >
                              {assistantName === name ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                              <span className="text-sm text-gray-700 font-medium">{name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Así se presentará tu asistente IA en las conversaciones de WhatsApp.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Foto del asistente</label>
                  <p className="text-xs text-gray-500 mb-3">
                    Esta es la foto que verán tus leads en tu perfil de WhatsApp Business.
                  </p>

                  <div className="inline-flex rounded-btn border border-gray-200 bg-gray-50 p-1 mb-4">
                    <button
                      type="button"
                      onClick={() => setPhotoMode("avatar")}
                      disabled={currentStep > 3 && !saving}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-btn transition-colors",
                        photoMode === "avatar" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-800"
                      )}
                    >
                      Avatar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoMode("logo")}
                      disabled={currentStep > 3 && !saving}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-btn transition-colors",
                        photoMode === "logo" ? "bg-white shadow-sm text-gray-900" : "text-gray-600 hover:text-gray-800"
                      )}
                    >
                      Logo de mi inmobiliaria
                    </button>
                  </div>

                  {photoMode === "avatar" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {ASSISTANT_AVATARS.map((avatar) => {
                        const isSelected = assistantAvatarId === avatar.id;
                        return (
                          <button
                            key={avatar.id}
                            type="button"
                            onClick={() => setAssistantAvatarId(avatar.id)}
                            disabled={currentStep > 3 && !saving}
                            className={cn(
                              "rounded-btn border p-2 transition-all bg-white flex items-center justify-center",
                              isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-gray-200 hover:border-primary-300",
                              currentStep > 3 && !saving && "cursor-not-allowed opacity-80 bg-gray-50"
                            )}
                          >
                            <img
                              src={avatar.imagePath}
                              alt="Avatar"
                              className="h-16 w-16 rounded-full object-cover border border-gray-200"
                              loading="lazy"
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="shrink-0">
                        {assistantPhotoUrl ? (
                          <img
                            src={assistantPhotoUrl}
                            alt="Logo de la inmobiliaria"
                            className="h-24 w-24 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400">
                            <Camera size={28} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <label
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-btn border border-gray-300 bg-white text-sm font-medium text-gray-700 cursor-pointer hover:border-primary-300",
                            (uploadingPhoto || (currentStep > 3 && !saving)) && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          {assistantPhotoUrl ? "Cambiar imagen" : "Subir logo"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            disabled={uploadingPhoto || (currentStep > 3 && !saving)}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handlePhotoUpload(file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          Cuadrada, mínimo 640×640 px. JPG o PNG, máximo 5 MB. WhatsApp recortará la imagen en círculo.
                        </p>
                        {photoError && (
                          <p className="text-xs text-red-600 mt-2">{photoError}</p>
                        )}
                        {photoWarning && !photoError && (
                          <p className="text-xs text-amber-600 mt-2">{photoWarning}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && photoMode === "avatar" && !assistantAvatarId && (
                    <p className="text-xs text-red-600 mt-2">Selecciona un avatar para continuar.</p>
                  )}
                  {currentStep === 3 && photoMode === "logo" && !assistantPhotoUrl && (
                    <p className="text-xs text-red-600 mt-2">Sube el logo de tu inmobiliaria para continuar.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp para Resúmenes</label>
                  {notificationNumbersV2 ? (
                    checkingVerifiedMatch && !verifiedNumberId ? (
                      <div className="text-xs text-gray-400 italic flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" /> Comprobando…
                      </div>
                    ) : (
                      <PhoneVerifyFlow
                        initialPhone={whatsappPhone}
                        source="onboarding"
                        onVerified={({ numberId, e164 }) => {
                          setVerifiedNumberId(numberId);
                          setWhatsappPhone(e164);
                        }}
                        onCancel={
                          verifiedNumberId
                            ? () => {
                                setVerifiedNumberId(null);
                                setWhatsappPhone("");
                              }
                            : undefined
                        }
                      />
                    )
                  ) : (
                    <>
                      <input
                        type="tel" required
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={whatsappPhone} onChange={e => setWhatsappPhone(e.target.value)}
                        disabled={currentStep > 3 && !saving}
                        placeholder="+34 XXXXXXXX"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Donde recibirás alertas de leads cualificados. Podrás cambiar este número o añadir otros más adelante.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {currentStep === 3 && (
                <Button
                  type="submit"
                  loading={saving}
                  disabled={
                    !assistantName ||
                    uploadingPhoto ||
                    (photoMode === "avatar" ? !assistantAvatarId : !assistantPhotoUrl) ||
                    (notificationNumbersV2 && !verifiedNumberId)
                  }
                  className="w-full sm:w-auto flex items-center justify-center gap-2 mt-6"
                >
                  Guardar y Continuar
                  <ArrowRight size={18} />
                </Button>
              )}
            </form>
            </div>
          </div>
        </div>

        {/* Paso 4 — Conectar WhatsApp Business */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 4 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 4 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">4</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 4 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 4 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(4)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 4 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 4 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">4</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Conectar WhatsApp Business</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[4] ? "rotate-180" : "")} />
              )}
            </button>

            <div className={cn(isDesktop && !expandedSteps[4] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            <p className="text-gray-600 mb-6">
              Conecta tu cuenta de WhatsApp Business con Meta Embedded Signup para activar la mensajería oficial en Proplead.
            </p>

            {!whatsAppConnected && (
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/connect-whatsapp" className="w-full sm:w-auto">
                  <Button className="w-full sm:w-auto flex items-center justify-center gap-2">
                    <MessageCircle size={18} />
                    Conectar con Facebook
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => refreshWhatsAppConnection(loadSeqRef.current, currentStep)}
                  loading={checkingConnection}
                  className="w-full sm:w-auto"
                >
                  Verificar conexión
                </Button>
              </div>
            )}

            {(currentStep > 4 || whatsAppConnected) && (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200 mt-4">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">WhatsApp Business conectado correctamente.</span>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Paso 5 — Activar suscripción */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 5 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 5 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">5</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 5 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 5 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(5)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 5 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 5 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">5</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Activar suscripción</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[5] ? "rotate-180" : "")} />
              )}
            </button>

            <div className={cn(isDesktop && !expandedSteps[5] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
              {
                <div className={currentStep > 5 && !saving ? "pointer-events-none opacity-80" : ""}>
                  <p className="text-gray-600 mb-4">
                    Para continuar, activa una suscripción. Desde ahí podrás elegir plan y completar el pago de forma segura.
                  </p>

                  {hasActiveSubscription ? (
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                      <CheckCircle size={20} className="text-emerald-600" />
                      <span className="font-medium">Suscripción activa detectada. Ya puedes continuar.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link to="/suscripcion" className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">
                          Ir a Suscripciones
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        onClick={() => refreshSubscription(loadSeqRef.current, currentStep)}
                        loading={subscriptionLoading}
                        className="w-full sm:w-auto"
                      >
                        Ya tengo suscripción (verificar)
                      </Button>
                    </div>
                  )}
                </div>
              }
            </div>
          </div>
        </div>

        {/* Paso 6 — Configurar email de leads */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : "ml-8 relative opacity-100"
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 6 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 6 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              <span className="font-bold text-lg">6</span>
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 6 ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 6 ? "border-primary-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(6)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 6 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 6 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  <span className="font-bold">6</span>
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Configurar email de leads</h2>
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[6] ? "rotate-180" : "")} />
              )}
            </button>

            <div className={cn(isDesktop && !expandedSteps[6] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
              <form onSubmit={handleSaveStep6} className={currentStep > 6 && !saving ? "pointer-events-none opacity-80" : ""}>
                  <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">Esto sirve para que el asistente responda automáticamente a los mensajes que entran desde Idealista (leads), no a llamadas al número de teléfono.</p>
                    <p className="mt-1 text-gray-600">
                      Nota: esta funcionalidad está activa por el momento <span className="font-semibold">solo para Idealista</span>.
                    </p>
                  </div>

                  <div className="mb-6 rounded-lg border border-primary-100 bg-primary-50 p-5">
                    <h3 className="mb-3 flex items-center gap-2 font-bold text-primary-900">
                      <Mail size={18} />
                      Guía de reenvío de correos (Idealista)
                    </h3>
                    <ol className="list-decimal list-inside space-y-3 pl-2 text-sm text-primary-800">
                      <li>Abre la cuenta de correo electrónico donde recibes las notificaciones de nuevos mensajes recibidos en Idealista.</li>
                      <li>Ve a los ajustes de <span className="font-bold">Filtros y direcciones bloqueadas</span> (o “Filtros”).</li>
                      <li>Crea un filtro para los correos que provengan de <code>idealista.com</code>.</li>
                      <li>Activa el reenvío automático a: <code className="mt-1 inline-block rounded border border-primary-200 bg-white px-2 py-1 font-mono font-bold">soporte@proplead.io</code></li>
                    </ol>
                  </div>

                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">¿Desde qué email se van a reenviar?</label>
                      <input
                        type="email"
                        required
                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={forwardingEmail}
                        onChange={e => {
                          setForwardingEmail(e.target.value);
                          if (step5Error) setStep5Error(null);
                        }}
                        disabled={currentStep > 6 && !saving}
                        placeholder="tucorreo@inmobiliaria.com"
                      />
                      <p className="text-xs text-gray-500 mt-1">Necesario para identificar tus leads y vincularlos a tu cuenta.</p>
                      {step5Error && <p className="text-xs text-red-600 mt-2">{step5Error}</p>}
                    </div>
                  </div>

                  {currentStep < 6 && (
                    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                      Paso bloqueado. Se desbloqueará al completar el paso anterior.
                    </div>
                  )}

                  {currentStep === 6 && (
                    <div className="mt-6 flex flex-col sm:flex-row gap-3">
                      <Button
                        type="submit"
                        loading={saving}
                        className="w-full sm:w-auto flex items-center justify-center gap-2"
                      >
                        Guardar y continuar
                        <ArrowRight size={18} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleMarkStep6Complete}
                        loading={saving}
                        className="w-full sm:w-auto"
                      >
                        Ya está completado
                      </Button>
                    </div>
                  )}
              </form>

              {currentStep > 6 && (
                <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span className="font-medium">Email de leads configurado.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Paso 7 — Activación del Asistente */}
        <div className={cn(
          "transition-all duration-300",
          isDesktop ? "p-4 sm:p-6" : `ml-8 relative ${currentStep >= 7 ? "opacity-100" : "opacity-60"}`
        )}>
          {!isDesktop && (
            <div className={`absolute -left-13 flex h-10 w-10 items-center justify-center rounded-full ring-8 ring-gray-50 bg-white shadow-sm border ${
              currentStep > 7 ? 'border-primary-500 bg-primary-500 text-white' :
              currentStep === 7 ? 'border-primary-500 bg-white text-primary-700' : 'border-gray-200 text-gray-400 bg-gray-50'
            }`}>
              {currentStep > 7 ? <span className="font-bold text-lg">7</span> : currentStep === 7 ? <span className="font-bold text-lg">7</span> : <Lock size={16} />}
            </div>
          )}

          <div className={cn(
            "card shadow-sm border",
            isDesktop ? "p-0" : `p-6 ${currentStep === 7 ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-100"}`,
            isDesktop && (currentStep === 7 ? "border-orange-300" : "border-gray-100")
          )}>
            <button
              type="button"
              onClick={() => toggleStep(7)}
              className={cn(
                "w-full flex items-center justify-between text-left",
                isDesktop ? "px-4 py-4 sm:px-6" : "mb-4",
                isDesktop && "hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  currentStep > 7 ? "border-primary-500 bg-primary-500 text-white" :
                  currentStep === 7 ? "border-primary-500 bg-white text-primary-700" :
                  "border-gray-200 text-gray-400 bg-gray-50"
                )}>
                  {currentStep > 7 ? <span className="font-bold">7</span> : currentStep === 7 ? <span className="font-bold">7</span> : <Lock size={14} />}
                </div>
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-heading leading-tight">Activación del Asistente</h2>
                  {currentStep < 7 && (
                    <p className="text-[11px] text-gray-500 font-medium mt-1">
                      Se desbloqueará al completar los pasos anteriores.
                    </p>
                  )}
                </div>
              </div>
              {isDesktop && (
                <ChevronDown size={18} className={cn("text-gray-400 transition-transform", expandedSteps[7] ? "rotate-180" : "")} />
              )}
            </button>

            <div className={cn(isDesktop && !expandedSteps[7] ? "hidden" : "", isDesktop ? "px-4 pb-5 sm:px-6" : "")}>
            {currentStep === 7 && (
               <div className="bg-primary-50 text-primary-700 p-5 rounded-lg border border-primary-100 animate-pulse">
                <h3 className="font-bold mb-2 flex items-center gap-2">
                  <Clock size={18} />
                  Estamos configurando tu asistente
                </h3>
                <p className="text-sm">
                  Normalmente tardamos <strong>24 horas</strong> en conectar tu cuenta y probar que todo funciona correctamente. Te notificaremos en tu panel cuando esté activo, y este paso se completará automáticamente.
                </p>
              </div>
            )}

            {currentStep < 7 && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-3 rounded border border-gray-100">
                Paso bloqueado. Completa los anteriores para solicitar la activación de tu asistente.
              </div>
            )}
            {currentStep > 7 && (
               <div className="mt-4 bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm flex gap-3 items-center border border-emerald-200">
                <CheckCircle size={20} className="text-emerald-600" />
                <span className="font-medium">¡Asistente activado y funcionando!</span>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {isCompleted && (
        <div className="mt-12 bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center shadow-sm ml-4 lg:ml-0">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-emerald-600 w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-emerald-900 mb-2">¡Todo Listo!</h3>
          <p className="text-emerald-800 mb-6 max-w-lg mx-auto text-sm sm:text-base">
            Has completado todos los pasos de configuración. Ahora Proplead está listo para atender y cualificar a tus leads automáticamente las 24 horas.
          </p>
          <Link to="/dashboard">
            <Button className="inline-flex items-center gap-2">
              Ir al Dashboard <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      )}

      {isCallModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-50/50">
              <div>
                <h3 className="font-bold text-gray-900 font-heading">Agenda tu onboarding</h3>
                <p className="text-xs text-gray-600 font-medium">Elige un hueco en el calendario.</p>
              </div>
              <button
                onClick={() => setIsCallModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-btn transition-colors"
                aria-label="Cerrar"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-72px)]">
              <CalEuInlineEmbed
                namespace="onboarding-proplead"
                calLink="propgroup/onboarding-proplead"
                minHeight={isDesktop ? 520 : 650}
              />
              <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-end">
                <Button variant="outline" onClick={() => setIsCallModalOpen(false)}>
                  Cerrar
                </Button>
                <Button onClick={handleConfirmCallScheduled} loading={saving}>
                  Ya la he reservado
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
