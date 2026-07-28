import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CollabMessage, CollabTargetType } from "../types";
import { getOrgMembers, type SystemUser } from "../services/users";
import { sendCollabMessage, subscribeTargetThread, markCollabRead } from "../services/collab";
import { useAuth } from "../contexts/AuthContext";
import { cn, formatDate } from "../lib/utils";

interface Props {
  targetType: CollabTargetType;
  targetId: string;
  targetName: string;
  targetSubtitle?: string;
  targetStage?: string;
  readOnly?: boolean;
}

/** Nombre legible de un compañero. */
function memberLabel(m: SystemUser): string {
  return m.displayName || m.name || m.email || m.uid;
}

/**
 * Hilo de colaboración + redactor, reutilizable en el modal de captación y en el de lead.
 * Se basta solo: obtiene el usuario actual y los compañeros por su cuenta, se suscribe al
 * hilo del target en tiempo real y marca como leídos los mensajes dirigidos a mí.
 */
export function CollabThread({
  targetType, targetId, targetName, targetSubtitle, targetStage, readOnly = false,
}: Props) {
  const { organizationId, effectiveUid, isImpersonationReadOnly } = useAuth();
  const disabled = readOnly || isImpersonationReadOnly;

  const [members, setMembers] = useState<SystemUser[]>([]);
  const [messages, setMessages] = useState<CollabMessage[]>([]);
  const [recipientUid, setRecipientUid] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  // Compañeros de la organización (para el selector de destinatario).
  useEffect(() => {
    if (!organizationId) return;
    getOrgMembers(organizationId)
      .then(setMembers)
      .catch((err) => console.error("[Collab] members error", err));
  }, [organizationId]);

  // Suscripción al hilo del target en tiempo real.
  useEffect(() => {
    if (!targetId) return;
    const unsub = subscribeTargetThread(
      targetType,
      targetId,
      setMessages,
      (err) => console.error("[Collab] thread error", err)
    );
    return () => unsub();
  }, [targetType, targetId]);

  // El usuario actual, resuelto contra la lista de compañeros (nombre canónico).
  const me = useMemo(
    () => members.find((m) => m.uid === effectiveUid),
    [members, effectiveUid]
  );
  const myName = me ? memberLabel(me) : "Yo";
  const otherMembers = useMemo(
    () => members.filter((m) => m.uid !== effectiveUid),
    [members, effectiveUid]
  );

  // Marca como leídos los mensajes que me han enviado en este hilo.
  useEffect(() => {
    const unread = messages
      .filter((m) => m.recipientUid === effectiveUid && !m.readAt)
      .map((m) => m.id);
    if (unread.length > 0) {
      markCollabRead(unread).catch((err) => console.error("[Collab] markRead error", err));
    }
  }, [messages, effectiveUid]);

  // Destinatario por defecto: la otra parte del último mensaje (responder es natural),
  // o el primer compañero disponible.
  useEffect(() => {
    if (recipientUid || otherMembers.length === 0) return;
    const last = messages[messages.length - 1];
    let preset = "";
    if (last) {
      const other = last.authorUid === effectiveUid ? last.recipientUid : last.authorUid;
      if (other && other !== effectiveUid && otherMembers.some((m) => m.uid === other)) {
        preset = other;
      }
    }
    setRecipientUid(preset || otherMembers[0].uid);
  }, [messages, otherMembers, recipientUid, effectiveUid]);

  // Autoscroll al final cuando llegan mensajes nuevos.
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function handleSend() {
    const text = body.trim();
    if (!text || !recipientUid || sending) return;
    const recipient = members.find((m) => m.uid === recipientUid);
    setSending(true);
    try {
      await sendCollabMessage({
        targetType,
        targetId,
        targetName,
        targetSubtitle,
        targetStage,
        recipientUid,
        recipientName: recipient ? memberLabel(recipient) : undefined,
        authorUid: effectiveUid,
        authorName: myName,
        body: text,
      });
      setBody("");
    } catch (err) {
      console.error("[Collab] send error", err);
      toast.error("No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Shift+Enter hace salto de línea.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-3">
      {/* Hilo de mensajes */}
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            Aún no hay mensajes. Etiqueta a un compañero para pedir ayuda o dejar un recado.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.authorUid === effectiveUid;
            return (
              <div key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "bg-primary-500 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </div>
                <span className="text-[11px] text-gray-400 mt-0.5 px-1">
                  {mine
                    ? `Tú → ${m.recipientName || "compañero"}`
                    : `${m.authorName || "compañero"} → tú`}
                  {" · "}
                  {formatDate(m.createdAt.toMillis())}
                </span>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {/* Redactor */}
      {!disabled && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600 shrink-0">Para</label>
            <select
              value={recipientUid}
              onChange={(e) => setRecipientUid(e.target.value)}
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              {otherMembers.length === 0 ? (
                <option value="">No hay compañeros en tu equipo</option>
              ) : (
                otherMembers.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {memberLabel(m)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Escribe un mensaje para tu compañero…"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!body.trim() || !recipientUid || sending}
              className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Enviar mensaje"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
