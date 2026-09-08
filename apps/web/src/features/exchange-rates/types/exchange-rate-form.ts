import type { StoredExchangeRate } from "@/services/exchange-rates/repository"

export interface ExchangeRateFormValues {
  fromCurrencyCode: string
  toCurrencyCode: string
  rate: string
  effectiveAt: string
}

export function rateToFormValues(rate: StoredExchangeRate): ExchangeRateFormValues {
  return {
    fromCurrencyCode: rate.base_currency_code,
    toCurrencyCode: rate.quote_currency_code,
    rate: rate.rate,
    effectiveAt: rate.effective_at.slice(0, 16),
  }
}
