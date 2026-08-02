import test from "node:test";
import assert from "node:assert/strict";

import {
  signInactiveLeadsToken,
  verifyInactiveLeadsToken,
} from "../services/inactiveLeadsToken";

const SECRET = "test-secret-inactive-leads";

test("a token signed for an org verifies back to that same org", () => {
  const token = signInactiveLeadsToken("org-abc", SECRET);
  assert.deepEqual(verifyInactiveLeadsToken(token, SECRET), { orgId: "org-abc" });
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
