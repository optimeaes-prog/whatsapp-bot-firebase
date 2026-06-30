import {
  collection,
  doc,
  addDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { CollabMessage, CollabTargetType } from "../types";
import { getOrganizationId, getOrganizationBasePath } from "../lib/organization";

function getCollabCollection() {
  return `${getOrganizationBasePath()}/collabMessages`;
}

/** Firestore rechaza `undefined`: dejamos solo las claves con valor (null SÍ se conserva). */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export type SendCollabMessageInput = {
  targetType: CollabTargetType;
  targetId: string;
  targetName: string;
  targetSubtitle?: string;
  targetStage?: string;
  recipientUid: string;
  recipientName?: string;
  authorUid: string;
  authorName?: string;
  body: string;
};

/**
 * Crea un mensaje de colaboración (etiqueta a un compañero sobre una captación/lead).
 * `participants` = [autor, destinatario] para que el inbox pueda consultar por usuario.
 */
export async function sendCollabMessage(input: SendCollabMessageInput): Promise<string> {
  const now = Timestamp.now();
  const data = stripUndefined({
    orgId: getOrganizationId(),
    targetType: input.targetType,
    targetId: input.targetId,
    targetName: input.targetName,
    targetSubtitle: input.targetSubtitle,
    targetStage: input.targetStage,
    participants: Array.from(new Set([input.authorUid, input.recipientUid].filter(Boolean))),
    recipientUid: input.recipientUid,
    recipientName: input.recipientName,
    authorUid: input.authorUid,
    authorName: input.authorName,
    body: input.body,
    readAt: null,
    createdAt: now,
  });
  const ref = await addDoc(collection(db, getCollabCollection()), data);
  return ref.id;
}

/**
 * Stream en tiempo real de TODOS los mensajes en los que participa el usuario
 * (los que envió y los que recibió). Alimenta el badge de no leídos y el inbox.
 */
export function subscribeMyCollab(
  uid: string,
  onChange: (messages: CollabMessage[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const trimmed = uid.trim();
  if (!trimmed) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(db, getCollabCollection()),
    where("participants", "array-contains", trimmed),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CollabMessage[];
      onChange(raw);
    },
    (err) => onError?.(err)
  );
}

/** Stream en tiempo real del hilo de un target concreto (todos los mensajes, en orden). */
export function subscribeTargetThread(
  targetType: CollabTargetType,
  targetId: string,
  onChange: (messages: CollabMessage[]) => void,
  onError?: (error: unknown) => void
): () => void {
  if (!targetId) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(db, getCollabCollection()),
    where("targetType", "==", targetType),
    where("targetId", "==", targetId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as CollabMessage[];
      onChange(raw);
    },
    (err) => onError?.(err)
  );
}

/**
 * Marca como leídos los mensajes indicados (solo el destinatario tiene permiso).
 * Quien llama ya tiene los mensajes en memoria (de su suscripción), así que solo
 * pasa los ids no leídos dirigidos a él — sin consultas extra ni índices nuevos.
 */
export async function markCollabRead(ids: string[]): Promise<void> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return;
  const now = Timestamp.now();
  // Un writeBatch admite hasta 500 operaciones; troceamos por seguridad.
  for (let i = 0; i < unique.length; i += 450) {
    const batch = writeBatch(db);
    for (const id of unique.slice(i, i + 450)) {
      batch.update(doc(db, getCollabCollection(), id), { readAt: now });
    }
    await batch.commit();
  }
}
