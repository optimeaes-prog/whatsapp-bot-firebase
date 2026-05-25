import type { ReactNode } from "react";
import { Search, Download, CheckCircle2, ChevronDown, MessageSquare, Bot, FileText, Tag, Check } from "lucide-react";
// QualificationBadge intentionally not used here — we render the Cualificado pill
// inline so it matches the "Finalizada" pill size exactly.
import type { Conversation, Message } from "../data/mockConversations";

export type ConversacionesStateProps = {
  listingFilter: string;
  listingDropdownOpen: boolean;
  listingHoverIdx?: number;
  filterHighlight?: boolean;
  visibleRows: { id: string; name: string; phone: string; listing: string; date: string; count: number; selected?: boolean; finished?: boolean }[];
  showThread: boolean;
  conv?: Conversation;
  threadHeaderProgress?: number;
  messagesOpacity?: number;
  scrollOffsetPx?: number;
  notesPanelProgress?: number;
  notesTypedText?: string;
  notesGenerating?: boolean;
  visibleTagsCount?: number;
};

const LISTING_OPTIONS = ["Todos", "Los Alamos", "Casa Algarrobo", "Adosado Chilches", "Sayalonga"];

export function ConversacionesPage(props: ConversacionesStateProps) {
  return (
    <div className="absolute inset-0 flex overflow-hidden bg-white">
      {/* List pane — widened again to fit larger text */}
      <div className="flex w-[800px] shrink-0 flex-col border-r border-gray-200 bg-white">
            {/* Header — compact */}
            <div className="border-b border-gray-200 px-7 pt-4 pb-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-5xl font-bold text-gray-900">Conversaciones</h2>
                <span className="rounded-full bg-gray-100 px-4 py-1.5 text-lg font-semibold text-gray-700">685</span>
              </div>

              {/* LEADS / NO IDENTIFICADOS tabs */}
              <div className="mb-1.5 grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
                <div className="rounded-md bg-white py-2 text-center text-lg font-semibold text-gray-900 shadow-sm">LEADS</div>
                <div className="py-2 text-center text-lg font-semibold text-gray-500">NO IDENTIFICADOS</div>
              </div>

              {/* TODOS / OPT-OUT / ACTIVOS */}
              <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
                <div className="rounded-md bg-primary-50 py-2 text-center text-lg font-semibold text-primary-700">TODOS</div>
                <div className="py-2 text-center text-lg font-semibold text-gray-500">OPT-OUT</div>
                <div className="py-2 text-center text-lg font-semibold text-gray-500">ACTIVOS</div>
              </div>

              {/* Search */}
              <div className="mb-2.5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-xl text-gray-500">
                <Search size={26} />
                <span>Buscar por teléfono o nombre…</span>
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-2 gap-2 text-lg">
                <FilterChip label="FECHA" value="Todos" />
                <div className="relative">
                  <FilterChip label="ANUNCIO" value={props.listingFilter} highlight={props.filterHighlight} />
                  {props.listingDropdownOpen && (
                    <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                      {LISTING_OPTIONS.map((opt, i) => (
                        <div
                          key={opt}
                          className={`flex items-center justify-between rounded-lg px-4 py-3 text-xl ${
                            i === props.listingHoverIdx ? "bg-primary-50 text-primary-700" : "text-gray-700"
                          }`}
                        >
                          <span>{opt}</span>
                          {opt === props.listingFilter && <Check size={22} className="text-primary-500" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <FilterChip label="CUALIF" value="Todos" />
                <FilterChip label="OPT-OUT" value="Todos" />
                <FilterChip label="BOT" value="Todos" />
                <FilterChip label="ESTADO" value="Todos" />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-hidden">
              {props.visibleRows.map((row) => (
                <div
                  key={row.id}
                  className={`border-b border-gray-100 px-7 py-5 ${row.selected ? "bg-primary-50/60" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
                        {row.name}
                        {row.finished && <CheckCircle2 size={22} className="text-emerald-500" />}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-lg text-gray-500">
                        <span>{row.listing}</span>
                        <span>·</span>
                        <MessageSquare size={18} className="text-gray-400" />
                        <span>{row.count}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg text-gray-700">{row.phone}</div>
                      <div className="text-lg text-gray-500">{row.date}</div>
                      {row.finished && <div className="mt-1 text-base font-semibold text-emerald-600">Finalizada</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thread pane */}
          <div className="flex flex-1 flex-col bg-gradient-to-b from-emerald-50/40 to-white">
            {!props.showThread ? (
              <div className="flex h-full items-center justify-center text-xl text-gray-400">
                Selecciona una conversación
              </div>
            ) : (
              <>
                {/* Header */}
                <div
                  className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-6"
                  style={{
                    opacity: props.threadHeaderProgress ?? 1,
                    transform: `translateY(${(1 - (props.threadHeaderProgress ?? 1)) * 12}px)`,
                  }}
                >
                  <div>
                    <h3 className="text-5xl font-bold text-gray-900">{props.conv?.name}</h3>
                    <p className="mt-2 text-xl text-gray-500">
                      {props.conv?.phoneMasked} · {props.conv?.listingId} · {props.conv?.messageCount} mensajes
                    </p>
                    <div className="mt-3 flex gap-2">
                      {props.conv?.finished && (
                        <span className="rounded-full bg-emerald-100 px-3.5 py-1 text-lg font-semibold text-emerald-700">
                          Finalizada
                        </span>
                      )}
                      {props.conv?.qualified && (
                        <span className="rounded-full bg-emerald-100 px-3.5 py-1 text-lg font-semibold text-emerald-700">
                          Cualificado
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center gap-2.5 rounded-md bg-emerald-50 px-5 py-3.5 text-xl font-medium text-emerald-700">
                      <Bot size={26} />
                      Asistente Activo
                    </div>
                    <div className="inline-flex items-center gap-2.5 rounded-md border border-gray-200 bg-white px-5 py-3.5 text-xl font-medium text-gray-700">
                      <Download size={22} />
                      Descargar
                    </div>
                  </div>
                </div>

                {/* Messages — anchored to bottom. */}
                <div className="relative flex-1 overflow-hidden">
                  <div
                    className="absolute left-0 right-0 space-y-7 px-8 pb-4"
                    style={{
                      bottom: `${props.scrollOffsetPx ?? 0}px`,
                      opacity: props.messagesOpacity ?? 1,
                    }}
                  >
                    {props.conv?.messages.map((msg, idx) => (
                      <StaticMessageBubble key={idx} msg={msg} />
                    ))}
                  </div>
                </div>

                {/* Notas + Tags footer */}
                <div
                  className="grid grid-cols-2 gap-4 border-t border-gray-200 bg-white p-6"
                  style={{
                    transform: `translateY(${(1 - (props.notesPanelProgress ?? 0)) * 120}%)`,
                    opacity: props.notesPanelProgress ?? 0,
                  }}
                >
                  <div className={`rounded-lg border bg-white p-5 transition-shadow ${
                    props.notesGenerating ? "border-primary-300 shadow-[0_0_0_3px_rgba(255,176,63,0.18)]" : "border-gray-200"
                  }`}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-lg font-semibold text-gray-700">
                        <FileText size={22} className="text-gray-500" />
                        Notas
                      </div>
                      {props.notesGenerating && (
                        <span className="flex items-center gap-1.5 text-base font-medium uppercase tracking-wider text-primary-600">
                          <Bot size={18} />
                          Generando con IA…
                        </span>
                      )}
                    </div>
                    <p className="min-h-[64px] text-xl leading-relaxed text-gray-800">
                      {props.notesTypedText ?? ""}
                      {props.notesGenerating && (
                        <span className="ml-0.5 inline-block h-6 w-0.5 align-middle bg-primary-500" />
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white p-5">
                    <div className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-700">
                      <Tag size={22} className="text-gray-500" />
                      Tags
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {props.conv?.tags.slice(0, props.visibleTagsCount ?? 0).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-primary-50 px-3.5 py-1.5 text-lg font-medium text-primary-700 border border-primary-100"
                        >
                          {t}
                        </span>
                      ))}
                      <span className="rounded-full border border-dashed border-gray-300 px-3.5 py-1.5 text-lg text-gray-400">
                        Nuevo tag…
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
    </div>
  );
}

function FilterChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`inline-flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-4 py-2.5 transition-all ${
        highlight ? "border-primary-400 ring-2 ring-primary-200" : "border-gray-200"
      }`}
    >
      <div>
        <span className="mr-1.5 text-base font-semibold uppercase tracking-wider text-gray-500">{label}:</span>
        <span className="text-lg font-medium text-gray-900">{value}</span>
      </div>
      <ChevronDown size={20} className="text-gray-400" />
    </div>
  );
}

function StaticMessageBubble({ msg }: { msg: Message }): ReactNode {
  const isAssistant = msg.role === "assistant";
  return isAssistant ? (
    <div>
      <p className="mb-2 text-lg font-semibold text-gray-500">Asistente</p>
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-white p-6 text-xl leading-relaxed text-gray-800 shadow-sm ring-1 ring-gray-200">
        {msg.text}
        <div className="mt-3 text-right text-base text-gray-400">{msg.time}</div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-end">
      <p className="mb-2 text-lg font-semibold text-amber-700">Interesado</p>
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-amber-100 p-6 text-xl leading-relaxed text-amber-950">
        {msg.text}
        <div className="mt-3 text-right text-base text-amber-700/70">{msg.time}</div>
      </div>
    </div>
  );
}
