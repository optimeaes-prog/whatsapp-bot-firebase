import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAudiences,
  buildInactiveLeadsMessage,
  isNewlyCold,
  orgSkipReason,
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
    inactivityHandledAtMs: null,
    assignedAgentUid: "",
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
  // Marking during a rehearsal would leave the first real reminder with nothing
  // new to report, which looks like a broken job.
  assert.equal(shouldMarkLeads({ dryRun: true }), false);
});

test("a real send to the agency does mark leads", () => {
  // The anti-repeat rule depends on this: without marking, the same reminder
  // would go out every morning forever.
  assert.equal(shouldMarkLeads({ dryRun: false }), true);
});

test("no message when every lead has been marked as contactado", () => {
  // The query drops leads marked "Contactado", so an agent who has rung all of
  // them leaves an empty list here — and nothing should go out tomorrow.
  assert.equal(orgSkipReason([]), "sin_leads_frias");
});

test("no message when nothing is newly cold, and the reason says so", () => {
  // Distinct from the case above on purpose: from outside both look like
  // silence, but one means "all handled" and the other "no news".
  const now = Date.now();
  const alreadyReported = lead({ lastMessageAtMs: now - 3 * DAY, inactivityNotifiedAtMs: now - 2 * DAY });
  assert.equal(orgSkipReason([alreadyReported]), "sin_leads_nuevas");
});

test("one newly cold lead is enough to send", () => {
  const now = Date.now();
  const alreadyReported = lead({ id: "old", lastMessageAtMs: now - 3 * DAY, inactivityNotifiedAtMs: now - 2 * DAY });
  const fresh = lead({ id: "new", inactivityNotifiedAtMs: null });
  assert.equal(orgSkipReason([alreadyReported, fresh]), null);
});

test("central gets every lead, each agent only their own", () => {
  const jose = lead({ id: "l1", assignedAgentUid: "uid_jose" });
  const paco = lead({ id: "l2", assignedAgentUid: "uid_paco" });
  const unassigned = lead({ id: "l3", assignedAgentUid: "" });

  const audiences = buildAudiences({
    leads: [jose, paco, unassigned],
    centralNumbers: ["34669354177", "34623021884"],
    agentNumbers: new Map([["uid_jose", ["34604825903"]]]),
  });

  const central = audiences.find((a) => a.agentUid === "");
  assert.deepEqual(central?.numbers, ["34669354177", "34623021884"]);
  assert.deepEqual(central?.leads.map((l) => l.id), ["l1", "l2", "l3"]);

  const joseAudience = audiences.find((a) => a.agentUid === "uid_jose");
  assert.deepEqual(joseAudience?.numbers, ["34604825903"]);
  assert.deepEqual(joseAudience?.leads.map((l) => l.id), ["l1"]);
});

test("an agent whose number is already central is not messaged twice", () => {
  // Paco is on the central list, so he already receives the full list; a second
  // message with a subset of it would be the same reminder again.
  const audiences = buildAudiences({
    leads: [lead({ id: "l1", assignedAgentUid: "uid_paco" })],
    centralNumbers: ["+34 623 02 18 84"],
    agentNumbers: new Map([["uid_paco", ["34623021884"]]]),
  });

  assert.equal(audiences.length, 1);
  assert.equal(audiences[0].agentUid, "");
});

test("an agent with no configured number gets no message of their own", () => {
  const audiences = buildAudiences({
    leads: [lead({ id: "l1", assignedAgentUid: "uid_sin_numero" })],
    centralNumbers: ["34669354177"],
    agentNumbers: new Map(),
  });

  assert.equal(audiences.length, 1);
  assert.equal(audiences[0].agentUid, "");
});

test("unassigned leads reach the agency but belong to no agent block", () => {
  const audiences = buildAudiences({
    leads: [lead({ id: "l1", assignedAgentUid: "" })],
    centralNumbers: ["34669354177"],
    agentNumbers: new Map(),
  });

  assert.equal(audiences.length, 1);
  assert.deepEqual(audiences[0].leads.map((l) => l.id), ["l1"]);
});

test("the link travels in the body, not only in the template variables", () => {
  // When the 24h window is open the message goes out as free text, so a URL that
  // only existed in the template variables would never reach the agent.
  const url = "https://proplead.io/leads-inactivos?t=xyz";
  const { body } = buildInactiveLeadsMessage(1, url);
  assert.ok(body.includes(url));
});
