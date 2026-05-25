import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tag, StickyNote, Plus, X, Save } from "lucide-react";
import type { Lead, Conversation } from "../types";
import { updateLead, getLeadByChatId, getLeadByChatIdForAgent } from "../services/leads";
import { updateConversation } from "../services/conversations";
import { cn } from "../lib/utils";
import { customLeadTagMd } from "../lib/metricTheme";
import { Button } from "./ui";
import { useAuth } from "../contexts/AuthContext";

interface LeadDetailsProps {
    lead?: Lead;
    conversation?: Conversation;
    onUpdate?: () => void;
}

export function LeadDetails({ lead: initialLead, conversation: initialConversation, onUpdate }: LeadDetailsProps) {
    const { effectiveRole, effectiveUid, isImpersonationReadOnly } = useAuth();
    const [notes, setNotes] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [saving, setSaving] = useState(false);
    const [leadId, setLeadId] = useState<string | null>(initialLead?.id || null);
    const [chatId, setChatId] = useState<string | null>(initialLead?.chatId || initialConversation?.chatId || null);

    useEffect(() => {
        if (initialLead) {
            setNotes(initialLead.notes || "");
            setTags((initialLead.tags || []).filter((t) => t.toLowerCase() !== "lead"));
            setLeadId(initialLead.id);
            setChatId(initialLead.chatId);
        } else if (initialConversation) {
            setNotes(initialConversation.notes || "");
            setTags([]);
            setChatId(initialConversation.chatId);
            // Source of truth: tags belong to Lead.
            const loadLead = effectiveRole === "agent"
                ? getLeadByChatIdForAgent(initialConversation.chatId, effectiveUid)
                : getLeadByChatId(initialConversation.chatId);
            loadLead.then(l => {
                if (l) {
                    setLeadId(l.id);
                    setNotes(l.notes || initialConversation.notes || "");
                    setTags((l.tags || []).filter((t) => t.toLowerCase() !== "lead"));
                }
            });
        }
    }, [initialLead, initialConversation, effectiveRole, effectiveUid]);

    const handleAddTag = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (isImpersonationReadOnly) return;
        const candidate = newTag.trim();
        if (!candidate) return;
        if (candidate.toLowerCase() === "lead") {
            toast.error("El tag 'lead' ya no se usa en Leads");
            setNewTag("");
            return;
        }
        if (!tags.includes(candidate)) {
            setTags([...tags, candidate]);
            setNewTag("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        if (isImpersonationReadOnly) return;
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        if (isImpersonationReadOnly) {
            toast.message("Solo lectura en modo vista como usuario");
            return;
        }
        setSaving(true);
        try {
            const leadData = { notes, tags };

            const promises: Promise<any>[] = [];

            if (leadId) {
                promises.push(updateLead(leadId, leadData));
            }

            if (chatId) {
                // Keep notes mirrored in conversation for chat view.
                // Tags are lead-owned and should not depend on conversation storage.
                promises.push(updateConversation(chatId, { notes }));
            }

            if (!leadId && chatId) {
                const matchedLead = effectiveRole === "agent"
                    ? await getLeadByChatIdForAgent(chatId, effectiveUid)
                    : await getLeadByChatId(chatId);
                if (matchedLead) {
                    promises.push(updateLead(matchedLead.id, leadData));
                    setLeadId(matchedLead.id);
                }
            }

            if (promises.length === 0) {
                toast.error("No se encontró lead asociado para guardar tags");
                return;
            }

            await Promise.all(promises);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Error saving lead details:", error);
            toast.error("Error al guardar las notas/tags");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4 p-4 bg-white border-t border-gray-100">
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <StickyNote size={16} className="text-primary-600" />
                    Notas
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Añade notas sobre este lead..."
                    disabled={isImpersonationReadOnly}
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[80px] disabled:bg-gray-50 disabled:text-gray-500"
                />
            </div>

            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Tag size={16} className="text-primary-600" />
                    Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag) => (
                        <span
                            key={tag}
                            className={cn("inline-flex items-center gap-1", customLeadTagMd)}
                        >
                            {tag}
                            <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                disabled={isImpersonationReadOnly}
                                className="hover:text-primary-900 disabled:opacity-40 disabled:pointer-events-none"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
                <form onSubmit={handleAddTag} className="flex gap-2">
                    <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Nuevo tag..."
                        disabled={isImpersonationReadOnly}
                        className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"
                    />
                    <button
                        type="submit"
                        disabled={!newTag.trim() || isImpersonationReadOnly}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-btn transition-colors border border-primary-200 disabled:opacity-50"
                    >
                        <Plus size={18} />
                    </button>
                </form>
            </div>

            {initialLead?.consent && (
                <div className="space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">Consentimiento registrado</p>
                    <p className="text-xs text-emerald-700">
                        Fuente: {initialLead.consent.source} · Idioma: {initialLead.consent.language || "es"}
                    </p>
                    {initialLead.consent.proofUrl && (
                        <a
                            href={initialLead.consent.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-emerald-700 underline"
                        >
                            Ver prueba
                        </a>
                    )}
                </div>
            )}

            <div className="flex justify-end pt-2">
                <Button
                    type="button"
                    onClick={handleSave}
                    loading={saving}
                    disabled={isImpersonationReadOnly}
                    className="shadow-sm"
                >
                    {saving ? null : <Save size={16} />}
                    Guardar Cambios
                </Button>
            </div>
        </div>
    );
}
