import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/whatsapp/send/route";

const originalFetch = global.fetch;

test.after(() => {
  global.fetch = originalFetch;
});

test("rejects unauthenticated sends before contacting Twilio", async () => {
  process.env.ADMIN_PROCESS_SECRET = "test-admin-secret";

  let twilioCalled = false;
  global.fetch = async () => {
    twilioCalled = true;
    throw new Error("Twilio must not be called");
  };

  const response = await POST(
    new Request("https://cartrenew.example/api/whatsapp/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "+15555550100",
        abandonedCartUrl: "https://shop.example/cart",
      }),
    })
  );

  assert.equal(response.status, 401);
  assert.equal(twilioCalled, false);
});

test("allows an authenticated automation send", async () => {
  process.env.ADMIN_PROCESS_SECRET = "test-admin-secret";
  process.env.TWILIO_ACCOUNT_SID = "ACtest";
  process.env.TWILIO_AUTH_TOKEN = "test-token";
  process.env.TWILIO_WHATSAPP_NUMBER = "whatsapp:+15555550199";

  let twilioCalled = false;
  global.fetch = async () => {
    twilioCalled = true;
    return new Response(JSON.stringify({ sid: "SMtest", status: "queued" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const response = await POST(
    new Request("https://cartrenew.example/api/whatsapp/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-secret": "test-admin-secret",
      },
      body: JSON.stringify({
        phoneNumber: "+15555550100",
        abandonedCartUrl: "https://shop.example/cart",
      }),
    })
  );
  const body = (await response.json()) as { success?: boolean; messageSid?: string };

  assert.equal(response.status, 200);
  assert.equal(twilioCalled, true);
  assert.equal(body.success, true);
  assert.equal(body.messageSid, "SMtest");
});
