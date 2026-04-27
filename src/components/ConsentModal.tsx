import { useState } from "react";
import { XCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "../types";
import { Button } from "./ui";
import { setLeadConsent } from "../services/leads";
import { uploadConsentProof } from "../services/storage";

type Props = {
  lead: Lead;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
};

type ConsentSource = "idealista_form" | "agency_website" | "phone_call" | "in_person" | "inbound_whatsapp";

const CONSENT_SOURCES: Array<{ value: ConsentSource; label: string }> = [
  { value: "agency_website", label: "Web de la agencia" },
  { value: "idealista_form", label: "Formulario Idealista" },
  { value: "phone_call", label: "Llamada telefonica" },
  { value: "in_person", label: "En persona" },
  { value: "inbound_whatsapp", label: "Mensaje entrante WhatsApp" },
];

export function ConsentModal({ lead, organizationId, onClose, onSaved }: Props) {
  const [source, setSource] = useState<ConsentSource>("agency_website");
  const [language, setLanguage] = useState<"es" | "en">("es");
  const [proofUrl, setProofUrl] = useState("");
  const [capturedAt, setCapturedAt] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit() {
    try {
      setSaving(true);
      let resolvedProofUrl = proofUrl.trim();
      if (file) {
        resolvedProofUrl = await uploadConsentProof({
          organizationId,
          leadId: lead.id,
          file,
        });
      }
      await setLeadConsent({
        leadId: lead.id,
        source,
        language,
        proofUrl: resolvedProofUrl || undefined,
        capturedAtMs: new Date(capturedAt).getTime(),
      });
      toast.success("Consentimiento guardado");
      onSaved();
      onClose();
    } catch (error) {
      console.error("set consent error:", error);
      toast.error("No se pudo guardar el consentimiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Registrar consentimiento</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-btn">
            <XCircle size={20} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Fuente</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-btn"
            >
              {CONSENT_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as "es" | "en")}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-btn"
              >
                <option value="es">Espanol</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha/hora</label>
              <input
                type="datetime-local"
                value={capturedAt}
                onChange={(e) => setCapturedAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-btn"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">URL de prueba (opcional)</label>
            <input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-btn"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Subir prueba (opcional)</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-btn cursor-pointer hover:bg-gray-50">
              <Upload size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700 truncate">{file ? file.name : "Seleccionar archivo"}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>
        <div className="p-4 bg-gray-50 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="flex-1" loading={saving} onClick={onSubmit}>Guardar consentimiento</Button>
        </div>
      </div>
    </div>
  );
}
