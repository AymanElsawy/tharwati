import type { CurrencyPair } from "./types"

export type ExchangeRateErrorCode =
  | "invalid_currency_pair"
  | "invalid_rate"
  | "rate_unavailable"
  | "duplicate_rate"
  | "provider_error"
  | "storage_error"

export class ExchangeRateError extends Error {
  readonly code: ExchangeRateErrorCode
  readonly pair?: CurrencyPair

  constructor(options: {
    code: ExchangeRateErrorCode
    message: string
    pair?: CurrencyPair
    cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = "ExchangeRateError"
    this.code = options.code
    this.pair = options.pair
  }
}
