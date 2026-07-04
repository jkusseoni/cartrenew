export const DEFAULT_ENDPOINTAI_MODEL = "deepseek-r1-7b";
export const DEFAULT_AICREDITS_MODEL = "deepseek/deepseek-r1";
export const ENDPOINTAI_DEFAULT_BASE_URL = "https://api.endpointai.in/v1";
export const AICREDITS_DEFAULT_BASE_URL = "https://api.aicredits.in/v1";

function isOfficialOpenAIBaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "api.openai.com" || host.endsWith(".openai.com");
  } catch {
    return /api\.openai\.com/i.test(url);
  }
}

function isAICreditsBaseUrl(url: string): boolean {
  return /aicredits\.in/i.test(url);
}

function normalizeProxyBaseUrl(url: string): string {
  let normalized = url.replace(/\/$/, "");

  // Common misconfiguration: https://aicredits.in/v1 → https://api.aicredits.in/v1
  if (/^https?:\/\/(?:www\.)?aicredits\.in/i.test(normalized)) {
    normalized = normalized.replace(
      /^https?:\/\/(?:www\.)?aicredits\.in/i,
      "https://api.aicredits.in"
    );
  }

  return normalized;
}

function normalizeProxyModel(model: string, baseUrl: string): string {
  const trimmed = model.trim();
  if (!trimmed) return DEFAULT_ENDPOINTAI_MODEL;

  // Already in provider/model format.
  if (trimmed.includes("/")) {
    return trimmed;
  }

  if (isAICreditsBaseUrl(baseUrl)) {
    const aicreditsModelMap: Record<string, string> = {
      "deepseek-r1-7b": DEFAULT_AICREDITS_MODEL,
      "deepseek-r1": DEFAULT_AICREDITS_MODEL,
      "deepseek-reasoner": DEFAULT_AICREDITS_MODEL,
      "deepseek-chat": "deepseek/deepseek-chat",
    };

    return aicreditsModelMap[trimmed] || `deepseek/${trimmed}`;
  }

  return trimmed;
}

/** Custom OpenAI-compatible proxy base URL (EndpointAI, AI Credits, etc.). */
export function getOpenAICompatibleProxyBaseUrl(): string | null {
  const candidates = [
    process.env.OPENAI_BASE_URL?.trim(),
    process.env.ENDPOINTAI_BASE_URL?.trim(),
    process.env.AI_PROXY_BASE_URL?.trim(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (!isOfficialOpenAIBaseUrl(candidate)) {
      return normalizeProxyBaseUrl(candidate);
    }
  }

  return null;
}

/** @deprecated Use getOpenAICompatibleProxyBaseUrl — kept for existing imports. */
export function isEndpointAIBaseUrl(url?: string | null): boolean {
  const normalized = url?.trim();
  if (!normalized) return false;
  return !isOfficialOpenAIBaseUrl(normalized);
}

/**
 * Resolve bearer token for the configured OpenAI-compatible proxy.
 * Supports ENDPOINTAI_API_KEY, or OPENAI_API_KEY when a custom proxy base URL is set.
 */
export function getEndpointAIApiKey(): string {
  const directKey = process.env.ENDPOINTAI_API_KEY?.trim();
  if (directKey) return directKey;

  const proxyBaseUrl = getOpenAICompatibleProxyBaseUrl();
  const openAIKey = process.env.OPENAI_API_KEY?.trim();

  if (openAIKey && proxyBaseUrl) {
    return openAIKey;
  }

  return "";
}

export function getEndpointAIBaseUrl(): string {
  return getOpenAICompatibleProxyBaseUrl() || ENDPOINTAI_DEFAULT_BASE_URL;
}

export function getEndpointAIChatCompletionsUrl(): string {
  const explicitUrl =
    process.env.ENDPOINTAI_CHAT_COMPLETIONS_URL?.trim() ||
    process.env.OPENAI_CHAT_COMPLETIONS_URL?.trim();

  if (explicitUrl) {
    return normalizeProxyBaseUrl(explicitUrl.replace(/\/chat\/completions\/?$/, "")) + "/chat/completions";
  }

  return `${getEndpointAIBaseUrl()}/chat/completions`;
}

export function getEndpointAIModel(): string {
  const baseUrl = getEndpointAIBaseUrl();
  const rawModel =
    process.env.ENDPOINTAI_MODEL?.trim() ||
    process.env.OPENAI_MODEL_NAME?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    (isAICreditsBaseUrl(baseUrl) ? DEFAULT_AICREDITS_MODEL : DEFAULT_ENDPOINTAI_MODEL);

  return normalizeProxyModel(rawModel, baseUrl);
}

/** True when OPENAI_API_KEY is paired with a non-OpenAI proxy base URL. */
export function isOpenAIConfiguredForEndpointAI(): boolean {
  return Boolean(getOpenAICompatibleProxyBaseUrl() && process.env.OPENAI_API_KEY?.trim());
}

export function isOpenAIConfiguredForProxy(): boolean {
  return isOpenAIConfiguredForEndpointAI();
}
