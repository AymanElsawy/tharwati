import type { Decimal } from "@/lib/supabase/types"

export type DiversificationDimensionId =
  | "asset_class"
  | "sector"
  | "geography"
  | "currency"
  | "account"

export interface PortfolioContributor {
  id: string
  name: string
  detail: string | null
  value: Decimal
  percentage: Decimal
}

export interface PortfolioExposure {
  id: string
  label: string
  value: Decimal
  percentage: Decimal
  offsetPercentage: Decimal
  color: string
  contributorIds: string[]
  contributors: PortfolioContributor[]
}

export interface PortfolioDiversificationDimension {
  id: DiversificationDimensionId
  status: "available" | "unavailable" | "partial"
  exposures: PortfolioExposure[]
  dominantExposureId: string | null
  missingClassificationCount: number
}

export type PortfolioRiskId =
  | "largest_holding"
  | "top_five"
  | "dominant_sector"
  | "dominant_currency"
  | "unpriced_exposure"
  | "illiquid_exposure"

export interface PortfolioRisk {
  id: PortfolioRiskId
  severity: "info" | "warning" | "high" | "unavailable"
  percentage: Decimal | null
  threshold: Decimal | null
  contributorIds: string[]
  available: boolean
  provisional: boolean
}

export interface PortfolioAnalysisHolding {
  id: string
  assetClass: string
  accountId: string
  currencyCode: string
  marketValueBase: Decimal | null
  name: string
  symbol: string | null
  missingMarketPrice: boolean
}

export interface PortfolioAnalysis {
  allocation: PortfolioExposure[]
  diversification: PortfolioDiversificationDimension[]
  risks: PortfolioRisk[]
  holdings: PortfolioAnalysisHolding[]
  isPartial: boolean
}

export interface PortfolioAnalyticalSelection {
  assetClassId: string | null
  dimension: DiversificationDimensionId
  exposureId: string | null
  riskId: PortfolioRiskId | null
}
