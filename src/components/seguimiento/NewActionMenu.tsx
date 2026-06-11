import { useState } from "react";
import { ChevronDown, Plus, Target, PhoneCall } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui";

/**
 * "+ Nuevo" con dos acciones: crear una captación o registrar un seguimiento
 * sobre un contacto existente (propietario o comprador, vía buscador).
 */
export function NewActionMenu({
  subject, disabled, onNewCaptacion, onRegistrarSeguimiento,
}: {
  subject: "all" | "owner" | "buyer";
  disabled: boolean;
  onNewCaptacion: () => void;
  onRegistrarSeguimiento: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    {
      key: "seguimiento",
      label: "Registrar seguimiento",
      desc: "Llamada, visita o nota sobre un contacto existente",
      icon: <PhoneCall size={16} />,
      onClick: onRegistrarSeguimiento,
    },
    {
      key: "captacion",
      label: "Nueva captación",
      desc: "Propietario nuevo para captar",
      icon: <Target size={16} />,
      onClick: onNewCaptacion,
    },
  ];
  // En la pestaña Compradores el seguimiento es lo natural; en el resto, crear captación primero.
  const ordered = subject === "buyer" ? items : [items[1], items[0]];

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} disabled={disabled}>
        <Plus size={16} /> Nuevo <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
            {ordered.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className="flex items-start gap-3 w-full px-3 py-2.5 hover:bg-gray-50 rounded-btn transition-colors text-left"
              >
                <span className="mt-0.5 text-primary-600">{it.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">{it.label}</span>
                  <span className="block text-xs text-gray-500">{it.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
