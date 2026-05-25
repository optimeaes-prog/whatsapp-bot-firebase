import { Search, Filter, ChevronDown, Settings, Phone, Calendar, Check } from "lucide-react";
import { QualificationBadge } from "../ui/QualificationBadge";
import { ConsentBadge } from "../ui/OperationTypeBadge";
import { MOCK_LEADS, QUALIFIED_LEADS, type Lead } from "../data/mockLeads";

const TABS = ["Todos", "No cualificados", "Sin respuesta", "Cualificados", "Rechazados"] as const;
type Tab = (typeof TABS)[number];

export type LeadsStateProps = {
  activeTab: Tab;
  /** Visual position of the tab pill (0..4). Allows smooth slide animation. */
  tabPillIndex: number;
  totalLeads: number;
  shownLeads: number;
  selectedIds: Set<string>;
  rowsToRender?: Lead[];
  // Bulk action UI
  bulkBarVisible: boolean;
  bulkBarOffset: number; // -100 (hidden) → 0 (shown)
  bulkBarHighlight?: "enviar" | "estado" | "tag" | "eliminar" | null;
};

export function LeadsPage(props: LeadsStateProps) {
  const rows = props.rowsToRender ?? (props.activeTab === "Cualificados" ? QUALIFIED_LEADS : MOCK_LEADS);

  return (
    <div className="absolute inset-0 overflow-hidden bg-gray-50 p-10">
      {/* Header */}
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h1 className="text-5xl font-bold text-gray-900">Leads</h1>
              <p className="mt-2 text-lg text-gray-600">
                Mostrando <span className="font-semibold">{props.shownLeads}</span> de{" "}
                <span className="font-semibold">{props.totalLeads}</span> leads · Último análisis: 22 may 2026, 13:11
              </p>
            </div>

            {/* Tab toggle — equal-width grid so the animated pill aligns precisely */}
            <div className="relative grid w-[920px] grid-cols-5 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
              {/* Animated pill */}
              <div
                className="absolute top-1.5 bottom-1.5 rounded-lg bg-primary-50 ring-1 ring-primary-200"
                style={{
                  width: `calc((100% - 0.75rem) / 5)`,
                  left: `calc(0.375rem + ${props.tabPillIndex} * (100% - 0.75rem) / 5)`,
                }}
              />
              {TABS.map((t) => (
                <div
                  key={t}
                  className={`relative z-10 whitespace-nowrap py-3 text-center text-lg font-semibold ${
                    t === props.activeTab ? "text-primary-700" : "text-gray-600"
                  }`}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Filters card */}
          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700">
                <Filter size={22} />
                <span className="text-xl font-semibold">Filtros</span>
              </div>
              <button className="rounded-md border border-gray-200 px-4 py-2 text-base text-gray-600">⊗ Restablecer</button>
            </div>

            <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-lg text-gray-500">
              <Search size={20} />
              <span>Buscar por teléfono, nombre o anuncio…</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <MiniFilter label="ANUNCIO" value="Todos" />
              <MiniFilter label="TIPO" value="Todos" />
              <MiniFilter label="Mascota" value="Todos" />
              <MiniFilter label="Pago" value="Todos" />
              <MiniFilter label="INGRESOS" value="Todos" />
              <div className="ml-auto inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 py-2 text-base">
                <Settings size={18} className="text-gray-500" />
                <span className="text-base font-semibold uppercase tracking-wider text-gray-500">COLUMNAS:</span>
                <span className="font-medium text-gray-900">12/18</span>
                <ChevronDown size={18} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Bulk action toolbar */}
          {props.bulkBarVisible && (
            <div
              className="mb-3 flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 px-5 py-3.5 shadow-sm"
              style={{ transform: `translateY(${props.bulkBarOffset}%)`, transition: "transform 0.2s" }}
            >
              <p className="text-lg font-semibold text-primary-800">
                {props.selectedIds.size} lead{props.selectedIds.size === 1 ? "" : "s"} seleccionado
                {props.selectedIds.size === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2.5">
                <BulkBtn label="Enviar mensaje" highlight={props.bulkBarHighlight === "enviar"} primary />
                <BulkBtn label="Cambiar estado" highlight={props.bulkBarHighlight === "estado"} />
                <BulkBtn label="Añadir tag" highlight={props.bulkBarHighlight === "tag"} />
                <BulkBtn label="Eliminar" highlight={props.bulkBarHighlight === "eliminar"} danger />
              </div>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200 text-left text-base font-semibold uppercase tracking-wider text-gray-500">
                  <th className="w-12 px-4 py-3.5"></th>
                  <th className="w-36 px-2 py-3.5">NOMBRE ↕</th>
                  <th className="w-52 px-2 py-3.5">TELÉFONO ↕</th>
                  <th className="w-56 px-2 py-3.5">IDENTIFICADOR ANUNCIO</th>
                  <th className="w-40 px-2 py-3.5">ESTADO ↕</th>
                  <th className="w-40 px-2 py-3.5">CONSENTIMIENTO</th>
                  <th className="w-52 px-2 py-3.5">
                    <div className="inline-flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>CUALIFICACION ↓</span>
                    </div>
                  </th>
                  <th className="w-28 px-2 py-3.5">MENSAJES ↕</th>
                  <th className="w-32 px-2 py-3.5">RESUMEN</th>
                  <th className="w-28 px-2 py-3.5">MASCOTAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => {
                  const selected = props.selectedIds.has(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`border-b border-gray-100 text-base ${selected ? "bg-primary-50/50" : "bg-white"}`}
                    >
                      <td className="px-4 py-3.5">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded border-2 ${
                            selected ? "border-primary-500 bg-primary-500" : "border-gray-300 bg-white"
                          }`}
                        >
                          {selected && <Check size={16} strokeWidth={3} className="text-white" />}
                        </div>
                      </td>
                      <td className="px-2 py-3.5 text-lg font-medium text-gray-900">{lead.name}</td>
                      <td className="px-2 py-3.5 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Phone size={15} className="text-gray-400" />
                          {lead.phoneMasked}
                        </div>
                      </td>
                      <td className="px-2 py-3.5 text-gray-700">{lead.listingName}</td>
                      <td className="px-2 py-3.5">
                        <QualificationBadge status={lead.status} />
                      </td>
                      <td className="px-2 py-3.5">
                        <ConsentBadge ok={lead.consent} />
                      </td>
                      <td className="px-2 py-3.5 text-gray-700">{lead.qualificationDate}</td>
                      <td className="px-2 py-3.5 text-gray-700">{lead.messages}</td>
                      <td className="px-2 py-3.5">
                        {lead.summary ? (
                          <span className="font-medium text-primary-600 underline underline-offset-2">Ver Resumen</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3.5 text-gray-700">{lead.hasPets}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
    </div>
  );
}

function MiniFilter({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 py-2 text-base">
      <span className="text-base font-semibold uppercase tracking-wider text-gray-500">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
      <ChevronDown size={18} className="text-gray-400" />
    </div>
  );
}

function BulkBtn({ label, highlight, primary, danger }: { label: string; highlight?: boolean; primary?: boolean; danger?: boolean }) {
  const base = "rounded-md px-4 py-2.5 text-lg font-semibold transition-all";
  if (primary) {
    return (
      <div className={`${base} bg-primary-500 text-white ${highlight ? "ring-4 ring-primary-300" : ""}`}>{label}</div>
    );
  }
  if (danger) {
    return (
      <div className={`${base} border border-rose-200 bg-white text-rose-600 ${highlight ? "ring-4 ring-rose-200" : ""}`}>
        {label}
      </div>
    );
  }
  return (
    <div className={`${base} border border-gray-200 bg-white text-gray-700 ${highlight ? "ring-4 ring-primary-200" : ""}`}>
      {label}
    </div>
  );
}
