import type { Translate } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/en/translations"

export type AppErrorCode =
  | "validation" | "business_rule" | "unauthorized" | "forbidden"
  | "offline" | "timeout" | "service_unavailable"
  | "market_price_unavailable" | "fx_unavailable" | "fx_stale" | "unknown"

export type AppMutationOutcome = "rejected" | "committed_refresh_failed" | "uncertain"

export type ClassifiedAppError = { code: AppErrorCode; cause: unknown }

const messageKeys: Record<AppErrorCode, TranslationKey> = {
  validation: "errors.validation",
  business_rule: "errors.businessRule",
  unauthorized: "errors.unauthorized",
  forbidden: "errors.forbidden",
  offline: "errors.offline",
  timeout: "errors.timeout",
  service_unavailable: "errors.serviceUnavailable",
  market_price_unavailable: "errors.marketPriceUnavailable",
  fx_unavailable: "errors.fxUnavailable",
  fx_stale: "errors.fxStale",
  unknown: "errors.unknown",
}

const knownBusinessMessages: Record<string, TranslationKey> = {
  "This account already contains financial history. Its currency cannot be changed.": "errors.accountCurrencyLocked",
  "This account already contains financial history. Its opening balance cannot be changed.": "errors.accountOpeningBalanceLocked",
  "You already have this type of Gold/Silver account in this currency. Go to that account and add a purchase instead of creating a new one.": "errors.duplicateMetalAccount",
  "An active account with this name and type already exists.": "errors.duplicateAccount",
  "Market price date cannot be in the future.": "errors.futureMarketPrice",
}

type ErrorShape = { code?: unknown; status?: unknown; name?: unknown; message?: unknown; cause?: unknown }
const errorCodes = new Set<AppErrorCode>(Object.keys(messageKeys) as AppErrorCode[])

/** Classify by stable codes and transport state; never interpret backend message text. */
export function classifyAppError(error: unknown): ClassifiedAppError {
  const value = error && typeof error === "object" ? error as ErrorShape : {}
  const code = typeof value.code === "string" ? value.code : ""
  const status = typeof value.status === "number" ? value.status : null
  const name = typeof value.name === "string" ? value.name : ""
  if (name === "TimeoutError" || code === "ETIMEDOUT") return { code: "timeout", cause: error }
  if (value.cause && value.cause !== error && (code === "" || code === "database_error" || code === "storage_error" || code === "service_unavailable")) {
    const nested = classifyAppError(value.cause)
    if (nested.code === "timeout" || nested.code === "offline" || nested.code === "unauthorized" || nested.code === "forbidden")
      return { code: nested.code, cause: error }
  }
  if (errorCodes.has(code as AppErrorCode)) return { code: code as AppErrorCode, cause: error }
  if (code === "insufficient_brokerage_available_cash") return { code: "business_rule", cause: error }
  if (code === "authentication_required" || code === "unauthenticated" || code === "PGRST301" || status === 401 || name === "AuthSessionMissingError")
    return { code: "unauthorized", cause: error }
  if (code === "42501" || status === 403) return { code: "forbidden", cause: error }
  if (code === "23505" || code === "23514" || code === "23503" || code === "conflict" || code === "constraint_violation" || code === "duplicate_rate")
    return { code: "business_rule", cause: error }
  if (code === "22P02" || code === "23502" || code === "PGRST100" || code === "invalid_rate" || code === "invalid_currency_pair" || code === "future_market_price" || code === "invalid_market_price") return { code: "validation", cause: error }
  if (code === "rate_unavailable") return { code: "fx_unavailable", cause: error }
  if (code === "market_price_unavailable") return { code: "market_price_unavailable", cause: error }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { code: "offline", cause: error }
  if (code === "provider_unavailable" || code === "provider_error" || code === "storage_error" || code === "database_error" || (status !== null && status >= 500))
    return { code: "service_unavailable", cause: error }
  return { code: "unknown", cause: error }
}

export function safeErrorMessage(error: unknown, t: Translate): string {
  const value = error && typeof error === "object" ? error as ErrorShape : {}
  if (value.code === "insufficient_brokerage_available_cash") return t("errors.insufficientBrokerageAvailableCash")
  const known = typeof value.message === "string" ? knownBusinessMessages[value.message] : undefined
  return t(known ?? messageKeys[classifyAppError(error).code])
}
