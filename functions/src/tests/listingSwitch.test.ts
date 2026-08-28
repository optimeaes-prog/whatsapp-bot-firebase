import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function readRepoFile(relativePathFromRepoRoot: string): string {
  return fs.readFileSync(path.resolve(__dirname, "..", "..", relativePathFromRepoRoot), "utf8");
}

/**
 * Quien vuelve a llamar tiene algo que decir. La conversación anterior podía estar
 * cerrada, y entonces sus mensajes se tiraban antes incluso de guardarlos: contestaba
 * a un chat que no leía nadie y la agencia no llegaba a verlo.
 */
test("a new call reopens the conversation and asks about the property again", () => {
  const src = readRepoFile("src/services/firestore.ts");
  // Solo la rama "el documento ya existe" de createPendingCallLead, no lo que venga después.
  const start = src.indexOf("Doc exists — refresh identity fields");
  const branch = src.slice(start, src.indexOf("export async function", start));
  assert.match(branch, /isFinished: false,/, "a repeat call must reopen a conversation that had ended");
  assert.match(branch, /flowStep: "call_listing_collect",/, "and put it back to collecting a property");
  assert.match(branch, /listingResolveAttempts: 0,/, "with the retry count reset");
  // El anuncio anterior NO se borra: hace falta para decidir si se pregunta.
  assert.doesNotMatch(
    branch,
    /listingCode: /,
    "the previous listing must survive, or the switch rule has nothing to compare against"
  );
});

/**
 * Cambiar de vivienda solo se pregunta en un caso: la actual sigue en el aire y hace
 * menos de 48 horas. Cualificado, Rechazado y Sin respuesta se cambian solos.
 */
test("only an unsettled lead inside 48h is asked before switching property", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(src, /const LISTING_SWITCH_CONFIRM_WINDOW_MS = 48 \* 60 \* 60 \* 1000;/);
  const fn = src.slice(
    src.indexOf("async function shouldAskBeforeSwitchingListing"),
    src.indexOf("function lastMessageBeforeBatchMs")
  );
  assert.match(
    fn,
    /if \(params\.nowMs - params\.lastMessageBeforeNowMs > LISTING_SWITCH_CONFIRM_WINDOW_MS\) return false;/,
    "past the window the switch is automatic"
  );
  assert.match(
    fn,
    /return status === "not_qualified";/,
    "only the starting state asks; qualified, rejected and no_response switch on their own"
  );
});

test("the 48h clock counts only what the lead sent, and not the message just received", () => {
  const src = readRepoFile("src/index.ts");
  const fn = src.slice(
    src.indexOf("function lastLeadMessageBeforeBatchMs"),
    src.indexOf("/** \"Estabas preguntando por X")
  );
  assert.match(fn, /at < oldestInBatch/, "counting the new message would keep the window open for ever");
  // Cada llamada escribe nuestra plantilla en el historial: contándola, el reloj se
  // reiniciaba en cada llamada y la ventana no se cerraba jamás.
  assert.match(fn, /if \(item\?\.role !== "user"\) continue;/, "our own messages must not reset the window");
});

test("switching property is decided in one place, where the listing is applied", () => {
  const src = readRepoFile("src/index.ts");
  const fn = src.slice(src.indexOf("const applyListingToStateAndPersist"));
  assert.match(
    fn,
    /const isListingSwitch =[\s\S]*?previousListingCode !== listing\.listingCode;/,
    "a different listing than the one held is what makes it a switch"
  );
  assert.match(fn, /if \(askFirst\) \{/, "and when the rule says so, it asks instead of applying");
});

test("an unclear answer keeps the property the lead already had", () => {
  const src = readRepoFile("src/index.ts");
  const block = src.slice(src.indexOf('currentStep === "call_listing_switch_confirm"'));
  assert.match(block, /if \(decision === "confirm"\)/, "yes switches");
  assert.match(block, /if \(decision === "deny"\)/, "no keeps the current one");
  assert.match(
    block,
    /if \(switchAttempt <= MAX_LISTING_LOOKUP_RETRIES\)/,
    "anything else is asked once more before giving up"
  );
});

/**
 * El aviso al agente es una plantilla aprobada de 8 variables: la única que admite
 * texto libre es la 8 (notas), así que la vivienda anterior se cuenta ahí y no hace
 * falta volver a pasar por Meta.
 */
test("the agent alert says where the lead came from, inside the free-text field", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(src, /Antes preguntaba por la referencia \$\{previousListingCode\}/);
  assert.match(src, /"8": notes\.slice\(0, 1200\)/, "it has to travel in the notes variable");
});

/**
 * El caso de "sin llamar, simplemente escribe por otra propiedad": la puerta del
 * flujo tiene que abrirse también ahí, y la respuesta al "¿te paso a la otra?"
 * tiene que poder entrar.
 */
test("the flow also opens for a new reference written without calling", () => {
  const src = readRepoFile("src/index.ts");
  const gate = src.slice(src.indexOf("const mentionsAnotherListing = await"), src.indexOf("const callFlowLanguage"));
  assert.match(gate, /state\.flowStep === "call_listing_switch_confirm" \|\|/, "the yes/no answer must be routed");
  assert.match(gate, /mentionsAnotherListing/, "a reference written mid-conversation must open the flow");
});

/**
 * Durante la cualificación el lead escribe números todo el rato. Un teléfono español
 * son nueve dígitos: si valiera cualquier número, decir el suyo le cambiaría de piso.
 */
test("only a real Idealista reference counts as naming another property", () => {
  const src = readRepoFile("src/index.ts");
  const fn = src.slice(
    src.indexOf("async function mentionsADifferentListing"),
    src.indexOf("/** Cuando decide quedarse con la vivienda que ya tenía. */")
  );
  assert.match(fn, /\\b\(1\\d\{8\}\)\\b/, "nine digits starting with 1, not any number");
  assert.match(fn, /idealista\\\.com\\\/inmueble/, "or the listing link");
  assert.match(fn, /await fetchListingByCode\(code\)/, "and it has to be a property that exists");
});

/**
 * Escribir `undefined` no borra nada: el cliente de Firestore va con
 * ignoreUndefinedProperties, así que la clave se ignora y el valor viejo se queda.
 */
test("the pending switch is actually deleted, not set to undefined", () => {
  const src = readRepoFile("src/index.ts");
  assert.match(
    src,
    /pendingListingSwitch: admin\.firestore\.FieldValue\.delete\(\)/,
    "clearing has to be a real delete"
  );
  const block = src.slice(src.indexOf('currentStep === "call_listing_switch_confirm"'), src.indexOf('currentStep === "call_listing_confirm"'));
  assert.doesNotMatch(block, /pendingListingSwitch: undefined,\s*\}\)/, "undefined would silently leave it behind");
});

/**
 * El helper puede estar bien y no estar enchufado. Aquí solo se comprueba que el
 * punto donde se aplica la vivienda lo usa, en vez de volver a sumar etiquetas.
 */
test("applying the listing runs the tags through the resolved-tags rule", () => {
  const src = readRepoFile("src/index.ts");
  const fn = src.slice(
    src.indexOf("const applyListingToStateAndPersist"),
    src.indexOf("await updateLeadListingByChatId")
  );
  assert.match(fn, /state\.tags = tagsAfterListingResolved\(state\.tags\);/, "the pending marker has to come off");
  assert.doesNotMatch(
    fn,
    /state\.tags = Array\.from\(new Set\(\[\.\.\.\(state\.tags/,
    "merging tags here is what left 'pending-listing' behind for ever"
  );
});
