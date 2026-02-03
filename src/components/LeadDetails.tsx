import React, { useState, useEffect } from "react";
import { Tag, StickyNote, Plus, X, Save } from "lucide-react";
import type { Lead, Conversation } from "../types";
import { updateLead, getLeadByChatId } from "../services/leads";
import { updateConversation } from "../services/conversations";

interface LeadDetailsProps {
    lead?: Lead;
    conversation?: Conversation;
    onUpdate?: () => void;
}

export function LeadDetails({ lead: initialLead, conversation: initialConversation, onUpdate }: LeadDetailsProps) {
    const [notes, setNotes] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [saving, setSaving] = useState(false);
    const [leadId, setLeadId] = useState<string | null>(initialLead?.id || null);
    const [chatId, setChatId] = useState<string | null>(initialLead?.chatId || initialConversation?.chatId || null);

    useEffect(() => {
        if (initialLead) {
            setNotes(initialLead.notes || "");
            setTags(initialLead.tags || []);
            setLeadId(initialLead.id);
            setChatId(initialLead.chatId);
        } else if (initialConversation) {
            setNotes(initialConversation.notes || "");
            setTags(initialConversation.tags || []);
            setChatId(initialConversation.chatId);
            // Try to find lead to get leadId
            getLeadByChatId(initialConversation.chatId).then(l => {
                if (l) setLeadId(l.id);
            });
        }
    }, [initialLead, initialConversation]);

    const handleAddTag = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = { notes, tags };

            const promises: Promise<any>[] = [];

            if (leadId) {
                promises.push(updateLead(leadId, data));
            }

            if (chatId) {
                promises.push(updateConversation(chatId, data));
            }

            await Promise.all(promises);
            if (onUpdate) onUpdate();
        } catch (error) {
            console.error("Error saving lead details:", error);
            alert("Error al guardar las notas/tags");
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
                    className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[80px]"
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-xs font-medium"
                        >
                            {tag}
                            <button
                                onClick={() => handleRemoveTag(tag)}
                                className="hover:text-primary-900"
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
                        className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={!newTag.trim()}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200 disabled:opacity-50"
                    >
                        <Plus size={18} />
                    </button>
                </form>
            </div>

            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                >
                    {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
}
