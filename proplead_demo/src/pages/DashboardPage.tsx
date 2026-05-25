import type { ReactNode } from "react";
import { Calendar, Filter, ChevronDown, Check, Phone, TrendingDown } from "lucide-react";
import { QualificationBadge } from "../ui/QualificationBadge";
import { OperationTypeBadge } from "../ui/OperationTypeBadge";
import { RECENT_LEADS_30D, RECENT_LEADS_7D, RECENT_LEADS_CASA } from "../data/mockMetrics";

export type DashboardStateProps = {
  dateLabel: string;
  listingLabel: string;
  // Animated values
  qualRate: ReactNode;
  responseRate: ReactNode;
  leads: ReactNode;
  messages: ReactNode;
  funnel: { conversations: ReactNode; responded: ReactNode; qualified: ReactNode };
  funnelWidths: { conversations: number; responded: number; qualified: number };
  // Recent leads to render
  recentLeads: "all30d" | "all7d" | "casaAlgarrobo";
  // UI state
  dateDropdownOpen: boolean;
  listingDropdownOpen: boolean;
  dateHover?: number;
  listingHover?: number;
  dateHighlight?: boolean;
  listingHighlight?: boolean;
};

const DATE_OPTIONS = ["Hoy", "Últimos 7 días", "Últimos 30 días", "Últimos 90 días"];
const LISTING_OPTIONS = ["Todos", "Los Alamos", "Casa Algarrobo", "Adosado Chilches", "Sayalonga", "Benajarafe Paraíso del Sol"];

export function DashboardPage(props: DashboardStateProps) {
  const leadsList =
    props.recentLeads === "all7d"
      ? RECENT_LEADS_7D
      : props.recentLeads === "casaAlgarrobo"
        ? RECENT_LEADS_CASA
        : RECENT_LEADS_30D;

  return (
    <div className="absolute inset-0 overflow-hidden bg-gray-50 p-10">
      {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-5xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-2 text-lg text-gray-600">
                Rango seleccionado: <span className="font-semibold">{props.dateLabel}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* FECHA dropdown */}
              <div className="relative">
                <div
                  className={`inline-flex items-center gap-2.5 rounded-xl border bg-white px-5 py-3.5 text-lg shadow-sm transition-all ${
                    props.dateHighlight ? "border-primary-400 ring-2 ring-primary-200" : "border-gray-200"
                  }`}
                >
                  <Calendar size={20} className="text-gray-500" />
                  <span className="text-base font-semibold uppercase tracking-wider text-gray-500">FECHA:</span>
                  <span className="font-medium text-gray-900">{props.dateLabel}</span>
                  <ChevronDown size={18} className="text-gray-400" />
                </div>
                {props.dateDropdownOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    {DATE_OPTIONS.map((opt, i) => (
                      <div
                        key={opt}
                        className={`flex cursor-default items-center justify-between rounded-lg px-4 py-3 text-lg ${
                          i === props.dateHover ? "bg-primary-50 text-primary-700" : "text-gray-700"
                        }`}
                      >
                        <span>{opt}</span>
                        {opt === props.dateLabel && <Check size={20} className="text-primary-500" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ANUNCIO dropdown */}
              <div className="relative">
                <div
                  className={`inline-flex items-center gap-2.5 rounded-xl border bg-white px-5 py-3.5 text-lg shadow-sm transition-all ${
                    props.listingHighlight ? "border-primary-400 ring-2 ring-primary-200" : "border-gray-200"
                  }`}
                >
                  <Filter size={20} className="text-gray-500" />
                  <span className="text-base font-semibold uppercase tracking-wider text-gray-500">ANUNCIO:</span>
                  <span className="font-medium text-gray-900">{props.listingLabel}</span>
                  <ChevronDown size={18} className="text-gray-400" />
                </div>
                {props.listingDropdownOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                    {LISTING_OPTIONS.map((opt, i) => (
                      <div
                        key={opt}
                        className={`flex cursor-default items-center justify-between rounded-lg px-4 py-3 text-lg ${
                          i === props.listingHover ? "bg-primary-50 text-primary-700" : "text-gray-700"
                        }`}
                      >
                        <span>{opt}</span>
                        {opt === props.listingLabel && <Check size={20} className="text-primary-500" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-12 gap-5">
            {/* KPI cards (left column) — flex column with each card flex-1
                so the stack fills the same height as the funnel card on the right,
                aligning the bottom of the last KPI with the bottom of the funnel. */}
            <div className="col-span-4 flex flex-col gap-4">
              <KpiCard label="TASA DE CUALIFICACIÓN" value={props.qualRate} valueClass="text-violet-600" suffix="%" big />
              <KpiCard label="TASA DE RESPUESTA" value={props.responseRate} valueClass="text-sky-600" suffix="%" big />
              <KpiCard label="LEADS" value={props.leads} valueClass="text-gray-900" big />
              <KpiCard label="MENSAJES TOTALES" value={props.messages} valueClass="text-gray-500" big />
            </div>

            {/* Funnel (right column) */}
            <div className="col-span-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
                <h2 className="text-center text-4xl font-bold text-gray-900">Embudo de conversión</h2>
                <p className="mb-6 text-center text-lg text-gray-500">Flujo de interacción total</p>

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
            </div>
          </div>

          {/* Recent leads */}
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-gray-900">Leads más recientes</h2>
              <span className="text-lg font-medium text-primary-600">Ver todos →</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {leadsList.map((l) => (
                <div key={`${l.name}-${l.date}`} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xl font-semibold text-gray-900">{l.name}</span>
                  </div>
                  <p className="flex items-center gap-2 text-base text-gray-500">
                    <Phone size={15} className="text-gray-400" />
                    {l.phone}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <QualificationBadge status={l.status as "qualified" | "not_qualified" | "rejected" | "no_response"} />
                    <OperationTypeBadge type={l.operation as "Venta" | "Alquiler"} />
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-500">ID {l.id}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-base text-gray-500">
                    <span>{l.date}</span>
                    <span className="font-medium text-primary-600">Ver detalles →</span>
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
  big,
}: {
  label: string;
  value: ReactNode;
  valueClass: string;
  suffix?: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
      <p className="text-base font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-2 font-bold ${big ? "text-7xl" : "text-4xl"} ${valueClass}`}>
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
    <div className="mx-auto" style={{ width: `${widthPct}%`, transition: "width 0.3s" }}>
      <div className={`mb-1 flex flex-col items-center rounded-2xl ${bg} ${text} py-7`}>
        <span className="text-7xl font-bold leading-none">{value}</span>
        <span className="mt-2.5 text-base font-semibold uppercase tracking-wider opacity-80">{label}</span>
      </div>
    </div>
  );
}

function FunnelArrow({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5 text-violet-500">
      <TrendingDown size={16} />
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}
