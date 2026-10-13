import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import test from "node:test"
import { fileURLToPath } from "node:url"

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const noticePath = path.join(root, "components/shopify/EmailRecoveryNotice.tsx")

process.env.NEXT_PUBLIC_APP_NAME = "Pingza"

test("Pingza email recovery notice renders a space after the brand name", async () => {
  const { default: EmailRecoveryNotice } = await import(
    "../components/shopify/EmailRecoveryNotice.tsx"
  )
  const html = renderToStaticMarkup(React.createElement(EmailRecoveryNotice))
  assert.match(html, /Pingza sends/)
  assert.equal(html.includes("Pingzasends"), false)
})

test("Next compiler keeps the space when the sentence contains an apostrophe entity", () => {
  const { transformSync } = require("next/dist/build/swc/index.js")
  const { getJestSWCOptions } = require("next/dist/build/swc/options.js")
  const filename = "components/shopify/EmailRecoveryNotice.tsx"
  const src = fs.readFileSync(noticePath, "utf8")
  const options = getJestSWCOptions({
    isServer: true,
    filename,
    esm: true,
    swcPlugins: [],
    compilerOptions: {},
    jsConfig: { compilerOptions: { jsx: "preserve" } },
    serverReferenceHashSalt: "",
  })
  const result = transformSync(src, { ...options, filename })
  const code = typeof result === "string" ? result : result.code
  assert.match(code, /brand\.name,\s*" ",\s*"sends /)
})
