import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, Trash2, AlertTriangle, Info, AlertCircle, CheckCircle, ShieldOff, Loader2 } from "lucide-react";
import { getAlerts, deleteAlert, ignoreChat, getAlertCatalogStatus, runAlertCheck, setAlertEnabled } from "../services/alerts";
import type { SystemAlert, AlertSeverity } from "../types";
import { formatDate, cn } from "../lib/utils";
import { PageContainer, PageHeader, PageLoading } from "../components/ui";

export function Alerts() {
    const [alerts, setAlerts] = useState<SystemAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [runningChecks, setRunningChecks] = useState<Record<string, boolean>>({});
    const controllersRef = useRef<Record<string, AbortController>>({});
    const [checkPanels, setCheckPanels] = useState<Record<string, {
        open: boolean;
        startedAtMs: number;
        lines: Array<{ t: number; level: "info" | "error"; msg: string }>;
    }>>({});
    const [catalogRows, setCatalogRows] = useState<Array<{
        key: string;
        subject: string;
        description: string;
        autoTest: { kind: "event" } | { kind: "schedule"; every: string };
        enabled: boolean;
        lastSeverity: string | null;
        lastMessage: string | null;
        lastTimestampMs: number | null;
        countLast24h: number;
    }>>([]);

    useEffect(() => {
        loadAlerts();
        loadCatalogStatus();
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

    async function loadCatalogStatus() {
        try {
            const data = await getAlertCatalogStatus({ limit: 800 });
            setCatalogRows(prev => {
                const incoming = data.rows || [];
                if (!prev.length) return incoming;
                const prevByKey = new Map(prev.map(r => [r.key, r]));
                return incoming.map(r => {
                    const local = prevByKey.get(r.key);
                    if (!local) return r;
                    const localTs = local.lastTimestampMs ?? 0;
                    const remoteTs = r.lastTimestampMs ?? 0;
                    // If we just ran an on-demand check, keep the newer local result
                    if (localTs > remoteTs) {
                        return {
                            ...r,
                            lastSeverity: local.lastSeverity,
                            lastMessage: local.lastMessage,
                            lastTimestampMs: local.lastTimestampMs,
                        };
                    }
                    return r;
                });
            });
        } catch (error) {
            console.error("Error loading alert catalog status:", error);
        } finally {
            setCatalogLoading(false);
        }
    }

    async function handleToggleAlertEnabled(key: string, enabled: boolean) {
        // Optimistic update
        setCatalogRows(rows => rows.map(r => r.key === key ? { ...r, enabled } : r));
        try {
            await setAlertEnabled({ key, enabled });
            toast.success(enabled ? "Alerta habilitada" : "Alerta deshabilitada");
        } catch (error) {
            console.error("Error updating alert enabled:", error);
            toast.error("No se pudo actualizar el toggle");
            // Revert
            setCatalogRows(rows => rows.map(r => r.key === key ? { ...r, enabled: !enabled } : r));
        }
    }

    async function handleRunCheck(key: string) {
        if (runningChecks[key]) {
            setCheckPanels(prev => {
                const cur = prev[key];
                if (!cur) return prev;
                return {
                    ...prev,
                    [key]: {
                        ...cur,
                        open: true,
                        lines: [...cur.lines, { t: Date.now(), level: "info", msg: "Ya hay un check en ejecución para este tipo." }],
                    },
                };
            });
            return;
        }

        const startedAtMs = Date.now();
        const controller = new AbortController();

        const pushLine = (level: "info" | "error", msg: string) => {
            setCheckPanels(prev => {
                const cur = prev[key];
                const base = cur ?? { open: true, startedAtMs, lines: [] as Array<{ t: number; level: "info" | "error"; msg: string }> };
                return {
                    ...prev,
                    [key]: {
                        ...base,
                        open: true,
                        startedAtMs: base.startedAtMs ?? startedAtMs,
                        lines: [...base.lines, { t: Date.now(), level, msg }],
                    },
                };
            });
        };

        // Start panel immediately
        setCheckPanels(prev => ({
            ...prev,
            [key]: {
                open: true,
                startedAtMs,
                lines: [
                    { t: startedAtMs, level: "info", msg: `Iniciando check: ${key}` },
                    { t: startedAtMs, level: "info", msg: "Enviando request al backend…" },
                ],
            },
        }));

        setRunningChecks(prev => ({ ...prev, [key]: true }));
        try {
            controllersRef.current[key] = controller;
            pushLine("info", "Request enviada. Esperando respuesta…");

            const result: any = await runAlertCheck({ key }, { timeoutMs: 25000, signal: controller.signal });
            if (!result.ok) {
                toast.error(result.error);
                pushLine("error", `Error: ${result.error}`);
                return;
            }
            if (result.status === "ok") {
                toast.success("Check OK");
                pushLine("info", `Resultado: OK (checkedAt=${result.checkedAt})`);
            } else if (result.status === "not_supported") {
                toast.message("Check no disponible para esta alerta");
                pushLine("info", `Resultado: no soportado (checkedAt=${result.checkedAt})`);
            } else {
                toast.error("Check con error");
                pushLine("error", `Resultado: ERROR (checkedAt=${result.checkedAt})`);
            }

            if (result?._meta) {
                pushLine(
                    "info",
                    `Meta: http=${result._meta.httpStatus ?? "—"} dur=${result._meta.durationMs}ms aborted=${result._meta.aborted ? "sí" : "no"}`
                );
            }
            if (result?.details != null) {
                try {
                    const detailsStr = typeof result.details === "string"
                        ? result.details
                        : JSON.stringify(result.details, null, 2);
                    const synthetic = typeof result.details === "object" && result.details?.synthetic === true;
                    if (synthetic) {
                        pushLine("info", "Synthetic test: sí");
                    }
                    pushLine("info", `Details:\n${detailsStr}`.slice(0, 2000));
                } catch {
                    // ignore
                }
            }

            // Update UI immediately for better feedback
            setCatalogRows(rows => rows.map(r => {
                if (r.key !== key) return r;
                const lastSeverity =
                    result.status === "ok" ? "healthy" :
                        result.status === "not_supported" ? (r.lastSeverity ?? "healthy") :
                            "critical";
                const lastMessage =
                    result.status === "ok" ? "Check OK" :
                        result.status === "not_supported" ? "Check no disponible" :
                            "Check con error";
                return {
                    ...r,
                    lastSeverity,
                    lastMessage,
                    lastTimestampMs: Date.now(),
                };
            }));

            // Refresh catalog to update last seen status if anything changed
            loadCatalogStatus();
        } catch (error) {
            console.error("Error running check:", error);
            toast.error("Error al ejecutar el check");
            pushLine("error", `Excepción: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            delete controllersRef.current[key];
            setRunningChecks(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    }

    function handleCancelCheck(key: string) {
        const controller = controllersRef.current[key];
        if (controller) {
            controller.abort();
        }
        setCheckPanels(prev => {
            const cur = prev[key];
            if (!cur) return prev;
            return {
                ...prev,
                [key]: {
                    ...cur,
                    open: true,
                    lines: [...cur.lines, { t: Date.now(), level: "error", msg: "Cancelado por el usuario (abort)." }],
                },
            };
        });
    }

    async function handleDeleteAlert(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!window.confirm("¿Estás seguro de que quieres eliminar esta alerta?")) {
            return;
        }
        try {
            await deleteAlert(id);
            setAlerts(alerts.filter(a => a.id !== id));
            if (expandedAlertId === id) setExpandedAlertId(null);
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
                return <CheckCircle className="text-emerald-500" size={20} />;
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
                return "border-slate-200 bg-slate-50 text-slate-700";
        }
    };

    if (loading) {
        return <PageLoading className="h-64" />;
    }

    return (
        <PageContainer maxWidth="full">
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

            {/* Estado del sistema de alertas */}
            <div className="mb-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 font-heading">Estado de alertas configuradas</h3>
                            <p className="text-xs text-gray-500 font-body">Última ocurrencia por tipo (y conteo en 24h)</p>
                        </div>
                        <div className="text-xs text-gray-400">
                            {catalogLoading ? "Cargando…" : `${catalogRows.length} tipos`}
                        </div>
                    </div>

                    {catalogLoading ? (
                        <div className="p-5 text-sm text-gray-500">Cargando estado…</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-5 py-3 font-semibold">Alerta</th>
                                        <th className="text-left px-5 py-3 font-semibold">Estado</th>
                                        <th className="text-left px-5 py-3 font-semibold">Habilitada</th>
                                        <th className="text-left px-5 py-3 font-semibold">Test</th>
                                        <th className="text-left px-5 py-3 font-semibold">Auto-test</th>
                                        <th className="text-left px-5 py-3 font-semibold">Última vez</th>
                                        <th className="text-left px-5 py-3 font-semibold">24h</th>
                                        <th className="text-left px-5 py-3 font-semibold">Descripción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {catalogRows.map((row) => {
                                        const sev = (row.lastSeverity as AlertSeverity | null) || "healthy";
                                        const hasEver = row.lastTimestampMs != null;
                                        const lastDate = hasEver ? new Date(row.lastTimestampMs as number) : null;
                                        const isRunningCheck = !!runningChecks[row.key];
                                        const panel = checkPanels[row.key];
                                        const showPanel = !!panel?.open;

                                        return (
                                            <>
                                                <tr key={row.key} className="hover:bg-gray-50/60">
                                                    <td className="px-5 py-3">
                                                        <div className="font-bold text-gray-900 font-heading">{row.subject}</div>
                                                        {row.lastMessage ? (
                                                            <div className="text-xs text-gray-500 truncate max-w-[520px] font-body">
                                                                {row.lastMessage}
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border font-heading",
                                                        hasEver ? getSeverityStyles(sev) : "border-gray-200 bg-gray-50 text-gray-600"
                                                    )}>
                                                        {hasEver ? getSeverityIcon(sev) : <Info className="text-gray-400" size={20} />}
                                                        {hasEver ? sev : "sin datos"}
                                                    </span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                            <input
                                                                type="checkbox"
                                                                checked={row.enabled}
                                                                onChange={(e) => handleToggleAlertEnabled(row.key, e.target.checked)}
                                                                className="peer sr-only"
                                                            />
                                                            <span className={cn(
                                                                "w-11 h-6 rounded-full border transition-colors relative",
                                                                row.enabled ? "bg-emerald-500 border-emerald-500" : "bg-gray-200 border-gray-300"
                                                            )}>
                                                                <span className={cn(
                                                                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform",
                                                                    row.enabled ? "translate-x-5" : "translate-x-0"
                                                                )} />
                                                            </span>
                                                            <span className="text-xs font-bold text-gray-600 font-heading tracking-wide">
                                                                {row.enabled ? "ON" : "OFF"}
                                                            </span>
                                                        </label>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleRunCheck(row.key)}
                                                                disabled={isRunningCheck}
                                                                className={cn(
                                                                    "px-3 py-1.5 rounded-btn text-xs font-bold border border-gray-200 bg-white text-gray-700 transition-colors shadow-sm",
                                                                    isRunningCheck
                                                                        ? "opacity-60 cursor-not-allowed"
                                                                        : "hover:bg-gray-900 hover:text-white hover:border-gray-900"
                                                                )}
                                                            >
                                                                {isRunningCheck ? (
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <Loader2 size={14} className="animate-spin" />
                                                                        Probando…
                                                                    </span>
                                                                ) : (
                                                                    "Probar"
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => setCheckPanels(prev => ({
                                                                    ...prev,
                                                                    [row.key]: {
                                                                        open: !(prev[row.key]?.open ?? false),
                                                                        startedAtMs: prev[row.key]?.startedAtMs ?? Date.now(),
                                                                        lines: prev[row.key]?.lines ?? [],
                                                                    },
                                                                }))}
                                                                className="px-2 py-1.5 rounded-btn text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                                            >
                                                                Detalles
                                                            </button>
                                                            {isRunningCheck ? (
                                                                <button
                                                                    onClick={() => handleCancelCheck(row.key)}
                                                                    className="px-2 py-1.5 rounded-btn text-xs font-bold border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                                    title="Abortar request (timeout 25s)"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-xs text-gray-700 whitespace-nowrap">
                                                        {row.autoTest?.kind === "schedule" ? row.autoTest.every : "por evento"}
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-700">
                                                        {lastDate ? formatDate(lastDate) : "—"}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold font-heading">
                                                            {row.countLast24h}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600 text-xs">
                                                        {row.description}
                                                    </td>
                                                </tr>
                                                {showPanel ? (
                                                    <tr key={`${row.key}-panel`} className="bg-gray-50/40">
                                                        <td colSpan={8} className="px-5 py-3">
                                                            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                                                                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                                                                    <div className="text-xs font-bold text-gray-700">Ejecución del check</div>
                                                                    <button
                                                                        onClick={() => setCheckPanels(prev => ({ ...prev, [row.key]: { ...(prev[row.key] || panel), open: false } }))}
                                                                        className="text-xs font-bold text-gray-500 hover:text-gray-900"
                                                                    >
                                                                        Cerrar
                                                                    </button>
                                                                </div>
                                                                <div className="p-3 space-y-1 font-mono text-[11px] text-gray-700 whitespace-pre-wrap">
                                                                    {(panel?.lines?.length ? panel.lines : [{ t: Date.now(), level: "info" as const, msg: "Sin eventos todavía." }]).map((l, idx) => (
                                                                        <div key={idx} className={cn("flex gap-2", l.level === "error" ? "text-rose-700" : "text-gray-700")}>
                                                                            <span className="text-gray-400 tabular-nums">{new Date(l.t).toLocaleTimeString()}</span>
                                                                            <span className="font-bold w-12">{l.level.toUpperCase()}</span>
                                                                            <span className="flex-1">{l.msg}</span>
                                                                        </div>
                                                                    ))}
                                                                    {isRunningCheck ? (
                                                                        <div className="pt-2 text-gray-500">
                                                                            Timeout automático: 25s.
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : null}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Log (tabla ancho completo, filas desplegables) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 font-heading">Log de alertas</h3>
                        <p className="text-xs text-gray-500 font-body">Eventos recientes (últimos 7 días). Despliega una fila para ver detalles técnicos.</p>
                    </div>
                    <div className="text-xs text-gray-400">{alerts.length}</div>
                </div>

                {alerts.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle className="mx-auto text-emerald-500 mb-2" size={32} />
                        <p className="text-sm font-medium text-gray-900">No hay alertas</p>
                        <p className="text-xs text-gray-500">Todo funciona correctamente</p>
                    </div>
                ) : (
                  <>
                    {/* Mobile: stacked cards (sm:hidden) */}
                    <div className="sm:hidden divide-y divide-gray-100">
                        {alerts.map((alert) => {
                            const isOpen = expandedAlertId === alert.id;
                            const when = alert.timestamp ? formatDate(alert.timestamp.toDate()) : "—";
                            const chatIds = extractAllChatIds(alert.details);
                            return (
                                <div key={alert.id} className={cn("p-4", isOpen && "bg-primary-50")}>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedAlertId(isOpen ? null : alert.id)}
                                        className="w-full text-left flex flex-col gap-2"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border font-heading shrink-0",
                                                getSeverityStyles(alert.severity)
                                            )}>
                                                {getSeverityIcon(alert.severity)}
                                                {alert.severity}
                                            </span>
                                            <button
                                                onClick={(e) => handleDeleteAlert(e, alert.id)}
                                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-btn hover:bg-red-50 transition-colors shrink-0"
                                                title="Eliminar alerta"
                                                aria-label="Eliminar alerta"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="font-bold text-gray-900 font-heading break-words">{alert.subject}</div>
                                        <div className="text-xs text-gray-500 font-body">
                                            <span>{when}</span>
                                            <span className="mx-1.5 text-gray-300">·</span>
                                            <span className="font-mono">ID: {alert.id}</span>
                                        </div>
                                    </button>
                                    {isOpen ? (
                                        <div className="mt-3 space-y-4">
                                            <div>
                                                <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">
                                                    Detalles técnicos
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap border border-gray-100" style={{ overflowWrap: 'anywhere' }}>
                                                    {typeof alert.details === "string"
                                                        ? alert.details
                                                        : JSON.stringify(alert.details, null, 2)}
                                                </div>
                                            </div>
                                            {chatIds.length > 0 ? (
                                                <div className="border-t pt-3">
                                                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">
                                                        Acciones por chatId
                                                    </div>
                                                    <div className="grid gap-2">
                                                        {chatIds.map((id) => (
                                                            <div key={id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                                                <span className="font-mono text-xs text-gray-600 font-medium break-all min-w-0">{id}</span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleIgnoreChat(id);
                                                                    }}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-btn text-[11px] font-bold hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all shadow-sm shrink-0"
                                                                >
                                                                    <ShieldOff size={12} />
                                                                    Ignorar
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="text-left px-5 py-3 font-semibold">Fecha</th>
                                    <th className="text-left px-5 py-3 font-semibold">Severidad</th>
                                    <th className="text-left px-5 py-3 font-semibold">Asunto</th>
                                    <th className="text-right px-5 py-3 font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {alerts.map((alert) => {
                                    const isOpen = expandedAlertId === alert.id;
                                    const when = alert.timestamp ? formatDate(alert.timestamp.toDate()) : "—";
                                    const chatIds = extractAllChatIds(alert.details);
                                    return (
                                        <>
                                            <tr
                                                key={alert.id}
                                                onClick={() => setExpandedAlertId(isOpen ? null : alert.id)}
                                                className={cn(
                                                    "cursor-pointer hover:bg-gray-50/70",
                                                    isOpen ? "bg-primary-50" : "bg-white"
                                                )}
                                            >
                                                <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">{when}</td>
                                                <td className="px-5 py-3">
                                                    <span className={cn(
                                                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border font-heading",
                                                        getSeverityStyles(alert.severity)
                                                    )}>
                                                        {getSeverityIcon(alert.severity)}
                                                        {alert.severity}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <div className="font-bold text-gray-900 font-heading">{alert.subject}</div>
                                                    <div className="text-xs text-gray-500 font-body">ID: <span className="font-mono">{alert.id}</span></div>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <button
                                                        onClick={(e) => handleDeleteAlert(e, alert.id)}
                                                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-btn hover:bg-red-50 transition-colors"
                                                        title="Eliminar alerta"
                                                        aria-label="Eliminar alerta"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                            {isOpen ? (
                                                <tr key={`${alert.id}-details`} className="bg-white">
                                                    <td colSpan={4} className="px-5 py-4">
                                                        <div className="space-y-4">
                                                            <div>
                                                                <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">
                                                                    Detalles técnicos
                                                                </div>
                                                                <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap border border-gray-100">
                                                                    {typeof alert.details === "string"
                                                                        ? alert.details
                                                                        : JSON.stringify(alert.details, null, 2)}
                                                                </div>
                                                            </div>

                                                            {chatIds.length > 0 ? (
                                                                <div className="border-t pt-4">
                                                                    <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 font-heading">
                                                                        Acciones por chatId
                                                                    </div>
                                                                    <div className="grid gap-2">
                                                                        {chatIds.map((id) => (
                                                                            <div key={id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                                                <span className="font-mono text-xs text-gray-600 font-medium">{id}</span>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleIgnoreChat(id);
                                                                                    }}
                                                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-btn text-xs font-bold hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all shadow-sm"
                                                                                >
                                                                                    <ShieldOff size={14} />
                                                                                    Ignorar Alertas
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                  </>
                )}
            </div>
        </PageContainer>
    );
}

