import test from "node:test";
import assert from "node:assert/strict";

import {
  pickLeadCandidate,
  fieldsToCarryOver,
  missingIdentityFields,
  shouldApplyQualificationStatus,
  tagsAfterListingResolved,
  PENDING_LISTING_TAG,
  LeadCandidate,
} from "../services/leadSelection";

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


// --- moving a call placeholder onto its real property ---

test("the placeholder's details come along when the row moves", () => {
  const placeholder = {
    name: "Riccardo", consent: { source: "phone_call" }, phone: "34644402838",
    listingCode: "__pending__", createdAt: 1_000, hasResponse: false,
  };
  const carried = fieldsToCarryOver({}, placeholder);
  assert.equal(carried.name, "Riccardo");
  assert.deepEqual(carried.consent, { source: "phone_call" });
  assert.equal(carried.createdAt, 1_000);
});

test("the property's own fields never travel between rows", () => {
  const carried = fieldsToCarryOver({}, {
    listingCode: "__pending__", listingResolutionStatus: "pending",
    assignedAgentUid: "uid_old", operationType: "Alquiler", name: "Ana",
  });
  assert.deepEqual(Object.keys(carried), ["name"]);
});

test("a destination that already knows something keeps its own value", () => {
  const carried = fieldsToCarryOver({ name: "Cristina florido" }, { name: "sin nombre", email: "a@b.c" });
  assert.equal(carried.name, undefined);
  assert.equal(carried.email, "a@b.c");
});

test("blank values are not worth carrying", () => {
  assert.deepEqual(fieldsToCarryOver({}, { name: "", email: null, notes: undefined }), {});
});

// --- one person, two properties, two rows that should read the same ---

test("a row missing the name gets it from the person", () => {
  assert.deepEqual(missingIdentityFields({ listingCode: "111" }, { name: "Renata" }), { name: "Renata" });
});

test("a row that already has the name is left alone", () => {
  assert.deepEqual(missingIdentityFields({ name: "Renata" }, { name: "renata" }), {});
});

test("only the person's own details are mirrored, never the qualification", () => {
  const patch = missingIdentityFields({}, {
    name: "Ana", consent: { source: "inbound_whatsapp" },
    qualificationStatus: "qualified", conversationSummary: "…",
  } as Record<string, unknown>);
  assert.deepEqual(Object.keys(patch).sort(), ["consent", "name"]);
});

// --- a new intake must not undo a conclusion the bot already reached ---

test("a second intake cannot push a qualified lead back to not_qualified", () => {
  assert.equal(shouldApplyQualificationStatus("qualified", "not_qualified"), false);
});

test("nor a rejected one", () => {
  assert.equal(shouldApplyQualificationStatus("rejected", "not_qualified"), false);
});

test("a lead still in progress takes the new status", () => {
  assert.equal(shouldApplyQualificationStatus("not_qualified", "not_qualified"), true);
  assert.equal(shouldApplyQualificationStatus(undefined, "not_qualified"), true);
  assert.equal(shouldApplyQualificationStatus("no_response", "not_qualified"), true);
});

test("qualifying or rejecting always wins", () => {
  assert.equal(shouldApplyQualificationStatus("qualified", "rejected"), true);
  assert.equal(shouldApplyQualificationStatus("rejected", "qualified"), true);
  assert.equal(shouldApplyQualificationStatus("not_qualified", "qualified"), true);
});

test("no status means nothing to write", () => {
  assert.equal(shouldApplyQualificationStatus("qualified", undefined), false);
});

// --- once the property is known, the lead must stop reading as "pending" ---

/**
 * The bug the agency saw: the call came in without a property, the lead named one,
 * the row moved to it — and still showed "pending-listing" for ever, so every
 * resolved call looked like one nobody had dealt with.
 */
test("resolving the property drops the pending marker", () => {
  assert.deepEqual(tagsAfterListingResolved(["lead", "call", PENDING_LISTING_TAG]), ["lead", "call"]);
});

test("the other tags of the call survive", () => {
  assert.deepEqual(
    tagsAfterListingResolved(["lead", "call", "handoff", PENDING_LISTING_TAG]),
    ["lead", "call", "handoff"]
  );
});

test("a lead that never had the marker is left alone", () => {
  assert.deepEqual(tagsAfterListingResolved(["lead", "call"]), ["lead", "call"]);
});

test("\"lead\" is always there, and only once", () => {
  assert.deepEqual(tagsAfterListingResolved(undefined), ["lead"]);
  assert.deepEqual(tagsAfterListingResolved([]), ["lead"]);
  assert.deepEqual(tagsAfterListingResolved(["lead", "lead"]), ["lead"]);
});

/**
 * The other door: the call stub is folded into a row whose property was known from
 * the start (an Idealista intake). Its tags come along only when the target has
 * none — and they must not bring "pending" onto a row that never was.
 */
test("absorbing a call placeholder does not carry its pending marker over", () => {
  const carried = fieldsToCarryOver(
    { listingCode: "112009850" },
    { tags: ["lead", "call", PENDING_LISTING_TAG], name: "Riccardo" }
  );
  assert.deepEqual(carried.tags, ["lead", "call"]);
  assert.equal(carried.name, "Riccardo");
});
