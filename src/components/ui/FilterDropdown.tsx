import { useState } from "react";
import { ChevronDown, CheckSquare, Square } from "lucide-react";
import { cn } from "../../lib/utils";

/** Filtro desplegable estilo Leads/Tareas: etiqueta + valor actual + lista con check. */
export function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative min-w-[150px]">
      <div
        className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-btn border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="text-sm text-gray-700 font-medium flex-1 flex items-center justify-between gap-1">
          <span className="text-xs font-semibold text-gray-600 shrink-0 font-heading uppercase tracking-wider">{label}:</span>
          <div className="flex items-center gap-1 justify-end flex-1">
            {current?.label ?? ""}
            <ChevronDown size={14} className={cn("text-gray-400 transition-transform ml-1 shrink-0", open && "rotate-180")} />
          </div>
        </div>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
            <div className="space-y-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
                >
                  {value === opt.value ? <CheckSquare size={16} className="text-primary-600" /> : <Square size={16} className="text-gray-300" />}
                  <span className="text-xs text-gray-700 font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
