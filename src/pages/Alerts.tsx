import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Trash2, AlertTriangle, Info, AlertCircle, Calendar, CheckCircle, ShieldOff } from "lucide-react";
import { getAlerts, deleteAlert, ignoreChat } from "../services/alerts";
import type { SystemAlert, AlertSeverity } from "../types";
import { formatDate, cn } from "../lib/utils";
import { PageContainer, PageHeader, PageLoading } from "../components/ui";

export function Alerts() {
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);

    useEffect(() => {
        loadAlerts();
    }, []);

    async function loadAlerts() {
        try {
            const data = await getAlerts();
            setAlerts(data);
        } catch (error) {
            console.error("Error loading alerts:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteAlert(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!window.confirm("¿Estás seguro de que quieres eliminar esta alerta?")) {
            return;
        }
        try {
            await deleteAlert(id);
            setAlerts(alerts.filter(a => a.id !== id));
            if (selectedAlert?.id === id) {
                setSelectedAlert(null);
            }
        } catch (error) {
            console.error("Error deleting alert:", error);
            toast.error("Error al eliminar la alerta");
        }
    }

    async function handleIgnoreChat(chatId: string) {
        if (!window.confirm(`¿Quieres ignorar las alertas del chat ${chatId} de ahora en adelante?`)) {
            return;
        }
        try {
            await ignoreChat(chatId);
            toast.success("Chat ignorado correctamente. No recibirás más alertas de este número.");
        } catch (error) {
            console.error("Error ignoring chat:", error);
            toast.error("Error al ignorar el chat");
        }
    }

    const extractAllChatIds = (details: any): string[] => {
        if (!details) return [];
        const found = new Set<string>();

        if (typeof details === 'string') {
            const matches = details.matchAll(/(?:chatId|chat_id)[:\s"]+([0-9]+@[^\s,"'\]}]+)/gi);
            for (const match of matches) {
                found.add(match[1]);
            }
        } else {
            const findDeep = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                if (typeof obj.chatId === 'string') found.add(obj.chatId);
                if (typeof obj.chat_id === 'string') found.add(obj.chat_id);
                for (const key in obj) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        findDeep(obj[key]);
                    }
                }
            };
            findDeep(details);
        }
        return Array.from(found);
    };

    const getSeverityIcon = (severity: AlertSeverity) => {
        switch (severity) {
            case "critical":
                return <AlertCircle className="text-red-500" size={20} />;
            case "warning":
                return <AlertTriangle className="text-amber-500" size={20} />;
            case "healthy":
                return <CheckCircle className="text-green-500" size={20} />;
            default:
                return <Info className="text-primary-600" size={20} />;
        }
    };

    const getSeverityStyles = (severity: AlertSeverity) => {
        switch (severity) {
            case "critical":
                return "border-rose-100 bg-rose-50 text-rose-700";
            case "warning":
                return "border-amber-100 bg-amber-50 text-amber-700";
            case "healthy":
                return "border-emerald-100 bg-emerald-50 text-emerald-700";
            default:
                return "border-sky-100 bg-sky-50 text-sky-700";
        }
    };

    if (loading) {
        return <PageLoading className="h-64" />;
    }

    return (
        <PageContainer maxWidth="6xl">
            <PageHeader
                title="Alertas del Sistema"
                subtitle="Monitoreo de sincronización y estado del asistente"
                actions={
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Bell size={18} />
                        <span>{alerts.length} alertas recientes</span>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Lista de alertas */}
                <div className="md:col-span-1 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
                    {alerts.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl border border-gray-200 text-center">
                            <CheckCircle className="mx-auto text-green-500 mb-2" size={32} />
                            <p className="text-sm font-medium text-gray-900">No hay alertas</p>
                            <p className="text-xs text-gray-500">Todo funciona correctamente</p>
                        </div>
                    ) : (
                        alerts.map((alert) => (
                            <div
                                key={alert.id}
                                onClick={() => setSelectedAlert(alert)}
                                className={cn(
                                    "p-4 rounded-btn border transition-all cursor-pointer hover:shadow-md",
                                    selectedAlert?.id === alert.id
                                        ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="p-2 rounded-lg bg-gray-50">
                                        {getSeverityIcon(alert.severity)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-gray-900 truncate">
                                            {alert.subject}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500 font-medium">
                                            <Calendar size={12} />
                                            {alert.timestamp ? formatDate(alert.timestamp.toDate()) : "—"}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteAlert(e, alert.id)}
                                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-btn hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Detalle de la alerta */}
                <div className="md:col-span-2 space-y-4">
                    {selectedAlert ? (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className={cn("p-6 border-b", getSeverityStyles(selectedAlert.severity))}>
                                <div className="flex items-center gap-3">
                                    {getSeverityIcon(selectedAlert.severity)}
                                    <h2 className="text-lg font-bold">{selectedAlert.subject}</h2>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalles Técnicos</h4>
                                        <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap border border-gray-100">
                                            {typeof selectedAlert.details === 'string'
                                                ? selectedAlert.details
                                                : JSON.stringify(selectedAlert.details, null, 2)}
                                        </div>
                                    </div>

                                    <div className="flex flex-col space-y-4 border-t pt-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-xs text-gray-500">
                                                ID Alerta: <span className="font-mono">{selectedAlert.id}</span>
                                            </div>
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                getSeverityStyles(selectedAlert.severity)
                                            )}>
                                                {selectedAlert.severity}
                                            </span>
                                        </div>

                                        {(() => {
                                            const chatIds = extractAllChatIds(selectedAlert.details);
                                            if (chatIds.length === 0) return null;

                                            return (
                                                <div className="space-y-2">
                                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acciones por Número</h4>
                                                    <div className="grid gap-2">
                                                        {chatIds.map((id) => (
                                                            <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                                                                <span className="font-mono text-xs text-gray-600 font-medium">{id}</span>
                                                                <button
                                                                    onClick={() => handleIgnoreChat(id)}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-btn text-xs font-bold hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all shadow-sm"
                                                                >
                                                                    <ShieldOff size={14} />
                                                                    Ignorar Alertas
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-400">
                            <div className="text-center">
                                <Bell className="mx-auto mb-3 opacity-20" size={48} />
                                <p className="text-sm italic">Selecciona una alerta para ver los detalles</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    );
}

