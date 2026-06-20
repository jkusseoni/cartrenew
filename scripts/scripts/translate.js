#!/usr/bin/env node
/**
 * Auto-translate all language files using DeepL API
 * 
 * Usage:
 *   1. Get free DeepL API key: https://www.deepl.com/pro-api
 *   2. Set env: DEEPL_API_KEY=your-key
 *   3. Run: node scripts/translate.js
 * 
 * Free tier: 500,000 chars/month (enough for all 20 languages)
 */

const fs = require("fs");
const path = require("path");

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const MESSAGES_DIR = path.join(__dirname, "../messages");

// Language code mapping: our code → DeepL code
const deeplLangMap = {
  es: "ES", fr: "FR", de: "DE", ar: "AR",
  zh: "ZH", ja: "JA", pt: "PT-BR", ru: "RU",
  bn: "EN", // Bengali not in DeepL free, fallback
  ur: "EN", // Urdu not in DeepL, fallback
  ta: "EN", te: "EN", mr: "EN", gu: "EN",
  kn: "EN", ml: "EN", pa: "EN", or: "EN",
};

// For Indian languages NOT supported by DeepL, we keep English
// and the community can contribute translations via GitHub

async function translateText(text, targetLang) {
  if (!DEEPL_API_KEY) {
    console.error("❌ DEEPL_API_KEY not set. Set it and retry.");
    process.exit(1);
  }

  const deeplLang = deeplLangMap[targetLang];
  if (!deeplLang || deeplLang === "EN") {
    return text; // Return English for unsupported languages
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
      await new Promise((r) => setTimeout(r, 50)); // Rate limit
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

  const targetLangs = Object.keys(deeplLangMap);

  for (const lang of targetLangs) {
    const filePath = path.join(MESSAGES_DIR, `${lang}.json`);
    console.log(`🌍 Translating ${lang}...`);

    const translated = await translateObject(enData, lang);
    fs.writeFileSync(filePath, JSON.stringify(translated, null, 2), "utf-8");
    console.log(`✅ Saved: messages/${lang}.json`);
  }

  console.log("\n🎉 All translations complete!");
  console.log("⚠️  Indian languages (bn, ur, ta, te, mr, gu, kn, ml, pa, or) kept in English.");
  console.log("🤝 Please contribute community translations on GitHub!");
}

main().catch(console.error);
