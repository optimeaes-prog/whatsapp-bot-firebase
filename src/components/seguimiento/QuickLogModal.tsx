import { useState } from "react";
import { toast } from "sonner";
import { X, PhoneCall, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import type { LeadFollowUpStatus } from "../../types";
import { LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS } from "../../types";
import { updateLead } from "../../services/leads";
import { generateFollowUpMessage } from "../../services/conversations";
import { cn } from "../../lib/utils";
import { LEAD_ACTIVITY_OUTCOMES } from "../../lib/prospectMeta";
import { whatsappLink, type FollowUpItem } from "../../lib/followUp";
import { EventTaskPicker } from "../EventTaskPicker";
import { Button } from "../ui";
import { KindBadge } from "./KindBadge";

const labelClass = "block text-xs font-semibold text-gray-600 mb-1 font-heading uppercase tracking-wider";

interface Props {
  target: FollowUpItem;
  readOnly: boolean;
  currentUid: string;
  currentName?: string;
  onClose: () => void;
  /** Refresca las listas de la página tras registrar. */
  onLogged: () => void;
  /** Siguiente pendiente (vencido/hoy) para encadenar registros sin volver a la lista. */
  nextPending?: FollowUpItem | null;
  onOpenNext?: (item: FollowUpItem) => void;
}

/**
 * Registro rápido desde la página Seguimiento: funciona para propietarios (Prospect)
 * y compradores (Lead) sin abrir el detalle completo. Dos acciones bien separadas
 * (vía EventTaskPicker): "Crear evento" (algo que ya pasó) y "Crear tarea" (algo por hacer).
 * Pasa `key={target.id}` al montarlo para resetear el estado por registro.
 */
export function QuickLogModal({
  target, readOnly, currentUid, currentName, onClose, onLogged, nextPending, onOpenNext,
}: Props) {
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState<LeadFollowUpStatus | "">(
    target.kind === "lead" ? target.lead.followUpStatus || "" : ""
  );

  const id = target.kind === "prospect" ? target.prospect.id : target.lead.id;
  const wa = whatsappLink(target.phone);

  /** El estado del comprador se guarda al instante al cambiarlo (no va atado a una tarjeta). */
  async function handleStatusChange(value: LeadFollowUpStatus | "") {
    setFollowUpStatus(value);
    if (readOnly || target.kind !== "lead") return;
    if (!value || value === (target.lead.followUpStatus || "")) return;
    try {
      await updateLead(target.lead.id, { followUpStatus: value });
      onLogged();
    } catch (e) {
      console.error("[QuickLog] update status", e);
      toast.error("No se pudo actualizar el estado");
    }
  }

  /** Pide a la IA un borrador de mensaje de seguimiento con el contexto del contacto. */
  async function handleGenerateMessage(channel: "message" | "email", note: string): Promise<string> {
    try {
      const todayLabel = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
      if (target.kind === "prospect") {
        const p = target.prospect;
        const property = [
          p.propertyType,
          p.address || [p.zone, p.municipality].filter(Boolean).join(" "),
          p.price,
          p.m2 ? `${p.m2} m²` : undefined,
          p.rooms ? `${p.rooms} hab.` : undefined,
        ].filter(Boolean).join(", ");
        const recentNotes = (p.activities || [])
          .map((a) => a.note?.trim())
          .filter((n): n is string => !!n)
          .slice(-8);
        return await generateFollowUpMessage({
          channel, name: p.ownerName, operationType: p.operationType,
          property: property || undefined, note: note.trim() || undefined, recentNotes, todayLabel,
        });
      }
      const l = target.lead;
      const recentNotes = [
        l.conversationSummary?.trim(),
        ...(l.activities || []).map((a) => a.note?.trim()),
      ].filter((n): n is string => !!n).slice(-8);
      return await generateFollowUpMessage({
        channel, name: l.name, operationType: l.operationType,
        note: note.trim() || undefined, recentNotes, todayLabel,
      });
    } catch (e) {
      console.error("[QuickLog] generar mensaje", e);
      toast.error("No se pudo generar el mensaje");
      throw e;
    }
  }

  const leadStatusSelect = target.kind === "lead" ? (
    <div className="mb-4">
      <label className={labelClass}>Estado del comprador</label>
      <select
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        value={followUpStatus}
        onChange={(e) => handleStatusChange(e.target.value as LeadFollowUpStatus | "")}
        disabled={readOnly}
      >
        <option value="">Sin estado</option>
        {LEAD_FOLLOWUP_STATUSES.map((s) => (
          <option key={s} value={s}>{LEAD_FOLLOWUP_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: quién es + contacto directo */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <KindBadge kind={target.kind} />
              <h2 className="text-lg font-bold text-gray-900 font-heading truncate mt-1.5">{target.name}</h2>
            </div>
            <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600 shrink-0" title="Cerrar">
              <X size={22} />
            </Button>
          </div>
          {target.phone && (
            <div className="flex gap-2 mt-2.5">
              <a
                href={`tel:${target.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-primary-500 hover:bg-primary-600 text-white text-xs font-bold transition-colors"
              >
                <PhoneCall size={14} /> Llamar
              </a>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-colors"
                >
                  <MessageSquare size={14} /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {justLogged ? (
            <div className="text-center py-6">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <p className="font-semibold text-gray-800">{justLogged}</p>
              {nextPending && onOpenNext ? (
                <>
                  <p className="text-sm text-gray-500 mt-1">
                    Siguiente pendiente: <span className="font-semibold text-gray-700">{nextPending.name}</span>
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <Button onClick={() => onOpenNext(nextPending)}>
                      Registrar siguiente <ArrowRight size={15} />
                    </Button>
                    <Button variant="secondary" onClick={() => setJustLogged(null)}>Añadir otra cosa</Button>
                    <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mt-1">¿Algo más para este contacto?</p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <Button variant="secondary" onClick={() => setJustLogged(null)}>Añadir otra cosa</Button>
                    <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {leadStatusSelect}
              <EventTaskPicker
                kind={target.kind}
                id={id}
                readOnly={readOnly}
                currentUid={currentUid}
                currentName={currentName}
                outcomes={target.kind === "lead" ? LEAD_ACTIVITY_OUTCOMES : undefined}
                onGenerateMessage={handleGenerateMessage}
                onLogged={(what) => {
                  onLogged();
                  setJustLogged(what === "evento" ? "Evento registrado" : "Tarea creada");
                }}
                eventExtraFields={
                  target.kind === "prospect" ? (
                    <p className="mt-2 text-[11px] text-gray-400">
                      El resultado puede mover la etapa automáticamente (p. ej. «Cita agendada» → Citado).
                    </p>
                  ) : undefined
                }
              />
            </>
          )}
        </div>

        {/* Estado/etapa actual como contexto, sin abrir el detalle */}
        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", target.statusClasses)}>
            {target.statusLabel}
          </span>
          <span className="text-[11px] text-gray-400">
            {target.kind === "prospect" ? "Captación" : "Lead comprador"}
          </span>
        </div>
      </div>
    </div>
  );
}
