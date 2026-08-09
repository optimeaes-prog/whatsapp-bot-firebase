import crypto from "crypto";
import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

/**
 * Enlaces cortos para el aviso de "leads sin respuesta".
 *
 * El token firmado mide unos 140 caracteres y en WhatsApp ocupa cinco líneas.
 * Aquí se guarda ese token bajo un código corto y en el mensaje solo viaja el
 * código: proplead.io/leads-inactivos/Xk7mQ2pRt9.
 *
 * El código no sustituye a la firma. Al abrirlo se recupera el token y se
 * verifica igual que siempre, así que sigue siendo el HMAC lo que decide de qué
 * organización (y de qué agente) es la lista, y cuándo caduca.
 */

const DB_NAME = "realestate-whatsapp-bot";
const COLLECTION = "inactiveLeadsLinks";

/**
 * 10 caracteres del alfabeto de abajo son ~8·10^17 combinaciones. Con el límite
 * de peticiones por IP del endpoint, adivinar uno no es realista, y sigue siendo
 * corto de leer. Con 6 el margen se vuelve incómodo para un enlace que enseña
 * nombres, teléfonos y conversaciones.
 */
const CODE_LENGTH = 10;

/** Sin vocales ni 0/O/1/l: así un código no forma palabras ni se lee mal. */
const CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXYZbcdfghjkmnpqrstvwxyz23456789";

/** Cuántos códigos caducados se limpian por ejecución. */
const PURGE_BATCH = 300;

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

/** Código aleatorio sin sesgo (se descartan los bytes que caerían fuera). */
export function generateLinkCode(length = CODE_LENGTH): string {
  const max = Math.floor(256 / CODE_ALPHABET.length) * CODE_ALPHABET.length;
  let out = "";
  while (out.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte >= max) continue;
      out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Solo lo que puede haber generado `generateLinkCode`. */
export function isValidLinkCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const char of code) {
    if (!CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Guarda el token bajo un código nuevo y lo devuelve.
 *
 * `create` (y no `set`) para que un choque de códigos falle en vez de pisar el
 * enlace de otra agencia. Con este alfabeto es prácticamente imposible, pero el
 * fallo silencioso sería enseñarle a alguien la lista equivocada.
 */
export async function createInactiveLeadsLink(params: {
  token: string;
  expiresAtMs: number;
}): Promise<string> {
  const code = generateLinkCode();
  await db().collection(COLLECTION).doc(code).create({
    token: params.token,
    expiresAt: Timestamp.fromMillis(params.expiresAtMs),
    createdAt: Timestamp.now(),
  });
  return code;
}

/** Token guardado bajo ese código, o null si no existe o ya caducó. */
export async function resolveInactiveLeadsLink(code: string): Promise<string | null> {
  if (!isValidLinkCode(code)) return null;

  const snap = await db().collection(COLLECTION).doc(code).get();
  if (!snap.exists) return null;

  const data = snap.data() || {};
  const expiresAtMs = data.expiresAt?.toMillis?.();
  // El token también lleva su propia caducidad; esto solo evita devolver algo
  // que ya sabemos muerto.
  if (typeof expiresAtMs === "number" && expiresAtMs < Date.now()) return null;

  return typeof data.token === "string" ? data.token : null;
}

/** Borra códigos caducados para que la colección no crezca sin fin. */
export async function purgeExpiredInactiveLeadsLinks(nowMs: number): Promise<number> {
  const snap = await db()
    .collection(COLLECTION)
    .where("expiresAt", "<", Timestamp.fromMillis(nowMs))
    .limit(PURGE_BATCH)
    .get();
  if (snap.empty) return 0;

  const batch = db().batch();
  for (const doc of snap.docs) batch.delete(doc.ref);
  await batch.commit();
  return snap.size;
}
