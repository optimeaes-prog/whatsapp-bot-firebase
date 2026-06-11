import { useState } from "react";
import { toast } from "sonner";
import { X, PhoneCall, MessageSquare, ArrowRight, CheckCircle2 } from "lucide-react";
import type { ActivityChannel, ActivityOutcome, LeadFollowUpStatus } from "../../types";
import { LEAD_FOLLOWUP_STATUSES, LEAD_FOLLOWUP_STATUS_LABELS } from "../../types";
import { addProspectActivity, setProspectNextAction } from "../../services/prospects";
import { addLeadActivity, setLeadNextAction, updateLead } from "../../services/leads";
import { cn } from "../../lib/utils";
import { LEAD_ACTIVITY_OUTCOMES, toDateTimeInputValue } from "../../lib/prospectMeta";
import { whatsappLink, type FollowUpItem } from "../../lib/followUp";
import { ContactLogForm } from "../ContactLogForm";
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
 * Registro rápido de seguimiento desde la página Seguimiento: funciona para
 * propietarios (Prospect) y compradores (Lead) sin abrir el detalle completo.
 * Pasa `key={target.id}` al montarlo para resetear el formulario por registro.
 */
export function QuickLogModal({
  target, readOnly, currentUid, currentName, onClose, onLogged, nextPending, onOpenNext,
}: Props) {
  const [logging, setLogging] = useState(false);
  const [justLogged, setJustLogged] = useState(false);
  const [followUpStatus, setFollowUpStatus] = useState<LeadFollowUpStatus | "">(
    target.kind === "lead" ? target.lead.followUpStatus || "" : ""
  );

  const entity = target.kind === "prospect" ? target.prospect : target.lead;
  const wa = whatsappLink(target.phone);

  async function handleSubmit(
    entry: { channel: ActivityChannel; outcome: ActivityOutcome; note?: string },
    nextDate: Date | null,
    reminderMinutes: number | null
  ) {
    if (readOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    setLogging(true);
    try {
      if (target.kind === "prospect") {
        await addProspectActivity(target.prospect.id, { ...entry, createdByUid: currentUid, createdByName: currentName });
        await setProspectNextAction(target.prospect.id, nextDate, reminderMinutes);
      } else {
        await addLeadActivity(target.lead.id, { ...entry, createdByUid: currentUid, createdByName: currentName });
        await setLeadNextAction(target.lead.id, nextDate, reminderMinutes);
        if (followUpStatus && followUpStatus !== target.lead.followUpStatus) {
          await updateLead(target.lead.id, { followUpStatus });
        }
      }
      toast.success("Seguimiento registrado");
      onLogged();
      if (nextPending && onOpenNext) setJustLogged(true);
      else onClose();
    } catch (e) {
      console.error("[QuickLog] error al registrar", e);
      toast.error("Error al registrar el seguimiento");
    } finally {
      setLogging(false);
    }
  }

  const extraFields = target.kind === "lead" ? (
    <div className="mt-3">
      <label className={labelClass}>Estado del comprador</label>
      <select
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        value={followUpStatus}
        onChange={(e) => setFollowUpStatus(e.target.value as LeadFollowUpStatus | "")}
        disabled={readOnly}
      >
        <option value="">Sin estado</option>
        {LEAD_FOLLOWUP_STATUSES.map((s) => (
          <option key={s} value={s}>{LEAD_FOLLOWUP_STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  ) : (
    <p className="mt-2 text-[11px] text-gray-400">
      El resultado puede mover la etapa automáticamente (p. ej. «Cita agendada» → Citado).
    </p>
  );

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
              <p className="font-semibold text-gray-800">Seguimiento registrado</p>
              {nextPending ? (
                <>
                  <p className="text-sm text-gray-500 mt-1">
                    Siguiente pendiente: <span className="font-semibold text-gray-700">{nextPending.name}</span>
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="secondary" onClick={onClose}>Cerrar</Button>
                    <Button onClick={() => onOpenNext?.(nextPending)}>
                      Registrar siguiente <ArrowRight size={15} />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mt-1">No quedan pendientes para hoy 🎉</p>
                  <Button variant="secondary" onClick={onClose} className="mt-4">Cerrar</Button>
                </>
              )}
            </div>
          ) : (
            <ContactLogForm
              key={target.id}
              disabled={readOnly}
              loading={logging}
              outcomes={target.kind === "lead" ? LEAD_ACTIVITY_OUTCOMES : undefined}
              initialNextDate={entity.nextActionDate ? toDateTimeInputValue(entity.nextActionDate.toMillis()) : ""}
              initialReminderMinutes={entity.reminderMinutesBefore ?? null}
              submitLabel="Registrar seguimiento"
              extraFields={extraFields}
              onSubmit={handleSubmit}
            />
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
