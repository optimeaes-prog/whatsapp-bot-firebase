import * as admin from "firebase-admin";

import { buildCatalogUrl, getOrCreateCatalogCode } from "../services/catalogLinks";

/**
 * Crea (o recupera) el enlace público al catálogo de anuncios de una agencia.
 *
 * El bot lo crea solo la primera vez que le manda el catálogo a un lead; esto
 * sirve para tenerlo antes, para enseñar la página sin esperar a que falle una
 * identificación de verdad.
 *
 * Uso (desde functions/):
 *   npm run build
 *   node lib/scripts/mintCatalogLink.js --org=<orgId>
 *
 * Es idempotente: llamarlo dos veces sobre la misma agencia devuelve el mismo
 * código, porque el enlace es uno por agencia y no caduca.
 *
 * Necesita credenciales de administrador (gcloud auth application-default login
 * o GOOGLE_APPLICATION_CREDENTIALS).
 */

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const orgId = (getArg("org") || "").trim();
  const baseUrl = (getArg("base-url") || "https://proplead.io").replace(/\/+$/, "");

  if (!orgId) {
    console.error("Falta --org=<orgId>");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: "real-estate-idealista-bot" });
  }

  const code = await getOrCreateCatalogCode(orgId);
  console.log(buildCatalogUrl(baseUrl, code));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
