/**
 * fetch wrapper with exponential-backoff retries for transient network failures.
 *
 * Retries only on network errors (TypeError from fetch) and 5xx/429 responses —
 * 4xx client errors are returned immediately since retrying cannot fix them.
 */

export type FetchRetryOptions = {
  retries?: number;
  /** Base delay in ms; doubles per attempt (500 → 1000 → 2000). */
  backoffMs?: number;
  /** Called before each retry — lets the UI show "Retrying…". */
  onRetry?: (attempt: number, error: unknown) => void;
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchRetryOptions = {}
): Promise<Response> {
  const { retries = 2, backoffMs = 500, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, init);

      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      // Browser reports network drops as TypeError; aborts/timeouts should not
      // retry (their signal is already consumed, retrying would fail instantly).
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw error;
      }
      lastError = error;
      if (attempt === retries) throw error;
    }

    onRetry?.(attempt + 1, lastError);
    await sleep(backoffMs * 2 ** attempt);
  }

  // Unreachable, but satisfies the type checker.
  throw lastError instanceof Error ? lastError : new Error("fetchWithRetry exhausted retries");
}

/** JSON helper: parses safely and never throws on malformed bodies. */
export async function safeJson<T = unknown>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
