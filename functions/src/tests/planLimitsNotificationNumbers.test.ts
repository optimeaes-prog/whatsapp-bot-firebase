import test from "node:test";
import assert from "node:assert/strict";
import { getMaxListingNotificationNumbers } from "../services/subscriptionService";
import type { SubscriptionPlanId } from "../types";

test("non-Pro+ plans cap at 1", () => {
  assert.equal(getMaxListingNotificationNumbers("free"), 1);
  assert.equal(getMaxListingNotificationNumbers("plus"), 1);
  assert.equal(getMaxListingNotificationNumbers("pro"), 1);
});

test("pro_plus unlocks the multi-recipient cap", () => {
  assert.ok(getMaxListingNotificationNumbers("pro_plus") > 1);
  assert.equal(getMaxListingNotificationNumbers("pro_plus"), 10);
});

test("enterprise (passed as widened string) unlocks the multi-recipient cap", () => {
  // Backend SubscriptionPlanId doesn't list "enterprise" yet, but the helper
  // should still treat it as multi-eligible when the value flows in from prod.
  assert.equal(getMaxListingNotificationNumbers("enterprise" as SubscriptionPlanId), 10);
});

test("undefined / null plan ID falls back to the conservative cap of 1", () => {
  assert.equal(getMaxListingNotificationNumbers(undefined), 1);
  assert.equal(getMaxListingNotificationNumbers(null), 1);
});
