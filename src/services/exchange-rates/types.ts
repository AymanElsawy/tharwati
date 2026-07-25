import type { Decimal } from "../../lib/supabase/types"

export type CurrencyPair = {
  sourceCurrencyCode: string
  destinationCurrencyCode: string
}

export type ExchangeRateDirection = "direct" | "inverse"

type ResolvedExchangeRate = CurrencyPair & {
  rate: Decimal
  direction: ExchangeRateDirection
  effectiveAt: string
  source: string | null
}

export type CurrentExchangeRate = ResolvedExchangeRate & {
  usage: "current"
  resolvedAt: string
}

export type HistoricalExchangeRate = ResolvedExchangeRate & {
  usage: "historical"
  requestedAt: string
}

export type ProviderRate = {
  baseCurrencyCode: string
  quoteCurrencyCode: string
  rate: Decimal
  effectiveAt: string
}

export type ExchangeRateRefreshRequest = {
  pairs: CurrencyPair[]
}

export type ExchangeRateRefreshResult = {
  provider: string
  refreshedAt: string
  insertedOrUpdated: number
}

