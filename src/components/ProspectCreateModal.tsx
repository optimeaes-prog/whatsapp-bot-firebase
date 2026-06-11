import { useState } from "react";
import { toast } from "sonner";
import { X, Target, AlertTriangle } from "lucide-react";
import type { Prospect, ProspectFormData, ProspectOperationType, ProspectPropertyType, ProspectSource } from "../types";
import { createProspect, findCaptacionByPhoneOrEmail } from "../services/prospects";
import type { SystemUser } from "../services/users";
import {
  PROSPECT_OPERATION_TYPES,
  PROSPECT_PROPERTY_TYPES,
  PROSPECT_SOURCES,
  PROSPECT_SOURCE_LABELS,
} from "../lib/prospectMeta";
import { formatPhoneWhatsApp } from "../lib/utils";
import { Button } from "./ui";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 font-heading uppercase tracking-wider";

interface Props {
  readOnly?: boolean;
  isManager: boolean;
  currentUid: string;
  members: SystemUser[];
  onClose: () => void;
  onCreated: () => void;
  /** Si el aviso anti-duplicados encuentra una captación existente, abrirla en vez de crear otra. */
  onOpenExisting?: (p: Prospect) => void;
}

export function ProspectCreateModal({ readOnly = false, isManager, currentUid, members, onClose, onCreated, onOpenExisting }: Props) {
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [operationType, setOperationType] = useState<ProspectOperationType>("Venta");
  const [propertyType, setPropertyType] = useState<ProspectPropertyType | "">("");
  const [municipality, setMunicipality] = useState("");
  const [zone, setZone] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [m2, setM2] = useState("");
  const [rooms, setRooms] = useState("");
  const [referencia, setReferencia] = useState("");
  const [idealistaDescription, setIdealistaDescription] = useState("");
  const [source, setSource] = useState<ProspectSource | "">("");
  const [listingUrl, setListingUrl] = useState("");
  const [features, setFeatures] = useState("");
  const [assignedAgentUid, setAssignedAgentUid] = useState(isManager ? "" : currentUid);
  const [saving, setSaving] = useState(false);

  // Aviso anti-duplicados (por teléfono/email): al cambiar el teléfono/email se limpia.
  const [duplicates, setDuplicates] = useState<Prospect[]>([]);
  const [checkingDup, setCheckingDup] = useState(false);
  function onPhoneChange(v: string) { setPhone(v); if (duplicates.length) setDuplicates([]); }
  function onEmailChange(v: string) { setEmail(v); if (duplicates.length) setDuplicates([]); }

  async function handleSave(force = false) {
    if (readOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    if (!ownerName.trim() && !phone.trim() && !email.trim() && !listingUrl.trim()) {
      toast.error("Añade al menos un nombre, teléfono, email o enlace al anuncio");
      return;
    }

    // Aviso anti-duplicados: si el teléfono/email ya existe, parar y dejar decidir al usuario.
    if (!force && (phone.trim() || email.trim())) {
      setCheckingDup(true);
      try {
        const found = await findCaptacionByPhoneOrEmail({
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          agentUid: isManager ? undefined : currentUid,
        });
        if (found.length > 0) {
          setDuplicates(found);
          return; // espera la decisión del usuario
        }
      } catch (e) {
        console.error("[Captacion] dedup check failed", e);
        // Si el chequeo falla, no bloqueamos la creación.
      } finally {
        setCheckingDup(false);
      }
    }

    setSaving(true);
    try {
      const data: ProspectFormData & { createdByUid: string } = {
        stage: "por_llamar",
        operationType,
        propertyType: propertyType || undefined,
        source: source || undefined,
        ownerName: ownerName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        listingUrl: listingUrl.trim() || undefined,
        address: address.trim() || undefined,
        municipality: municipality.trim() || undefined,
        zone: zone.trim() || undefined,
        price: price.trim() || undefined,
        m2: m2.trim() || undefined,
        rooms: rooms.trim() || undefined,
        referencia: referencia.trim() || undefined,
        idealistaDescription: idealistaDescription.trim() || undefined,
        features: features.trim() || undefined,
        createdByUid: currentUid,
        assignedAgentUid: assignedAgentUid || undefined,
      };
      await createProspect(data);
      toast.success("Captación creada");
      onCreated();
      onClose();
    } catch (error) {
      console.error("Error creating captación:", error);
      toast.error("Error al crear la captación");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
              <Target size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-heading">Nueva captación</h2>
              <p className="text-sm text-gray-500">Inmueble y propietario</p>
            </div>
          </div>
          <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600" title="Cerrar">
            <X size={22} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle size={16} /> Ya existe una captación con este teléfono o email
              </p>
              <ul className="mt-2 space-y-1.5">
                {duplicates.slice(0, 3).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-gray-700">
                      {d.ownerName || "Sin nombre"}{d.phone ? ` · ${formatPhoneWhatsApp(d.phone)}` : ""}
                    </span>
                    {onOpenExisting && (
                      <button
                        type="button"
                        onClick={() => onOpenExisting(d)}
                        className="shrink-0 text-xs font-semibold text-primary-600 hover:text-primary-700"
                      >
                        Abrir existente
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="mt-2 text-xs font-semibold text-amber-800 underline hover:text-amber-900"
              >
                Crear de todas formas
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre del propietario</label>
              <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Ej: María García" />
            </div>
            <div>
              <label className={labelClass}>Teléfono</label>
              <input className={inputClass} value={phone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="+34 600 000 000" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} placeholder="propietario@email.com" />
            </div>
            <div>
              <label className={labelClass}>Operación</label>
              <select className={inputClass} value={operationType} onChange={(e) => setOperationType(e.target.value as ProspectOperationType)}>
                {PROSPECT_OPERATION_TYPES.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Tipo de inmueble</label>
              <select className={inputClass} value={propertyType} onChange={(e) => setPropertyType(e.target.value as ProspectPropertyType | "")}>
                <option value="">Sin especificar</option>
                {PROSPECT_PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Municipio</label>
              <input className={inputClass} value={municipality} onChange={(e) => setMunicipality(e.target.value)} placeholder="Ej: Málaga" />
            </div>
            <div>
              <label className={labelClass}>Zona</label>
              <input className={inputClass} value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ej: Centro" />
            </div>
            <div>
              <label className={labelClass}>Dirección</label>
              <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle y número" />
            </div>
            <div>
              <label className={labelClass}>Precio</label>
              <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ej: 200.000 €" />
            </div>
            <div>
              <label className={labelClass}>m²</label>
              <input className={inputClass} inputMode="numeric" value={m2} onChange={(e) => setM2(e.target.value.replace(/[^\d]/g, ""))} placeholder="Ej: 90" />
            </div>
            <div>
              <label className={labelClass}>Habitaciones</label>
              <input className={inputClass} inputMode="numeric" value={rooms} onChange={(e) => setRooms(e.target.value.replace(/[^\d]/g, ""))} placeholder="Ej: 3" />
            </div>
            <div>
              <label className={labelClass}>Referencia interna</label>
              <input className={inputClass} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ref. CRM (opcional)" />
            </div>
            <div>
              <label className={labelClass}>Origen del anuncio</label>
              <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as ProspectSource | "")}>
                <option value="">Sin especificar</option>
                {PROSPECT_SOURCES.map((s) => (
                  <option key={s} value={s}>{PROSPECT_SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Enlace al anuncio</label>
              <input className={inputClass} value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="https://..." />
            </div>
            {isManager && (
              <div className="sm:col-span-2">
                <label className={labelClass}>Asignar a agente</label>
                <select className={inputClass} value={assignedAgentUid} onChange={(e) => setAssignedAgentUid(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.uid} value={m.uid}>{m.name || m.displayName || m.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>Características / detalles</label>
            <textarea
              className={`${inputClass} min-h-[90px] resize-none`}
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              placeholder="Ej: 3 dormitorios, 90 m², 2ª planta con ascensor, terraza..."
            />
          </div>
          <div>
            <label className={labelClass}>Descripción comercial</label>
            <textarea
              className={`${inputClass} min-h-[90px] resize-none`}
              value={idealistaDescription}
              onChange={(e) => setIdealistaDescription(e.target.value)}
              placeholder="Texto del anuncio (se podrá copiar al crear el Anuncio)"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <Button onClick={onClose} variant="secondary">Cancelar</Button>
          <Button onClick={() => handleSave()} loading={saving || checkingDup} disabled={readOnly} className="px-8">Crear captación</Button>
        </div>
      </div>
    </div>
  );
}
