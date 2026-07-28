import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Zoom de la vista "Tabla": un control tipo lupa (− / +) que cambia el tamaño de
 * la letra y el alto de las celdas para poder ver más filas de un vistazo (como
 * acercar/alejar en Excel). Cada nivel define el padding de la celda y el tamaño
 * de fuente; el resto de la tabla los hereda vía contexto.
 */
export const SPREADSHEET_ZOOMS = [
  { id: "xs", td: "px-1.5 py-1", text: "text-[10px]" },
  { id: "s", td: "px-2 py-1", text: "text-[11px]" },
  { id: "m", td: "px-2.5 py-1.5", text: "text-xs" },
  { id: "l", td: "px-3 py-2", text: "text-sm" },
] as const;

export type SpreadsheetZoomId = (typeof SPREADSHEET_ZOOMS)[number]["id"];
export type ZoomCfg = { td: string; text: string };

/** Por defecto un punto más pequeño que el tamaño normal (más denso). */
export const DEFAULT_ZOOM: SpreadsheetZoomId = "m";

export function zoomCfg(id: SpreadsheetZoomId): ZoomCfg {
  const z = SPREADSHEET_ZOOMS.find((x) => x.id === id) ?? SPREADSHEET_ZOOMS[2];
  return { td: z.td, text: z.text };
}

const ZoomContext = createContext<ZoomCfg>(zoomCfg(DEFAULT_ZOOM));

/** Las celdas editables leen el tamaño actual sin pasar props por toda la cadena. */
export const useZoom = () => useContext(ZoomContext);

export function SpreadsheetZoomProvider({ zoom, children }: { zoom: SpreadsheetZoomId; children: ReactNode }) {
  return <ZoomContext.Provider value={zoomCfg(zoom)}>{children}</ZoomContext.Provider>;
}

/** Control "lupa": botones − / + para reducir o aumentar el tamaño del texto de la tabla. */
export function ZoomControl({
  zoom,
  onChange,
}: {
  zoom: SpreadsheetZoomId;
  onChange: (z: SpreadsheetZoomId) => void;
}) {
  const idx = SPREADSHEET_ZOOMS.findIndex((x) => x.id === zoom);
  const setIdx = (i: number) =>
    onChange(SPREADSHEET_ZOOMS[Math.max(0, Math.min(SPREADSHEET_ZOOMS.length - 1, i))].id);
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-gray-300 bg-white px-1 py-0.5 shadow-sm">
      <button
        type="button"
        title="Texto más pequeño"
        disabled={idx <= 0}
        onClick={() => setIdx(idx - 1)}
        className={cn(
          "rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
        )}
      >
        <ZoomOut size={15} />
      </button>
      <button
        type="button"
        title="Texto más grande"
        disabled={idx >= SPREADSHEET_ZOOMS.length - 1}
        onClick={() => setIdx(idx + 1)}
        className={cn(
          "rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
        )}
      >
        <ZoomIn size={15} />
      </button>
    </div>
  );
}
