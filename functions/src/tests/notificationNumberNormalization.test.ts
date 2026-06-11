import test from "node:test";
import assert from "node:assert/strict";
import {
  digestsFromE164,
  normalizeToE164,
} from "../services/notificationNumbersService";

test("normalizeToE164 accepts canonical E.164", () => {
  assert.equal(normalizeToE164("+34612345678"), "+34612345678");
});

test("normalizeToE164 accepts pretty-printed E.164 with spaces", () => {
  assert.equal(normalizeToE164("+34 612 345 678"), "+34612345678");
});

test("normalizeToE164 accepts bare digits and prefixes +", () => {
  assert.equal(normalizeToE164("34612345678"), "+34612345678");
});

test("normalizeToE164 strips 00 international access prefix when no plus", () => {
  assert.equal(normalizeToE164("0034 612 345 678"), "+34612345678");
});

test("normalizeToE164 preserves digits when input has + and dashes", () => {
  assert.equal(normalizeToE164("+34-612-345-678"), "+34612345678");
});

test("normalizeToE164 rejects empty and whitespace-only inputs", () => {
  assert.equal(normalizeToE164(""), null);
  assert.equal(normalizeToE164("   "), null);
  assert.equal(normalizeToE164(null), null);
  assert.equal(normalizeToE164(undefined), null);
});

test("normalizeToE164 rejects too-short (under 8 digits)", () => {
  assert.equal(normalizeToE164("+34 612"), null);
});

test("normalizeToE164 rejects too-long (over 15 digits)", () => {
  assert.equal(normalizeToE164("+1234567890123456"), null);
});

test("digestsFromE164 strips the plus", () => {
  assert.equal(digestsFromE164("+34612345678"), "34612345678");
});
