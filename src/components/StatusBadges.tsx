import type { OperationType, QualificationStatus } from "../types";
import { cn } from "../lib/utils";
import { qualificationStatusClasses } from "../lib/metricTheme";

/** Estado de cualificación — mismos colores en toda la app */
export function QualificationBadge({
  status,
  className,
}: {
  status?: QualificationStatus | string | null;
  className?: string;
}) {
  if (!status || status === "not_qualified") {
    return (
      <span className={cn(qualificationStatusClasses.notQualified, "font-heading font-semibold", className)}>
        No cualificado
      </span>
    );
  }
  if (status === "no_response") {
    return (
      <span className={cn(qualificationStatusClasses.noResponse, "font-heading font-semibold", className)}>
        Sin respuesta
      </span>
    );
  }
  if (status === "qualified") {
    return (
      <span className={cn(qualificationStatusClasses.qualified, "font-heading font-semibold", className)}>
        Cualificado
      </span>
    );
  }
  return (
    <span className={cn(qualificationStatusClasses.rejected, "font-heading font-semibold", className)}>
      Rechazado
    </span>
  );
}

/** "Sigue publicado" de una captación (¿el anuncio sigue activo?). No se muestra si está sin especificar. */
export function StillListedBadge({ value, className }: { value?: boolean; className?: string }) {
  if (value === undefined) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        value ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500",
        className
      )}
    >
      {value ? "Publicado" : "No publicado"}
    </span>
  );
}

export function OperationTypeBadge({
  type,
  className,
}: {
  type?: OperationType | string | null;
  className?: string;
}) {
  const isVenta = type === "Venta";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        isVenta ? "bg-primary-100 text-primary-800" : "bg-slate-100 text-slate-700",
        className
      )}
    >
      <span className="font-heading font-bold uppercase tracking-widest">{type || "—"}</span>
    </span>
  );
}
