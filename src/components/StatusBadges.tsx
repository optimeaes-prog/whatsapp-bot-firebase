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
        isVenta ? "bg-primary-100 text-primary-800" : "bg-orange-100 text-orange-800",
        className
      )}
    >
      <span className="font-heading font-bold uppercase tracking-widest">{type || "—"}</span>
    </span>
  );
}
