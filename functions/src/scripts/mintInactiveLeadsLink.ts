import { signInactiveLeadsToken } from "../services/inactiveLeadsToken";

/**
 * Genera a mano un enlace firmado a la página "leads sin respuesta" de una
 * organización, para probar la página antes de que exista el envío automático.
 *
 * Uso (desde functions/):
 *   npm run build
 *   INACTIVE_LEADS_SECRET=... node lib/scripts/mintInactiveLeadsLink.js --org=<orgId>
 *
 * Con --agent=<uid> el enlace solo enseña los leads de ese agente, igual que el
 * que recibe él en su WhatsApp.
 *
 * El secreto tiene que ser el mismo que hay en Secret Manager
 * (INACTIVE_LEADS_SECRET), o el servidor rechazará el token.
 */

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function main(): void {
  const orgId = (getArg("org") || "").trim();
  const secret = (process.env.INACTIVE_LEADS_SECRET || "").trim();
  const baseUrl = (getArg("base-url") || "https://proplead.io").replace(/\/+$/, "");

  if (!orgId) {
    console.error("Falta --org=<orgId>");
    process.exit(1);
  }
  if (!secret) {
    console.error("Falta la variable de entorno INACTIVE_LEADS_SECRET");
    process.exit(1);
  }

  const agentUid = (getArg("agent") || "").trim();
  const token = signInactiveLeadsToken(orgId, secret, undefined, agentUid || undefined);
  console.log(`${baseUrl}/leads-inactivos?t=${encodeURIComponent(token)}`);
}

main();
