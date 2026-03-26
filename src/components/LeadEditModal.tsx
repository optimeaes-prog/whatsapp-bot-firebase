import React, { useState, useEffect } from "react";
import { X, Save, User, Tag, StickyNote, Hash, ListFilter, MessageSquare, ExternalLink } from "lucide-react";
import type { Lead, QualificationStatus, OperationType } from "../types";
import { updateLead } from "../services/leads";
import { updateConversation } from "../services/conversations";
import { formatPhone } from "../lib/utils";

interface LeadEditModalProps {
    lead: Lead;
    onClose: () => void;
    onUpdate: () => void;
    onViewConversation: (lead: Lead) => void;
}

export function LeadEditModal({ lead, onClose, onUpdate, onViewConversation }: LeadEditModalProps) {
    const [name, setName] = useState(lead.name || "");
    const [listingCode, setListingCode] = useState(lead.listingCode || "");
    const [operationType, setOperationType] = useState<OperationType>(lead.operationType || "Venta");
    const [status, setStatus] = useState<QualificationStatus>(lead.qualificationStatus || "not_qualified");
    const [notes, setNotes] = useState(lead.notes || "");
    const [tags, setTags] = useState<string[]>(lead.tags || []);
    const [newTag, setNewTag] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setName(lead.name || "");
        setListingCode(lead.listingCode || "");
        setOperationType(lead.operationType || "Venta");
        setStatus(lead.qualificationStatus || "not_qualified");
        setNotes(lead.notes || "");
        setTags(lead.tags || []);
    }, [lead]);

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
            const data = {
                name,
                listingCode,
                operationType,
                qualificationStatus: status,
                notes,
                tags
            };

            await updateLead(lead.id, data);

            // Also update conversation if it exists
            try {
                await updateConversation(lead.chatId, {
                    name,
                    listingCode,
                    qualified: status === "qualified" ? true : (status === "rejected" ? false : null),
                    notes,
                    tags
                });
            } catch (convError) {
                console.warn("Could not update conversation:", convError);
            }

            onUpdate();
            onClose();
        } catch (error) {
            console.error("Error updating lead:", error);
            alert("Error al actualizar el lead");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 text-primary-600 rounded-lg">
                            <User size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Editar Lead</h2>
                            <p className="text-sm text-gray-500">{formatPhone(lead.phone)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <User size={16} className="text-primary-500" />
                                Nombre completo
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nombre del cliente"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {/* Listing Code */}
                        <div className="space-y-2">
                            <label className="flex items-center justify-between text-sm font-semibold text-gray-700">
                                <span className="flex items-center gap-2">
                                    <Hash size={16} className="text-primary-500" />
                                    Código de anuncio
                                </span>
                                {listingCode && (
                                    <a
                                        href={`https://www.idealista.com/inmueble/${listingCode}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-600 hover:text-primary-700 flex items-center gap-1 text-xs font-medium"
                                        title="Ver en Idealista"
                                    >
                                        <ExternalLink size={12} />
                                        Ver anuncio
                                    </a>
                                )}
                            </label>
                            <input
                                type="text"
                                value={listingCode}
                                onChange={(e) => setListingCode(e.target.value)}
                                placeholder="Ej: 123456"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {/* Operation Type */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <ListFilter size={16} className="text-primary-500" />
                                Tipo de operación
                            </label>
                            <select
                                value={operationType}
                                onChange={(e) => setOperationType(e.target.value as OperationType)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                            >
                                <option value="Venta">Venta</option>
                                <option value="Alquiler">Alquiler</option>
                            </select>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <Tag size={16} className="text-primary-500" />
                                Estado de cualificación
                            </label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as QualificationStatus)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
                            >
                                <option value="not_qualified">No cualificado</option>
                                <option value="qualified">Cualificado</option>
                                <option value="rejected">Rechazado</option>
                            </select>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <Tag size={16} className="text-primary-500" />
                            Etiquetas
                        </label>
                        <div className="flex flex-wrap gap-2 min-h-[40px] p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                            {tags.length === 0 && <span className="text-gray-400 text-sm italic">Sin etiquetas</span>}
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-bold ring-1 ring-primary-200"
                                >
                                    {tag}
                                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary-900">
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                        </div>
                        <form onSubmit={handleAddTag} className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                placeholder="Nueva etiqueta..."
                                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            />
                            <button
                                type="submit"
                                disabled={!newTag.trim()}
                                className="px-4 py-2 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
                            >
                                Añadir
                            </button>
                        </form>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <StickyNote size={16} className="text-primary-500" />
                            Notas adicionales
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Añade información relevante sobre el lead..."
                            className="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none min-h-[120px] resize-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                    <button
                        onClick={() => onViewConversation(lead)}
                        className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-sm font-semibold border border-primary-200"
                    >
                        <MessageSquare size={18} />
                        Ver conversación
                    </button>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors text-sm font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all text-sm font-bold shadow-lg shadow-primary-200 disabled:opacity-50"
                        >
                            {saving ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Save size={18} />
                            )}
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
