/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CollabMessage } from "../types";
import { subscribeMyCollab } from "../services/collab";
import { useAuth } from "./AuthContext";

type CollabContextType = {
  /** Todos los mensajes (enviados + recibidos) del usuario actual, más recientes primero. */
  myMessages: CollabMessage[];
  /** Nº de mensajes recibidos por mí y aún sin leer (alimenta el badge). */
  unreadCount: number;
};

const CollabContext = createContext<CollabContextType | undefined>(undefined);

export function CollabProvider({ children }: { children: ReactNode }) {
  const { organizationId, effectiveUid } = useAuth();
  const [myMessages, setMyMessages] = useState<CollabMessage[]>([]);

  useEffect(() => {
    // Sin org o sin usuario no hay a qué suscribirse: pasamos uid vacío y el
    // servicio responde con [] y un unsubscribe vacío (sin construir consulta).
    const uid = organizationId ? effectiveUid : "";
    const unsub = subscribeMyCollab(
      uid,
      setMyMessages,
      (err) => console.error("[Collab] subscription error", err)
    );
    return () => unsub();
  }, [organizationId, effectiveUid]);

  const unreadCount = useMemo(
    () => myMessages.filter((m) => m.recipientUid === effectiveUid && !m.readAt).length,
    [myMessages, effectiveUid]
  );

  const value = useMemo(() => ({ myMessages, unreadCount }), [myMessages, unreadCount]);

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
}

export function useCollab(): CollabContextType {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error("useCollab must be used within a CollabProvider");
  return ctx;
}
