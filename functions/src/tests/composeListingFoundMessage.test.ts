import test from "node:test";
import assert from "node:assert/strict";
import { composeListingFoundMessage, normalizeVoiceE164 } from "../services/inboundVoicePerOrg";

test("composeListingFoundMessage (ES) announces the found listing and asks for características", () => {
  const msg = composeListingFoundMessage({
    language: "es",
    link: "https://www.idealista.com/inmueble/123",
    features: "• 3 habitaciones\n• 90 m²",
    leadName: "Ana",
  });
  assert.match(msg, /¡Estupendo! Creo que ya lo he encontrado/);
  assert.match(msg, /¿Has visto las características de la vivienda\?/);
  assert.ok(msg.includes("https://www.idealista.com/inmueble/123"), "should include the listing link");
  assert.ok(msg.includes("¡Hola Ana!"), "should greet by name when known");
  assert.ok(msg.includes("• 3 habitaciones"), "should include the formatted features");
});

test("composeListingFoundMessage (EN) variant and omits greeting when no name", () => {
  const msg = composeListingFoundMessage({
    language: "en",
    link: "https://www.idealista.com/inmueble/456",
    features: "• 3 beds",
  });
  assert.match(msg, /Great! I think I've found it/);
  assert.match(msg, /Have you seen the property highlights\?/);
  assert.ok(msg.includes("https://www.idealista.com/inmueble/456"));
  assert.ok(!msg.includes("Hi "), "no name → no greeting line");
});

test("normalizeVoiceE164 strips +, spaces, and the whatsapp: prefix", () => {
  assert.equal(normalizeVoiceE164("+34 911 22 33 44"), "34911223344");
  assert.equal(normalizeVoiceE164("whatsapp:+34911223344"), "34911223344");
  assert.equal(normalizeVoiceE164("34911223344"), "34911223344");
  assert.equal(normalizeVoiceE164(undefined), "");
  assert.equal(normalizeVoiceE164(""), "");
});
