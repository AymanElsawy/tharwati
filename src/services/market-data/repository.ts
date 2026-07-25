import type { TypedSupabaseClient } from "../../lib/supabase/client"
import type { Decimal, TableRow } from "../../lib/supabase/types"
import { MarketDataError } from "./errors"
import type {
  CurrentMarketPrice,
  MarketAssetReference,
  ProviderMarketPrice,
  SupportedMarketAssetType,
} from "./types"

const supportedTypes = new Set<string>([
  "stock",
  "etf",
  "commodity",
  "cryptocurrency",
])

export class MarketDataRepository {
  private readonly client: TypedSupabaseClient

  constructor(client: TypedSupabaseClient) {
    this.client = client
  }

  async getAsset(assetId: string): Promise<MarketAssetReference> {
    const { data, error } = await this.client
      .from("assets")
      .select(
        "id,asset_type_code,name,symbol,exchange,currency_code",
      )
      .eq("id", assetId)
      .single()
    if (error || !data) {
      throw new MarketDataError({
        code: "storage_error",
        message: error?.message ?? `Asset ${assetId} was not found`,
        assetId,
        cause: error,
      })
    }
    if (!supportedTypes.has(data.asset_type_code)) {
      throw new MarketDataError({
        code: "unsupported_asset_type",
        message: `Market prices are not supported for ${data.asset_type_code}`,
        assetId,
      })
    }
    return {
      id: data.id,
      assetTypeCode:
        data.asset_type_code as SupportedMarketAssetType,
      name: data.name,
      symbol: data.symbol,
      exchange: data.exchange,
      currencyCode: data.currency_code,
    }
  }

  async getSupportedAssets(): Promise<MarketAssetReference[]> {
    const { data, error } = await this.client
      .from("assets")
      .select(
        "id,asset_type_code,name,symbol,exchange,currency_code",
      )
      .in("asset_type_code", [...supportedTypes])
      .eq("is_active", true)
    if (error) {
      throw new MarketDataError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
    return (data ?? []).map((asset) => ({
      id: asset.id,
      assetTypeCode:
        asset.asset_type_code as SupportedMarketAssetType,
      name: asset.name,
      symbol: asset.symbol,
      exchange: asset.exchange,
      currencyCode: asset.currency_code,
    }))
  }

  async getLatestCachedPrice(
    assetId: string,
  ): Promise<CurrentMarketPrice | null> {
    const { data, error } = await this.client
      .from("market_prices")
      .select("*")
      .eq("asset_id", assetId)
      .gt("price", "0")
      .order("as_of", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      throw new MarketDataError({
        code: "storage_error",
        message: error.message,
        assetId,
        cause: error,
      })
    }
    return data ? normalizeStoredPrice(data) : null
  }

  async upsertPrices(
    prices: readonly ProviderMarketPrice[],
    provider: string,
  ): Promise<void> {
    if (prices.length === 0) return
    const { error } = await this.client.from("market_prices").upsert(
      prices.map((price) => ({
        asset_id: price.assetId,
        provider,
        price: price.price,
        currency_code: price.currencyCode,
        as_of: price.asOf,
      })),
      { onConflict: "asset_id,provider,as_of" },
    )
    if (error) {
      throw new MarketDataError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
  }
}

function normalizeStoredPrice(
  price: TableRow<"market_prices">,
): CurrentMarketPrice {
  return {
    assetId: price.asset_id,
    provider: price.provider,
    price: String(price.price) as Decimal,
    currencyCode: price.currency_code,
    asOf: price.as_of,
    cachedAt: price.created_at,
  }
}

