import {
  supabase,
  type TypedSupabaseClient,
} from "../../lib/supabase/client"
import { MarketDataError } from "./errors"
import type { MarketDataProvider } from "./provider"
import { MarketDataRepository } from "./repository"
import type {
  CurrentMarketPrice,
  MarketAssetReference,
  MarketPriceRefreshResult,
  ProviderMarketPrice,
} from "./types"

const positivePricePattern = /^(?:0*[1-9]\d*|0*\d*\.\d*[1-9]\d*)$/

function validateProviderPrice(
  price: ProviderMarketPrice,
  asset: MarketAssetReference,
): ProviderMarketPrice {
  const currencyCode = price.currencyCode.trim().toUpperCase()
  if (
    price.assetId !== asset.id ||
    !positivePricePattern.test(price.price.trim()) ||
    !/^[A-Z]{3}$/.test(currencyCode) ||
    Number.isNaN(Date.parse(price.asOf))
  ) {
    throw new MarketDataError({
      code: "invalid_market_price",
      message: `Provider returned an invalid price for asset ${asset.id}`,
      assetId: asset.id,
    })
  }
  return {
    assetId: asset.id,
    price: price.price.trim(),
    currencyCode,
    asOf: new Date(price.asOf).toISOString(),
  }
}

type MarketDataServiceOptions = {
  readClient?: TypedSupabaseClient
  writeClient?: TypedSupabaseClient
  provider?: MarketDataProvider
}

export class MarketDataService {
  private readonly readRepository: MarketDataRepository
  private readonly writeRepository: MarketDataRepository | null
  private readonly provider: MarketDataProvider | null

  constructor(options: MarketDataServiceOptions = {}) {
    this.readRepository = new MarketDataRepository(
      options.readClient ?? supabase,
    )
    this.writeRepository = options.writeClient
      ? new MarketDataRepository(options.writeClient)
      : null
    this.provider = options.provider ?? null
  }

  async getLatestCachedPrice(
    assetId: string,
  ): Promise<CurrentMarketPrice | null> {
    return this.readRepository.getLatestCachedPrice(assetId)
  }

  async getCurrentPrice(assetId: string): Promise<CurrentMarketPrice> {
    const cached = await this.getLatestCachedPrice(assetId)
    if (cached) return cached
    if (this.provider && this.writeRepository) {
      return this.refreshAsset(assetId)
    }
    throw new MarketDataError({
      code: "market_price_unavailable",
      message: `No current market price is available for asset ${assetId}`,
      assetId,
    })
  }

  async getCurrentPrices(
    assetIds: readonly string[],
  ): Promise<CurrentMarketPrice[]> {
    return Promise.all(
      [...new Set(assetIds)].map((assetId) =>
        this.getCurrentPrice(assetId),
      ),
    )
  }

  async refreshAsset(assetId: string): Promise<CurrentMarketPrice> {
    const asset = await this.readRepository.getAsset(assetId)
    const prices = await this.refreshAssets([asset])
    const price = prices[0]
    if (!price) {
      throw new MarketDataError({
        code: "market_price_unavailable",
        message: `Provider returned no price for asset ${assetId}`,
        assetId,
      })
    }
    return price
  }

  async refreshAll(): Promise<MarketPriceRefreshResult> {
    const assets = await this.readRepository.getSupportedAssets()
    const prices = await this.refreshAssets(assets)
    return {
      provider: this.requireProvider().name,
      refreshedAt: new Date().toISOString(),
      prices,
    }
  }

  private requireProvider(): MarketDataProvider {
    if (!this.provider || !this.writeRepository) {
      throw new MarketDataError({
        code: "provider_unavailable",
        message:
          "Market-data refresh requires a provider and trusted write client",
      })
    }
    return this.provider
  }

  private async refreshAssets(
    assets: readonly MarketAssetReference[],
  ): Promise<CurrentMarketPrice[]> {
    const provider = this.requireProvider()
    let providerPrices: ProviderMarketPrice[]
    try {
      providerPrices = await provider.fetchCurrentPrices(assets)
    } catch (cause) {
      throw new MarketDataError({
        code: "provider_error",
        message: `Provider ${provider.name} refresh failed`,
        cause,
      })
    }
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
    const prices = providerPrices.map((price) => {
      const asset = assetsById.get(price.assetId)
      if (!asset) {
        throw new MarketDataError({
          code: "invalid_market_price",
          message: `Provider returned an unexpected asset ${price.assetId}`,
          assetId: price.assetId,
        })
      }
      return validateProviderPrice(price, asset)
    })
    await this.writeRepository?.upsertPrices(prices, provider.name)
    return prices.map((price) => ({
      ...price,
      provider: provider.name,
      cachedAt: new Date().toISOString(),
    }))
  }
}

export const marketDataService = new MarketDataService()

