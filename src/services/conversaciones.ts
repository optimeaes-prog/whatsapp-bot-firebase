import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  where,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Conversacion, HistoryItem } from "../types";

const COLLECTION_NAME = "conversaciones";

export async function getConversaciones(): Promise<Conversacion[]> {
  const q = query(
    collection(db, COLLECTION_NAME), 
    orderBy("ultimoMensaje", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversacion[];
}

export async function getConversacionById(id: string): Promise<Conversacion | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Conversacion;
}

export async function getConversacionByChatId(chatId: string): Promise<Conversacion | null> {
  const q = query(collection(db, COLLECTION_NAME), where("chatId", "==", chatId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Conversacion;
}

export async function upsertConversacion(
  chatId: string,
  data: {
    telefono: string;
    anuncio: string;
    history: HistoryItem[];
    nombre?: string;
    cualificado?: boolean | null;
    isFinished?: boolean;
  }
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, chatId);
  const existing = await getDoc(docRef);

  const now = Timestamp.now();
  const historyArray = data.history || [];

  if (existing.exists()) {
    await setDoc(
      docRef,
      {
        ...data,
        chatId,
        numeroMensajes: historyArray.length,
        ultimoMensaje: now,
      },
      { merge: true }
    );
  } else {
    await setDoc(docRef, {
      ...data,
      chatId,
      numeroMensajes: historyArray.length,
      ultimoMensaje: now,
      cualificado: data.cualificado ?? null,
      isFinished: data.isFinished ?? false,
    });
  }
}

export async function getConversacionesActivas(): Promise<Conversacion[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("isFinished", "==", false),
    orderBy("ultimoMensaje", "desc"),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Conversacion[];
}
