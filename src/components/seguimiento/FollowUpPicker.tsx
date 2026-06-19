import { useMemo, useState } from "react";
import { Search, X, Target } from "lucide-react";
import type { Lead, Prospect } from "../../types";
import { prospectToItem, leadToItem, type FollowUpItem } from "../../lib/followUp";
import { cn, normalizePhoneForMatch } from "../../lib/utils";
import { Button, SegmentedControl } from "../ui";
import { KindBadge } from "./KindBadge";

type KindFilter = "all" | "prospect" | "lead";

/**
 * Buscador para "Registrar seguimiento": encuentra un propietario o comprador
 * por nombre o teléfono (en cualquier formato) y lo pasa al registro rápido.
 * Sin búsqueda muestra los 10 más recientes.
 */
export function FollowUpPicker({
  prospects, leads, defaultKind = "all", onSelect, onClose, onCreateNew,
}: {
  prospects: Prospect[];
  leads: Lead[];
  defaultKind?: KindFilter;
  onSelect: (item: FollowUpItem) => void;
  onClose: () => void;
  onCreateNew: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>(defaultKind);

  const allItems = useMemo(
    () => [...prospects.map(prospectToItem), ...leads.map(leadToItem)],
    [prospects, leads]
  );

  const results = useMemo(() => {
    const pool = kind === "all" ? allItems : allItems.filter((i) => i.kind === kind);
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...pool].sort((a, b) => b.recencyMillis - a.recencyMillis).slice(0, 10);
    }
    const phoneKey = normalizePhoneForMatch(query);
    return pool
      .filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (phoneKey.length >= 3 && normalizePhoneForMatch(i.phone).includes(phoneKey))
      )
      .slice(0, 20);
  }, [allItems, kind, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900 font-heading">Registrar seguimiento</h2>
            <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600" title="Cerrar">
              <X size={20} />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              autoFocus
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) onSelect(results[0]);
              }}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none bg-white"
            />
          </div>
          <SegmentedControl
            ariaLabel="Tipo de contacto"
            mode="single"
            value={kind}
            onChange={(v) => setKind(v)}
            className="!shadow-none"
            options={[
              { value: "all", label: "Todos" },
              { value: "prospect", label: "Propietarios" },
              { value: "lead", label: "Leads" },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Sin resultados{query ? ` para “${query}”` : ""}.
            </p>
          ) : (
            results.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => onSelect(i)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-left transition-colors"
              >
                <KindBadge kind={i.kind} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-gray-900 truncate">{i.name}</span>
                  <span className="block text-xs text-gray-500 truncate">{i.phone || "Sin teléfono"}</span>
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", i.statusClasses)}>
                  {i.statusLabel}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500">¿No lo encuentras?</span>
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            <Target size={14} /> Nueva captación
          </button>
        </div>
      </div>
    </div>
  );
}
