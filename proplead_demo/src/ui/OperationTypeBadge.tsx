export type OperationType = "Venta" | "Alquiler";

export function OperationTypeBadge({ type }: { type: OperationType }) {
  const isVenta = type === "Venta";
  return (
    <span
      className={`rounded-full px-3 py-1 text-base ${
        isVenta ? "bg-primary-100 text-primary-800" : "bg-slate-100 text-slate-700"
      }`}
    >
      <span className="font-bold uppercase tracking-widest">{type}</span>
    </span>
  );
}

export function ConsentBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-base font-medium ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {ok ? "Consent OK" : "No consent"}
    </span>
  );
}
