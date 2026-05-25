import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  Megaphone,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Wallet,
} from "lucide-react";
import { PageContainer, PageHeader, PageLoading, FilterCard, Button, SegmentedControl } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  getCreditTransactions,
  getLeadsByChatIds,
  getOrgCreditBalance,
  type CreditTransaction,
  type LeadSummary,
  type UsageEventType,
} from "../services/usage";
import { cn } from "../lib/utils";

type RangeKey = "thisMonth" | "last30" | "last90" | "all";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "thisMonth", label: "Este mes" },
  { value: "last30", label: "Últimos 30 días" },
  { value: "last90", label: "Últimos 90 días" },
  { value: "all", label: "Todo" },
];

const EVENT_META: Record<
  UsageEventType,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  initial_outbound: {
    label: "Mensaje inicial a lead",
    tone: "bg-primary-50 text-primary-700 border-primary-200",
    icon: <MessageSquare size={12} />,
  },
  intake_outbound: {
    label: "Llamada → handoff",
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    icon: <PhoneCall size={12} />,
  },
  manual_purchase: {
    label: "Compra de conversaciones",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <ShoppingCart size={12} />,
  },
  auto_recharge: {
    label: "Recarga automática",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <RefreshCw size={12} />,
  },
  subscription_grant: {
    label: "Plan mensual",
    tone: "bg-primary-50 text-primary-700 border-primary-200",
    icon: <Sparkles size={12} />,
  },
  free_plan_activation: {
    label: "Activación plan Free",
    tone: "bg-primary-50 text-primary-700 border-primary-200",
    icon: <Sparkles size={12} />,
  },
  other: {
    label: "Otro",
    tone: "bg-gray-100 text-gray-700 border-gray-200",
    icon: <Megaphone size={12} />,
  },
};

const DEDUCTION_EVENT_TYPES: UsageEventType[] = ["initial_outbound", "intake_outbound", "other"];

function txMillis(tx: CreditTransaction): number {
  return tx.createdAt && typeof tx.createdAt.toMillis === "function" ? tx.createdAt.toMillis() : 0;
}

function rangeStartMs(range: RangeKey): number {
  const now = new Date();
  if (range === "thisMonth") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  if (range === "last30") return now.getTime() - 30 * 24 * 60 * 60 * 1000;
  if (range === "last90") return now.getTime() - 90 * 24 * 60 * 60 * 1000;
  return 0;
}

function formatDate(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeFromNow(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(ms).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function detectEventType(tx: CreditTransaction): UsageEventType {
  if (tx.eventType) return tx.eventType;
  // Heuristic fallback for historical entries
  const desc = (tx.description || "").toLowerCase();
  if (tx.type === "purchase") {
    if (desc.includes("auto-compra") || desc.includes("auto-recharge")) return "auto_recharge";
    if (desc.includes("suscripción") || desc.includes("plan ") || desc.includes("plan:")) return "subscription_grant";
    if (desc.includes("activación plan free")) return "free_plan_activation";
    return "manual_purchase";
  }
  if (desc.includes("intake") || desc.includes("handoff")) return "intake_outbound";
  if (desc.includes("initial outbound") || desc.includes("idealista")) return "initial_outbound";
  return "other";
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function Usage() {
  const { organizationId, isImpersonationReadOnly } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [leadsByChatId, setLeadsByChatId] = useState<Map<string, LeadSummary>>(new Map());
  const [balance, setBalance] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [range, setRange] = useState<RangeKey>("thisMonth");
  const [activeEventTypes, setActiveEventTypes] = useState<Set<UsageEventType>>(new Set());
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"perLead" | "ledger">("perLead");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  async function loadAll() {
    if (!organizationId) return;
    try {
      setLoading(true);
      const [{ transactions: txs, hasMore: more }, bal] = await Promise.all([
        getCreditTransactions({ pageSize: 500 }),
        getOrgCreditBalance().catch(() => 0),
      ]);
      setTransactions(txs);
      setHasMore(more);
      setBalance(bal);
      const chatIds = Array.from(
        new Set(txs.map((t) => t.chatId).filter((c): c is string => !!c))
      );
      if (chatIds.length) {
        const map = await getLeadsByChatIds(chatIds);
        setLeadsByChatId(map);
      } else {
        setLeadsByChatId(new Map());
      }
    } catch (err) {
      console.error("[Usage] load error", err);
      toast.error("Error al cargar el uso de créditos");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }

  const rangeStart = useMemo(() => rangeStartMs(range), [range]);

  const filteredTransactions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      const ms = txMillis(tx);
      if (rangeStart && ms < rangeStart) return false;
      if (activeEventTypes.size > 0) {
        const t = detectEventType(tx);
        if (!activeEventTypes.has(t)) return false;
      }
      if (term) {
        const chatId = tx.chatId ?? "";
        const lead = chatId ? leadsByChatId.get(chatId) : undefined;
        const hay = [
          tx.description,
          chatId,
          lead?.name,
          lead?.listingCode,
          lead?.assignedAgentName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [transactions, rangeStart, activeEventTypes, search, leadsByChatId]);

  const stats = useMemo(() => {
    const monthStart = rangeStartMs("thisMonth");
    let consumedMonth = 0;
    const uniqueConversationsMonth = new Set<string>();
    for (const tx of transactions) {
      const ms = txMillis(tx);
      if (ms < monthStart) continue;
      if (tx.amount < 0) consumedMonth += Math.abs(tx.amount);
      const t = detectEventType(tx);
      if (tx.chatId && (t === "initial_outbound" || t === "intake_outbound")) {
        uniqueConversationsMonth.add(tx.chatId);
      }
    }
    return {
      consumedMonth,
      uniqueConversationsMonth: uniqueConversationsMonth.size,
    };
  }, [transactions]);

  // Per-lead aggregation over filteredTransactions (deductions only)
  const perLeadRows = useMemo(() => {
    type Row = {
      key: string; // chatId or "__unlinked__"
      chatId: string | null;
      lead?: LeadSummary;
      creditsSpent: number;
      eventCount: number;
      lastMs: number;
      events: CreditTransaction[];
    };
    const map = new Map<string, Row>();
    for (const tx of filteredTransactions) {
      if (tx.amount >= 0) continue; // only deductions
      const key = tx.chatId || "__unlinked__";
      const lead = tx.chatId ? leadsByChatId.get(tx.chatId) : undefined;
      const ms = txMillis(tx);
      const row = map.get(key) ?? {
        key,
        chatId: tx.chatId ?? null,
        lead,
        creditsSpent: 0,
        eventCount: 0,
        lastMs: 0,
        events: [],
      };
      row.creditsSpent += Math.abs(tx.amount);
      row.eventCount += 1;
      if (ms > row.lastMs) row.lastMs = ms;
      row.events.push(tx);
      if (!row.lead && lead) row.lead = lead;
      map.set(key, row);
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => {
      // unlinked rows always last
      if (a.chatId === null && b.chatId !== null) return 1;
      if (b.chatId === null && a.chatId !== null) return -1;
      return b.creditsSpent - a.creditsSpent || b.lastMs - a.lastMs;
    });
    return rows;
  }, [filteredTransactions, leadsByChatId]);

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleEventType(type: UsageEventType) {
    setActiveEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function exportCsv() {
    if (isImpersonationReadOnly) {
      toast.message("Solo lectura en modo vista como usuario");
      return;
    }
    const headers = [
      "fecha",
      "tipo",
      "evento",
      "amount",
      "chatId",
      "lead",
      "anuncio",
      "agente",
      "descripcion",
      "referencia",
    ];
    const lines = [headers.join(",")];
    for (const tx of filteredTransactions) {
      const t = detectEventType(tx);
      const lead = tx.chatId ? leadsByChatId.get(tx.chatId) : undefined;
      const row = [
        new Date(txMillis(tx)).toISOString(),
        tx.type,
        t,
        String(tx.amount),
        tx.chatId ?? "",
        lead?.name ?? "",
        lead?.listingCode ?? "",
        lead?.assignedAgentName ?? "",
        tx.description ?? "",
        tx.stripeReference ?? "",
      ].map((v) => csvEscape(String(v)));
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uso-creditos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <PageLoading message="Cargando uso de créditos..." className="py-12" />;
  }

  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Uso de créditos"
        subtitle="A qué leads y conversaciones se han imputado los créditos."
        icon={<BarChart3 size={28} />}
        actions={
          <>
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              <RefreshCw size={16} className={cn(refreshing && "animate-spin")} />
              <span className="ml-1.5">Actualizar</span>
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download size={16} />
              <span className="ml-1.5">Exportar CSV</span>
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Wallet size={20} />}
          label="Saldo actual"
          value={balance !== null ? `${balance}` : "—"}
          accent="amber"
          hint={
            <Link to="/suscripcion" className="text-primary-700 hover:underline">
              Gestionar suscripción →
            </Link>
          }
        />
        <StatCard
          icon={<CreditCard size={20} />}
          label="Créditos consumidos este mes"
          value={`${stats.consumedMonth}`}
          accent="sky"
        />
        <StatCard
          icon={<MessageSquare size={20} />}
          label="Conversaciones facturadas este mes"
          value={`${stats.uniqueConversationsMonth}`}
          accent="emerald"
        />
      </div>

      {/* Filters */}
      <FilterCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              ariaLabel="Rango temporal"
              value={range}
              onChange={setRange}
              options={RANGE_OPTIONS}
              colorScheme="amber"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lead, anuncio, chatId..."
              className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:w-72"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Tipo de evento:</span>
            {(Object.keys(EVENT_META) as UsageEventType[]).map((t) => {
              const meta = EVENT_META[t];
              const selected = activeEventTypes.has(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleEventType(t)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    selected ? meta.tone : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              );
            })}
            {activeEventTypes.size > 0 ? (
              <button
                type="button"
                onClick={() => setActiveEventTypes(new Set())}
                className="ml-1 text-xs font-semibold text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </FilterCard>

      {/* Tabs */}
      <div className="flex items-center justify-between">
        <SegmentedControl
          ariaLabel="Vista de uso"
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: "perLead", label: "Por lead / conversación" },
            { value: "ledger", label: "Movimientos" },
          ]}
          colorScheme="primary"
        />
        {hasMore ? (
          <p className="text-xs text-gray-500">Mostrando los 500 movimientos más recientes</p>
        ) : null}
      </div>

      {/* Tab content */}
      {tab === "perLead" ? (
        <PerLeadTable
          rows={perLeadRows}
          expanded={expanded}
          onToggle={toggleExpanded}
        />
      ) : (
        <LedgerTable rows={filteredTransactions} leadsByChatId={leadsByChatId} />
      )}
    </PageContainer>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "amber" | "sky" | "emerald";
  hint?: React.ReactNode;
}) {
  const tone =
    accent === "amber"
      ? "bg-primary-100 text-primary-700"
      : accent === "sky"
      ? "bg-slate-100 text-slate-700"
      : "bg-emerald-100 text-emerald-700";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("rounded-lg p-2", tone)}>{icon}</div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900 font-heading">{value}</p>
      {hint ? <p className="mt-2 text-xs">{hint}</p> : null}
    </div>
  );
}

function PerLeadTable({
  rows,
  expanded,
  onToggle,
}: {
  rows: Array<{
    key: string;
    chatId: string | null;
    lead?: LeadSummary;
    creditsSpent: number;
    eventCount: number;
    lastMs: number;
    events: CreditTransaction[];
  }>;
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <p className="text-gray-500">No hay consumo en el rango seleccionado.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="w-8 px-3 py-3"></th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Lead / conversación</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Anuncio</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Agente</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">Créditos</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">Eventos</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">Último</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => {
              const isOpen = expanded.has(row.key);
              const unlinked = row.chatId === null;
              return (
                <Fragment key={row.key}>
                  <tr
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => onToggle(row.key)}
                  >
                    <td className="px-3 py-3 text-gray-400">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="px-4 py-3">
                      {unlinked ? (
                        <div>
                          <p className="font-semibold text-gray-500">Sin enlace a lead</p>
                          <p className="text-xs text-gray-400">Movimientos sin chatId asociado</p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">
                              {row.lead?.name || "(Sin nombre)"}
                            </p>
                            {!row.lead ? (
                              <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                sin lead
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{row.chatId}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.lead?.listingCode || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{row.lead?.assignedAgentName || "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{row.creditsSpent}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.eventCount}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{relativeFromNow(row.lastMs)}</td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-gray-50/40">
                      <td></td>
                      <td colSpan={6} className="px-4 py-3">
                        <ul className="space-y-2">
                          {[...row.events]
                            .sort((a, b) => txMillis(b) - txMillis(a))
                            .map((ev) => {
                              const t = detectEventType(ev);
                              const meta = EVENT_META[t];
                              return (
                                <li key={ev.id} className="flex flex-wrap items-center gap-3 text-xs">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
                                      meta.tone
                                    )}
                                  >
                                    {meta.icon}
                                    {meta.label}
                                  </span>
                                  <span className="text-gray-500">{formatDate(txMillis(ev))}</span>
                                  <span className="text-gray-700">{ev.description}</span>
                                  <span className="ml-auto font-mono font-bold text-rose-700">
                                    {ev.amount > 0 ? `+${ev.amount}` : ev.amount}
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                        {row.lead ? (
                          <div className="mt-3">
                            <Link
                              to={`/leads/${row.lead.id}`}
                              className="text-xs font-semibold text-primary-700 hover:underline"
                            >
                              Ver lead →
                            </Link>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LedgerTable({
  rows,
  leadsByChatId,
}: {
  rows: CreditTransaction[];
  leadsByChatId: Map<string, LeadSummary>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <p className="text-gray-500">Sin movimientos en el rango seleccionado.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Lead / referencia</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-gray-600">Descripción</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-gray-600">Cambio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((tx) => {
              const t = detectEventType(tx);
              const meta = EVENT_META[t];
              const lead = tx.chatId ? leadsByChatId.get(tx.chatId) : undefined;
              const isDeduction = tx.amount < 0;
              const isDeductionEventType = DEDUCTION_EVENT_TYPES.includes(t);
              return (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-600">{formatDate(txMillis(tx))}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                        meta.tone
                      )}
                    >
                      {meta.icon}
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {lead ? (
                      <Link to={`/leads/${lead.id}`} className="font-semibold text-gray-900 hover:underline">
                        {lead.name || lead.chatId}
                      </Link>
                    ) : tx.chatId ? (
                      <span className="font-mono text-xs text-gray-500">{tx.chatId}</span>
                    ) : tx.stripeReference ? (
                      <span className="font-mono text-xs text-gray-500">{tx.stripeReference}</span>
                    ) : isDeductionEventType ? (
                      <span className="text-xs italic text-gray-400">sin enlace</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tx.description}</td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-mono font-bold",
                      isDeduction ? "text-rose-700" : "text-emerald-700"
                    )}
                  >
                    {isDeduction ? tx.amount : `+${tx.amount}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Usage;
