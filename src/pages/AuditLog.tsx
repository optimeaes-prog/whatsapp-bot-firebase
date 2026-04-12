import { useEffect, useState } from "react";
import { History, Filter, Search, User, Bot, ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import type { AuditLogEntry, AuditAction, AuditEntityType } from "../types";
import { getAuditLogs } from "../services/auditLog";
import { formatDate, cn } from "../lib/utils";
import { PageHeader, FilterCard, PageLoading } from "../components/ui";

export function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEntityType, setFilterEntityType] = useState<AuditEntityType | "all">("all");
    const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");
    const [filterSource, setFilterSource] = useState<"all" | "user" | "system">("all");
    const [search, setSearch] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    const [isEntityTypeDropdownOpen, setIsEntityTypeDropdownOpen] = useState(false);
    const [isActionDropdownOpen, setIsActionDropdownOpen] = useState(false);
    const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false);

    useEffect(() => {
        loadLogs();
    }, [filterEntityType, filterAction, filterSource]);

    async function loadLogs() {
        try {
            setLoading(true);
            const params: any = {};

            if (filterEntityType !== "all") params.entityType = filterEntityType;
            if (filterAction !== "all") params.action = filterAction;
            if (filterSource === "user") params.isSystemAction = false;
            if (filterSource === "system") params.isSystemAction = true;

            const data = await getAuditLogs(params);
            setLogs(data);
        } catch (error) {
            console.error("Error loading audit logs:", error);
        } finally {
            setLoading(false);
        }
    }

    const filteredLogs = logs.filter((log) => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            log.entityId.toLowerCase().includes(searchLower) ||
            log.userId?.toLowerCase().includes(searchLower) ||
            log.userName?.toLowerCase().includes(searchLower) ||
            log.action.toLowerCase().includes(searchLower)
        );
    });

    const getActionLabel = (action: AuditAction): string => {
        const labels: Record<AuditAction, string> = {
            create: "Creado",
            update: "Actualizado",
            delete: "Eliminado",
            status_change: "Cambio de Estado",
            bot_toggle: "Asistente Activado/Desactivado",
            message_sent: "Mensaje Enviado",
            qualification_change: "Cambio de Cualificación",
        };
        return labels[action] || action;
    };

    const getEntityTypeLabel = (type: AuditEntityType): string => {
        const labels: Record<AuditEntityType, string> = {
            lead: "Lead",
            conversation: "Conversación",
            listing: "Anuncio",
            qualified_lead: "Lead Cualificado",
            system_config: "Configuración",
        };
        return labels[type] || type;
    };

    const getActionColor = (action: AuditAction): string => {
        switch (action) {
            case "create":
                return "bg-emerald-100 text-emerald-700";
            case "update":
                return "bg-sky-100 text-sky-700";
            case "delete":
                return "bg-rose-100 text-rose-700";
            case "status_change":
            case "qualification_change":
                return "bg-violet-100 text-violet-700";
            case "bot_toggle":
                return "bg-amber-100 text-amber-700";
            case "message_sent":
                return "bg-cyan-100 text-cyan-700";
            default:
                return "bg-slate-100 text-slate-700";
        }
    };

    if (loading) {
        return <PageLoading className="h-64" />;
    }

    return (
        <div>
            <PageHeader
                className="mb-6"
                title="Historial de Cambios"
                subtitle="Registro completo de todos los cambios realizados en la aplicación"
                icon={<History className="text-primary-600" size={32} />}
            />

            {/* Filters */}
            <FilterCard className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={18} className="text-gray-600" />
                    <h2 className="font-bold text-gray-900 font-heading">Filtros</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Entity Type */}
                    <div className="relative">
                        <div 
                            className="flex items-center gap-2 bg-white px-3 py-2 rounded-btn border shadow-sm cursor-pointer min-h-[42px]" 
                            onClick={() => setIsEntityTypeDropdownOpen(!isEntityTypeDropdownOpen)}
                        >
                            <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Origen:</span>
                                <div className="flex items-center gap-1">
                                    {filterEntityType === "all" ? "Todos" : getEntityTypeLabel(filterEntityType)}
                                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isEntityTypeDropdownOpen && "rotate-180")} />
                                </div>
                            </div>
                        </div>
                        {isEntityTypeDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsEntityTypeDropdownOpen(false)} />
                                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                    {[
                                        { value: "all", label: "Todos los tipos" },
                                        { value: "lead", label: "Leads" },
                                        { value: "conversation", label: "Conversaciones" },
                                        { value: "listing", label: "Anuncios" },
                                        { value: "qualified_lead", label: "Leads Cualificados" },
                                        { value: "system_config", label: "Configuración" }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setFilterEntityType(option.value as any);
                                                setIsEntityTypeDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                        >
                                            {filterEntityType === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                            <span className="text-xs text-gray-700 font-medium">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action */}
                    <div className="relative">
                        <div 
                            className="flex items-center gap-2 bg-white px-3 py-2 rounded-btn border shadow-sm cursor-pointer min-h-[42px]" 
                            onClick={() => setIsActionDropdownOpen(!isActionDropdownOpen)}
                        >
                            <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Acción:</span>
                                <div className="flex items-center gap-1">
                                    {filterAction === "all" ? "Todas" : getActionLabel(filterAction)}
                                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isActionDropdownOpen && "rotate-180")} />
                                </div>
                            </div>
                        </div>
                        {isActionDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsActionDropdownOpen(false)} />
                                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100 max-h-[300px] overflow-y-auto">
                                    {[
                                        { value: "all", label: "Todas las acciones" },
                                        { value: "create", label: "Creado" },
                                        { value: "update", label: "Actualizado" },
                                        { value: "delete", label: "Eliminado" },
                                        { value: "status_change", label: "Cambio de Estado" },
                                        { value: "bot_toggle", label: "Asistente Toggle" },
                                        { value: "message_sent", label: "Mensaje Enviado" },
                                        { value: "qualification_change", label: "Cambio Cualificación" }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setFilterAction(option.value as any);
                                                setIsActionDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                        >
                                            {filterAction === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                            <span className="text-xs text-gray-700 font-medium">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Source */}
                    <div className="relative">
                        <div 
                            className="flex items-center gap-2 bg-white px-3 py-2 rounded-btn border shadow-sm cursor-pointer min-h-[42px]" 
                            onClick={() => setIsSourceDropdownOpen(!isSourceDropdownOpen)}
                        >
                            <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-heading">Origen:</span>
                                <div className="flex items-center gap-1">
                                    {filterSource === "all" ? "Todos" : filterSource === "user" ? "Usuario" : "Sistema"}
                                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1", isSourceDropdownOpen && "rotate-180")} />
                                </div>
                            </div>
                        </div>
                        {isSourceDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsSourceDropdownOpen(false)} />
                                <div className="absolute left-0 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                                    {[
                                        { value: "all", label: "Todos" },
                                        { value: "user", label: "Usuario" },
                                        { value: "system", label: "Sistema" }
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setFilterSource(option.value as any);
                                                setIsSourceDropdownOpen(false);
                                            }}
                                            className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                                        >
                                            {filterSource === option.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                                            <span className="text-xs text-gray-700 font-medium">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </FilterCard>

            {/* Logs Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <History className="text-gray-300 mb-3" size={48} />
                        <h3 className="text-sm font-bold text-gray-900 mb-1 font-heading">No hay registros</h3>
                        <p className="text-xs text-gray-500">
                            No se encontraron cambios con los filtros seleccionados
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                                        Fecha/Hora
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                                        Usuario
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                                        Tipo
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                                        Acción
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                                        ID Entidad
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest font-heading">
                                        Detalles
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredLogs.map((log) => {
                                    const parseTimestamp = (ts: any): Date => {
                                        if (!ts) return new Date();
                                        if (typeof ts.toDate === 'function') return ts.toDate();
                                        if (ts._seconds !== undefined) return new Date(ts._seconds * 1000);
                                        if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
                                        return new Date();
                                    };
                                    const date = parseTimestamp(log.timestamp);

                                    return (
                                        <>
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                                    {formatDate(date)}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        {log.isSystemAction ? (
                                                            <>
                                                                <Bot size={16} className="text-gray-400" />
                                                                <span className="text-gray-600">Sistema</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <User size={16} className="text-primary-600" />
                                                                <span className="text-gray-900">
                                                                    {log.userName || log.userId || "Usuario"}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900">
                                                    {getEntityTypeLabel(log.entityType)}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <span
                                                        className={cn(
                                                            "px-2 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest font-heading border",
                                                            getActionColor(log.action)
                                                        )}
                                                    >
                                                        {getActionLabel(log.action)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 font-mono truncate max-w-xs">
                                                    {log.entityId}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {log.changes && log.changes.length > 0 && (
                                                        <button
                                                            onClick={() =>
                                                                setExpandedLog(expandedLog === log.id ? null : log.id)
                                                            }
                                                            className="flex items-center gap-1 text-primary-600 hover:text-primary-700"
                                                        >
                                                            {expandedLog === log.id ? (
                                                                <>
                                                                    <ChevronUp size={16} />
                                                                    Ocultar
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown size={16} />
                                                                    Ver cambios
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedLog === log.id && log.changes && (
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-3 bg-gray-50">
                                                        <div className="space-y-2">
                                                            <h4 className="text-xs font-semibold text-gray-700 uppercase">
                                                                Cambios realizados:
                                                            </h4>
                                                            {log.changes.map((change, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className="bg-white rounded p-3 border border-gray-200"
                                                                >
                                                                    <div className="text-xs font-medium text-gray-700 mb-1">
                                                                        Campo: <span className="font-mono">{change.field}</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                                                        <div>
                                                                            <span className="text-gray-500">Antes:</span>
                                                                            <div className="mt-1 p-2 bg-rose-50 rounded font-mono text-rose-700">
                                                                                {JSON.stringify(change.oldValue, null, 2)}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-gray-500">Después:</span>
                                                                            <div className="mt-1 p-2 bg-emerald-50 rounded font-mono text-emerald-700">
                                                                                {JSON.stringify(change.newValue, null, 2)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary */}
            <div className="mt-4 text-sm text-gray-600 text-center">
                Mostrando {filteredLogs.length} de {logs.length} registros
            </div>
        </div>
    );
}
