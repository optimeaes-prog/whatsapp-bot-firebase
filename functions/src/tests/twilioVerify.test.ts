import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import {
  startVerification,
  checkVerification,
  isTwilioVerifyRateLimited,
  twilioVerifyErrorMessage,
} from "../services/twilioVerify";

type AxiosMockHandler = (url: string, body: string) => Promise<{ data: unknown; status?: number }>;

function withAxiosMock(handler: AxiosMockHandler, fn: () => Promise<void>): Promise<void> {
  const original = axios.post;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (axios as any).post = async (url: string, body: string) => handler(url, body);
  return fn().finally(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (axios as any).post = original;
  });
}

const FAKE_CREDS = {
  accountSid: "AC_test",
  authToken: "tok_test",
  serviceSid: "VA_test",
};

test("startVerification posts to /Verifications and parses sid+status", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  await withAxiosMock(
    async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { data: { sid: "VE123", status: "pending", channel: "sms" } };
    },
    async () => {
      const result = await startVerification({
        credentials: FAKE_CREDS,
        to: "+34612345678",
        channel: "sms",
        locale: "es",
      });
      assert.equal(result.sid, "VE123");
      assert.equal(result.status, "pending");
      assert.equal(result.channel, "sms");
      assert.ok(capturedUrl.includes("/Services/VA_test/Verifications"));
      assert.ok(capturedBody.includes("To=%2B34612345678"));
      assert.ok(capturedBody.includes("Channel=sms"));
      assert.ok(capturedBody.includes("Locale=es"));
    }
  );
});

test("startVerification throws when Twilio omits sid", async () => {
  await withAxiosMock(
    async () => ({ data: { status: "pending" } }),
    async () => {
      await assert.rejects(
        () =>
          startVerification({
            credentials: FAKE_CREDS,
            to: "+34612345678",
          }),
        /did not return a verification sid/
      );
    }
  );
});

test("checkVerification with approved status flags valid", async () => {
  await withAxiosMock(
    async () => ({ data: { sid: "VE1", status: "approved", valid: true } }),
    async () => {
      const result = await checkVerification({
        credentials: FAKE_CREDS,
        to: "+34612345678",
        code: "123456",
      });
      assert.equal(result.valid, true);
      assert.equal(result.status, "approved");
    }
  );
});

test("checkVerification with pending status is not valid", async () => {
  await withAxiosMock(
    async () => ({ data: { sid: "VE1", status: "pending", valid: false } }),
    async () => {
      const result = await checkVerification({
        credentials: FAKE_CREDS,
        to: "+34612345678",
        code: "000000",
      });
      assert.equal(result.valid, false);
      assert.equal(result.status, "pending");
    }
  );
});

test("checkVerification posts To and Code (not the SID) to VerificationCheck", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  await withAxiosMock(
    async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { data: { status: "approved", valid: true } };
    },
    async () => {
      await checkVerification({
        credentials: FAKE_CREDS,
        to: "+34612345678",
        code: "987654",
      });
      assert.ok(capturedUrl.endsWith("/Services/VA_test/VerificationCheck"));
      assert.ok(capturedBody.includes("To=%2B34612345678"));
      assert.ok(capturedBody.includes("Code=987654"));
    }
  );
});

test("isTwilioVerifyRateLimited recognises Twilio 60203 code", () => {
  // Build a synthetic axios error.
  const err = Object.assign(new Error("boom"), {
    isAxiosError: true,
    response: { status: 400, data: { code: 60203, message: "Max send attempts reached" } },
    config: {},
    toJSON: () => ({}),
  });
  // axios.isAxiosError checks an internal property; emulate it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (axios as any).isAxiosError = (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError;
  assert.equal(isTwilioVerifyRateLimited(err), true);
});

test("twilioVerifyErrorMessage prefers Twilio message + code", () => {
  const err = Object.assign(new Error("HTTP fail"), {
    isAxiosError: true,
    response: { status: 400, data: { code: 60200, message: "Invalid parameter" } },
    config: {},
    toJSON: () => ({}),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (axios as any).isAxiosError = (e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError;
  const msg = twilioVerifyErrorMessage(err);
  assert.ok(msg.includes("60200"));
  assert.ok(msg.includes("Invalid parameter"));
});
