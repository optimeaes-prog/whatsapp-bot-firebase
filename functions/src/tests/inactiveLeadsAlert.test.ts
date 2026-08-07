import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInactiveLeadsMessage,
  isNewlyCold,
  shouldMarkLeads,
} from "../services/inactiveLeadsAlertService";
import type { InactiveLead } from "../services/inactiveLeadsService";

const DAY = 24 * 60 * 60 * 1000;

function lead(overrides: Partial<InactiveLead> = {}): InactiveLead {
  return {
    id: "lead_1",
    name: "Marcos",
    phone: "34669643792",
    listingDescription: "Adosado Albon",
    listingCode: "111993451",
    lastMessageAtMs: Date.now() - 3 * DAY,
    inactivityNotifiedAtMs: null,
    chatId: "chat_34669643792",
    messageCount: 3,
    recentMessages: [],
    ...overrides,
  };
}

test("a lead we have never notified counts as newly cold", () => {
  assert.equal(isNewlyCold(lead({ inactivityNotifiedAtMs: null })), true);
});

test("a lead already notified, with no activity since, is not re-notified", () => {
  // Silent since day 3; we told the agency about it on day 2. Nothing new.
  const now = Date.now();
  assert.equal(
    isNewlyCold(lead({ lastMessageAtMs: now - 3 * DAY, inactivityNotifiedAtMs: now - 2 * DAY })),
    false
  );
});

test("a lead that replied after being notified, then went quiet, counts again", () => {
  // Notified on day 5, the lead wrote back on day 3, and has been silent since.
  const now = Date.now();
  assert.equal(
    isNewlyCold(lead({ lastMessageAtMs: now - 3 * DAY, inactivityNotifiedAtMs: now - 5 * DAY })),
    true
  );
});

test("message body matches the approved template and does not end on a variable", () => {
  const url = "https://proplead.io/leads-inactivos?t=abc.def";
  const { body, variables } = buildInactiveLeadsMessage(3, url);

  assert.match(body, /^Tienes 3 leads de venta sin respuesta desde hace más de 48 horas\./);
  assert.ok(body.includes(`Consulta la lista aquí: ${url}`));
  assert.ok(body.trimEnd().endsWith("- Proplead"), "WhatsApp rejects a body ending in a variable");
  assert.deepEqual(variables, { "1": "3", "2": url });
});

test("a dry run never marks leads", () => {
  assert.equal(shouldMarkLeads({ dryRun: true, usingTestRecipient: false }), false);
});

test("a send diverted to the test number never marks leads", () => {
  // The agency did not receive it, so those leads must stay pending for the
  // first genuine reminder.
  assert.equal(shouldMarkLeads({ dryRun: false, usingTestRecipient: true }), false);
  assert.equal(shouldMarkLeads({ dryRun: true, usingTestRecipient: true }), false);
});

test("a real send to the agency does mark leads", () => {
  // The anti-repeat rule depends on this: without marking, the same reminder
  // would go out every morning forever.
  assert.equal(shouldMarkLeads({ dryRun: false, usingTestRecipient: false }), true);
});

test("the link travels in the body, not only in the template variables", () => {
  // When the 24h window is open the message goes out as free text, so a URL that
  // only existed in the template variables would never reach the agent.
  const url = "https://proplead.io/leads-inactivos?t=xyz";
  const { body } = buildInactiveLeadsMessage(1, url);
  assert.ok(body.includes(url));
});
