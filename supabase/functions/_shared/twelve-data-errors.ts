import { ProviderBudgetError } from "./provider-budget.ts"

/** Never forward provider messages, URLs, or credentials to callers. */
export function twelveDataRateLimit(payload: unknown, retryAfter: string | null = null): ProviderBudgetError | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const error = payload as Record<string, unknown>
  if (error.status !== "error" || error.code !== 429) return null
  const seconds = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
    ? Number(retryAfter) : retryAfter ? (Date.parse(retryAfter) - Date.now()) / 1000 : NaN
  return new ProviderBudgetError("provider_refresh_rate_limited",
    Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 60)
}

export function twelveDataHttpRateLimit(response: Response): ProviderBudgetError | null {
  return response.status === 429
    ? twelveDataRateLimit({ status: "error", code: 429 }, response.headers.get("Retry-After")) : null
}
