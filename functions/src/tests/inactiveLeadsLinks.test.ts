import test from "node:test";
import assert from "node:assert/strict";

import { generateLinkCode, isValidLinkCode } from "../services/inactiveLeadsLinks";

test("codes are 10 characters and accepted by the validator", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateLinkCode();
    assert.equal(code.length, 10);
    assert.ok(isValidLinkCode(code), `should accept its own output: ${code}`);
  }
});

test("codes avoid characters that get misread or spell words", () => {
  // No vowels, and none of 0/O/1/l — a code is read aloud and typed by hand
  // often enough that ambiguity costs more than the extra alphabet.
  const codes = Array.from({ length: 200 }, () => generateLinkCode()).join("");
  assert.equal(/[aeiouAEIOU0O1lL]/.test(codes), false);
});

test("codes do not repeat in a large sample", () => {
  // Not proof of uniqueness, but a stuck generator would show up here.
  const seen = new Set(Array.from({ length: 2000 }, () => generateLinkCode()));
  assert.equal(seen.size, 2000);
});

test("the validator rejects anything that is not a real code", () => {
  for (const bad of ["", "short", "Xk7mQ2pRt9x", "Xk7mQ2pRt", "Xk7mQ2pRt!", "aeiouaeiou", "Xk7mQ2pRt0"]) {
    assert.equal(isValidLinkCode(bad), false, `should reject: ${bad}`);
  }
});
