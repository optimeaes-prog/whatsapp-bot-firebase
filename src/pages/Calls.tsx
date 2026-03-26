import { useEffect, useState } from "react";
import { PhoneIncoming, Search, ArrowLeft, Trash2, MessageSquare, Play } from "lucide-react";
import type { Call } from "../types";
import { getCalls, deleteCall } from "../services/calls";
import { formatDate, formatPhoneWhatsApp, cn } from "../lib/utils";

export function Calls() {
    const [calls, setCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "qualified" | "rejected">("all");
    const [selectedCall, setSelectedCall] = useState<Call | null>(null);

    useEffect(() => {
        loadCalls();
    }, []);

    async function loadCalls() {
        try {
            const data = await getCalls();
            setCalls(data);
        } catch (error) {
            console.error("Error loading calls:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteCall(e: React.MouseEvent, call: Call) {
        e.stopPropagation();
        if (!window.confirm(`¿Estás seguro de que quieres eliminar el registro de llamada de ${call.name || formatPhoneWhatsApp(call.phone)}?`)) {
            return;
        }
        try {
            await deleteCall(call.id);
            setCalls(calls.filter(c => c.id !== call.id));
            if (selectedCall?.id === call.id) {
                setSelectedCall(null);
            }
        } catch (error) {
            console.error("Error deleting call:", error);
            alert("Error al eliminar la llamada");
        }
    }

    const filteredCalls = calls.filter((call) => {
        const matchesSearch =
            (call.phone || "").includes(search) ||
            (call.name || "").toLowerCase().includes(search.toLowerCase()) ||
            (call.listingCode || "").toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
            filterStatus === "all" ||
            (filterStatus === "qualified" && call.isQualified) ||
            (filterStatus === "rejected" && !call.isQualified);
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Panel izquierdo - Lista de llamadas */}
            <div className={cn(
                "flex flex-col border-r border-gray-200 bg-white transition-all",
                selectedCall ? "hidden md:flex md:w-[380px]" : "w-full md:w-[380px]"
            )}>
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 text-center">Registro de Llamadas</h1>

                    {/* Búsqueda */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por teléfono o nombre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                        />
                    </div>

                    {/* Filtros */}
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white transition-shadow"
                    >
                        <option value="all">Todas las llamadas</option>
                        <option value="qualified">Cualificadas</option>
                        <option value="rejected">No cualificadas</option>
                    </select>
                </div>

                {/* Lista de llamadas */}
                <div className="flex-1 overflow-y-auto">
                    {filteredCalls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <PhoneIncoming className="text-gray-300 mb-3" size={48} />
                            <h3 className="text-sm font-medium text-gray-900 mb-1">
                                {calls.length === 0 ? "No hay llamadas" : "No se encontraron resultados"}
                            </h3>
                        </div>
                    ) : (
                        filteredCalls.map((call) => (
                            <div
                                key={call.id}
                                className={cn(
                                    "p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer",
                                    selectedCall?.id === call.id && "bg-gray-100"
                                )}
                                onClick={() => setSelectedCall(call)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-gray-900 text-sm truncate">
                                                {call.name || formatPhoneWhatsApp(call.phone)}
                                            </h3>
                                            <span
                                                className={cn(
                                                    "px-1.5 py-0.5 text-[10px] font-medium rounded",
                                                    call.isQualified
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                )}
                                            >
                                                {call.isQualified ? "Cualificado" : "Rechazado"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">
                                            {call.listingCode}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            {formatDate(call.timestamp.toDate())}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteCall(e, call)}
                                        className="text-red-600 hover:text-red-800 p-1.5"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Panel derecho - Detalle de la llamada */}
            {selectedCall ? (
                <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto">
                    {/* Header */}
                    <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSelectedCall(null)}
                                className="md:hidden p-1"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div className="flex-1">
                                <h2 className="font-bold text-gray-900 text-lg">
                                    Llamada con {selectedCall.name || formatPhoneWhatsApp(selectedCall.phone)}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {selectedCall.listingCode} • {formatDate(selectedCall.timestamp.toDate())}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Reproductor de Audio */}
                        {selectedCall.recordingUrl && (
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <Play size={16} className="text-primary-600" />
                                    Grabación de la llamada
                                </h3>
                                <audio controls src={selectedCall.recordingUrl} className="w-full" />
                            </div>
                        )}

                        {/* Resumen Estructurado */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen de la Cualificación</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedCall.structuredData && Object.entries(selectedCall.structuredData).map(([key, value]) => (
                                    <div key={key} className="p-2 bg-gray-50 rounded-lg">
                                        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{key.replace(/_/g, ' ')}</p>
                                        <p className="text-sm text-gray-900 font-medium">
                                            {typeof value === 'boolean' ? (value ? 'Sí' : 'No') : (value as string || 'N/A')}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            {!selectedCall.structuredData && selectedCall.summary && (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedCall.summary}</p>
                            )}
                        </div>

                        {/* Transcripción Completa */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <MessageSquare size={16} className="text-primary-600" />
                                Transcripción Completa
                            </h3>
                            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap italic">
                                    {selectedCall.transcript || "Transcripción no disponible"}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <PhoneIncoming className="mx-auto text-gray-300 mb-4" size={64} />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Selecciona una llamada
                        </h3>
                        <p className="text-sm text-gray-500">
                            Elige una llamada de la lista para ver los detalles y escuchar la grabación
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
