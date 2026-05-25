import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function FilterPill({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm transition-colors ${
        highlight ? "border-primary-400 ring-2 ring-primary-200" : "border-gray-200"
      }`}
    >
      {icon && <span className="text-gray-500">{icon}</span>}
      <span className="font-semibold uppercase tracking-wider text-gray-500 text-[11px]">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
      <ChevronDown size={14} className="text-gray-400" />
    </div>
  );
}
