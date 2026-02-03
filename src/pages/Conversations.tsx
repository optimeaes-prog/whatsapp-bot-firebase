import { useEffect, useState } from "react";
import { MessageSquare, Search, ArrowLeft, Trash2 } from "lucide-react";
import type { Conversation } from "../types";
import { getConversations, deleteConversation } from "../services/conversations";
import { formatDate, formatPhoneWhatsApp, formatMessageTime, cn } from "../lib/utils";
import { LeadDetails } from "../components/LeadDetails";

export function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "finished">("all");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConversation(e: React.MouseEvent, conversation: Conversation) {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la conversación de ${conversation.name || formatPhoneWhatsApp(conversation.phone)}?`)) {
      return;
    }
    try {
      await deleteConversation(conversation.id);
      setConversations(conversations.filter(c => c.id !== conversation.id));
      if (selectedConversation?.id === conversation.id) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      alert("Error al eliminar la conversación");
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      (conv.phone || "").includes(search) ||
      (conv.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (conv.listingCode || "").toLowerCase().includes(search.toLowerCase());
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
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Panel izquierdo - Lista de conversaciones */}
      <div className={cn(
        "flex flex-col border-r border-gray-200 bg-white transition-all",
        selectedConversation ? "hidden md:flex md:w-[380px]" : "w-full md:w-[380px]"
      )}>
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Conversaciones</h1>

          {/* Búsqueda */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por teléfono o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
            />
          </div>

          {/* Filtros */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white transition-shadow"
          >
            <option value="all">Todas las conversaciones</option>
            <option value="active">Activas</option>
            <option value="finished">Finalizadas</option>
          </select>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <MessageSquare className="text-gray-300 mb-3" size={48} />
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                {conversations.length === 0 ? "No hay conversaciones" : "No se encontraron resultados"}
              </h3>
              <p className="text-xs text-gray-500">
                {conversations.length === 0
                  ? "Las conversaciones aparecerán aquí"
                  : "Intenta con otros términos"}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors",
                  selectedConversation?.id === conv.id && "bg-gray-100"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">
                        {conv.name || (conv.phone ? formatPhoneWhatsApp(conv.phone) : conv.id)}
                      </h3>
                      {conv.qualified !== null && conv.qualified !== undefined && (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-xs font-medium rounded",
                            conv.qualified
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {conv.qualified ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {conv.listingCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {conv.lastMessage ? formatDate(conv.lastMessage.toDate()) : "—"}
                      </span>
                      {conv.isFinished && (
                        <span className="text-xs text-gray-400 mt-1">Finalizada</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors"
                      title="Eliminar conversación"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div
                  className="flex flex-wrap gap-1 mt-2"
                  onClick={() => setSelectedConversation(conv)}
                >
                  {conv.tags?.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-primary-50 text-primary-600 border border-primary-100">
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer mt-2"
                  onClick={() => setSelectedConversation(conv)}
                >
                  <MessageSquare size={12} />
                  <span>{conv.messageCount || 0} mensajes</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel derecho - Detalle de conversación */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header del chat */}
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSelectedConversation(null)}
                className="md:hidden text-gray-600 hover:text-gray-900 p-1"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                  {selectedConversation.name || (selectedConversation.phone ? formatPhoneWhatsApp(selectedConversation.phone) : selectedConversation.id)}
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="truncate">{selectedConversation.listingCode}</span>
                  <span>•</span>
                  <span className="whitespace-nowrap">{selectedConversation.messageCount || 0} msjs</span>
                </div>
              </div>
            </div>
            {/* Badges - on separate line on mobile */}
            <div className="flex items-center gap-2 mt-2 ml-0 md:ml-0">
              {selectedConversation.isFinished && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                  Finalizada
                </span>
              )}
              {selectedConversation.qualified !== null && selectedConversation.qualified !== undefined && (
                <span
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium rounded-full",
                    selectedConversation.qualified
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  )}
                >
                  {selectedConversation.qualified ? "Cualificado" : "No interesado"}
                </span>
              )}
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-50" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}>
            <div className="space-y-2 sm:space-y-3 sm:max-w-4xl sm:mx-auto">
              {selectedConversation.history && selectedConversation.history.length > 0 ? (
                selectedConversation.history.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex",
                      item.role === "assistant" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] sm:max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                        item.role === "assistant"
                          ? "bg-green-500 text-white rounded-br-sm"
                          : "bg-white text-gray-900 rounded-bl-sm"
                      )}
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word' }}>{item.text}</p>
                      {item.timestamp && (
                        <p className={cn(
                          "text-[10px] mt-1 text-right",
                          item.role === "assistant"
                            ? "text-green-100"
                            : "text-gray-400"
                        )}>
                          {formatMessageTime(item.timestamp)}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No hay mensajes en esta conversación</p>
                </div>
              )}
            </div>
          </div>

          {/* Lead Details (Notes/Tags) */}
          <div className="border-t border-gray-200">
            <LeadDetails
              conversation={selectedConversation || undefined}
              onUpdate={() => {
                loadConversations();
              }}
            />
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageSquare className="mx-auto text-gray-300 mb-4" size={64} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Selecciona una conversación
            </h3>
            <p className="text-sm text-gray-500">
              Elige una conversación de la lista para ver los mensajes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
