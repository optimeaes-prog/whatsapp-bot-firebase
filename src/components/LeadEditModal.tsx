import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Save, User, Tag, StickyNote, Hash, ListFilter, MessageSquare, ExternalLink, ChevronDown, CheckSquare, Square } from "lucide-react";
import type { Lead, QualificationStatus, OperationType } from "../types";
import { updateLead } from "../services/leads";
import { updateConversation } from "../services/conversations";
import { formatPhone, cn } from "../lib/utils";
import { Button } from "./ui";

interface LeadEditModalProps {
    lead: Lead;
    readOnly?: boolean;
    onClose: () => void;
    onUpdate: () => void;
    onViewConversation: (lead: Lead) => void;
}

export function LeadEditModal({ lead, readOnly = false, onClose, onUpdate, onViewConversation }: LeadEditModalProps) {
    const [name, setName] = useState(lead.name || "");
    const [listingCode, setListingCode] = useState(lead.listingCode || "");
    const [operationType, setOperationType] = useState<OperationType>(lead.operationType || "Venta");
    const [status, setStatus] = useState<QualificationStatus>(lead.qualificationStatus || "not_qualified");
    const [pets, setPets] = useState<boolean | undefined>(lead.pets);
    const [income, setIncome] = useState<number | "">(lead.income ?? "");
    const [paymentMethod, setPaymentMethod] = useState<"Contado" | "Hipoteca" | "">(lead.paymentMethod ?? "");
    const [notes, setNotes] = useState(lead.notes || "");
    const [tags, setTags] = useState<string[]>((lead.tags || []).filter((t) => t.toLowerCase() !== "lead"));
    const [newTag, setNewTag] = useState("");
    const [saving, setSaving] = useState(false);

    const [isOperationTypeDropdownOpen, setIsOperationTypeDropdownOpen] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const [isPetsDropdownOpen, setIsPetsDropdownOpen] = useState(false);
    const [isPaymentMethodDropdownOpen, setIsPaymentMethodDropdownOpen] = useState(false);

    useEffect(() => {
        setName(lead.name || "");
        setListingCode(lead.listingCode || "");
        setOperationType(lead.operationType || "Venta");
        setStatus(lead.qualificationStatus || "not_qualified");
        setPets(lead.pets);
        setIncome(lead.income ?? "");
        setPaymentMethod(lead.paymentMethod ?? "");
        setNotes(lead.notes || "");
        setTags((lead.tags || []).filter((t) => t.toLowerCase() !== "lead"));
    }, [lead]);

    const handleAddTag = (e?: React.FormEvent) => {
        e?.preventDefault();
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
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSave = async () => {
        if (readOnly) {
            toast.message("Solo lectura en modo vista como usuario");
            return;
        }
        setSaving(true);
        try {
            const data = {
                name,
                listingCode,
                operationType,
                qualificationStatus: status,
                pets: pets !== undefined ? pets : undefined,
                income: income !== "" ? Number(income) : undefined,
                paymentMethod: paymentMethod !== "" ? (paymentMethod as "Contado" | "Hipoteca") : undefined,
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
            toast.error("Error al actualizar el lead");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
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
                    <Button
                        onClick={onClose}
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        title="Cerrar"
                    >
                        <X size={24} />
                    </Button>
                </div>

                {/* Content */}
                <div
                    className={cn(
                        "flex-1 overflow-y-auto p-6 space-y-6",
                        readOnly && "pointer-events-none opacity-[0.65]"
                    )}
                >
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
                                {listingCode && listingCode !== "__pending__" && (
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
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsOperationTypeDropdownOpen(!isOperationTypeDropdownOpen)}
                                    className={cn(
                                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                                        isOperationTypeDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                                    )}
                                >
                                    <span>{operationType}</span>
                                    <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isOperationTypeDropdownOpen && "rotate-180")} />
                                </button>
                                {isOperationTypeDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsOperationTypeDropdownOpen(false)} />
                                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                            {["Venta", "Alquiler"].map((type) => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => {
                                                        setOperationType(type as OperationType);
                                                        setIsOperationTypeDropdownOpen(false);
                                                    }}
                                                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                                >
                                                    {operationType === type ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                                    <span className="text-sm text-gray-700 font-medium">{type}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <Tag size={16} className="text-primary-500" />
                                Estado de cualificación
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                    className={cn(
                                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                                        isStatusDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                                    )}
                                >
                                    <span>
                                        {status === "not_qualified" ? "No cualificado" :
                                         status === "qualified" ? "Cualificado" :
                                         status === "rejected" ? "Rechazado" : "Sin respuesta"}
                                    </span>
                                    <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isStatusDropdownOpen && "rotate-180")} />
                                </button>
                                {isStatusDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsStatusDropdownOpen(false)} />
                                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                            {[
                                                { id: "not_qualified", label: "No cualificado" },
                                                { id: "qualified", label: "Cualificado" },
                                                { id: "rejected", label: "Rechazado" },
                                                { id: "no_response", label: "Sin respuesta" }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setStatus(opt.id as QualificationStatus);
                                                        setIsStatusDropdownOpen(false);
                                                    }}
                                                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                                >
                                                    {status === opt.id ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                                    <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Mascotas */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                Mascotas
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsPetsDropdownOpen(!isPetsDropdownOpen)}
                                    className={cn(
                                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                                        isPetsDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                                    )}
                                >
                                    <span>{pets === undefined ? "No especificado" : pets ? "Sí" : "No"}</span>
                                    <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isPetsDropdownOpen && "rotate-180")} />
                                </button>
                                {isPetsDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsPetsDropdownOpen(false)} />
                                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                            {[
                                                { value: "", label: "No especificado" },
                                                { value: "true", label: "Sí" },
                                                { value: "false", label: "No" }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => {
                                                        const val = opt.value;
                                                        setPets(val === "" ? undefined : val === "true");
                                                        setIsPetsDropdownOpen(false);
                                                    }}
                                                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                                >
                                                    {(opt.value === "" && pets === undefined) || (opt.value === "true" && pets === true) || (opt.value === "false" && pets === false) ? 
                                                        <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                                    <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Ingresos mensuales */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                Ingresos mensuales (€)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="100"
                                value={income}
                                onChange={(e) => setIncome(e.target.value ? Number(e.target.value) : "")}
                                placeholder="Ej: 2500"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        {/* Forma de Pago */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                Pago
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsPaymentMethodDropdownOpen(!isPaymentMethodDropdownOpen)}
                                    className={cn(
                                        "w-full px-4 py-2 border border-gray-300 rounded-btn flex items-center justify-between text-sm transition-all bg-white",
                                        isPaymentMethodDropdownOpen ? "ring-2 ring-primary-500 border-transparent" : "hover:border-gray-400"
                                    )}
                                >
                                    <span>{paymentMethod || "No especificado"}</span>
                                    <ChevronDown size={16} className={cn("text-gray-400 transition-transform", isPaymentMethodDropdownOpen && "rotate-180")} />
                                </button>
                                {isPaymentMethodDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsPaymentMethodDropdownOpen(false)} />
                                        <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                            {(
                                                [
                                                    { value: "", label: "No especificado" },
                                                    { value: "Contado", label: "Contado" },
                                                    { value: "Hipoteca", label: "Hipoteca" },
                                                ] as const
                                            ).map((opt) => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentMethod(opt.value);
                                                        setIsPaymentMethodDropdownOpen(false);
                                                    }}
                                                    className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                                >
                                                    {paymentMethod === opt.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                                    <span className="text-sm text-gray-700 font-medium">{opt.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
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
                                     className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-600 text-xs font-bold border border-primary-100"
                                 >
                                     {tag}
                                     <button onClick={() => handleRemoveTag(tag)} className="hover:text-primary-700">
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
                            <Button
                                type="submit"
                                disabled={!newTag.trim()}
                                variant="outline"
                                className="border-primary-200 text-primary-700 hover:bg-primary-50"
                            >
                                Añadir
                            </Button>
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
                    <Button
                        onClick={() => onViewConversation(lead)}
                        variant="outline"
                        className="border-primary-200 text-primary-700 hover:bg-primary-50"
                    >
                        <MessageSquare size={18} />
                        Ver conversación
                    </Button>

                    <div className="flex gap-3">
                        <Button onClick={onClose} variant="secondary">
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} loading={saving} disabled={readOnly} className="px-8">
                            <Save size={18} />
                            Guardar Cambios
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
