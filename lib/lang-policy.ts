export type LanguageFallback = "HINGLISH" | "ENGLISH";

export type RegionalLanguage =
  | "ASSAMESE"
  | "BENGALI"
  | "BODO"
  | "DOGRI"
  | "ENGLISH"
  | "GARO"
  | "GUJARATI"
  | "HINDI"
  | "HINGLISH"
  | "KANNADA"
  | "KASHMIRI"
  | "KHASI"
  | "KONKANI"
  | "MAITHILI"
  | "MALAYALAM"
  | "MANIPURI"
  | "MARATHI"
  | "MIZO"
  | "NEPALI"
  | "ODIA"
  | "PUNJABI"
  | "SANSKRIT"
  | "SANTALI"
  | "SINDHI"
  | "TAMIL"
  | "TELUGU"
  | "URDU";

export type IndianStateCode =
  | "IN-AN"
  | "IN-AP"
  | "IN-AR"
  | "IN-AS"
  | "IN-BR"
  | "IN-CH"
  | "IN-CT"
  | "IN-DL"
  | "IN-DN"
  | "IN-GA"
  | "IN-GJ"
  | "IN-HP"
  | "IN-HR"
  | "IN-JH"
  | "IN-JK"
  | "IN-KA"
  | "IN-KL"
  | "IN-LA"
  | "IN-LD"
  | "IN-MH"
  | "IN-ML"
  | "IN-MN"
  | "IN-MP"
  | "IN-MZ"
  | "IN-NL"
  | "IN-OR"
  | "IN-PB"
  | "IN-PY"
  | "IN-RJ"
  | "IN-SK"
  | "IN-TG"
  | "IN-TN"
  | "IN-TR"
  | "IN-UP"
  | "IN-UT"
  | "IN-WB";

export type LanguageStrategyInput = string | Partial<LanguageStrategy>;

export interface LanguageStrategy {
  stateCode: IndianStateCode | "DEFAULT";
  regionName: string;
  targetLocale: string;
  primaryLanguage: RegionalLanguage;
  fallbackLanguage: LanguageFallback;
  secondaryFallbackLanguage: "ENGLISH";
  textDirection: "ltr" | "rtl";
  confidenceThreshold: number;
  promptRenderRisk: "LOW" | "MEDIUM" | "HIGH";
  useNativeScript: boolean;
  supportedLanguages: RegionalLanguage[];
}

type LanguageProfile = {
  targetLocale: string;
  fallbackLanguage: LanguageFallback;
  textDirection: "ltr" | "rtl";
  confidenceThreshold: number;
  promptRenderRisk: "LOW" | "MEDIUM" | "HIGH";
  useNativeScript: boolean;
};

type StateLanguageRule = {
  regionName: string;
  primaryLanguage: RegionalLanguage;
  supportedLanguages?: RegionalLanguage[];
};

const LANGUAGE_PROFILES: Record<RegionalLanguage, LanguageProfile> = {
  ASSAMESE: languageProfile("as-IN", "ENGLISH", 0.82, "HIGH"),
  BENGALI: languageProfile("bn-IN", "HINGLISH", 0.8, "MEDIUM"),
  BODO: languageProfile("brx-IN", "ENGLISH", 0.84, "HIGH"),
  DOGRI: languageProfile("doi-IN", "HINGLISH", 0.84, "HIGH"),
  ENGLISH: languageProfile("en-IN", "ENGLISH", 0.5, "LOW", false),
  GARO: languageProfile("grt-IN", "ENGLISH", 0.84, "HIGH"),
  GUJARATI: languageProfile("gu-IN", "HINGLISH", 0.8, "MEDIUM"),
  HINDI: languageProfile("hi-IN", "HINGLISH", 0.72, "LOW"),
  HINGLISH: languageProfile("hi-Latn-IN", "ENGLISH", 0.55, "LOW", false),
  KANNADA: languageProfile("kn-IN", "ENGLISH", 0.84, "HIGH"),
  KASHMIRI: languageProfile("ks-IN", "ENGLISH", 0.86, "HIGH"),
  KHASI: languageProfile("kha-IN", "ENGLISH", 0.84, "HIGH"),
  KONKANI: languageProfile("kok-IN", "HINGLISH", 0.82, "MEDIUM"),
  MAITHILI: languageProfile("mai-IN", "HINGLISH", 0.82, "MEDIUM"),
  MALAYALAM: languageProfile("ml-IN", "ENGLISH", 0.84, "HIGH"),
  MANIPURI: languageProfile("mni-IN", "ENGLISH", 0.84, "HIGH"),
  MARATHI: languageProfile("mr-IN", "HINGLISH", 0.82, "MEDIUM"),
  MIZO: languageProfile("lus-IN", "ENGLISH", 0.82, "MEDIUM"),
  NEPALI: languageProfile("ne-IN", "ENGLISH", 0.8, "MEDIUM"),
  ODIA: languageProfile("or-IN", "HINGLISH", 0.82, "HIGH"),
  PUNJABI: languageProfile("pa-IN", "HINGLISH", 0.8, "MEDIUM"),
  SANSKRIT: languageProfile("sa-IN", "ENGLISH", 0.86, "HIGH"),
  SANTALI: languageProfile("sat-IN", "ENGLISH", 0.86, "HIGH"),
  SINDHI: languageProfile("sd-IN", "HINGLISH", 0.84, "HIGH"),
  TAMIL: languageProfile("ta-IN", "ENGLISH", 0.84, "HIGH"),
  TELUGU: languageProfile("te-IN", "ENGLISH", 0.86, "HIGH"),
  URDU: languageProfile("ur-IN", "HINGLISH", 0.82, "HIGH"),
};

const STATE_LANGUAGE_RULES: Record<IndianStateCode, StateLanguageRule> = {
  "IN-AN": { regionName: "Andaman and Nicobar Islands", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "BENGALI", "ENGLISH"] },
  "IN-AP": { regionName: "Andhra Pradesh", primaryLanguage: "TELUGU", supportedLanguages: ["TELUGU", "URDU", "ENGLISH"] },
  "IN-AR": { regionName: "Arunachal Pradesh", primaryLanguage: "ENGLISH", supportedLanguages: ["ENGLISH", "HINDI"] },
  "IN-AS": { regionName: "Assam", primaryLanguage: "ASSAMESE", supportedLanguages: ["ASSAMESE", "BODO", "BENGALI", "ENGLISH"] },
  "IN-BR": { regionName: "Bihar", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "MAITHILI", "URDU"] },
  "IN-CH": { regionName: "Chandigarh", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "PUNJABI", "ENGLISH"] },
  "IN-CT": { regionName: "Chhattisgarh", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "ODIA"] },
  "IN-DL": { regionName: "Delhi", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "PUNJABI", "URDU", "ENGLISH"] },
  "IN-DN": { regionName: "Dadra and Nagar Haveli and Daman and Diu", primaryLanguage: "GUJARATI", supportedLanguages: ["GUJARATI", "HINDI", "ENGLISH"] },
  "IN-GA": { regionName: "Goa", primaryLanguage: "KONKANI", supportedLanguages: ["KONKANI", "MARATHI", "ENGLISH"] },
  "IN-GJ": { regionName: "Gujarat", primaryLanguage: "GUJARATI", supportedLanguages: ["GUJARATI", "HINDI", "ENGLISH"] },
  "IN-HP": { regionName: "Himachal Pradesh", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "SANSKRIT", "ENGLISH"] },
  "IN-HR": { regionName: "Haryana", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "PUNJABI", "ENGLISH"] },
  "IN-JH": { regionName: "Jharkhand", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "SANTALI", "BENGALI", "ODIA"] },
  "IN-JK": { regionName: "Jammu and Kashmir", primaryLanguage: "KASHMIRI", supportedLanguages: ["KASHMIRI", "DOGRI", "URDU", "HINDI", "ENGLISH"] },
  "IN-KA": { regionName: "Karnataka", primaryLanguage: "KANNADA", supportedLanguages: ["KANNADA", "KONKANI", "URDU", "ENGLISH"] },
  "IN-KL": { regionName: "Kerala", primaryLanguage: "MALAYALAM", supportedLanguages: ["MALAYALAM", "TAMIL", "ENGLISH"] },
  "IN-LA": { regionName: "Ladakh", primaryLanguage: "ENGLISH", supportedLanguages: ["ENGLISH", "HINDI", "URDU"] },
  "IN-LD": { regionName: "Lakshadweep", primaryLanguage: "MALAYALAM", supportedLanguages: ["MALAYALAM", "ENGLISH"] },
  "IN-MH": { regionName: "Maharashtra", primaryLanguage: "MARATHI", supportedLanguages: ["MARATHI", "HINDI", "KONKANI", "ENGLISH"] },
  "IN-ML": { regionName: "Meghalaya", primaryLanguage: "KHASI", supportedLanguages: ["KHASI", "GARO", "BENGALI", "ENGLISH"] },
  "IN-MN": { regionName: "Manipur", primaryLanguage: "MANIPURI", supportedLanguages: ["MANIPURI", "ENGLISH", "HINDI"] },
  "IN-MP": { regionName: "Madhya Pradesh", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "MARATHI", "ENGLISH"] },
  "IN-MZ": { regionName: "Mizoram", primaryLanguage: "MIZO", supportedLanguages: ["MIZO", "ENGLISH", "HINDI"] },
  "IN-NL": { regionName: "Nagaland", primaryLanguage: "ENGLISH", supportedLanguages: ["ENGLISH", "HINDI"] },
  "IN-OR": { regionName: "Odisha", primaryLanguage: "ODIA", supportedLanguages: ["ODIA", "SANTALI", "TELUGU", "ENGLISH"] },
  "IN-PB": { regionName: "Punjab", primaryLanguage: "PUNJABI", supportedLanguages: ["PUNJABI", "HINDI", "ENGLISH"] },
  "IN-PY": { regionName: "Puducherry", primaryLanguage: "TAMIL", supportedLanguages: ["TAMIL", "TELUGU", "MALAYALAM", "ENGLISH"] },
  "IN-RJ": { regionName: "Rajasthan", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "SINDHI", "ENGLISH"] },
  "IN-SK": { regionName: "Sikkim", primaryLanguage: "NEPALI", supportedLanguages: ["NEPALI", "HINDI", "ENGLISH"] },
  "IN-TG": { regionName: "Telangana", primaryLanguage: "TELUGU", supportedLanguages: ["TELUGU", "URDU", "ENGLISH"] },
  "IN-TN": { regionName: "Tamil Nadu", primaryLanguage: "TAMIL", supportedLanguages: ["TAMIL", "ENGLISH"] },
  "IN-TR": { regionName: "Tripura", primaryLanguage: "BENGALI", supportedLanguages: ["BENGALI", "ENGLISH", "HINDI"] },
  "IN-UP": { regionName: "Uttar Pradesh", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "URDU", "ENGLISH"] },
  "IN-UT": { regionName: "Uttarakhand", primaryLanguage: "HINDI", supportedLanguages: ["HINDI", "SANSKRIT", "ENGLISH"] },
  "IN-WB": { regionName: "West Bengal", primaryLanguage: "BENGALI", supportedLanguages: ["BENGALI", "NEPALI", "HINDI", "ENGLISH"] },
};

const DEFAULT_STRATEGY: LanguageStrategy = {
  stateCode: "DEFAULT",
  regionName: "Pan-India",
  targetLocale: "hi-Latn-IN",
  primaryLanguage: "HINGLISH",
  fallbackLanguage: "ENGLISH",
  secondaryFallbackLanguage: "ENGLISH",
  textDirection: "ltr",
  confidenceThreshold: 0.55,
  promptRenderRisk: "LOW",
  useNativeScript: false,
  supportedLanguages: ["HINGLISH", "HINDI", "ENGLISH"],
};

const STATE_CODE_ALIASES: Record<string, IndianStateCode> = {
  ANDAMANANDNICOBARISLANDS: "IN-AN",
  ANDHRAPRADESH: "IN-AP",
  ARUNACHALPRADESH: "IN-AR",
  ASSAM: "IN-AS",
  BIHAR: "IN-BR",
  CG: "IN-CT",
  CHANDIGARH: "IN-CH",
  CHHATTISGARH: "IN-CT",
  CHATTISGARH: "IN-CT",
  DADRAANDNAGARHAVELIANDDAMANANDDIU: "IN-DN",
  DAMANANDDIU: "IN-DN",
  DELHI: "IN-DL",
  GOA: "IN-GA",
  GUJARAT: "IN-GJ",
  HARYANA: "IN-HR",
  HIMACHALPRADESH: "IN-HP",
  INCG: "IN-CT",
  INOD: "IN-OR",
  INTE: "IN-TG",
  INTS: "IN-TG",
  JAMMUANDKASHMIR: "IN-JK",
  JHARKHAND: "IN-JH",
  KARNATAKA: "IN-KA",
  KERALA: "IN-KL",
  LADAKH: "IN-LA",
  LAKSHADWEEP: "IN-LD",
  MADHYAPRADESH: "IN-MP",
  MAHARASHTRA: "IN-MH",
  MANIPUR: "IN-MN",
  MEGHALAYA: "IN-ML",
  MIZORAM: "IN-MZ",
  NAGALAND: "IN-NL",
  OD: "IN-OR",
  ODISHA: "IN-OR",
  ORISSA: "IN-OR",
  PONDICHERRY: "IN-PY",
  PUDUCHERRY: "IN-PY",
  PUNJAB: "IN-PB",
  RAJASTHAN: "IN-RJ",
  SIKKIM: "IN-SK",
  TAMILNADU: "IN-TN",
  TE: "IN-TG",
  TELANGANA: "IN-TG",
  TELUGU: "IN-TG",
  TRIPURA: "IN-TR",
  TS: "IN-TG",
  UK: "IN-UT",
  UTTARAKHAND: "IN-UT",
  UTTARPRADESH: "IN-UP",
  WESTBENGAL: "IN-WB",
};

const SUPPORTED_LANGUAGES = new Set<RegionalLanguage>(
  Object.keys(LANGUAGE_PROFILES) as RegionalLanguage[]
);

export function getLanguageStrategy(stateCode?: string | null): LanguageStrategy {
  const normalizedStateCode = normalizeIndianStateCode(stateCode);

  if (normalizedStateCode === "DEFAULT") {
    return cloneStrategy(DEFAULT_STRATEGY);
  }

  return buildStrategy(normalizedStateCode, STATE_LANGUAGE_RULES[normalizedStateCode]);
}

export function resolveLanguageStrategy(
  input?: LanguageStrategyInput | null
): LanguageStrategy {
  if (!input) {
    return getLanguageStrategy();
  }

  if (typeof input === "string") {
    return getLanguageStrategy(input);
  }

  const baseStrategy = getLanguageStrategy(input.stateCode);
  const primaryLanguage = normalizeLanguageName(
    input.primaryLanguage,
    baseStrategy.primaryLanguage
  );
  const profile = LANGUAGE_PROFILES[primaryLanguage];
  const fallbackLanguage = normalizeFallbackLanguage(
    input.fallbackLanguage,
    profile.fallbackLanguage
  );

  return {
    ...baseStrategy,
    confidenceThreshold:
      typeof input.confidenceThreshold === "number" &&
      Number.isFinite(input.confidenceThreshold)
        ? clampConfidence(input.confidenceThreshold)
        : profile.confidenceThreshold,
    fallbackLanguage,
    primaryLanguage,
    promptRenderRisk: input.promptRenderRisk ?? profile.promptRenderRisk,
    secondaryFallbackLanguage: "ENGLISH",
    supportedLanguages: normalizeSupportedLanguages(
      input.supportedLanguages,
      primaryLanguage,
      fallbackLanguage
    ),
    targetLocale: input.targetLocale || profile.targetLocale,
    textDirection: input.textDirection ?? profile.textDirection,
    useNativeScript: input.useNativeScript ?? profile.useNativeScript,
  };
}

export function normalizeIndianStateCode(
  stateCode?: string | null
): IndianStateCode | "DEFAULT" {
  if (!stateCode) {
    return "DEFAULT";
  }

  const compactCode = normalizeCodeToken(stateCode);

  if (!compactCode) {
    return "DEFAULT";
  }

  const aliasedCode = STATE_CODE_ALIASES[compactCode];

  if (aliasedCode) {
    return aliasedCode;
  }

  const candidateCode =
    compactCode.length === 2
      ? `IN-${compactCode}`
      : compactCode.startsWith("IN") && compactCode.length > 2
        ? `IN-${compactCode.slice(2)}`
        : compactCode;

  return isIndianStateCode(candidateCode) ? candidateCode : "DEFAULT";
}

export function buildLanguageGuardRail(strategy: LanguageStrategy) {
  const fallbackOrder = getLanguageFallbackOrder(strategy).join(" -> ");

  return [
    "LANGUAGE STRATEGY PROFILE:",
    `Target state profile: ${strategy.stateCode} (${strategy.regionName}).`,
    `Primary language: ${strategy.primaryLanguage}.`,
    `Fallback execution order: ${fallbackOrder}.`,
    `Minimum language confidence: ${strategy.confidenceThreshold.toFixed(2)}.`,
    `Prompt render risk: ${strategy.promptRenderRisk}. Native script requested: ${strategy.useNativeScript ? "yes" : "no"}.`,
    "GUARD RAILS:",
    `Generate in ${strategy.primaryLanguage} only if the copy is natural, grammatically clean, persuasive, and the estimated languageConfidence is at or above the threshold.`,
    `If confidence is below threshold, if script/token rendering is garbled, or if a regional language such as MARATHI or TELUGU cannot be rendered cleanly, output the same recovery template in ${strategy.fallbackLanguage}.`,
    "If the fallback language also becomes unclear, output clean ENGLISH. Never output broken native script, placeholders, transliteration fragments, or internal policy text.",
    "For HINGLISH, use Romanized Hindi-English with a friendly Indian ecommerce tone. For ENGLISH, use concise Indian ecommerce English.",
  ].join("\n");
}

export function getLanguageFallbackOrder(
  strategy: LanguageStrategy
): RegionalLanguage[] {
  return uniqueLanguages([
    strategy.primaryLanguage,
    strategy.fallbackLanguage,
    strategy.secondaryFallbackLanguage,
  ]);
}

export function shouldUseLanguageFallback({
  languageConfidence,
  outputLanguage,
  renderedMessage,
  strategy,
}: {
  languageConfidence?: number | null;
  outputLanguage?: RegionalLanguage | null;
  renderedMessage?: string | null;
  strategy: LanguageStrategy;
}) {
  const hasRegionalPrimary =
    strategy.primaryLanguage !== "HINGLISH" && strategy.primaryLanguage !== "ENGLISH";

  if (!renderedMessage?.trim()) {
    return true;
  }

  if (hasPromptRenderArtifacts(renderedMessage)) {
    return true;
  }

  if (languageConfidence === undefined || languageConfidence === null) {
    return hasRegionalPrimary;
  }

  const confidenceThreshold =
    outputLanguage && outputLanguage !== strategy.primaryLanguage
      ? LANGUAGE_PROFILES[outputLanguage].confidenceThreshold
      : strategy.confidenceThreshold;

  return languageConfidence < confidenceThreshold;
}

export function isLanguageAllowedForStrategy(
  language: RegionalLanguage,
  strategy: LanguageStrategy
) {
  return getLanguageFallbackOrder(strategy).includes(language);
}

export function normalizeLanguageName(
  language: unknown,
  fallback: RegionalLanguage = "HINGLISH"
): RegionalLanguage {
  if (typeof language !== "string") {
    return fallback;
  }

  const normalizedLanguage = language.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const compactLanguage = normalizedLanguage.replace(/_/g, "");

  if (compactLanguage === "HINDI_ENGLISH" || compactLanguage === "ROMANIZEDHINDI") {
    return "HINGLISH";
  }

  return SUPPORTED_LANGUAGES.has(compactLanguage as RegionalLanguage)
    ? (compactLanguage as RegionalLanguage)
    : fallback;
}

function buildStrategy(
  stateCode: IndianStateCode,
  rule: StateLanguageRule
): LanguageStrategy {
  const profile = LANGUAGE_PROFILES[rule.primaryLanguage];

  return {
    stateCode,
    regionName: rule.regionName,
    targetLocale: profile.targetLocale,
    primaryLanguage: rule.primaryLanguage,
    fallbackLanguage: profile.fallbackLanguage,
    secondaryFallbackLanguage: "ENGLISH",
    textDirection: profile.textDirection,
    confidenceThreshold: profile.confidenceThreshold,
    promptRenderRisk: profile.promptRenderRisk,
    useNativeScript: profile.useNativeScript,
    supportedLanguages: normalizeSupportedLanguages(
      rule.supportedLanguages,
      rule.primaryLanguage,
      profile.fallbackLanguage
    ),
  };
}

function languageProfile(
  targetLocale: string,
  fallbackLanguage: LanguageFallback,
  confidenceThreshold: number,
  promptRenderRisk: LanguageStrategy["promptRenderRisk"],
  useNativeScript = true
): LanguageProfile {
  return {
    confidenceThreshold,
    fallbackLanguage,
    promptRenderRisk,
    targetLocale,
    textDirection: "ltr",
    useNativeScript,
  };
}

function normalizeFallbackLanguage(
  language: unknown,
  fallback: LanguageFallback
): LanguageFallback {
  const normalizedLanguage = normalizeLanguageName(language, fallback);

  return normalizedLanguage === "HINGLISH" || normalizedLanguage === "ENGLISH"
    ? normalizedLanguage
    : fallback;
}

function normalizeSupportedLanguages(
  languages: readonly RegionalLanguage[] | undefined,
  primaryLanguage: RegionalLanguage,
  fallbackLanguage: LanguageFallback
) {
  return uniqueLanguages([
    primaryLanguage,
    ...(languages ?? []),
    fallbackLanguage,
    "ENGLISH",
  ]);
}

function uniqueLanguages(languages: readonly RegionalLanguage[]) {
  return languages.filter((language, index) => languages.indexOf(language) === index);
}

function normalizeCodeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isIndianStateCode(value: string): value is IndianStateCode {
  return Object.prototype.hasOwnProperty.call(STATE_LANGUAGE_RULES, value);
}

function clampConfidence(value: number) {
  return Math.min(0.99, Math.max(0.1, value));
}

function cloneStrategy(strategy: LanguageStrategy): LanguageStrategy {
  return {
    ...strategy,
    supportedLanguages: [...strategy.supportedLanguages],
  };
}

function hasPromptRenderArtifacts(message: string) {
  if (/\{\{|\}\}|\bundefined\b|\bnull\b|\bNaN\b/i.test(message)) {
    return true;
  }

  for (let index = 0; index < message.length; index += 1) {
    if (message.charCodeAt(index) === 0xfffd) {
      return true;
    }
  }

  return false;
}
