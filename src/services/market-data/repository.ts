import type { TypedSupabaseClient } from "../../lib/supabase/client"
import type { Decimal, TableRow } from "../../lib/supabase/types"
import { MarketDataError } from "./errors"
import { requireAuthenticatedUserId } from "../../lib/supabase/repository"
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

export function isMarketPriceSupportedAssetType(
  assetTypeCode: string,
): boolean {
  return supportedTypes.has(assetTypeCode)
}

const futureMarketPriceMessage =
  "Market price date cannot be in the future."

function storageError(
  error: { code?: string; message: string },
  assetId?: string,
): MarketDataError {
  if (
    error.code === "23514" &&
    error.message.includes(futureMarketPriceMessage)
  ) {
    return new MarketDataError({
      code: "future_market_price",
      message: futureMarketPriceMessage,
      assetId,
      cause: error,
    })
  }

  return new MarketDataError({
    code: "storage_error",
    message: error.message,
    assetId,
    cause: error,
  })
}

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
      .rpc("get_current_market_price", {
        p_asset_id: assetId,
      })
      .maybeSingle()
    if (error) {
      throw storageError(error, assetId)
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
        user_id: null,
        asset_id: price.assetId,
        provider,
        price: price.price,
        currency_code: price.currencyCode,
        as_of: price.asOf,
      })),
      { onConflict: "user_id,asset_id,provider,as_of" },
    )
    if (error) {
      throw storageError(error)
    }
  }

  async listManualPrices(): Promise<TableRow<"market_prices">[]> {
    const userId = await requireAuthenticatedUserId(
      this.client,
      "marketData.listManualPrices",
    )
    const { data, error } = await this.client
      .from("market_prices")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "manual")
      .order("as_of", { ascending: false })
      .order("id", { ascending: false })
    if (error) {
      throw new MarketDataError({
        code: "storage_error",
        message: error.message,
        cause: error,
      })
    }
    return data ?? []
  }

  async createManualPrice(input: ProviderMarketPrice) {
    const userId = await requireAuthenticatedUserId(
      this.client,
      "marketData.createManualPrice",
    )
    const { data, error } = await this.client
      .from("market_prices")
      .insert({
        user_id: userId,
        asset_id: input.assetId,
        provider: "manual",
        price: input.price,
        currency_code: input.currencyCode,
        as_of: input.asOf,
      })
      .select("*")
      .single()
    if (error || !data) {
      if (error) {
        throw storageError(error, input.assetId)
      }
      throw new MarketDataError({
        code: "storage_error",
        message: "Manual price was not returned",
        assetId: input.assetId,
      })
    }
    return data
  }

  async updateManualPrice(
    id: string,
    input: ProviderMarketPrice,
  ) {
    const userId = await requireAuthenticatedUserId(
      this.client,
      "marketData.updateManualPrice",
    )
    const { data, error } = await this.client
      .from("market_prices")
      .update({
        asset_id: input.assetId,
        price: input.price,
        currency_code: input.currencyCode,
        as_of: input.asOf,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("provider", "manual")
      .select("*")
      .single()
    if (error || !data) {
      if (error) {
        throw storageError(error, input.assetId)
      }
      throw new MarketDataError({
        code: "storage_error",
        message: "Manual price was not returned",
        assetId: input.assetId,
      })
    }
    return data
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
