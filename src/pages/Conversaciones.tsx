import { useEffect, useState } from "react";
import { MessageSquare, User, Clock, CheckCircle, XCircle, Search } from "lucide-react";
import type { Conversacion, HistoryItem } from "../types";
import { getConversaciones } from "../services/conversaciones";
import { formatDate, formatPhone, cn } from "../lib/utils";

export function Conversaciones() {
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "finished">("all");
  const [selectedConversacion, setSelectedConversacion] = useState<Conversacion | null>(null);

  useEffect(() => {
    loadConversaciones();
  }, []);

  async function loadConversaciones() {
    try {
      const data = await getConversaciones();
      setConversaciones(data);
    } catch (error) {
      console.error("Error loading conversaciones:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredConversaciones = conversaciones.filter((conv) => {
    const matchesSearch =
      conv.telefono.includes(search) ||
      conv.anuncio.toLowerCase().includes(search.toLowerCase()) ||
      (conv.nombre && conv.nombre.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && !conv.isFinished) ||
      (filterStatus === "finished" && conv.isFinished);
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Lista de conversaciones */}
      <div className="w-full lg:w-1/3 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Conversaciones</h1>
          <span className="text-sm text-gray-500">{conversaciones.length} totales</span>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            {[
              { value: "all", label: "Todas" },
              { value: "active", label: "Activas" },
              { value: "finished", label: "Finalizadas" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value as typeof filterStatus)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  filterStatus === option.value
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredConversaciones.length === 0 ? (
            <div className="card text-center py-8">
              <MessageSquare className="mx-auto text-gray-400 mb-2" size={32} />
              <p className="text-gray-500">No hay conversaciones</p>
            </div>
          ) : (
            filteredConversaciones.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversacion(conv)}
                className={cn(
                  "w-full text-left card p-4 transition-colors",
                  selectedConversacion?.id === conv.id
                    ? "ring-2 ring-primary-500 bg-primary-50"
                    : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {conv.nombre || "Sin nombre"}
                    </span>
                  </div>
                  {conv.isFinished ? (
                    conv.cualificado ? (
                      <CheckCircle size={16} className="text-green-500" />
                    ) : (
                      <XCircle size={16} className="text-red-500" />
                    )
                  ) : (
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{formatPhone(conv.telefono)}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{conv.anuncio}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {conv.ultimoMensaje ? formatDate(conv.ultimoMensaje.toDate()) : "—"}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalle de conversación */}
      <div className="hidden lg:flex flex-1 flex-col">
        {selectedConversacion ? (
          <ChatViewer conversacion={selectedConversacion} />
        ) : (
          <div className="flex-1 flex items-center justify-center card">
            <div className="text-center">
              <MessageSquare className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-500">Selecciona una conversación para ver los detalles</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatViewer({ conversacion }: { conversacion: Conversacion }) {
  return (
    <div className="card flex flex-col h-full p-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              {conversacion.nombre || "Sin nombre"}
            </h2>
            <p className="text-sm text-gray-500">{formatPhone(conversacion.telefono)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{conversacion.anuncio}</p>
            <p className="text-xs text-gray-400">{conversacion.numeroMensajes} mensajes</p>
          </div>
        </div>
        {conversacion.isFinished && (
          <div
            className={cn(
              "mt-3 px-3 py-2 rounded-lg text-sm font-medium",
              conversacion.cualificado
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {conversacion.cualificado ? "Lead cualificado" : "Lead no interesado"}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {conversacion.history && conversacion.history.length > 0 ? (
          conversacion.history.map((item: HistoryItem, index: number) => (
            <div
              key={index}
              className={cn(
                "max-w-[80%] p-3 rounded-lg",
                item.role === "assistant"
                  ? "bg-white border border-gray-200 mr-auto"
                  : "bg-primary-600 text-white ml-auto"
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{item.text}</p>
              <p
                className={cn(
                  "text-xs mt-1",
                  item.role === "assistant" ? "text-gray-400" : "text-primary-200"
                )}
              >
                {formatDate(item.timestamp)}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-400 py-8">
            No hay mensajes en esta conversación
          </div>
        )}
      </div>
    </div>
  );
}
