export const DEFAULT_ENDPOINTAI_MODEL = "deepseek-r1-7b";
export const ENDPOINTAI_DEFAULT_BASE_URL = "https://api.endpointai.in/v1";

/** True when a custom base URL points at EndpointAI (not platform.openai.com). */
export function isEndpointAIBaseUrl(url?: string | null): boolean {
  const normalized = url?.trim();
  if (!normalized) return false;
  return /endpointai\.in/i.test(normalized);
}

/**
 * Resolve EndpointAI bearer token.
 * Supports ENDPOINTAI_API_KEY, or OPENAI_API_KEY when OPENAI_BASE_URL targets EndpointAI.
 */
export function getEndpointAIApiKey(): string {
  const directKey = process.env.ENDPOINTAI_API_KEY?.trim();
  if (directKey) return directKey;

  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  if (openAIKey && isEndpointAIBaseUrl(process.env.OPENAI_BASE_URL)) {
    return openAIKey;
  }

  return "";
}

export function getEndpointAIBaseUrl(): string {
  const fromEnv =
    process.env.ENDPOINTAI_BASE_URL?.trim() ||
    (isEndpointAIBaseUrl(process.env.OPENAI_BASE_URL)
      ? process.env.OPENAI_BASE_URL!.trim()
      : "");

  return (fromEnv || ENDPOINTAI_DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function getEndpointAIChatCompletionsUrl(): string {
  const explicitUrl =
    process.env.ENDPOINTAI_CHAT_COMPLETIONS_URL?.trim() ||
    process.env.OPENAI_CHAT_COMPLETIONS_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  return `${getEndpointAIBaseUrl()}/chat/completions`;
}

export function getEndpointAIModel(): string {
  return (
    process.env.ENDPOINTAI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_ENDPOINTAI_MODEL
  );
}

export function isOpenAIConfiguredForEndpointAI(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() && isEndpointAIBaseUrl(process.env.OPENAI_BASE_URL)
  );
}
