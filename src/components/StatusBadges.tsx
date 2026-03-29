import type { OperationType, QualificationStatus } from "../types";
import { cn } from "../lib/utils";

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
      <span className={cn("rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700", className)}>
        No cualificado
      </span>
    );
  }
  if (status === "no_response") {
    return (
      <span className={cn("rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800", className)}>
        Sin respuesta
      </span>
    );
  }
  if (status === "qualified") {
    return (
      <span className={cn("rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700", className)}>
        Cualificado
      </span>
    );
  }
  return (
    <span className={cn("rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700", className)}>
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
        isVenta ? "bg-primary-100 text-primary-800" : "bg-sky-100 text-sky-800",
        className
      )}
    >
      {type || "—"}
    </span>
  );
}
