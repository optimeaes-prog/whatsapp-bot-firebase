import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import type { Anuncio, AnuncioFormData } from "../types";

const COLLECTION_NAME = "anuncios";

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

export async function getAnuncios(): Promise<Anuncio[]> {
  try {
    const currentUser = auth.currentUser;
    console.log("Current user:", currentUser?.email || "NOT AUTHENTICATED");
    
    if (!currentUser) {
      throw new Error("Usuario no autenticado. Por favor, inicia sesión.");
    }

    console.log("Fetching anuncios (timeout: 60s)...");
    const colRef = collection(db, COLLECTION_NAME);
    
    const snapshot = await withTimeout(getDocs(colRef), 60000, "getAnuncios");
    console.log(`Fetched ${snapshot.docs.length} anuncios`);
    
    const anuncios = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Anuncio[];
    return anuncios.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error fetching anuncios:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.name, error.message);
    }
    throw error;
  }
}

export async function getAnuncioById(id: string): Promise<Anuncio | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) {
    return null;
  }
  return { id: snapshot.id, ...snapshot.data() } as Anuncio;
}

export async function getAnuncioByAnuncioId(anuncioId: string): Promise<Anuncio | null> {
  const q = query(collection(db, COLLECTION_NAME));
  const snapshot = await getDocs(q);
  const found = snapshot.docs.find((doc) => doc.data().anuncio === anuncioId);
  if (!found) {
    return null;
  }
  return { id: found.id, ...found.data() } as Anuncio;
}

export async function createAnuncio(data: AnuncioFormData): Promise<string> {
  const now = Timestamp.now();
  try {
    const currentUser = auth.currentUser;
    console.log("Creating anuncio for user:", currentUser?.email);
    console.log("Data:", JSON.stringify(data));
    
    const docRef = await withTimeout(
      addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
      120000, // 2 minutes timeout
      "createAnuncio"
    );
    console.log("Anuncio created with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating anuncio:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.name, error.message);
    }
    throw error;
  }
}

export async function updateAnuncio(id: string, data: Partial<AnuncioFormData>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteAnuncio(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}
