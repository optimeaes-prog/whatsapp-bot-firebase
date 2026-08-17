import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import { resolveCatalogCode } from "./services/catalogLinks";
import { clientIpKey, enforceRateLimit } from "./utils/rateLimit";

/**
 * API JSON detrás de la página pública de anuncios (`/anuncios/<código>`).
 *
 * La abre el lead desde WhatsApp cuando el bot no ha conseguido identificar la
 * vivienda: ahí busca la suya y copia el número de referencia para pegarlo en el
 * chat.
 *
 * Sin login: el código de la URL es lo único que hace falta, porque lo que se
 * devuelve ya está publicado en los portales. Lo que NO puede salir de aquí son
 * los campos internos del anuncio, y por eso se copian uno a uno más abajo.
 */

const DB_NAME = "realestate-whatsapp-bot";

/**
 * Tope de anuncios por respuesta. Hoy la agencia más grande tiene 17 activos;
 * el tope es para que una cartera enorme no convierta la página en una descarga
 * de varios megas en el móvil de un lead.
 */
const MAX_LISTINGS = 200;

/** Lo único que ve el lead de cada anuncio. */
type CatalogCard = {
  id: string;
  /** Referencia de Idealista: es lo que el bot sabe reconocer cuando la pega. */
  listingCode: string;
  operationType: string;
  /** Calle si la hay; si no, la dirección completa. */
  street: string;
  price: string;
  rooms: string;
  m2: string;
  link: string;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Título de la tarjeta: lo que el lead lee primero para reconocer su vivienda.
 *
 * Lo normal es `street` ("Calle Naufragio 1"), pero hay anuncios sin ese campo
 * y entonces toca `address`, que viene con código postal y país: "29749
 * Vélez-Málaga, Andalucía, España". Como titular no le dice nada a nadie y
 * además manda los anuncios al principio de la lista al ordenar, se le quitan el
 * código postal de delante y el país de detrás.
 */
function buildCardTitle(data: Record<string, unknown>): string {
  const street = asText(data.street);
  if (street) return street;

  return asText(data.address)
    .replace(/^\d{5}\s+/, "")
    .replace(/,\s*España\s*$/i, "")
    .trim();
}

/**
 * Del documento del anuncio a la tarjeta, campo a campo.
 *
 * Nunca se hace spread del documento. `listings` guarda también condiciones de
 * cualificación (`minMonthlyIncome`, `maxPeople`, `requireMortgageApproved`),
 * a quién se avisa (`assignedAgentUid`, `notificationNumberIds`), el informe de
 * rentabilidad y, sobre todo, `features`, que pese al nombre no son las
 * características de la vivienda sino el guion de preguntas que el bot le hará
 * al lead ("¿tienes la hipoteca concedida?"). Nada de eso puede acabar en una
 * página que abre el lead.
 */
function toCard(id: string, data: Record<string, unknown>): CatalogCard | null {
  const listingCode = asText(data.listingCode);
  // Sin referencia la tarjeta no sirve para nada: es justo lo que viene a copiar.
  if (!listingCode) return null;

  return {
    id,
    listingCode,
    operationType: asText(data.operationType),
    street: buildCardTitle(data),
    price: asText(data.price),
    rooms: asText(data.rooms),
    m2: asText(data.m2),
    link: asText(data.link),
  };
}

/**
 * Anuncios activos de la agencia, ordenados por calle.
 *
 * Alfabético y no por fecha porque el lead viene buscando una vivienda concreta
 * que ya conoce, normalmente por la calle; el orden de alta no le dice nada.
 */
async function listCatalogForOrg(orgId: string): Promise<CatalogCard[]> {
  const db = getFirestore(admin.app(), DB_NAME);
  const snap = await db.collection(`organizations/${orgId}/listings`).get();

  const cards: CatalogCard[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    // Un anuncio cerrado seguiría enseñándose como disponible: el lead elegiría
    // una vivienda ya vendida y el agente lo descubriría al llamarle.
    if (data.isActive === false) continue;
    const card = toCard(doc.id, data);
    if (card) cards.push(card);
  }

  cards.sort((a, b) => a.street.localeCompare(b.street, "es", { sensitivity: "base" }));
  return cards.slice(0, MAX_LISTINGS);
}

/**
 * Tope por IP. El código no es adivinable, pero esto evita que alguien pruebe
 * códigos en masa para ir sacando la cartera de agencias sueltas.
 */
async function enforceCatalogIpLimit(req: Request): Promise<{ ok: boolean; retryAfterSec: number }> {
  const ipHash = clientIpKey(req);
  const result = await enforceRateLimit(
    getFirestore(admin.app(), DB_NAME),
    `catalog:ip:${ipHash}`,
    { windowSec: 60, max: 30 }
  );
  return { ok: result.allowed, retryAfterSec: result.retryAfterSec };
}

/** GET /api/anuncios?code=<código> */
export async function catalogApiHandler(req: Request, res: Response): Promise<void> {
  res.set("Referrer-Policy", "no-referrer");
  // La página no debe salir en Google: es de la agencia, no un portal.
  res.set("X-Robots-Tag", "noindex, nofollow, noarchive");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code) {
    res.status(400).json({ error: "missing_code" });
    return;
  }

  // Antes de tocar Firestore, igual que en la página de leads inactivos.
  const ipLimit = await enforceCatalogIpLimit(req);
  if (!ipLimit.ok) {
    res.setHeader("Retry-After", String(ipLimit.retryAfterSec));
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const orgId = await resolveCatalogCode(code);
  if (!orgId) {
    res.status(404).json({ error: "invalid_code" });
    return;
  }

  try {
    const listings = await listCatalogForOrg(orgId);
    // Un minuto de caché: el catálogo cambia como mucho a diario y el lead suele
    // recargar la página un par de veces mientras busca la suya.
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({ generatedAtMs: Date.now(), listings });
  } catch (e) {
    console.error("[catalog] query failed", { orgTail: orgId.slice(-8), error: e });
    res.status(500).json({ error: "query_failed" });
  }
}
