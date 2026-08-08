import test from "node:test";
import assert from "node:assert/strict";

import {
  signInactiveLeadsToken,
  verifyInactiveLeadsToken,
} from "../services/inactiveLeadsToken";

const SECRET = "test-secret-inactive-leads";

test("a token signed for an org verifies back to that same org", () => {
  const token = signInactiveLeadsToken("org-abc", SECRET);
  assert.deepEqual(verifyInactiveLeadsToken(token, SECRET), { orgId: "org-abc", agentUid: "" });
});

test("an agent-scoped token carries the agent back", () => {
  const token = signInactiveLeadsToken("org-abc", SECRET, undefined, "uid_jose");
  assert.deepEqual(verifyInactiveLeadsToken(token, SECRET), {
    orgId: "org-abc",
    agentUid: "uid_jose",
  });
});

test("an agent cannot widen their own link to the whole agency", () => {
  // Dropping the agent from the payload changes what the signature should be,
  // so the edited link is rejected rather than showing everyone's leads.
  const scoped = signInactiveLeadsToken("org-abc", SECRET, undefined, "uid_jose");
  const [, sig] = scoped.split(".");
  const widened = Buffer.from(JSON.stringify({ o: "org-abc", exp: Date.now() + 60_000 }), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  assert.equal(verifyInactiveLeadsToken(`${widened}.${sig}`, SECRET), null);
});

test("a token signed with a different secret is rejected", () => {
  const token = signInactiveLeadsToken("org-abc", "other-secret");
  assert.equal(verifyInactiveLeadsToken(token, SECRET), null);
});

test("tampering with the payload to swap orgId is rejected", () => {
  // An attacker who holds a valid link for their own org must not be able to
  // re-point it at someone else's leads by editing the payload.
  const token = signInactiveLeadsToken("org-mine", SECRET);
  const [, sig] = token.split(".");
  const forgedPayload = Buffer.from(JSON.stringify({ o: "org-victim", exp: Date.now() + 60_000 }), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  assert.equal(verifyInactiveLeadsToken(`${forgedPayload}.${sig}`, SECRET), null);
});

test("an expired token is rejected", () => {
  const token = signInactiveLeadsToken("org-abc", SECRET, -1000);
  assert.equal(verifyInactiveLeadsToken(token, SECRET), null);
});

test("malformed tokens are rejected instead of throwing", () => {
  for (const bad of ["", ".", "abc", "a.b.c", "not-base64.sig"]) {
    assert.equal(verifyInactiveLeadsToken(bad, SECRET), null, `should reject: ${bad}`);
  }
});
