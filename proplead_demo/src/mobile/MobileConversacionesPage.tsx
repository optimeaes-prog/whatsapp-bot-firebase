import type { ReactNode } from "react";
import { Search, Download, CheckCircle2, ChevronLeft, MessageSquare, Bot, FileText, Tag, Menu } from "lucide-react";
import type { Conversation, Message } from "../data/mockConversations";

export type MobileConversacionesStateProps = {
  // Which view is shown
  view: "list" | "thread";
  // Filter chip state
  listingFilter: string;
  filterHighlight?: boolean;
  // List rows
  visibleRows: { id: string; name: string; phone: string; listing: string; date: string; count: number; selected?: boolean; finished?: boolean }[];
  // Thread pane
  conv?: Conversation;
  threadHeaderProgress?: number;
  messagesOpacity?: number;
  scrollOffsetPx?: number;
  notesPanelProgress?: number;
  notesTypedText?: string;
  notesGenerating?: boolean;
  visibleTagsCount?: number;
};

export function MobileConversacionesPage(props: MobileConversacionesStateProps) {
  if (props.view === "list") return <ListView {...props} />;
  return <ThreadView {...props} />;
}

function ListView(props: MobileConversacionesStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      {/* App header */}
      <div className="flex items-center justify-between bg-white px-8 pt-6 pb-5 border-b border-gray-100">
        <div>
          <h1 className="text-[64px] font-bold text-gray-900 leading-none">Conversaciones</h1>
          <p className="mt-1 text-base text-gray-500">685 conversaciones</p>
        </div>
        <Menu size={44} className="text-gray-700" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 bg-white px-6 pb-3 pt-4">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-gray-200 bg-gray-50 p-1.5">
          <div className="rounded-lg bg-white py-3 text-center text-lg font-semibold text-gray-900 shadow-sm">LEADS</div>
          <div className="py-3 text-center text-lg font-semibold text-gray-500">NO IDENTIFICADOS</div>
        </div>

        {/* Search + filter */}
        <div className="mt-3 flex items-center gap-2.5">
          <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-500">
            <Search size={20} />
            <span>Buscar por teléfono o nombre…</span>
          </div>
        </div>

        {/* ANUNCIO chip */}
        <div className="mt-3">
          <div
            className={`flex items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3 text-base transition-all ${
              props.filterHighlight ? "border-primary-400 ring-4 ring-primary-200" : "border-gray-200"
            }`}
          >
            <span>
              <span className="mr-2 text-xs font-bold uppercase tracking-wider text-gray-500">ANUNCIO:</span>
              <span className="font-semibold text-gray-900">{props.listingFilter}</span>
            </span>
            <span className="text-gray-400">▾</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-hidden">
        {props.visibleRows.map((row) => (
          <div
            key={row.id}
            className={`border-b border-gray-100 px-7 py-5 ${row.selected ? "bg-primary-50/60" : "bg-white"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
                  <span className="truncate">{row.name}</span>
                  {row.finished && <CheckCircle2 size={22} className="shrink-0 text-emerald-500" />}
                </div>
                <div className="mt-1 flex items-center gap-2 text-base text-gray-500">
                  <span className="truncate">{row.listing}</span>
                  <span>·</span>
                  <MessageSquare size={16} className="shrink-0 text-gray-400" />
                  <span>{row.count}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base text-gray-700">{row.phone}</div>
                <div className="text-base text-gray-500">{row.date}</div>
                {row.finished && <div className="mt-1 text-sm font-semibold text-emerald-600">Finalizada</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThreadView(props: MobileConversacionesStateProps): ReactNode {
  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-emerald-50/40 to-white">
      {/* Header */}
      <div
        className="flex flex-col gap-3 border-b border-gray-200 bg-white px-7 pb-5 pt-6"
        style={{
          opacity: props.threadHeaderProgress ?? 1,
          transform: `translateY(${(1 - (props.threadHeaderProgress ?? 1)) * 12}px)`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ChevronLeft size={36} className="shrink-0 text-gray-600" />
            <div className="min-w-0">
              <h3 className="truncate text-3xl font-bold text-gray-900">{props.conv?.name}</h3>
              <p className="truncate text-base text-gray-500">
                {props.conv?.phoneMasked} · {props.conv?.messageCount} mensajes
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {props.conv?.finished && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-700">Finalizada</span>
          )}
          {props.conv?.qualified && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-700">Cualificado</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-base font-medium text-emerald-700">
              <Bot size={20} />
              Activo
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-base font-medium text-gray-700">
              <Download size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-hidden">
        <div
          className="absolute left-0 right-0 space-y-5 px-6 pb-4"
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

      {/* Notas + Tags */}
      <div
        className="space-y-3 border-t border-gray-200 bg-white p-5"
        style={{
          transform: `translateY(${(1 - (props.notesPanelProgress ?? 0)) * 120}%)`,
          opacity: props.notesPanelProgress ?? 0,
        }}
      >
        <div
          className={`rounded-2xl border bg-white p-4 transition-shadow ${
            props.notesGenerating ? "border-primary-300 shadow-[0_0_0_3px_rgba(255,176,63,0.18)]" : "border-gray-200"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-700">
              <FileText size={20} className="text-gray-500" />
              Notas
            </div>
            {props.notesGenerating && (
              <span className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wider text-primary-600">
                <Bot size={14} />
                Generando con IA…
              </span>
            )}
          </div>
          <p className="min-h-[60px] text-lg leading-relaxed text-gray-800">
            {props.notesTypedText ?? ""}
            {props.notesGenerating && <span className="ml-0.5 inline-block h-5 w-0.5 align-middle bg-primary-500" />}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-700">
            <Tag size={20} className="text-gray-500" />
            Tags
          </div>
          <div className="flex flex-wrap gap-2">
            {props.conv?.tags.slice(0, props.visibleTagsCount ?? 0).map((t) => (
              <span
                key={t}
                className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-base font-medium text-primary-700"
              >
                {t}
              </span>
            ))}
            <span className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-base text-gray-400">
              Nuevo tag…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaticMessageBubble({ msg }: { msg: Message }): ReactNode {
  const isAssistant = msg.role === "assistant";
  return isAssistant ? (
    <div>
      <p className="mb-1 text-sm font-semibold text-gray-500">Asistente</p>
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tl-sm bg-white p-5 text-xl leading-relaxed text-gray-800 shadow-sm ring-1 ring-gray-200">
        {msg.text}
        <div className="mt-2 text-right text-sm text-gray-400">{msg.time}</div>
      </div>
    </div>
  ) : (
    <div className="flex flex-col items-end">
      <p className="mb-1 text-sm font-semibold text-amber-700">Interesado</p>
      <div className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-amber-100 p-5 text-xl leading-relaxed text-amber-950">
        {msg.text}
        <div className="mt-2 text-right text-sm text-amber-700/70">{msg.time}</div>
      </div>
    </div>
  );
}
