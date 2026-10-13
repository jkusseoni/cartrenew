import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { PINGZA_SUPPORT_EMAIL, publicSupportEmail } from "../lib/legal/pingza"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("Pingza register-store returns 404", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
        import { NextRequest } from "next/server"
        import { POST } from "./app/api/woocommerce/register-store/route.ts"
        const res = await POST(new NextRequest("http://localhost/api/woocommerce/register-store", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer not-a-session",
          },
          body: JSON.stringify({
            email: "buyer@example.com",
            site_url: "https://shop.example",
            store_name: "Shop",
          }),
        }))
        const body = await res.json()
        if (res.status !== 404 || body.error !== "Not found") {
          console.error(JSON.stringify({ status: res.status, body }))
          process.exit(1)
        }
      `,
    ],
    {
      cwd: root,
      env: { ...process.env, NEXT_PUBLIC_APP_NAME: "Pingza" },
      encoding: "utf8",
    }
  )
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
})

test("Pingza public contact is not the CartRenew address", () => {
  assert.equal(publicSupportEmail(true, "contact@cartrenew.com"), "contact@cartrenew.com")
  assert.equal(publicSupportEmail(false, "contact@cartrenew.com"), PINGZA_SUPPORT_EMAIL)
  assert.equal(publicSupportEmail(false, ""), PINGZA_SUPPORT_EMAIL)
})
