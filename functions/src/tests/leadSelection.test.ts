import test from "node:test";
import assert from "node:assert/strict";

import { pickLeadCandidate, LeadCandidate } from "../services/leadSelection";

const at = (millis: number) => ({ toMillis: () => millis });

/** The pair the agency reported: a call placeholder and the row the chat filled in. */
const placeholderRow: LeadCandidate = {
  id: "lead_34644402838___pending__",
  listingCode: "__pending__",
  createdAt: at(1_000),
};
const qualifiedRow: LeadCandidate = {
  id: "lead_34644402838_112009850",
  listingCode: "112009850",
  name: "Riccardo",
  consent: { source: "inbound_whatsapp" },
  qualificationStatus: "qualified",
  createdAt: at(2_000),
};

test("a single row is returned as-is", () => {
  assert.equal(pickLeadCandidate([qualifiedRow])?.id, qualifiedRow.id);
});

test("no rows means no lead", () => {
  assert.equal(pickLeadCandidate([]), null);
});

test("the row for the property the conversation is about wins", () => {
  const otherProperty: LeadCandidate = {
    id: "lead_34644402838_111993451",
    listingCode: "111993451",
    name: "Riccardo",
    consent: {},
    qualificationStatus: "qualified",
    conversationSummary: "…",
    createdAt: at(500),
  };
  // The other row is older AND more complete, so it would win on every other
  // ground — matching the conversation's property has to beat both.
  const chosen = pickLeadCandidate([otherProperty, qualifiedRow], "112009850");
  assert.equal(chosen?.id, qualifiedRow.id);
});

test("the placeholder is not treated as a property to match on", () => {
  // Passing "__pending__" must not drag the write onto the placeholder row.
  const chosen = pickLeadCandidate([placeholderRow, qualifiedRow], "__pending__");
  assert.equal(chosen?.id, qualifiedRow.id);
});

test("with no property to go on, the row holding the lead's data wins", () => {
  assert.equal(pickLeadCandidate([placeholderRow, qualifiedRow])?.id, qualifiedRow.id);
});

test("between equally complete rows the original one wins", () => {
  const older: LeadCandidate = { id: "lead_b", listingCode: "1", createdAt: at(1_000) };
  const newer: LeadCandidate = { id: "lead_a", listingCode: "2", createdAt: at(9_000) };
  // "lead_a" sorts first by id, which is exactly what the old code would have
  // picked; age has to decide instead.
  assert.equal(pickLeadCandidate([newer, older])?.id, "lead_b");
});

test("a row without createdAt loses to a dated one", () => {
  const legacy: LeadCandidate = { id: "lead_a", listingCode: "1" };
  const dated: LeadCandidate = { id: "lead_z", listingCode: "1", createdAt: at(9_000) };
  assert.equal(pickLeadCandidate([legacy, dated])?.id, "lead_z");
});

test("the choice does not depend on the order rows come back in", () => {
  const rows = [placeholderRow, qualifiedRow];
  assert.equal(pickLeadCandidate(rows)?.id, pickLeadCandidate([...rows].reverse())?.id);
});

test("identical rows still resolve to a stable answer", () => {
  const a: LeadCandidate = { id: "lead_a", listingCode: "1", createdAt: at(1) };
  const b: LeadCandidate = { id: "lead_b", listingCode: "1", createdAt: at(1) };
  assert.equal(pickLeadCandidate([b, a])?.id, "lead_a");
  assert.equal(pickLeadCandidate([a, b])?.id, "lead_a");
});

test("a preferred property nobody has does not empty the result", () => {
  const chosen = pickLeadCandidate([placeholderRow, qualifiedRow], "999999999");
  assert.equal(chosen?.id, qualifiedRow.id);
});

