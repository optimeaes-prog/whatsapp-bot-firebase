import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isCustomerCareWindowOpenFromLastInboundMs,
  normalizeWhatsappContentVariableStrings,
  TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_MS,
  TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_SKEW_MS,
} from "../services/twilioClient";

function readRepoFile(relativePathFromRepoRoot: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePathFromRepoRoot);
  return fs.readFileSync(absolutePath, "utf8");
}

test("customer-care window: just inside threshold is open", () => {
  const nowMs = 1_700_000_000_000;
  const lastInboundMs = nowMs - TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_MS + TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_SKEW_MS + 1;
  assert.equal(isCustomerCareWindowOpenFromLastInboundMs(lastInboundMs, nowMs), true);
});

test("customer-care window: just before threshold is closed", () => {
  const nowMs = 1_700_000_000_000;
  const lastInboundMs = nowMs - TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_MS + TWILIO_WHATSAPP_CUSTOMER_CARE_WINDOW_SKEW_MS - 1;
  assert.equal(isCustomerCareWindowOpenFromLastInboundMs(lastInboundMs, nowMs), false);
});

test("customer-care window: non-finite or zero is closed", () => {
  assert.equal(isCustomerCareWindowOpenFromLastInboundMs(0, 1_700_000_000_000), false);
  assert.equal(isCustomerCareWindowOpenFromLastInboundMs(Number.NaN, 1_700_000_000_000), false);
});

test("normalizeWhatsappContentVariableStrings: newlines become separators", () => {
  const out = normalizeWhatsappContentVariableStrings({ "1": "a\nb\nc" });
  assert.equal(out["1"], "a | b | c");
});

test("normalizeWhatsappContentVariableStrings: tabs and long space runs", () => {
  const out = normalizeWhatsappContentVariableStrings({ "1": "x\t     y" });
  assert.match(out["1"], /^x /);
  assert.ok(!out["1"].includes("\t"));
  assert.ok(!/\n/.test(out["1"]));
});

test("normalizeWhatsappContentVariableStrings: truncates at 1600 chars", () => {
  const long = "x".repeat(2000);
  const out = normalizeWhatsappContentVariableStrings({ "1": long });
  assert.equal(out["1"].length, 1600);
  assert.ok(out["1"].endsWith("\u2026"));
});

test("twilio preflight logs and returns false on API failure (source contract)", () => {
  const source = readRepoFile("src/services/twilioClient.ts");
  assert.match(
    source,
    /Customer-care window preflight failed; treating window as closed/,
    "preflight catch should log and default to closed window"
  );
  assert.match(
    source,
    /catch \(error\) \{[\s\S]*?return false;/,
    "preflight catch should return false"
  );
});

test("sendAgentNotificationMessage branches on window preflight (source contract)", () => {
  const source = readRepoFile("src/services/messagingProvider.ts");
  assert.match(
    source,
    /isLikelyWhatsAppCustomerCareWindowOpenForRecipient\(params\.to\)/,
    "should call Twilio window preflight"
  );
  assert.match(
    source,
    /Agent notification sent via Twilio template \(closed window\)/,
    "closed window path should log template send"
  );
  assert.match(
    source,
    /if \(windowLikelyOpen\)[\s\S]*?twilioSendTextWithTemplateFallback/,
    "open window should use free-form first with template fallback"
  );
  assert.match(
    source,
    /if \(templateSid\) \{[\s\S]*?await twilioSendTemplate\(/,
    "closed window with template should call twilioSendTemplate"
  );
  assert.match(source, /twilioTemplateVariables/, "should support explicit Twilio Content variables");
});

test("Proplead 8-var template SID comparison is case-normalized (source contract)", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /TWILIO_AGENT_NOTIFICATION_PROPLEAD_8VAR_CONTENT_SID_NORMALIZED\s*=[\s\S]*?\.toUpperCase\(\)/,
    "constant SID should be normalized once"
  );
  assert.match(
    source,
    /function isProplead8VarAgentNotificationSid[\s\S]*?\.toUpperCase\(\)\s*===\s*TWILIO_AGENT_NOTIFICATION_PROPLEAD_8VAR_CONTENT_SID_NORMALIZED/,
    "Firestore SID and constant SID should be compared in the same normalized case"
  );
  assert.match(
    source,
    /buildPropleadAgentNotificationTwilioVariables[\s\S]*?isProplead8VarAgentNotificationSid\(params\.templateSid\)/,
    "8-variable builder should use the normalized SID helper"
  );
  assert.match(
    source,
    /getAgentNotificationTemplateSidForCompactAlert[\s\S]*?isProplead8VarAgentNotificationSid\(primary\)/,
    "compact alerts should not accidentally reuse the Proplead 8-var template"
  );
});

test("Proplead free-form qualified alert mirrors the 8-var template copy (source contract)", () => {
  const source = readRepoFile("src/index.ts");
  assert.match(
    source,
    /function renderPropleadAgentNotificationBody\(vars: Record<string, string>\)/,
    "qualified lead free-form body should have a dedicated Proplead template renderer"
  );
  assert.match(
    source,
    /Tu nuevo lead se llama \*\$\{vars\["1"\]/,
    "renderer should use the same variable slots as the approved template"
  );
  assert.match(
    source,
    /function buildQualifiedLeadAgentNotificationPayload[\s\S]*?renderPropleadAgentNotificationBody\(propleadVars\)[\s\S]*?twilioTemplateVariables: propleadVars/,
    "payload builder should render the free-form body from the same variables used by the template"
  );
  assert.match(
    source,
    /body: notificationPayload\.body/,
    "agent notification send should use the mirrored body"
  );
  assert.match(
    source,
    /twilioTemplateVariables: notificationPayload\.twilioTemplateVariables/,
    "agent notification send should pass the matching template variables"
  );
});
