import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeOrgAndAgentRecipients,
  normalizePhoneForDedupe,
  resolveOrgNotificationNumbers,
  splitNotificationNumberRaw,
} from "../services/qualifiedLeadNotificationTargets";

test("normalizePhoneForDedupe strips non-digits", () => {
  assert.equal(normalizePhoneForDedupe("+34 612 345 678"), "34612345678");
  assert.equal(normalizePhoneForDedupe("34612345678"), "34612345678");
});

test("mergeOrgAndAgentRecipients: union with dedupe", () => {
  const merged = mergeOrgAndAgentRecipients(["34611111111"], ["34622222222"]);
  assert.deepEqual(merged, ["34611111111", "34622222222"]);
});

test("mergeOrgAndAgentRecipients: same number twice sends once", () => {
  const merged = mergeOrgAndAgentRecipients(["+34 611 111 111"], ["34611111111"]);
  assert.deepEqual(merged, ["+34 611 111 111"]);
});

test("mergeOrgAndAgentRecipients: org first stable order", () => {
  const merged = mergeOrgAndAgentRecipients(["34610000000"], ["34620000000", "34610000000"]);
  assert.deepEqual(merged, ["34610000000", "34620000000"]);
});

test("resolveOrgNotificationNumbers matches botConfig before env", () => {
  assert.deepEqual(resolveOrgNotificationNumbers({ notificationNumbers: "34600000000" }, ""), ["34600000000"]);
});

test("resolveOrgNotificationNumbers falls back to env string", () => {
  assert.deepEqual(resolveOrgNotificationNumbers({}, "34699999999"), ["34699999999"]);
});

test("splitNotificationNumberRaw handles commas", () => {
  assert.deepEqual(splitNotificationNumberRaw("34610000000, 34620000000"), ["34610000000", "34620000000"]);
});
