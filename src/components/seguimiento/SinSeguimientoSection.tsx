import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, PhoneCall, ExternalLink } from "lucide-react";
import type { Lead } from "../../types";
import { isQualifiedLead, leadRecencyMillis } from "../../services/leads";
import { cn, formatPhone } from "../../lib/utils";
import { formatShortDate } from "../../lib/prospectMeta";
import { QualificationBadge, OperationTypeBadge } from "../StatusBadges";

const PAGE_SIZE = 10;

/**
 * Compradores que aún no están en seguimiento (sin próxima acción, historial ni estado):
 * el punto de entrada para empezar a seguirlos sin salir de la página.
 * Cualificados primero, luego por actividad reciente.
 */
export function SinSeguimientoSection({
  leads, onStart, readOnly,
}: {
  leads: Lead[];
  onStart: (lead: Lead) => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(
    () =>
      [...leads].sort((a, b) => {
        const qa = isQualifiedLead(a) ? 1 : 0;
        const qb = isQualifiedLead(b) ? 1 : 0;
        if (qa !== qb) return qb - qa;
        return leadRecencyMillis(b) - leadRecencyMillis(a);
      }),
    [leads]
  );

  if (leads.length === 0) return null;

  const visible = sorted.slice(0, visibleCount);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-3 text-left hover:bg-gray-100/70 transition-colors"
      >
        <span className="text-sm font-bold text-gray-700 font-heading">
          Sin seguimiento <span className="text-gray-400 font-semibold">({leads.length})</span>
        </span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          <span className="hidden sm:inline">Compradores sin próxima acción ni historial</span>
          <ChevronDown size={16} className={cn("transition-transform shrink-0", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-50">
          {visible.map((l) => {
            const createdMs = l.createdAt?.toMillis?.();
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
                <div className="flex-1 min-w-0 basis-48">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {l.name || (l.phone ? formatPhone(l.phone) : "Sin nombre")}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {l.phone ? formatPhone(l.phone) : "Sin teléfono"}
                    {createdMs ? ` · ${formatShortDate(createdMs)}` : ""}
                  </p>
                </div>
                <QualificationBadge status={l.qualificationStatus} />
                <OperationTypeBadge type={l.operationType} />
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onStart(l)}
                  className="ml-auto inline-flex items-center gap-1 rounded-btn border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-40 transition-colors"
                >
                  <PhoneCall size={12} /> Iniciar seguimiento
                </button>
              </div>
            );
          })}
          <div className="flex items-center justify-between px-4 py-2.5">
            {sorted.length > visibleCount ? (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="text-sm font-semibold text-primary-600 hover:text-primary-700"
              >
                Ver más
              </button>
            ) : (
              <span />
            )}
            <Link to="/leads" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700">
              Ver todos en Leads <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
