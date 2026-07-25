import type {
  MarketAssetReference,
  ProviderMarketPrice,
} from "./types"

export interface MarketDataProvider {
  readonly name: string
  fetchCurrentPrices(
    assets: readonly MarketAssetReference[],
  ): Promise<ProviderMarketPrice[]>
}

export class ManualMarketDataProvider implements MarketDataProvider {
  readonly name: string
  private readonly prices: readonly ProviderMarketPrice[]

  constructor(
    prices: readonly ProviderMarketPrice[],
    name = "manual",
  ) {
    this.prices = prices
    this.name = name
  }

  async fetchCurrentPrices(
    assets: readonly MarketAssetReference[],
  ): Promise<ProviderMarketPrice[]> {
    const assetIds = new Set(assets.map((asset) => asset.id))
    return this.prices.filter((price) => assetIds.has(price.assetId))
  }
}

