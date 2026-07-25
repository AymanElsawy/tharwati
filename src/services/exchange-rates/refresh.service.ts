import type { TypedSupabaseClient } from "../../lib/supabase/client"
import { requirePositiveRate } from "./decimal"
import { ExchangeRateError } from "./errors"
import type { ExchangeRateProvider } from "./provider"
import { ExchangeRateRepository } from "./repository"
import type {
  ExchangeRateRefreshRequest,
  ExchangeRateRefreshResult,
  ProviderRate,
} from "./types"

function validateProviderRate(rate: ProviderRate): ProviderRate {
  const baseCurrencyCode = rate.baseCurrencyCode.trim().toUpperCase()
  const quoteCurrencyCode = rate.quoteCurrencyCode.trim().toUpperCase()
  if (
    !/^[A-Z]{3}$/.test(baseCurrencyCode) ||
    !/^[A-Z]{3}$/.test(quoteCurrencyCode) ||
    baseCurrencyCode === quoteCurrencyCode ||
    Number.isNaN(Date.parse(rate.effectiveAt))
  ) {
    throw new ExchangeRateError({
      code: "provider_error",
      message: "Provider returned an invalid exchange-rate record",
    })
  }
  return {
    baseCurrencyCode,
    quoteCurrencyCode,
    rate: requirePositiveRate(rate.rate),
    effectiveAt: new Date(rate.effectiveAt).toISOString(),
  }
}

/**
 * Instantiate only in a trusted server or scheduled-job environment with a
 * client authorized to write exchange_rates. Never provide a service-role
 * credential to the browser.
 */
export class ExchangeRateRefreshService {
  private readonly repository: ExchangeRateRepository
  private readonly provider: ExchangeRateProvider

  constructor(
    client: TypedSupabaseClient,
    provider: ExchangeRateProvider,
  ) {
    this.repository = new ExchangeRateRepository(client)
    this.provider = provider
  }

  async refresh(
    request: ExchangeRateRefreshRequest,
  ): Promise<ExchangeRateRefreshResult> {
    let providerRates: ProviderRate[]
    try {
      providerRates = await this.provider.fetchRates(request)
    } catch (cause) {
      if (cause instanceof ExchangeRateError) throw cause
      throw new ExchangeRateError({
        code: "provider_error",
        message: `Provider ${this.provider.name} refresh failed`,
        cause,
      })
    }
    const rates = providerRates.map(validateProviderRate)
    const insertedOrUpdated =
      await this.repository.upsertProviderRates(
        rates,
        this.provider.name,
      )
    return {
      provider: this.provider.name,
      refreshedAt: new Date().toISOString(),
      insertedOrUpdated,
    }
  }
}
