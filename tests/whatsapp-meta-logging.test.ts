import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { sendWhatsAppMessage } from "../lib/services/whatsapp-meta";

const sensitiveValues = [
  "14155552671",
  "Sensitive Customer",
  "https://checkout.example/recover/secret-token",
];

const originalFetch = globalThis.fetch;
const originalLog = console.log;
const originalError = console.error;
const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

const capturedLogs: unknown[][] = [];
console.log = (...args: unknown[]) => capturedLogs.push(args);
console.error = (...args: unknown[]) => capturedLogs.push(args);

process.env.WHATSAPP_ACCESS_TOKEN = "test-system-user-token";
process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";

function assertCallersDoNotLogRecoveryData() {
  const sourcePaths = [
    "app/api/webhooks/shopify/route.ts",
    "app/api/whatsapp/send/route.ts",
    "lib/bullmq.ts",
    "lib/services/messaging.ts",
    "lib/services/whatsapp-meta.ts",
  ];
  const sensitiveIdentifiers = new Set([
    "bodyVariables",
    "cartId",
    "cartToken",
    "checkoutUrl",
    "customer",
    "customerName",
    "customerPhone",
    "email",
    "phone",
    "recoveryCartId",
    "safeName",
    "shippingAddress",
    "toPhone",
    "token",
    "trackedCheckoutUrl",
  ]);
  const violations: string[] = [];

  for (const sourcePath of sourcePaths) {
    const source = readFileSync(resolve(process.cwd(), sourcePath), "utf8");
    const sourceFile = ts.createSourceFile(
      sourcePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    for (const forbiddenSnippet of [
      "bodyPreview:",
      "fullBody:",
    ]) {
      if (source.includes(forbiddenSnippet)) {
        violations.push(`${sourcePath}: contains ${forbiddenSnippet}`);
      }
    }

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === "console"
      ) {
        const inspectArgument = (argumentNode: ts.Node) => {
          if (ts.isStringLiteralLike(argumentNode)) return;
          if (
            ts.isPropertyAccessExpression(argumentNode) &&
            ts.isIdentifier(argumentNode.expression) &&
            argumentNode.expression.text === "payload" &&
            ["customer", "shipping_address", "billing_address"].includes(
              argumentNode.name.text
            )
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              argumentNode.getStart(sourceFile)
            );
            violations.push(
              `${sourcePath}:${line + 1} logs customer or address payload data`
            );
          }
          if (
            ts.isIdentifier(argumentNode) &&
            (argumentNode.text === "payload" || argumentNode.text === "body") &&
            (ts.isShorthandPropertyAssignment(argumentNode.parent) ||
              (ts.isPropertyAssignment(argumentNode.parent) &&
                argumentNode.parent.initializer === argumentNode) ||
              (ts.isCallExpression(argumentNode.parent) &&
                ts.isPropertyAccessExpression(argumentNode.parent.expression) &&
                ts.isIdentifier(argumentNode.parent.expression.expression) &&
                argumentNode.parent.expression.expression.text === "console" &&
                argumentNode.parent.arguments.includes(argumentNode)))
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              argumentNode.getStart(sourceFile)
            );
            violations.push(
              `${sourcePath}:${line + 1} logs a request payload or body`
            );
          }
          if (
            ts.isCallExpression(argumentNode) &&
            ts.isPropertyAccessExpression(argumentNode.expression) &&
            ts.isIdentifier(argumentNode.expression.expression) &&
            argumentNode.expression.expression.text === "JSON" &&
            argumentNode.expression.name.text === "stringify" &&
            argumentNode.arguments.some(
              (value) =>
                ts.isIdentifier(value) &&
                (value.text === "payload" || value.text === "body")
            )
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              argumentNode.getStart(sourceFile)
            );
            violations.push(
              `${sourcePath}:${line + 1} logs a serialized request body`
            );
          }
          if (
            ts.isIdentifier(argumentNode) &&
            sensitiveIdentifiers.has(argumentNode.text)
          ) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(
              argumentNode.getStart(sourceFile)
            );
            violations.push(
              `${sourcePath}:${line + 1} logs ${argumentNode.text}`
            );
          }
          ts.forEachChild(argumentNode, inspectArgument);
        };

        node.arguments.forEach(inspectArgument);
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  assert.deepEqual(violations, []);
}

async function main() {
  try {
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: "whatsapp",
          contacts: [{ input: sensitiveValues[0], wa_id: sensitiveValues[0] }],
          messages: [{ id: "wamid.test-message" }],
        }),
      }) as Response;

    const success = await sendWhatsAppMessage(`+${sensitiveValues[0]}`, {
      templateName: "abandoned_cart_reminder",
      bodyVariables: [sensitiveValues[1], sensitiveValues[2]],
    });
    assert.equal(success.success, true);

    const invalidPhone = "private-invalid-destination";
    const invalid = await sendWhatsAppMessage(invalidPhone, {
      templateName: "abandoned_cart_reminder",
    });
    assert.equal(invalid.success, false);

    globalThis.fetch = async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            code: 131030,
            type: "OAuthException",
            message: `Recipient ${sensitiveValues[0]} rejected ${sensitiveValues[2]}`,
          },
        }),
      }) as Response;

    const rejected = await sendWhatsAppMessage(`+${sensitiveValues[0]}`, {
      templateName: "abandoned_cart_reminder",
      bodyVariables: [sensitiveValues[1], sensitiveValues[2]],
    });
    assert.equal(rejected.success, false);

    const output = capturedLogs
      .flatMap((args) =>
        args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      )
      .join("\n");

    for (const sensitiveValue of [...sensitiveValues, invalidPhone]) {
      assert.equal(
        output.includes(sensitiveValue),
        false,
        `console output leaked sensitive value: ${sensitiveValue}`
      );
    }

    assertCallersDoNotLogRecoveryData();
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;

    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN;
    else process.env.WHATSAPP_ACCESS_TOKEN = originalToken;

    if (originalPhoneNumberId === undefined) {
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    } else {
      process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
    }
  }
}

main()
  .then(() =>
    console.log("PASS: WhatsApp delivery logs exclude customer contact and recovery data")
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
