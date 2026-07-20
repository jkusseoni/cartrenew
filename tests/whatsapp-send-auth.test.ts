import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { POST } from "../app/api/whatsapp/send/route";

const originalEnvironment = {
  ADMIN_PROCESS_SECRET: process.env.ADMIN_PROCESS_SECRET,
  NODE_ENV: process.env.NODE_ENV,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
};
const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.NODE_ENV = "production";
  process.env.ADMIN_PROCESS_SECRET = "test-admin-secret";
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  process.env.TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886";
});

afterEach(() => {
  restoreEnvironment();
  globalThis.fetch = originalFetch;
});

test("rejects an unauthenticated send without contacting Twilio", async () => {
  let twilioCalls = 0;
  globalThis.fetch = async () => {
    twilioCalls += 1;
    throw new Error("Twilio must not be contacted");
  };

  const response = await POST(createRequest());

  assert.equal(response.status, 401);
  assert.equal(twilioCalls, 0);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("allows the cart poller secret to send", async () => {
  let twilioCalls = 0;
  globalThis.fetch = async () => {
    twilioCalls += 1;
    return Response.json({ sid: "SM_test", status: "queued" });
  };

  const response = await POST(
    createRequest({ "x-admin-secret": "test-admin-secret" })
  );

  assert.equal(response.status, 200);
  assert.equal(twilioCalls, 1);
  assert.deepEqual(await response.json(), {
    success: true,
    message: "WhatsApp communication node initialized smoothly",
    messageSid: "SM_test",
    deliveryStatus: "queued",
  });
});

function createRequest(headers: Record<string, string> = {}) {
  return new Request("https://cartrenew.example/api/whatsapp/send", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      phoneNumber: "+14155550100",
      abandonedCartUrl: "https://shop.example/checkouts/test",
    }),
  });
}

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
