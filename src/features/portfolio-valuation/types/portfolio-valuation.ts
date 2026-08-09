import type { HoldingDetails } from "@/features/holdings/types/holding"
import type { Decimal } from "@/lib/supabase/types"

export interface MissingExchangeRatePair {
  sourceCurrencyCode: string
  destinationCurrencyCode: string
}

export interface FxRateMetadata extends MissingExchangeRatePair {
  provider: string | null
  effectiveAt: string
  fetchedAt: string | null
  stale: boolean
}

export interface PortfolioValuationSource {
  baseCurrency: string
  holdings: HoldingDetails[]
}

export interface HoldingValuationResult {
  holdingId: string
  assetId: string
  symbol: string | null
  assetName: string
  assetType: string
  quantity: Decimal
  averageCost: Decimal | null
  costBasisNative: Decimal
  costBasisCurrency: string
  marketPrice: Decimal | null
  marketPriceCurrency: string | null
  marketPriceTimestamp: string | null
  marketPriceSource: string | null
  marketPriceType?: "realtime" | "delayed" | "previous_close" | "stale" | "manual" | null
  marketPriceFetchedAt?: string | null
  marketValueNative: Decimal | null
  unrealizedGainLossNative: Decimal | null
  unrealizedReturnPercent: Decimal | null
  marketValueBase: Decimal | null
  costBasisBase: Decimal | null
  unrealizedGainLossBase: Decimal | null
  baseCurrency: string
  missingMarketPrice: boolean
  missingExchangeRate: MissingExchangeRatePair[]
  fxRates?: FxRateMetadata[]
  stalePrice: boolean | null
}

export type PortfolioCompletenessStatus =
  | "complete"
  | "partial"
  | "unavailable"

export interface PortfolioValuationResult {
  baseCurrency: string
  holdings: HoldingValuationResult[]
  totalMarketValueBase: Decimal | null
  totalCostBasisBase: Decimal | null
  totalUnrealizedGainLossBase: Decimal | null
  totalUnrealizedReturnPercent: Decimal | null
  valuedHoldingsCount: number
  missingPriceHoldings: Array<{
    holdingId: string
    assetId: string
    assetName: string
    symbol: string | null
  }>
  missingExchangeRatePairs: MissingExchangeRatePair[]
  fxRates?: FxRateMetadata[]
  completenessStatus: PortfolioCompletenessStatus
}

export interface PortfolioValuationRepositoryContract {
  getSource(): Promise<PortfolioValuationSource>
}
