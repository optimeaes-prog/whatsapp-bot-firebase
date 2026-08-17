import * as admin from "firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

import { generateLinkCode, isValidLinkCode } from "./inactiveLeadsLinks";

/**
 * Enlace público al catálogo de anuncios de una agencia.
 *
 * A diferencia del de "leads sin respuesta", aquí no hay nada privado que
 * proteger: lo que se enseña ya está publicado en Idealista. Por eso el enlace
 * ni se firma ni caduca.
 *
 * Y es **uno por agencia**, no uno por lead: el bot lo manda en cada reintento
 * de identificar el anuncio, así que un enlace por lead significaría una
 * escritura en Firestore por mensaje y un enlace distinto cada vez. Con uno fijo
 * el mensaje solo lee, y la página se puede cachear.
 *
 * El código es aleatorio en vez del propio orgId a propósito: con el id interno
 * en la URL, cualquiera podría cambiarlo por el de otra agencia y listar su
 * cartera entera.
 */

const DB_NAME = "realestate-whatsapp-bot";

/** código -> orgId (lo que resuelve la página). */
const CODE_COLLECTION = "catalogLinks";

/** orgId -> código (para no acuñar uno nuevo en cada mensaje). */
const BY_ORG_COLLECTION = "catalogLinkByOrg";

/** Intentos de acuñar un código libre antes de rendirse. */
const MINT_ATTEMPTS = 5;

function db() {
  return getFirestore(admin.app(), DB_NAME);
}

/**
 * Código del catálogo de esta agencia, creándolo la primera vez.
 *
 * El doc inverso (`catalogLinkByOrg`) se valida contra el directo antes de
 * darlo por bueno: si alguien borrara el código a mano, el puntero quedaría
 * apuntando a la nada y la agencia se quedaría sin catálogo sin que nadie se
 * entere.
 */
export async function getOrCreateCatalogCode(orgId: string): Promise<string> {
  const cleanOrgId = orgId.trim();
  if (!cleanOrgId) throw new Error("catalogLinks: orgId vacío");

  const byOrgRef = db().collection(BY_ORG_COLLECTION).doc(cleanOrgId);
  const existing = await byOrgRef.get();
  const existingCode = existing.exists ? existing.data()?.code : undefined;

  if (typeof existingCode === "string" && isValidLinkCode(existingCode)) {
    const forward = await db().collection(CODE_COLLECTION).doc(existingCode).get();
    if (forward.exists && forward.data()?.orgId === cleanOrgId) return existingCode;
  }

  // `create` (y no `set`) para que un choque de códigos falle y se reintente en
  // vez de pisar el catálogo de otra agencia.
  for (let attempt = 0; attempt < MINT_ATTEMPTS; attempt++) {
    const code = generateLinkCode();
    try {
      await db().collection(CODE_COLLECTION).doc(code).create({
        orgId: cleanOrgId,
        createdAt: Timestamp.now(),
      });
    } catch {
      continue;
    }
    await byOrgRef.set({ code, createdAt: Timestamp.now() }, { merge: true });
    return code;
  }

  throw new Error("catalogLinks: no se pudo generar un código libre");
}

/** Organización dueña de ese código, o null si no existe. */
export async function resolveCatalogCode(code: string): Promise<string | null> {
  if (!isValidLinkCode(code)) return null;

  const snap = await db().collection(CODE_COLLECTION).doc(code).get();
  if (!snap.exists) return null;

  const orgId = snap.data()?.orgId;
  return typeof orgId === "string" && orgId ? orgId : null;
}

/** `https://proplead.io/anuncios/Xk7mQ2pRt9` */
export function buildCatalogUrl(appBaseUrl: string, code: string): string {
  return `${appBaseUrl.trim().replace(/\/+$/, "")}/anuncios/${code}`;
}
