import assert from "node:assert/strict";
import test from "node:test";

import { getAdminSessionStatus, requireAdmin } from "../lib/api-auth";

const originalAdminSecret = process.env.ADMIN_PROCESS_SECRET;

test.after(() => {
  if (originalAdminSecret === undefined) {
    delete process.env.ADMIN_PROCESS_SECRET;
  } else {
    process.env.ADMIN_PROCESS_SECRET = originalAdminSecret;
  }
});

test("rejects an unauthenticated admin request", async () => {
  delete process.env.ADMIN_PROCESS_SECRET;

  const response = await requireAdmin(
    new Request("https://cartrenew.example/api/admin/stores")
  );

  assert.equal(response?.status, 401);
});

test("forbids a signed-in non-admin user", async () => {
  assert.equal(
    getAdminSessionStatus("user_123", {
      metadata: { role: "customer" },
    }),
    403
  );
});

test("allows a signed-in admin user", async () => {
  assert.equal(
    getAdminSessionStatus("user_admin", {
      metadata: { role: "admin" },
    }),
    200
  );
});

test("allows a valid server-to-server admin secret", async () => {
  process.env.ADMIN_PROCESS_SECRET = "test-admin-secret";

  const response = await requireAdmin(
    new Request("https://cartrenew.example/api/admin/stores", {
      headers: { "x-admin-secret": "test-admin-secret" },
    })
  );

  assert.equal(response, null);
});
