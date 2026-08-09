import type { Decimal } from "../../lib/supabase/types"

export type SupportedMarketAssetType =
  | "stock"
  | "etf"
  | "commodity"
  | "cryptocurrency"

export type MarketAssetReference = {
  id: string
  assetTypeCode: SupportedMarketAssetType
  name: string
  symbol: string | null
  exchange: string | null
  currencyCode: string
}

export type ProviderMarketPrice = {
  assetId: string
  price: Decimal
  currencyCode: string
  asOf: string
}

export type CurrentMarketPrice = ProviderMarketPrice & {
  provider: string
  cachedAt: string
  fetchedAt: string
  priceType: "realtime" | "delayed" | "previous_close" | "stale" | "manual"
  stale: boolean
}

export type MarketPriceRefreshResult = {
  provider: string
  refreshedAt: string
  prices: CurrentMarketPrice[]
}
