import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

/**
 * El catálogo lo abre el lead, así que lo único que importa de verdad aquí es
 * qué sale del endpoint. `listings` guarda el guion de cualificación
 * (`features`), las condiciones de filtrado y a qué agente se avisa; nada de eso
 * puede acabar en la página.
 */
test("the catalog endpoint copies fields one by one instead of spreading the document", () => {
  const src = readRepoFile("src/catalogEndpoints.ts");
  assert.doesNotMatch(src, /\.\.\.data/, "spreading the listing doc would leak internal fields");
  assert.doesNotMatch(src, /\.\.\.doc\.data\(\)/, "spreading the listing doc would leak internal fields");
});

test("the catalog endpoint never returns the qualification script or the filtering rules", () => {
  const src = readRepoFile("src/catalogEndpoints.ts");
  const card = src.slice(src.indexOf("function toCard"), src.indexOf("async function listCatalogForOrg"));
  for (const field of [
    "features",
    "minMonthlyIncome",
    "maxPeople",
    "requireMortgageApproved",
    "assignedAgentUid",
    "notificationNumberIds",
    "profitabilityReport",
    "idealistaDescription",
  ]) {
    assert.doesNotMatch(
      card,
      new RegExp(`data\\.${field}\\b`),
      `${field} is internal and must not reach the public page`
    );
  }
});

test("the catalog endpoint hides closed listings", () => {
  const src = readRepoFile("src/catalogEndpoints.ts");
  assert.match(
    src,
    /if \(data\.isActive === false\) continue;/,
    "a sold/withdrawn listing must not be offered to a lead"
  );
});

/**
 * La plantilla inicial del flujo per-org lleva el código del catálogo como
 * variable. Si se enviara sin él, el lead recibiría el enlace a medias.
 */
test("the post-call template gets the catalog code, but only on the per-org flow", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /variables: await resolveVoiceOptInTemplateVariables\(isPerOrgGather \? orgId : ""\)/,
    "the opt-in send must pass the code, and only when the agency is known"
  );
  assert.match(
    src,
    /async function resolveVoiceOptInTemplateVariables\(orgId: string\)[\s\S]*?if \(!orgId\) return \{\};/,
    "the global intake org must keep sending its variable-free template"
  );
});

test("the retry message only carries a catalog link on the per-org call flow", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /if \(state\.callFlowMode !== "per_org"\) return undefined;/,
    "the global intake flow doesn't know the agency yet, so it has no catalog to link"
  );
});

test("every listing-lookup retry sends the catalog link", () => {
  const src = readRepoFile("src/index.ts");
  const calls = src.match(
    /buildRetryListingLookupMessage\(nextAttempt, callFlowLanguage, await resolveCallCatalogUrl\(state\)\)/g
  );
  assert.equal(calls?.length, 2, "both places the bot retries from must carry the link");
});

/**
 * El lead recibe el catálogo ya en la plantilla inicial, así que se le pregunta
 * una vez más y, si tampoco sale, se le pasa a la agencia.
 */
test("the bot retries once and then hands the lead to the agency", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(src, /const MAX_LISTING_LOOKUP_RETRIES = 1;/);
  assert.match(
    src,
    /if \(nextAttempt <= MAX_LISTING_LOOKUP_RETRIES\)/,
    "the retry must be capped by the constant, not a literal"
  );
  assert.doesNotMatch(src, /if \(nextAttempt <= 2\)/, "the old two-retry rule must be gone");
});

test("both give-up paths hand over through the same helper", () => {
  const src = readRepoFile("src/index.ts");
  const handovers = src.match(/await handOverToAgency\(/g);
  assert.equal(handovers?.length, 3, "every dead end must go through handOverToAgency");
  // Antes una de las salidas se olvidaba de la etiqueta y el lead no aparecía
  // en el recuento de "no se encontró el anuncio".
  assert.match(
    src,
    /const handOverToAgency = async \(reason: string\) => \{[\s\S]*?"listing-not-found"[\s\S]*?listingResolutionStatus: "failed"/,
    "the handover must tag the lead and mark the resolution as failed"
  );
});
