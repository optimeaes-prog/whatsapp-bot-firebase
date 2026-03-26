import { useEffect, useState } from "react";
import { History, Filter, Search, User, Bot, ChevronDown, ChevronUp } from "lucide-react";
import type { AuditLogEntry, AuditAction, AuditEntityType } from "../types";
import { getAuditLogs } from "../services/auditLog";
import { formatDate, cn } from "../lib/utils";

export function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEntityType, setFilterEntityType] = useState<AuditEntityType | "all">("all");
    const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");
    const [filterSource, setFilterSource] = useState<"all" | "user" | "system">("all");
    const [search, setSearch] = useState("");
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

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
            bot_toggle: "Bot Activado/Desactivado",
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
                return "bg-green-100 text-green-700";
            case "update":
                return "bg-blue-100 text-blue-700";
            case "delete":
                return "bg-red-100 text-red-700";
            case "status_change":
            case "qualification_change":
                return "bg-purple-100 text-purple-700";
            case "bot_toggle":
                return "bg-amber-100 text-amber-700";
            case "message_sent":
                return "bg-cyan-100 text-cyan-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <History className="text-primary-600" size={32} />
                    <h1 className="text-2xl font-bold text-gray-900">Historial de Cambios</h1>
                </div>
                <p className="text-sm text-gray-600">
                    Registro completo de todos los cambios realizados en la aplicación
                </p>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={18} className="text-gray-600" />
                    <h2 className="font-semibold text-gray-900">Filtros</h2>
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
                    <select
                        value={filterEntityType}
                        onChange={(e) => setFilterEntityType(e.target.value as AuditEntityType | "all")}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Todos los tipos</option>
                        <option value="lead">Leads</option>
                        <option value="conversation">Conversaciones</option>
                        <option value="listing">Anuncios</option>
                        <option value="qualified_lead">Leads Cualificados</option>
                        <option value="system_config">Configuración</option>
                    </select>

                    {/* Action */}
                    <select
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value as AuditAction | "all")}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Todas las acciones</option>
                        <option value="create">Creado</option>
                        <option value="update">Actualizado</option>
                        <option value="delete">Eliminado</option>
                        <option value="status_change">Cambio de Estado</option>
                        <option value="bot_toggle">Bot Toggle</option>
                        <option value="message_sent">Mensaje Enviado</option>
                        <option value="qualification_change">Cambio Cualificación</option>
                    </select>

                    {/* Source */}
                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value as "all" | "user" | "system")}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                    >
                        <option value="all">Todos</option>
                        <option value="user">Usuario</option>
                        <option value="system">Sistema</option>
                    </select>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <History className="text-gray-300 mb-3" size={48} />
                        <h3 className="text-sm font-medium text-gray-900 mb-1">No hay registros</h3>
                        <p className="text-xs text-gray-500">
                            No se encontraron cambios con los filtros seleccionados
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Fecha/Hora
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Usuario
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tipo
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Acción
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID Entidad
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                                                            "px-2 py-1 text-xs font-medium rounded-full",
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
                                                                            <div className="mt-1 p-2 bg-red-50 rounded font-mono text-red-700">
                                                                                {JSON.stringify(change.oldValue, null, 2)}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-gray-500">Después:</span>
                                                                            <div className="mt-1 p-2 bg-green-50 rounded font-mono text-green-700">
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
