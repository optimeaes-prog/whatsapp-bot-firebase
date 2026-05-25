import test from "node:test";
import assert from "node:assert/strict";
import { parseCloudApiWebhook } from "../services/cloudApiClient.js";
import { resolveReplyLanguageFromMessages, isLikelySpanishReply } from "../index.js";
import type { PendingItem } from "../types.js";

test("Sí infers Spanish even when fallback is English", () => {
  const msgs: PendingItem[] = [{ text: "Sí", timestamp: Date.now() }];
  assert.equal(resolveReplyLanguageFromMessages(msgs, "en"), "es");
});

test("Yes infers English even when fallback is Spanish", () => {
  const msgs: PendingItem[] = [{ text: "Yes", timestamp: Date.now() }];
  assert.equal(resolveReplyLanguageFromMessages(msgs, "es"), "en");
});

test("legacy canonical confirm_yes token reads as English", () => {
  assert.ok(!isLikelySpanishReply("confirm_yes"));
});

test("Cloud API interactive reply prefers button title over id", () => {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "123" },
              messages: [
                {
                  from: "34600123456",
                  id: "wamid.x",
                  timestamp: "1700000000",
                  type: "interactive",
                  interactive: {
                    type: "button_reply",
                    button_reply: { id: "confirm_yes", title: "Sí" },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const out = parseCloudApiWebhook(body, (p) => `${p}@c.us`, (ts) => ts);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.text, "Sí");
});
