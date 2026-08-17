import { formatMessageDay } from "../lib/utils";

/**
 * Separador de día estilo WhatsApp entre mensajes del chat.
 * Lo usan la conversación de Leads y la de Conversaciones para que las dos
 * vistas muestren siempre las fechas igual.
 */
export function ChatDayDivider({ timestamp }: { timestamp: number }) {
  return (
    <div className="flex justify-center py-1">
      <span className="px-3 py-1 rounded-full bg-white/90 border border-gray-200 text-[10px] font-semibold uppercase tracking-wide text-gray-500 shadow-sm">
        {formatMessageDay(timestamp)}
      </span>
    </div>
  );
}
