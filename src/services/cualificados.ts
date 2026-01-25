import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Cualificado } from "../types";

const COLLECTION_NAME = "cualificados";

export async function getCualificados(): Promise<Cualificado[]> {
  const q = query(
    collection(db, COLLECTION_NAME), 
    orderBy("createdAt", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Cualificado[];
}

export async function getCualificadoById(id: string): Promise<Cualificado | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Cualificado;
}

export async function createCualificado(data: {
  telefono: string;
  chatId: string;
  anuncio: string;
  resumenConversacion: string;
  nombre: string;
  cualificado: boolean;
}): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION_NAME), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}
