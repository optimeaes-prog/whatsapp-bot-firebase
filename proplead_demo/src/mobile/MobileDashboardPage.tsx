import type { ReactNode } from "react";
import { Calendar, Filter, ChevronDown, Check, TrendingDown, Menu } from "lucide-react";
import { QualificationBadge } from "../ui/QualificationBadge";
import { OperationTypeBadge } from "../ui/OperationTypeBadge";
import { RECENT_LEADS_30D, RECENT_LEADS_7D, RECENT_LEADS_CASA } from "../data/mockMetrics";

export type MobileDashboardStateProps = {
  dateLabel: string;
  listingLabel: string;
  qualRate: ReactNode;
  responseRate: ReactNode;
  leads: ReactNode;
  messages: ReactNode;
  funnel: { conversations: ReactNode; responded: ReactNode; qualified: ReactNode };
  funnelWidths: { conversations: number; responded: number; qualified: number };
  recentLeads: "all30d" | "all7d" | "casaAlgarrobo";
  dateDropdownOpen: boolean;
  listingDropdownOpen: boolean;
  dateHover?: number;
  listingHover?: number;
  dateHighlight?: boolean;
  listingHighlight?: boolean;
};

const DATE_OPTIONS = ["Hoy", "Últimos 7 días", "Últimos 30 días", "Últimos 90 días"];
const LISTING_OPTIONS = ["Todos", "Los Alamos", "Casa Algarrobo", "Adosado Chilches", "Sayalonga", "Benajarafe Paraíso del Sol"];

export function MobileDashboardPage(props: MobileDashboardStateProps) {
  const leadsList =
    props.recentLeads === "all7d"
      ? RECENT_LEADS_7D
      : props.recentLeads === "casaAlgarrobo"
        ? RECENT_LEADS_CASA
        : RECENT_LEADS_30D;

  return (
    <div className="absolute inset-0 overflow-hidden bg-gray-50">
      {/* App header */}
      <div className="flex items-center justify-between bg-white px-8 pt-6 pb-5 border-b border-gray-100">
        <h1 className="text-[64px] font-bold text-gray-900 leading-none">Dashboard</h1>
        <Menu size={44} className="text-gray-700" />
      </div>

      <div className="px-6 pb-8 pt-5">
        {/* Filter pills — horizontal */}
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <div
              className={`flex items-center justify-between gap-2 rounded-2xl border-2 bg-white px-5 py-4 ${
                props.dateHighlight ? "border-primary-400 ring-4 ring-primary-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar size={24} className="text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">FECHA</p>
                  <p className="truncate text-lg font-semibold text-gray-900">{props.dateLabel}</p>
                </div>
              </div>
              <ChevronDown size={22} className="text-gray-400 shrink-0" />
            </div>
            {props.dateDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
                {DATE_OPTIONS.map((opt, i) => (
                  <div
                    key={opt}
                    className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-xl ${
                      i === props.dateHover ? "bg-primary-50 text-primary-700" : "text-gray-700"
                    }`}
                  >
                    <span>{opt}</span>
                    {opt === props.dateLabel && <Check size={22} className="text-primary-500" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-1">
            <div
              className={`flex items-center justify-between gap-2 rounded-2xl border-2 bg-white px-5 py-4 ${
                props.listingHighlight ? "border-primary-400 ring-4 ring-primary-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Filter size={24} className="text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">ANUNCIO</p>
                  <p className="truncate text-lg font-semibold text-gray-900">{props.listingLabel}</p>
                </div>
              </div>
              <ChevronDown size={22} className="text-gray-400 shrink-0" />
            </div>
            {props.listingDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl">
                {LISTING_OPTIONS.map((opt, i) => (
                  <div
                    key={opt}
                    className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-xl ${
                      i === props.listingHover ? "bg-primary-50 text-primary-700" : "text-gray-700"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {opt === props.listingLabel && <Check size={22} className="text-primary-500 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPI cards — 2x2 grid */}
        <div className="mb-5 grid grid-cols-2 gap-4">
          <KpiCard label="TASA DE CUALIFICACIÓN" value={props.qualRate} valueClass="text-violet-600" suffix="%" />
          <KpiCard label="TASA DE RESPUESTA" value={props.responseRate} valueClass="text-sky-600" suffix="%" />
          <KpiCard label="LEADS" value={props.leads} valueClass="text-gray-900" />
          <KpiCard label="MENSAJES" value={props.messages} valueClass="text-gray-500" />
        </div>

        {/* Funnel */}
        <div className="mb-5 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-center text-3xl font-bold text-gray-900">Embudo de conversión</h2>
          <p className="mb-5 text-center text-base text-gray-500">Flujo de interacción total</p>

          <FunnelBar
            label="CONVERSACIONES"
            value={props.funnel.conversations}
            bg="bg-gray-100"
            text="text-gray-800"
            widthPct={props.funnelWidths.conversations}
          />
          <FunnelArrow value="72%" />
          <FunnelBar
            label="RESPONDIDAS"
            value={props.funnel.responded}
            bg="bg-sky-50"
            text="text-sky-700"
            widthPct={props.funnelWidths.responded}
          />
          <FunnelArrow value="32%" />
          <FunnelBar
            label="CUALIFICADOS"
            value={props.funnel.qualified}
            bg="bg-emerald-50"
            text="text-emerald-700"
            widthPct={props.funnelWidths.qualified}
          />
        </div>

        {/* Recent leads — first 3 in single column */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Leads más recientes</h2>
          <span className="text-base font-medium text-primary-600">Ver todos →</span>
        </div>
        <div className="space-y-3">
          {leadsList.slice(0, 3).map((l) => (
            <div key={`${l.name}-${l.date}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xl font-semibold text-gray-900">{l.name}</span>
                <span className="text-sm text-gray-400">{l.date}</span>
              </div>
              <p className="text-base text-gray-500">{l.phone}</p>
              <div className="mt-2 flex items-center gap-2">
                <QualificationBadge status={l.status as "qualified" | "not_qualified" | "rejected" | "no_response"} />
                <OperationTypeBadge type={l.operation as "Venta" | "Alquiler"} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueClass,
  suffix,
}: {
  label: string;
  value: ReactNode;
  valueClass: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white p-5 text-center shadow-sm">
      <p className="text-sm font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 text-[64px] font-bold leading-none ${valueClass}`}>
        {value}
        {suffix}
      </p>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  bg,
  text,
  widthPct,
}: {
  label: string;
  value: ReactNode;
  bg: string;
  text: string;
  widthPct: number;
}) {
  return (
    <div className="mx-auto" style={{ width: `${widthPct}%` }}>
      <div className={`mb-1 flex flex-col items-center rounded-2xl ${bg} ${text} py-5`}>
        <span className="text-5xl font-bold leading-none">{value}</span>
        <span className="mt-2 text-sm font-semibold uppercase tracking-wider opacity-80">{label}</span>
      </div>
    </div>
  );
}

function FunnelArrow({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5 text-violet-500">
      <TrendingDown size={16} />
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
