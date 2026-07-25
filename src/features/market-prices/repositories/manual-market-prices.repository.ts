import { assetsRepository } from "@/features/assets/repositories/assets.repository"
import type { ManualMarketPriceInput } from "@/features/market-prices/types/manual-market-price"
import type { AssetSummary } from "@/lib/supabase/types"
import { RepositoryError } from "@/lib/supabase/types"
import { marketDataService } from "@/services/market-data"
import { MarketDataError } from "@/services/market-data/errors"

const supportedTypes = new Set([
  "stock",
  "etf",
  "commodity",
  "cryptocurrency",
])

export class ManualMarketPricesRepository {
  async getConfiguration() {
    const [prices, assets] = await Promise.all([
      marketDataService.listManualPrices(),
      assetsRepository.getAssets(),
    ])
    return {
      prices,
      assets: assets.filter(
        (asset): asset is AssetSummary =>
          asset.is_active && supportedTypes.has(asset.asset_type_code),
      ),
    }
  }

  async create(input: ManualMarketPriceInput) {
    try {
      return await marketDataService.createManualPrice({
        assetId: input.assetId,
        price: input.price,
        currencyCode: input.currencyCode,
        asOf: input.asOf,
      })
    } catch (error) {
      throw mapManualPriceError(error, "marketPrices.create")
    }
  }

  async update(id: string, input: ManualMarketPriceInput) {
    try {
      return await marketDataService.updateManualPrice(id, {
        assetId: input.assetId,
        price: input.price,
        currencyCode: input.currencyCode,
        asOf: input.asOf,
      })
    } catch (error) {
      throw mapManualPriceError(error, "marketPrices.update")
    }
  }
}

export function mapManualPriceError(
  error: unknown,
  operation: string,
): Error {
  if (
    error instanceof MarketDataError &&
    error.code === "future_market_price"
  ) {
    return new RepositoryError({
      code: "constraint_violation",
      message: "Market price date cannot be in the future.",
      operation,
      cause: error,
    })
  }

  return error instanceof Error
    ? error
    : new RepositoryError({
        code: "database_error",
        message: "Market price could not be saved.",
        operation,
        cause: error,
      })
}

export const manualMarketPricesRepository =
  new ManualMarketPricesRepository()
