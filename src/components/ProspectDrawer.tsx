import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X, Save, Phone, MessageSquare, Mail, MapPin, StickyNote, ExternalLink,
  Lightbulb, History, Trash2, PhoneCall, ImagePlus, Megaphone, Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { deleteObject, ref } from "firebase/storage";
import type {
  Prospect, ProspectStage, ProspectOperationType, ProspectPropertyType,
  ProspectSource, ProspectActivityChannel, ProspectActivityOutcome,
} from "../types";
import { PROSPECT_STAGES, PROSPECT_STAGE_LABELS } from "../types";
import {
  updateProspect, updateProspectStage, addProspectActivity,
  setProspectNextAction, getProspectById, deleteProspect,
} from "../services/prospects";
import type { SystemUser } from "../services/users";
import { uploadCaptacionPhoto } from "../services/storage";
import { storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { formatDate, cn } from "../lib/utils";
import {
  PROSPECT_STAGE_CLASSES, PROSPECT_OUTCOME_LABELS, PROSPECT_PROPERTY_TYPES,
  PROSPECT_OPERATION_TYPES, PROSPECT_SOURCES, PROSPECT_SOURCE_LABELS,
  formatShortDate, toDateTimeInputValue,
} from "../lib/prospectMeta";
import { Button } from "./ui";
import { ContactLogForm } from "./ContactLogForm";

const inputClass =
  "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all";
const labelClass = "block text-xs font-semibold text-gray-600 mb-1 font-heading uppercase tracking-wider";

const channelIcon: Record<ProspectActivityChannel, React.ReactNode> = {
  call: <Phone size={14} />,
  whatsapp: <MessageSquare size={14} />,
  email: <Mail size={14} />,
  visit: <MapPin size={14} />,
  note: <StickyNote size={14} />,
};

interface Props {
  prospect: Prospect;
  readOnly?: boolean;
  isManager: boolean;
  currentUid: string;
  currentName?: string;
  members: SystemUser[];
  onClose: () => void;
  /** Refresca la lista de la página tras cualquier cambio. */
  onChanged: () => void;
  /** Tras eliminar, cierra y refresca. */
  onDeleted: () => void;
}

export function ProspectDrawer({
  prospect, readOnly = false, isManager, currentUid, currentName, members, onClose, onChanged, onDeleted,
}: Props) {
  const [current, setCurrent] = useState<Prospect>(prospect);
  const { organizationId } = useAuth();

  // Detalles editables
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [operationType, setOperationType] = useState<ProspectOperationType>("Venta");
  const [propertyType, setPropertyType] = useState<ProspectPropertyType | "">("");
  const [source, setSource] = useState<ProspectSource | "">("");
  const [municipality, setMunicipality] = useState("");
  const [zone, setZone] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [m2, setM2] = useState("");
  const [rooms, setRooms] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [idealistaDescription, setIdealistaDescription] = useState("");
  const [referencia, setReferencia] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Registrar contacto (el formulario vive en ContactLogForm)
  const [logging, setLogging] = useState(false);

  // Aprendizajes
  const [learnings, setLearnings] = useState("");
  const [savingLearnings, setSavingLearnings] = useState(false);

  // Inicializa los campos cada vez que se abre otro prospecto.
  useEffect(() => {
    setCurrent(prospect);
    setOwnerName(prospect.ownerName || "");
    setPhone(prospect.phone || "");
    setOperationType(prospect.operationType || "Venta");
    setPropertyType(prospect.propertyType || "");
    setSource(prospect.source || "");
    setMunicipality(prospect.municipality || "");
    setZone(prospect.zone || "");
    setAddress(prospect.address || "");
    setPrice(prospect.price || "");
    setListingUrl(prospect.listingUrl || "");
    setEmail(prospect.email || "");
    setM2(prospect.m2 || "");
    setRooms(prospect.rooms || "");
    setStreet(prospect.street || "");
    setCity(prospect.city || "");
    setProvince(prospect.province || "");
    setPostalCode(prospect.postalCode || "");
    setCountry(prospect.country || "");
    setIdealistaDescription(prospect.idealistaDescription || "");
    setReferencia(prospect.referencia || "");
    setLearnings(prospect.learnings || "");
  }, [prospect]);

  function guard(): boolean {
    if (readOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return false;
    }
    return true;
  }

  async function refresh() {
    const fresh = await getProspectById(current.id);
    if (fresh) setCurrent(fresh);
    onChanged();
  }

  async function handleStageChange(stage: ProspectStage) {
    if (!guard()) return;
    setCurrent((p) => ({ ...p, stage })); // optimista
    try {
      await updateProspectStage(current.id, stage);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al cambiar la etapa");
    }
  }

  async function handleStillListed(value: boolean | undefined) {
    if (!guard()) return;
    try {
      await updateProspect(current.id, { stillListed: value });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    }
  }

  async function handleAssign(uid: string) {
    if (!guard()) return;
    const member = members.find((m) => m.uid === uid);
    try {
      await updateProspect(current.id, {
        assignedAgentUid: uid,
        assignedAgentName: member ? member.name || member.displayName || member.email : "",
      });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al asignar");
    }
  }

  async function handleSaveDetails() {
    if (!guard()) return;
    setSavingDetails(true);
    try {
      await updateProspect(current.id, {
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        operationType,
        propertyType: propertyType || undefined,
        source: source || undefined,
        municipality: municipality.trim(),
        zone: zone.trim(),
        address: address.trim(),
        price: price.trim(),
        m2: m2.trim(),
        rooms: rooms.trim(),
        street: street.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        idealistaDescription: idealistaDescription.trim(),
        referencia: referencia.trim(),
        listingUrl: listingUrl.trim(),
      });
      toast.success("Datos guardados");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar los datos");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleLogContact(
    entry: { channel: ProspectActivityChannel; outcome: ProspectActivityOutcome; note?: string },
    nextDate: Date | null,
    reminderMinutes: number | null
  ) {
    if (!guard()) return;
    setLogging(true);
    try {
      await addProspectActivity(current.id, {
        ...entry,
        createdByUid: currentUid,
        createdByName: currentName,
      });
      // La próxima acción y el recordatorio se guardan aparte (pueden limpiarse).
      await setProspectNextAction(current.id, nextDate, reminderMinutes);
      toast.success("Evento registrado");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar el contacto");
    } finally {
      setLogging(false);
    }
  }

  async function handleSaveLearnings() {
    if (!guard()) return;
    setSavingLearnings(true);
    try {
      await updateProspect(current.id, { learnings: learnings.trim() });
      toast.success("Aprendizajes guardados");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSavingLearnings(false);
    }
  }

  async function handleAddPhotos(files: FileList | null) {
    if (!guard()) return;
    if (!files || files.length === 0) return;
    if (!organizationId) { toast.error("No hay organización activa"); return; }
    setUploadingPhotos(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadCaptacionPhoto({ organizationId, captacionId: current.id, file }));
      }
      await updateProspect(current.id, { photos: [...(current.photos || []), ...urls] });
      toast.success(urls.length > 1 ? "Fotos añadidas" : "Foto añadida");
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al subir las fotos");
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function handleRemovePhoto(url: string) {
    if (!guard()) return;
    try {
      // Borrado best-effort del fichero en Storage (no es fatal si falla).
      try { await deleteObject(ref(storage, url)); } catch (err) { console.warn("[Captacion] no se pudo borrar la foto de Storage", err); }
      await updateProspect(current.id, { photos: (current.photos || []).filter((p) => p !== url) });
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Error al quitar la foto");
    }
  }

  async function handleDelete() {
    if (!guard()) return;
    if (!window.confirm("¿Eliminar esta captación? Esta acción no se puede deshacer.")) return;
    try {
      // Limpieza best-effort de las fotos en Storage antes de borrar el documento.
      for (const url of current.photos || []) {
        try { await deleteObject(ref(storage, url)); } catch (err) { console.warn("[Captacion] no se pudo borrar la foto", err); }
      }
      await deleteProspect(current.id);
      toast.success("Captación eliminada");
      onDeleted();
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar");
    }
  }

  const activities = [...(current.activities || [])].sort((a, b) => b.at.toMillis() - a.at.toMillis());
  const waLink = current.phone ? `https://wa.me/${current.phone.replace(/[^\d]/g, "")}` : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 font-heading truncate">
                {current.ownerName || "Sin nombre"}
              </h2>
              <p className="text-sm text-gray-500 truncate">
                {[current.municipality, current.zone].filter(Boolean).join(" · ") || "Sin ubicación"}
              </p>
            </div>
            <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 shrink-0" title="Cerrar">
              <X size={22} />
            </Button>
          </div>

          {/* Quick actions: llamar / WhatsApp */}
          {current.phone && (
            <div className="flex gap-2 mt-3">
              <a href={`tel:${current.phone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold transition-colors">
                <PhoneCall size={14} /> Llamar
              </a>
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-colors">
                  <MessageSquare size={14} /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 p-5 space-y-6">
          {current.wonListingId && (
            <Link
              to="/anuncios"
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              <Megaphone size={16} /> Esta captación ya tiene un anuncio publicado
            </Link>
          )}

          {/* Etapa + estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Etapa</label>
              <select
                className={cn(inputClass, "font-semibold", PROSPECT_STAGE_CLASSES[current.stage])}
                value={current.stage}
                onChange={(e) => handleStageChange(e.target.value as ProspectStage)}
              >
                {PROSPECT_STAGES.map((s) => (
                  <option key={s} value={s}>{PROSPECT_STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Sigue publicado</label>
              <select
                className={inputClass}
                value={current.stillListed === undefined ? "" : current.stillListed ? "yes" : "no"}
                onChange={(e) => handleStillListed(e.target.value === "" ? undefined : e.target.value === "yes")}
              >
                <option value="">Sin especificar</option>
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          {isManager && (
            <div>
              <label className={labelClass}>Agente asignado</label>
              <select className={inputClass} value={current.assignedAgentUid || ""} onChange={(e) => handleAssign(e.target.value)}>
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>{m.name || m.displayName || m.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* Registrar contacto */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 font-heading mb-3">
              <PhoneCall size={16} className="text-primary-600" /> Registrar evento
            </h3>
            <ContactLogForm
              key={current.id}
              disabled={readOnly}
              loading={logging}
              initialNextDate={current.nextActionDate ? toDateTimeInputValue(current.nextActionDate.toMillis()) : ""}
              initialReminderMinutes={current.reminderMinutesBefore ?? null}
              onSubmit={handleLogContact}
            />
          </section>

          {/* Historial */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 font-heading mb-3">
              <History size={16} className="text-gray-500" /> Historial
              {current.lastContactAt && (
                <span className="text-xs font-normal text-gray-400">
                  · último: {formatShortDate(current.lastContactAt.toMillis())}
                </span>
              )}
            </h3>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin contactos registrados todavía.</p>
            ) : (
              <ul className="space-y-2">
                {activities.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm border-l-2 border-gray-200 pl-3 py-0.5">
                    <span className="mt-0.5 text-gray-400 shrink-0">{channelIcon[a.channel]}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{PROSPECT_OUTCOME_LABELS[a.outcome]}</p>
                      {a.note && <p className="text-gray-600 break-words">{a.note}</p>}
                      <p className="text-[11px] text-gray-400">
                        {formatDate(a.at.toMillis())}{a.createdByName ? ` · ${a.createdByName}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Fotos */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 font-heading mb-3">
              <ImagePlus size={16} className="text-primary-600" /> Fotos
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(current.photos || []).map((url) => (
                <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {!readOnly && (
                    <button
                      onClick={() => handleRemovePhoto(url)}
                      className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Quitar foto"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <label className={cn(
                  "aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-primary-400 hover:text-primary-500 transition-colors",
                  uploadingPhotos && "opacity-50 pointer-events-none"
                )}>
                  {uploadingPhotos ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                  <span className="text-[10px] mt-1">{uploadingPhotos ? "Subiendo..." : "Añadir"}</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleAddPhotos(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </section>

          {/* Datos del inmueble */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900 font-heading">Datos del propietario e inmueble</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Nombre</label>
                <input className={inputClass} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Teléfono</label>
                <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Precio</label>
                <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>m²</label>
                <input className={inputClass} inputMode="numeric" value={m2} onChange={(e) => setM2(e.target.value.replace(/[^\d]/g, ""))} />
              </div>
              <div>
                <label className={labelClass}>Habitaciones</label>
                <input className={inputClass} inputMode="numeric" value={rooms} onChange={(e) => setRooms(e.target.value.replace(/[^\d]/g, ""))} />
              </div>
              <div>
                <label className={labelClass}>Operación</label>
                <select className={inputClass} value={operationType} onChange={(e) => setOperationType(e.target.value as ProspectOperationType)}>
                  {PROSPECT_OPERATION_TYPES.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo</label>
                <select className={inputClass} value={propertyType} onChange={(e) => setPropertyType(e.target.value as ProspectPropertyType | "")}>
                  <option value="">—</option>
                  {PROSPECT_PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Municipio</label>
                <input className={inputClass} value={municipality} onChange={(e) => setMunicipality(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Zona</label>
                <input className={inputClass} value={zone} onChange={(e) => setZone(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Dirección</label>
                <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Vía y número</label>
                <input className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Ciudad</label>
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Provincia</label>
                <input className={inputClass} value={province} onChange={(e) => setProvince(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Código postal</label>
                <input className={inputClass} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>País</label>
                <input className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Referencia interna</label>
                <input className={inputClass} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Origen</label>
                <select className={inputClass} value={source} onChange={(e) => setSource(e.target.value as ProspectSource | "")}>
                  <option value="">—</option>
                  {PROSPECT_SOURCES.map((s) => <option key={s} value={s}>{PROSPECT_SOURCE_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                {listingUrl && (
                  <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium pb-2">
                    <ExternalLink size={14} /> Ver anuncio
                  </a>
                )}
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Enlace al anuncio</label>
                <input className={inputClass} value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            {current.features && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{current.features}</p>
            )}
            <div>
              <label className={labelClass}>Descripción comercial</label>
              <textarea
                className={cn(inputClass, "min-h-[80px] resize-none")}
                value={idealistaDescription}
                onChange={(e) => setIdealistaDescription(e.target.value)}
                placeholder="Texto del anuncio (se podrá copiar al crear el Anuncio)"
              />
            </div>
            <Button onClick={handleSaveDetails} loading={savingDetails} disabled={readOnly} variant="outline" className="w-full">
              <Save size={16} /> Guardar datos
            </Button>
          </section>

          {/* Aprendizajes */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 font-heading mb-2">
              <Lightbulb size={16} className="text-amber-500" /> Aprendizajes
            </h3>
            <textarea
              className={cn(inputClass, "min-h-[80px] resize-none")}
              value={learnings}
              onChange={(e) => setLearnings(e.target.value)}
              placeholder="¿Qué ha funcionado o fallado? Lecciones para la próxima captación..."
            />
            <Button onClick={handleSaveLearnings} loading={savingLearnings} disabled={readOnly} variant="ghost" className="mt-2">
              Guardar aprendizajes
            </Button>
          </section>
        </div>

        {/* Footer */}
        {isManager && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
            <button onClick={handleDelete} disabled={readOnly} className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-40">
              <Trash2 size={16} /> Eliminar prospecto
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
