import type {
  ExchangeRateRefreshRequest,
  ProviderRate,
} from "./types"

export interface ExchangeRateProvider {
  readonly name: string
  fetchRates(
    request: ExchangeRateRefreshRequest,
  ): Promise<ProviderRate[]>
}

/**
 * Trusted manual imports use the same provider boundary as a future HTTP
 * provider or scheduled job. The refresh service still validates every row.
 */
export class ManualExchangeRateProvider implements ExchangeRateProvider {
  readonly name: string
  private readonly rates: readonly ProviderRate[]

  constructor(
    rates: readonly ProviderRate[],
    name = "manual",
  ) {
    this.rates = rates
    this.name = name
  }

  async fetchRates(): Promise<ProviderRate[]> {
    return [...this.rates]
  }
}

