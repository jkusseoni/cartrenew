/**
 * Manual test runner for generateAICartRecoveryMessage.
 *
 * Usage:
 *   npx tsx test-recovery.ts
 *   npm run test:recovery
 *
 * Language forcing:
 *   Remove customerStateCode/stateCode and set languageStrategy.primaryLanguage
 *   or languageStrategy.stateCode so AI does not infer Kannada/Marathi from geo.
 *
 * Loads AI keys from .env.local / .env.
 */
import { config } from "dotenv";

import {
  generateAICartRecoveryMessage,
  type AICartRecoveryContext,
} from "@/lib/ai-agent";
import type { LanguageStrategyInput } from "@/lib/lang-policy";

config({ path: ".env.local", override: true });
config({ path: ".env", override: true });

type RecoveryScenario = {
  name: string;
  description: string;
  languageOverride: string;
  context: AICartRecoveryContext;
};

const CHECKOUT_URL = "https://cartrenew-sandbox-store.myshopify.com/checkouts/test-recovery";

/** Force script language — bypasses geo/state inference (e.g. KA → Kannada). */
function forcedLanguage(primaryLanguage: "HINGLISH" | "ENGLISH" | "HINDI"): LanguageStrategyInput {
  return { primaryLanguage };
}

/** Force state routing + script — e.g. MP → Hindi belt, still render Hinglish if set. */
function forcedStateLanguage(
  stateCode: string,
  primaryLanguage: "HINGLISH" | "ENGLISH" | "HINDI" = "HINGLISH"
): LanguageStrategyInput {
  return { stateCode, primaryLanguage };
}

const scenarios: RecoveryScenario[] = [
  {
    name: "High-value cart",
    description: "Rs. 4,850 cart — forced HINGLISH (ignores any geo signal).",
    languageOverride: "primaryLanguage: HINGLISH",
    context: {
      storeName: "CartRenew Demo Store",
      checkoutUrl: CHECKOUT_URL,
      totalAmount: 4850,
      currency: "INR",
      customerName: "Priya Sharma",
      phoneNumber: "+919876543210",
      itemsCount: 2,
      items: [
        { title: "Wireless Earbuds Pro", quantity: 1, price: 2999 },
        { title: "USB-C Fast Charger", quantity: 1, price: 1851 },
      ],
      abandonedReason: "Customer paused after seeing delivery charges to Pune pincode",
      timeSpentOnCheckout: 42,
      userHistory: [
        "Viewed shipping policy twice",
        "Compared delivery fee with competitor",
        "Returned to cart after 6 hours",
      ],
      brandVoice: "premium, reassuring, concise",
      supportPhone: "+918888777666",
      languageStrategy: forcedLanguage("HINGLISH"),
    },
  },
  {
    name: "Payment friction",
    description: "UPI failure — forced MP state + HINGLISH script.",
    languageOverride: 'stateCode: "MP", primaryLanguage: HINGLISH',
    context: {
      storeName: "CartRenew Demo Store",
      checkoutUrl: CHECKOUT_URL,
      totalAmount: 1899,
      currency: "INR",
      customerName: "Rahul Mehta",
      phoneNumber: "+919811223344",
      itemsCount: 1,
      items: [{ title: "Running Shoes - Size 9", quantity: 1, price: 1899 }],
      abandonedReason: "UPI payment failed twice with bank timeout error",
      timeSpentOnCheckout: 95,
      userHistory: [
        "Selected UPI payment method",
        "Retried payment after OTP timeout",
        "Abandoned on payment error screen",
      ],
      brandVoice: "helpful, calm, action-oriented",
      whatsappNumber: "+918888777666",
      languageStrategy: forcedStateLanguage("MP", "HINGLISH"),
    },
  },
  {
    name: "Low-value reminder",
    description: "Small cart — forced HINGLISH instead of Kannada (no KA state passed).",
    languageOverride: "primaryLanguage: HINGLISH",
    context: {
      storeName: "CartRenew Demo Store",
      checkoutUrl: CHECKOUT_URL,
      totalAmount: 499,
      currency: "INR",
      customerName: "Ananya",
      phoneNumber: "+917700112233",
      itemsCount: 1,
      items: [{ title: "Phone Stand", quantity: 1, price: 499 }],
      abandonedReason: "Left checkout quickly after adding item",
      timeSpentOnCheckout: 6,
      userHistory: ["Added item from Instagram ad", "Opened checkout once"],
      brandVoice: "friendly, light, non-pushy",
      languageStrategy: forcedLanguage("HINGLISH"),
    },
  },
];

function printDivider(label: string) {
  console.log("\n" + "=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
}

function printResult(scenario: RecoveryScenario, result: Awaited<ReturnType<typeof generateAICartRecoveryMessage>>) {
  printDivider(`Scenario: ${scenario.name}`);
  console.log(`About    : ${scenario.description}`);
  console.log(`Override : ${scenario.languageOverride}`);
  console.log(`Strategy : ${result.languageStrategy.primaryLanguage} (state: ${result.languageStrategy.stateCode})`);
  console.log(`Amount   : Rs. ${scenario.context.totalAmount.toLocaleString("en-IN")}`);
  console.log(`Provider : ${result.provider} (${result.model})`);
  console.log(`Offer    : ${result.offerType}`);
  console.log(`Language : ${result.language} (confidence: ${result.languageConfidence})`);
  console.log(`Fallback : ${result.fallbackUsed ? "yes" : "no"}`);

  if (result.fallbackReason) {
    console.log(`Reason   : ${result.fallbackReason}`);
  }

  console.log(`CTA      : ${result.cta}`);
  console.log("\nMessage:\n");
  console.log(result.message);
  console.log("\n--- Prompt snapshot (first 400 chars) ---");
  console.log(result.prompt.slice(0, 400) + (result.prompt.length > 400 ? "…" : ""));
}

async function main() {
  const hasEndpointAI = Boolean(
    process.env.ENDPOINTAI_API_KEY?.trim() ||
      (process.env.OPENAI_API_KEY?.trim() &&
        process.env.OPENAI_BASE_URL?.trim() &&
        !process.env.OPENAI_BASE_URL.includes("api.openai.com"))
  );
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());
  const preferredProvider = process.env.AI_AGENT_PROVIDER?.trim() || "(auto → proxy first)";

  console.log("CartRenew — AI recovery message test");
  console.log(`Provider preference: ${preferredProvider}`);
  console.log(
    `Keys loaded: ENDPOINTAI=${hasEndpointAI ? "yes" : "no"}, DEEPSEEK=${hasDeepSeek ? "yes" : "no"}, OPENAI=${hasOpenAI ? "yes" : "no"}`
  );

  if (!hasEndpointAI && !hasDeepSeek && !hasOpenAI) {
    console.warn(
      "\nNo AI API key found — scenarios will use rule-based fallback output only.\n"
    );
  }

  for (const scenario of scenarios) {
    const result = await generateAICartRecoveryMessage(scenario.context);
    printResult(scenario, result);
  }

  printDivider("Done");
  console.log(`Ran ${scenarios.length} scenario(s).\n`);
}

main().catch((error) => {
  console.error("\nTest run failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
