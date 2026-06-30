import test from "node:test";
import assert from "node:assert/strict";
import { getMaxActiveListings, FREE_MAX_ACTIVE_LISTINGS } from "../services/subscriptionService";
import type { SubscriptionPlanId } from "../types";

test("each plan caps active listings at its tier max", () => {
  assert.equal(getMaxActiveListings("free"), FREE_MAX_ACTIVE_LISTINGS);
  assert.equal(getMaxActiveListings("free"), 1);
  assert.equal(getMaxActiveListings("plus"), 3);
  assert.equal(getMaxActiveListings("pro"), 12);
  assert.equal(getMaxActiveListings("pro_plus"), 25);
});

test("enterprise (passed as widened string) is unlimited", () => {
  // Backend SubscriptionPlanId doesn't list "enterprise" yet, but the helper
  // should treat it as unlimited when the value flows in from prod.
  assert.equal(getMaxActiveListings("enterprise" as SubscriptionPlanId), Number.POSITIVE_INFINITY);
  assert.equal(Number.isFinite(getMaxActiveListings("enterprise" as SubscriptionPlanId)), false);
});

test("undefined / null plan ID falls back to the Free cap", () => {
  assert.equal(getMaxActiveListings(undefined), FREE_MAX_ACTIVE_LISTINGS);
  assert.equal(getMaxActiveListings(null), FREE_MAX_ACTIVE_LISTINGS);
});
