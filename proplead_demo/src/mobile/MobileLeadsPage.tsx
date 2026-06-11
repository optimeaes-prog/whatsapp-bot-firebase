import { Search, Menu, Check, Phone, Filter } from "lucide-react";
import { QualificationBadge } from "../ui/QualificationBadge";
import { MOCK_LEADS, QUALIFIED_LEADS, type Lead } from "../data/mockLeads";

const TABS = ["Todos", "No cualificados", "Sin respuesta", "Cualificados", "Rechazados"] as const;
type Tab = (typeof TABS)[number];

export type MobileLeadsStateProps = {
  activeTab: Tab;
  tabPillIndex: number;
  totalLeads: number;
  shownLeads: number;
  selectedIds: Set<string>;
  rowsToRender?: Lead[];
  bulkBarVisible: boolean;
  bulkBarOffset: number;
  bulkBarHighlight?: "enviar" | "estado" | "tag" | "eliminar" | null;
};

export function MobileLeadsPage(props: MobileLeadsStateProps) {
  const rows = props.rowsToRender ?? (props.activeTab === "Cualificados" ? QUALIFIED_LEADS : MOCK_LEADS);
  const showCheckboxes = props.selectedIds.size > 0 || props.bulkBarVisible;

  return (
    <div className="absolute inset-0 overflow-hidden bg-gray-50">
      {/* App header */}
      <div className="flex items-center justify-between bg-white px-8 pt-6 pb-5 border-b border-gray-100">
        <div>
          <h1 className="text-[64px] font-bold text-gray-900 leading-none">Leads</h1>
          <p className="mt-1 text-base text-gray-500">
            {props.shownLeads} de {props.totalLeads} · 22 may 2026
          </p>
        </div>
        <Menu size={44} className="text-gray-700" />
      </div>

      {/* Tabs — horizontally scrollable feel, with active pill */}
      <div className="border-b border-gray-100 bg-white px-6 pb-4 pt-4">
        <div className="relative grid grid-cols-5 rounded-2xl border border-gray-200 bg-gray-50 p-1.5">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-xl bg-primary-50 ring-1 ring-primary-200"
            style={{
              width: `calc((100% - 0.75rem) / 5)`,
              left: `calc(0.375rem + ${props.tabPillIndex} * (100% - 0.75rem) / 5)`,
            }}
          />
          {TABS.map((t) => (
            <div
              key={t}
              className={`relative z-10 truncate px-1 py-2.5 text-center text-[15px] font-semibold ${
                t === props.activeTab ? "text-primary-700" : "text-gray-600"
              }`}
              title={t}
            >
              {t === "No cualificados" ? "No cualif." : t === "Sin respuesta" ? "Sin resp." : t}
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div className="mt-4 flex items-center gap-2.5">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-500">
            <Search size={20} />
            <span>Buscar por teléfono o nombre…</span>
          </div>
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-3 text-gray-600">
            <Filter size={24} />
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {props.bulkBarVisible && (
        <div
          className="border-b border-primary-200 bg-primary-50 px-6 py-4 shadow-sm"
          style={{ transform: `translateY(${props.bulkBarOffset}%)` }}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-lg font-bold text-primary-800">
              {props.selectedIds.size} lead{props.selectedIds.size === 1 ? "" : "s"} seleccionado{props.selectedIds.size === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <BulkBtn label="Enviar mensaje" highlight={props.bulkBarHighlight === "enviar"} primary />
            <BulkBtn label="Cambiar estado" highlight={props.bulkBarHighlight === "estado"} />
            <BulkBtn label="Eliminar" highlight={props.bulkBarHighlight === "eliminar"} danger />
          </div>
        </div>
      )}

      {/* Leads list — card-based */}
      <div className="space-y-3 px-6 pt-5 pb-8">
        {rows.slice(0, 7).map((lead) => {
          const selected = props.selectedIds.has(lead.id);
          return (
            <div
              key={lead.id}
              className={`flex items-center gap-4 rounded-2xl border bg-white p-5 shadow-sm ${
                selected ? "border-primary-300 bg-primary-50/40" : "border-gray-200"
              }`}
            >
              {showCheckboxes && (
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${
                    selected ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"
                  }`}
                >
                  {selected && <Check size={22} strokeWidth={3} className="text-white" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-2xl font-semibold text-gray-900">{lead.name}</span>
                  {lead.summary && (
                    <span className="shrink-0 text-base font-medium text-primary-600 underline underline-offset-2">
                      Ver
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2 text-base text-gray-500">
                  <Phone size={14} className="shrink-0" />
                  <span className="truncate">{lead.phoneMasked}</span>
                </div>
                <div className="mt-1 truncate text-base text-gray-500">{lead.listingName}</div>
                <div className="mt-2.5 flex items-center gap-2">
                  <QualificationBadge status={lead.status} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BulkBtn({ label, highlight, primary, danger }: { label: string; highlight?: boolean; primary?: boolean; danger?: boolean }) {
  const base = "flex-1 rounded-xl px-3 py-3 text-center text-base font-semibold transition-all";
  if (primary) {
    return <div className={`${base} bg-primary-500 text-white ${highlight ? "ring-4 ring-primary-300" : ""}`}>{label}</div>;
  }
  if (danger) {
    return <div className={`${base} border border-rose-200 bg-white text-rose-600 ${highlight ? "ring-4 ring-rose-200" : ""}`}>{label}</div>;
  }
  return <div className={`${base} border border-gray-200 bg-white text-gray-700 ${highlight ? "ring-4 ring-primary-200" : ""}`}>{label}</div>;
}
