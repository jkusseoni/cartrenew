#!/usr/bin/env node
/**
 * Translate helper for CartRenew locales (en, hi, hni).
 *
 * Usage:
 *   1. Get free DeepL API key: https://www.deepl.com/pro-api
 *   2. Set env: DEEPL_API_KEY=your-key
 *   3. Run: node scripts/scripts/translate.js
 *
 * Note: Hinglish (hni) is maintained manually — this script only
 * refreshes Hindi (hi) from English via DeepL.
 */

const fs = require("fs");
const path = require("path");

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const MESSAGES_DIR = path.join(__dirname, "../../messages");

// Supported app locales → DeepL target codes
const deeplLangMap = {
  hi: "HI",
};

async function translateText(text, targetLang) {
  if (!DEEPL_API_KEY) {
    console.error("❌ DEEPL_API_KEY not set. Set it and retry.");
    process.exit(1);
  }

  const deeplLang = deeplLangMap[targetLang];
  if (!deeplLang) {
    return text;
  }

  try {
    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text,
        target_lang: deeplLang,
        source_lang: "EN",
      }),
    });

    const data = await response.json();
    return data.translations?.[0]?.text || text;
  } catch (err) {
    console.error(`⚠️ Translation failed for "${text}":`, err.message);
    return text;
  }
}

async function translateObject(obj, targetLang) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.startsWith("[TRANSLATE")) {
      const cleanText = value.replace(/\[TRANSLATE:[^\]]+\]\s*/, "");
      result[key] = await translateText(cleanText, targetLang);
      await new Promise((r) => setTimeout(r, 50));
    } else if (typeof value === "object" && value !== null) {
      result[key] = await translateObject(value, targetLang);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function main() {
  const enPath = path.join(MESSAGES_DIR, "en.json");
  const enData = JSON.parse(fs.readFileSync(enPath, "utf-8"));

  for (const lang of Object.keys(deeplLangMap)) {
    const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
    console.log(`🌍 Translating ${lang}...`);

    const translated = await translateObject(enData, lang);
    fs.writeFileSync(filePath, JSON.stringify(translated, null, 2), "utf-8");
    console.log(`✅ Saved: messages/${lang}.json`);
  }

  console.log("\n🎉 Done. Supported locales: en, hi, hni.");
  console.log("ℹ️  Hinglish (hni) is maintained manually in messages/hni.json.");
}

main().catch(console.error);
