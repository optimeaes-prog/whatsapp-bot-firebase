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
  // Legacy whitelist still exists as a backwards-compat fallback for orgs that
  // haven't been through the sender-migration flow. New orgs are detected via
  // the per-org `agentNotificationIs8Var` flag.
  assert.match(
    source,
    /TWILIO_AGENT_NOTIFICATION_8VAR_CONTENT_SIDS\s*=\s*new Set\([\s\S]*?\.toUpperCase\(\)/,
    "approved 8-var template SIDs should be stored normalized"
  );
  assert.match(
    source,
    /function isProplead8VarAgentNotification\(params:[\s\S]*?TWILIO_AGENT_NOTIFICATION_8VAR_CONTENT_SIDS\.has\(String\(params\.sid \|\| ""\)\.trim\(\)\.toUpperCase\(\)\)/,
    "Firestore SID and approved SID set should be compared in the same normalized case; the helper now also accepts a per-org is8VarFlag"
  );
  assert.match(
    source,
    /function isProplead8VarAgentNotification\(params:[\s\S]*?if \(params\.is8VarFlag === true\) return true/,
    "per-org agentNotificationIs8Var flag should win over the legacy whitelist"
  );
  assert.match(
    source,
    /buildPropleadAgentNotificationTwilioVariables[\s\S]*?isProplead8VarAgentNotification\(\{ sid: params\.templateSid, is8VarFlag: params\.is8VarFlag \}\)/,
    "8-variable builder should pass the per-org flag through to the helper"
  );
  assert.match(
    source,
    /getAgentNotificationTemplateSidForCompactAlert[\s\S]*?isProplead8VarAgentNotification\(\{ sid: primary, is8VarFlag: twilioTemplates\.agentNotificationIs8Var \}\)/,
    "compact alerts should consult the per-org flag when deciding whether to skip the 8-var SID"
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
