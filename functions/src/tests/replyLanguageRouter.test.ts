import test from "node:test";
import assert from "node:assert/strict";
import type OpenAI from "openai";
import { resolveReplyLanguageWithAgent, __setClientForTests } from "../services/openaiClient.js";
import type { HistoryItem } from "../types.js";

/**
 * Builds a fake OpenAI client whose responses.create returns a canned output_text.
 * Captures the last input string so we can assert what was sent to the model.
 */
function fakeClient(outputText: string): { client: OpenAI; calls: () => number; lastInput: () => string } {
  let count = 0;
  let lastInput = "";
  const client = {
    responses: {
      create: async (args: { input: string }) => {
        count += 1;
        lastInput = args.input;
        return { output_text: outputText };
      },
    },
  } as unknown as OpenAI;
  return { client, calls: () => count, lastInput: () => lastInput };
}

const SPANISH_HISTORY: HistoryItem[] = [
  { role: "assistant", text: "Hola Zhanna, soy Marcos. ¿Es correcto?", timestamp: 1 },
  { role: "user", text: "Sí, quiero ver la vivienda", timestamp: 2 },
  { role: "assistant", text: "Genial, ¿cuántas personas viviréis?", timestamp: 3 },
];

test("keeps Spanish when model says es (sticky, the 'no' bug case)", async () => {
  const fake = fakeClient('{"language": "es", "switched": false, "reason": "still Spanish"}');
  __setClientForTests(fake.client);
  try {
    const result = await resolveReplyLanguageWithAgent({
      history: SPANISH_HISTORY,
      newMessages: ["2 personas, no tengo animales, 2200 evro", "Para mucho tiempo nesesito"],
      currentLanguage: "es",
    });
    assert.equal(result, "es");
    assert.equal(fake.calls(), 1);
    // The new messages must be forwarded to the model.
    assert.match(fake.lastInput(), /2200 evro/);
  } finally {
    __setClientForTests(null);
  }
});

test("switches to English when model says en", async () => {
  const fake = fakeClient('{"language": "en", "switched": true, "reason": "full English sentence"}');
  __setClientForTests(fake.client);
  try {
    const result = await resolveReplyLanguageWithAgent({
      history: SPANISH_HISTORY,
      newMessages: ["Sorry, can we please continue in English from now on?"],
      currentLanguage: "es",
    });
    assert.equal(result, "en");
  } finally {
    __setClientForTests(null);
  }
});

test("no new messages → keeps current language without calling the model", async () => {
  const fake = fakeClient('{"language": "en"}');
  __setClientForTests(fake.client);
  try {
    const result = await resolveReplyLanguageWithAgent({
      history: SPANISH_HISTORY,
      newMessages: ["", "   "],
      currentLanguage: "es",
    });
    assert.equal(result, "es");
    assert.equal(fake.calls(), 0, "model should not be called when there is nothing to classify");
  } finally {
    __setClientForTests(null);
  }
});

test("parses JSON even when wrapped in extra model text", async () => {
  const fake = fakeClient('Sure! Here is the result: {"language": "en", "switched": true} hope that helps');
  __setClientForTests(fake.client);
  try {
    const result = await resolveReplyLanguageWithAgent({
      history: [],
      newMessages: ["Hello, is this property still available?"],
      currentLanguage: "es",
    });
    assert.equal(result, "en");
  } finally {
    __setClientForTests(null);
  }
});

test("defaults to Spanish on unrecognised language value", async () => {
  const fake = fakeClient('{"language": "fr"}');
  __setClientForTests(fake.client);
  try {
    const result = await resolveReplyLanguageWithAgent({
      history: [],
      newMessages: ["Bonjour"],
      currentLanguage: "es",
    });
    assert.equal(result, "es");
  } finally {
    __setClientForTests(null);
  }
});
