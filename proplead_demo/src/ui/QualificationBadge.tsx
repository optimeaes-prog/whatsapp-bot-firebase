export type QualificationStatus = "not_qualified" | "no_response" | "qualified" | "rejected";

const CLASSES: Record<QualificationStatus, string> = {
  not_qualified: "rounded-full bg-slate-100 px-3 py-1 text-base font-semibold text-slate-700",
  no_response: "rounded-full bg-sky-100 px-3 py-1 text-base font-semibold text-sky-800",
  qualified: "rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-700",
  rejected: "rounded-full bg-rose-100 px-3 py-1 text-base font-semibold text-rose-700",
};

const LABELS: Record<QualificationStatus, string> = {
  not_qualified: "No cualificado",
  no_response: "Sin respuesta",
  qualified: "Cualificado",
  rejected: "Rechazado",
};

export function QualificationBadge({ status }: { status: QualificationStatus }) {
  return <span className={CLASSES[status]}>{LABELS[status]}</span>;
}
