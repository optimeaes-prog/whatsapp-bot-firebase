import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mergeConversationHistoryItems } from "../services/firestore";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("mergeConversationHistoryItems preserves assistant rows from richer stored history", () => {
  const stored = [
    { role: "assistant" as const, text: "Intro", timestamp: 10 },
    { role: "user" as const, text: "Hola", timestamp: 20 },
    { role: "assistant" as const, text: "Follow-up", timestamp: 30 },
  ];
  const staleIncoming = [
    { role: "assistant" as const, text: "Intro", timestamp: 10 },
    { role: "user" as const, text: "Hola", timestamp: 20 },
    { role: "user" as const, text: "Gracias", timestamp: 40 },
  ];

  const merged = mergeConversationHistoryItems(stored, staleIncoming);

  assert.deepEqual(
    merged.map((item) => [item.role, item.text, item.timestamp]),
    [
      ["assistant", "Intro", 10],
      ["user", "Hola", 20],
      ["assistant", "Follow-up", 30],
      ["user", "Gracias", 40],
    ]
  );
});

test("conversation state write paths bypass warm cache before mutating history", () => {
  const source = readRepoFile("src/index.ts");

  assert.match(
    source,
    /type EnsureConversationStateOptions = \{[\s\S]*?preferFresh\?: boolean;[\s\S]*?\}/,
    "ensureConversationState should expose a fresh-read option"
  );
  assert.match(
    source,
    /if \(!options\.preferFresh\) \{[\s\S]*?getCachedConversationState/,
    "cache reads should be skipped when preferFresh is enabled"
  );
  assert.match(
    source,
    /ensureConversationState\(chatId, messages\[0\]\.phone, \{ preferFresh: true \}\)/,
    "inbound webhook history mutations should refresh from Firestore first"
  );
  assert.match(
    source,
    /ensureConversationState\(chatId, undefined, \{ preferFresh: true \}\)/,
    "processBuffer/manual write paths should refresh from Firestore first"
  );
});

test("upsertConversation merges stale incoming history with stored history", () => {
  const source = readRepoFile("src/services/firestore.ts");

  assert.match(
    source,
    /const existingHist = existingPair\?\.\[1\]\?\.history;/,
    "normal upsert path should read currently stored history"
  );
  assert.match(
    source,
    /const merged = mergeConversationHistoryItems\(existingHist, incomingHistory\);[\s\S]*?payload\.history = merged;[\s\S]*?payload\.messageCount = merged\.length;/,
    "normal upsert path should merge stored and incoming history before writing"
  );
  assert.match(
    source,
    /const unionHistory = mergeConversationHistoryItems\(\.\.\.allHistories\);[\s\S]*?mergeConversationHistoryItems\(unionHistory, incomingHistory\)/,
    "duplicate variant upsert path should union all histories plus incoming history"
  );
});

test("assistant send helpers persist the same customer-facing body to history", () => {
  const source = readRepoFile("src/index.ts");

  assert.match(
    source,
    /async function recordAssistantHistoryMessage[\s\S]*?role: "assistant"[\s\S]*?await upsertConversation\(state\.chatId, \{[\s\S]*?history: state\.history/,
    "assistant history helper should append assistant rows and persist them"
  );
  assert.match(
    source,
    /async function sendAssistantTextAndRecord[\s\S]*?await sendTextMessage[\s\S]*?await recordAssistantHistoryMessage\(state, text, extra\)/,
    "text sends should record after successful send"
  );
  assert.match(
    source,
    /await recordAssistantHistoryMessage\(state, cleanMessage, \{[\s\S]*?isFinished: qualificationStatus !== undefined/,
    "OpenAI assistant replies should persist through the shared recorder"
  );
});
