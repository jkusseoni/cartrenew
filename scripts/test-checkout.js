#!/usr/bin/env node

const endpoint = 'http://127.0.0.1:3000/api/cart/automate';
let now = () => Date.now();
let payloadMatrix = [];
let runId = "";
let timeoutMs = 30000;

async function bootstrapEnvironment() {
  const [{ default: path }, { performance }, dotenvModule] = await Promise.all([
    import("node:path"),
    import("node:perf_hooks"),
    import("dotenv"),
  ]);
  const dotenv = dotenvModule.default || dotenvModule;

  now = () => performance.now();
  dotenv.config({
    path: path.resolve(process.cwd(), ".env.local"),
    quiet: true,
  });
}

function configureRun() {
  const parsedTimeoutMs = Number(process.env.CART_AUTOMATE_TEST_TIMEOUT_MS || 30000);

  timeoutMs =
    Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0 ? parsedTimeoutMs : 30000;
  runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  payloadMatrix = createPayloadMatrix(runId);
}

function createPayloadMatrix(currentRunId) {
  return [
    {
      scenario: "single-sku-high-intent",
      payload: {
        abandonedReason: "shipping cost surfaced at checkout",
        checkoutUrl: `http://localhost:3000/cart/option-x-${currentRunId}-single`,
        customer: {
          email: "aarav.optionx@example.com",
          first_name: "Aarav",
          last_name: "Mehta",
          phone: "+91 98765 43210",
        },
        customerPhone: "+91 98765 43210",
        externalCartId: `option-x-${currentRunId}-single-sku`,
        line_items: [
          {
            price: "8499.00",
            quantity: 1,
            title: "Automation Starter Kit",
          },
        ],
        shopifyDomain: "bharat-ai-automations.myshopify.com",
        storeName: "Bharat AI Automations",
        timeSpentOnCheckout: 244,
        totalAmount: 8499,
        userHistory: ["viewed starter kit", "opened checkout", "selected UPI"],
        userId: "user_option_x_checkout_qa",
      },
    },
    {
      scenario: "multi-sku-returning-customer",
      payload: {
        abandonedReason: "payment retry abandoned",
        checkoutUrl: `http://localhost:3000/cart/option-x-${currentRunId}-bundle`,
        customer: {
          email: "nisha.optionx@example.com",
          first_name: "Nisha",
          last_name: "Rao",
          phone: "+91 99887 76655",
        },
        customerPhone: "+91 99887 76655",
        externalCartId: `option-x-${currentRunId}-multi-sku`,
        items: [
          {
            name: "Recovery Playbook",
            price: 3999,
            quantity: 1,
            title: "Recovery Playbook",
          },
          {
            name: "Lifecycle Messaging Bundle",
            price: 5499,
            quantity: 2,
            title: "Lifecycle Messaging Bundle",
          },
        ],
        shopifyDomain: "bharat-ai-automations.myshopify.com",
        storeName: "Bharat AI Automations",
        timeSpentOnCheckout: 612,
        totalAmount: 14997,
        userHistory: ["returning customer", "used coupon OPTIONX", "payment retry failed"],
        userId: "user_option_x_checkout_qa",
      },
    },
  ];
}

function buildHeaders(scenario) {
  const secret = (
    process.env.CART_AUTOMATE_SECRET ||
    process.env.WEBHOOK_INGEST_SECRET ||
    ""
  ).trim();
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-QA-Run-Id": runId,
    "X-QA-Scenario": scenario,
  };

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
    headers["X-Cart-Renew-Secret"] = secret;
  }

  return headers;
}

function getItemCount(payload) {
  const items = Array.isArray(payload.items) ? payload.items : payload.line_items;

  if (!Array.isArray(items)) {
    return 0;
  }

  return items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
}

function roundMetric(value) {
  return Math.round(value * 100) / 100;
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.ceil((percentileValue / 100) * sortedValues.length) - 1
  );

  return roundMetric(sortedValues[index]);
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text.trim()) {
    return { body: null, rawText: "" };
  }

  try {
    return { body: JSON.parse(text), rawText: text };
  } catch {
    return { body: null, rawText: text };
  }
}

function getOutcome(row) {
  if (row.connectionError) {
    return "CONNECTION_ERROR";
  }

  if (row.pipelineSuccess === true && row.deliveryStatus === "sent") {
    return "PASS";
  }

  if (row.pipelineSuccess === true && row.deliveryMode === "console") {
    return "PASS_CONSOLE";
  }

  if (row.pipelineSuccess === true) {
    return "WARN_DELIVERY";
  }

  if (row.statusCode === 401) {
    return "AUTH_REJECTED";
  }

  return "FAILED";
}

async function dispatchCheckout(testCase) {
  const body = JSON.stringify(testCase.payload);
  const start = now();

  try {
    const response = await fetch(endpoint, {
      body,
      headers: buildHeaders(testCase.scenario),
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const { body: responseBody, rawText } = await parseResponse(response);
    const durationMs = roundMetric(now() - start);
    const row = {
      aiModel: responseBody?.ai?.model || "n/a",
      aiProvider: responseBody?.ai?.provider || "n/a",
      cartId: responseBody?.cart?.id || "n/a",
      deliveryMode: responseBody?.delivery?.mode || "n/a",
      deliveryStatus: responseBody?.delivery?.status || "n/a",
      durationMs,
      error:
        responseBody?.error ||
        responseBody?.delivery?.error ||
        (response.ok ? "" : rawText.slice(0, 120)),
      httpOk: response.ok,
      itemCount: getItemCount(testCase.payload),
      payloadBytes: Buffer.byteLength(body),
      pipelineSuccess: responseBody?.success === true,
      scenario: testCase.scenario,
      statusCode: response.status,
      telemetryStored: responseBody?.telemetry?.stored === true ? "yes" : "no",
      totalAmount: testCase.payload.totalAmount,
    };

    return {
      ...row,
      outcome: getOutcome(row),
    };
  } catch (error) {
    const durationMs = roundMetric(now() - start);
    const row = {
      aiModel: "n/a",
      aiProvider: "n/a",
      cartId: "n/a",
      connectionError: error instanceof Error ? error.message : String(error),
      deliveryMode: "n/a",
      deliveryStatus: "n/a",
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      httpOk: false,
      itemCount: getItemCount(testCase.payload),
      payloadBytes: Buffer.byteLength(body),
      pipelineSuccess: false,
      scenario: testCase.scenario,
      statusCode: "n/a",
      telemetryStored: "no",
      totalAmount: testCase.payload.totalAmount,
    };

    return {
      ...row,
      outcome: getOutcome(row),
    };
  }
}

function printPayloadMatrix() {
  console.log("Option X abandoned checkout webhook matrix");
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Run ID: ${runId}`);
  console.table(
    payloadMatrix.map(({ payload, scenario }) => ({
      externalCartId: payload.externalCartId,
      itemCount: getItemCount(payload),
      scenario,
      storeName: payload.storeName,
      totalAmount: payload.totalAmount,
    }))
  );
}

function printPerformanceSummary(results) {
  const durations = results.map((result) => result.durationMs);
  const averageMs =
    durations.length === 0
      ? 0
      : roundMetric(durations.reduce((total, value) => total + value, 0) / durations.length);

  console.table([
    {
      averageMs,
      cases: results.length,
      maxMs: roundMetric(Math.max(...durations)),
      minMs: roundMetric(Math.min(...durations)),
      p95Ms: percentile(durations, 95),
      runId,
      timeoutMs,
    },
  ]);
}

async function main() {
  await bootstrapEnvironment();
  configureRun();

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Run this script with Node.js 18 or newer.");
  }

  printPayloadMatrix();

  const results = [];

  for (const testCase of payloadMatrix) {
    results.push(await dispatchCheckout(testCase));
  }

  console.log("Auto-pilot pipeline results");
  console.table(
    results.map((result) => ({
      ai: `${result.aiProvider}:${result.aiModel}`,
      cartId: result.cartId,
      delivery: `${result.deliveryMode}:${result.deliveryStatus}`,
      durationMs: result.durationMs,
      error: result.error,
      outcome: result.outcome,
      payloadBytes: result.payloadBytes,
      scenario: result.scenario,
      statusCode: result.statusCode,
      telemetryStored: result.telemetryStored,
    }))
  );

  console.log("Performance summary");
  printPerformanceSummary(results);

  const hardFailures = results.filter((result) =>
    ["AUTH_REJECTED", "CONNECTION_ERROR", "FAILED"].includes(result.outcome)
  );

  if (hardFailures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Checkout webhook matrix failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
