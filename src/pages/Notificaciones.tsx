import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Loader2 } from "lucide-react";
import type { CollabMessage, Prospect, Lead } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useCollab } from "../contexts/CollabContext";
import { getOrgMembers, type SystemUser } from "../services/users";
import { getProspectById } from "../services/prospects";
import { getLeadById } from "../services/leads";
import { PageHeader, PageLoading } from "../components/ui";
import { ProspectDrawer } from "../components/ProspectDrawer";
import { LeadEditModal } from "../components/LeadEditModal";
import { cn, formatDate } from "../lib/utils";

/** Un hilo = todos los mensajes de un mismo target, con su último mensaje y nº de no leídos. */
type Thread = {
  key: string;
  targetType: CollabMessage["targetType"];
  targetId: string;
  targetName: string;
  targetSubtitle?: string;
  targetStage?: string;
  last: CollabMessage;
  unread: number;
  lastAtMs: number;
};

export function Notificaciones() {
  const { user, organizationId, effectiveRole, effectiveUid, isImpersonationReadOnly } = useAuth();
  const isManager = effectiveRole === "owner" || effectiveRole === "admin" || effectiveRole === "super_admin";
  const { myMessages } = useCollab();

  const [members, setMembers] = useState<SystemUser[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Compañeros (para los props del modal de captación).
  useEffect(() => {
    if (!organizationId) return;
    getOrgMembers(organizationId).then(setMembers).catch((e) => console.error("[Notificaciones] members", e));
  }, [organizationId]);

  // Agrupa mis mensajes por target en hilos (myMessages ya viene ordenado de más nuevo a más viejo).
  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>();
    for (const m of myMessages) {
      const key = `${m.targetType}:${m.targetId}`;
      const isUnreadForMe = m.recipientUid === effectiveUid && !m.readAt;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          targetType: m.targetType,
          targetId: m.targetId,
          targetName: m.targetName,
          targetSubtitle: m.targetSubtitle,
          targetStage: m.targetStage,
          last: m, // el primero que vemos es el más reciente
          unread: isUnreadForMe ? 1 : 0,
          lastAtMs: m.createdAt.toMillis(),
        });
      } else if (isUnreadForMe) {
        existing.unread += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastAtMs - a.lastAtMs);
  }, [myMessages, effectiveUid]);

  async function openThread(t: Thread) {
    if (opening) return;
    setOpening(t.key);
    try {
      if (t.targetType === "prospect") {
        const p = await getProspectById(t.targetId);
        if (!p) {
          toast.error("La captación ya no existe");
          return;
        }
        setSelectedProspect(p);
      } else {
        const l = await getLeadById(t.targetId);
        if (!l) {
          toast.error("El lead ya no existe");
          return;
        }
        setSelectedLead(l);
      }
    } catch (e) {
      console.error("[Notificaciones] open", e);
      toast.error("No se pudo abrir");
    } finally {
      setOpening(null);
    }
  }

  if (!effectiveRole) return <PageLoading message="Cargando notificaciones..." />;

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title="Notificaciones"
          subtitle={`Mensajes de tu equipo · ${threads.length} ${threads.length === 1 ? "conversación" : "conversaciones"}`}
          icon={<Bell size={22} />}
        />
      </div>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 text-gray-400">
          <Bell size={40} className="mb-3 text-gray-300" />
          <p className="text-sm font-medium">No tienes notificaciones</p>
          <p className="text-xs mt-1">
            Cuando un compañero te etiquete en una captación o lead, aparecerá aquí.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => {
            const mine = t.last.authorUid === effectiveUid;
            const preview = `${mine ? "Tú" : t.last.authorName || "Compañero"}: ${t.last.body}`;
            const isUnread = t.unread > 0;
            return (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => openThread(t)}
                  disabled={opening === t.key}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-4 rounded-xl border transition-colors",
                    isUnread
                      ? "bg-primary-50/60 border-primary-200 hover:bg-primary-50"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {/* Punto de no leído */}
                  <span className="mt-1.5 shrink-0">
                    {isUnread ? (
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    ) : (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-transparent" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("text-sm truncate", isUnread ? "font-bold text-gray-900" : "font-semibold text-gray-800")}>
                        {t.targetName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {t.targetType === "prospect" ? "Captación" : "Lead"}
                      </span>
                      {t.targetSubtitle && <span className="text-xs text-gray-400">· {t.targetSubtitle}</span>}
                      {t.targetStage && <span className="text-xs text-gray-400">· {t.targetStage}</span>}
                    </div>
                    <p className={cn("text-sm truncate mt-0.5", isUnread ? "text-gray-700" : "text-gray-500")}>
                      {preview}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(t.lastAtMs)}</p>
                  </div>

                  {opening === t.key ? (
                    <Loader2 size={16} className="animate-spin text-gray-400 mt-1 shrink-0" />
                  ) : isUnread ? (
                    <span className="shrink-0 mt-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold">
                      {t.unread > 99 ? "99+" : t.unread}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedProspect && (
        <ProspectDrawer
          prospect={selectedProspect}
          context="seguimiento"
          readOnly={isImpersonationReadOnly}
          isManager={isManager}
          currentUid={effectiveUid}
          currentName={user?.displayName || user?.email || undefined}
          members={members}
          openCollab
          onClose={() => setSelectedProspect(null)}
          onChanged={() => { /* la lista se refresca sola por la suscripción de colaboración */ }}
          onDeleted={() => setSelectedProspect(null)}
        />
      )}

      {selectedLead && (
        <LeadEditModal
          lead={selectedLead}
          readOnly={isImpersonationReadOnly}
          openCollab
          onClose={() => setSelectedLead(null)}
          onUpdate={() => { /* sin recarga: la suscripción mantiene el hilo al día */ }}
          onViewConversation={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}
