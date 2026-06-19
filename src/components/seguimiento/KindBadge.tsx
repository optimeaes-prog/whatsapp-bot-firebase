import { cn } from "../../lib/utils";

/** Distingue propietario (captación) de comprador (lead) en listas mezcladas. */
export function KindBadge({ kind, className }: { kind: "prospect" | "lead"; className?: string }) {
  const isProspect = kind === "prospect";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
        isProspect ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-indigo-50 text-indigo-700 border-indigo-200",
        className
      )}
    >
      {isProspect ? "Captación" : "Lead"}
    </span>
  );
}
