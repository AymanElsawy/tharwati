import type { WealthInsight } from "@/features/insights/types/wealth-insight"
import type { PortfolioCompletenessStatus } from "@/features/portfolio-valuation/types/portfolio-valuation"
import type { Decimal } from "@/lib/supabase/types"
import type { PortfolioAnalysis } from "@/features/portfolio/types/portfolio-analysis"
import type { PortfolioEvidence } from "@/features/portfolio/types/portfolio-evidence"

export type PortfolioHealthStatus =
  "strong" | "healthy" | "needs_attention" | "at_risk" | "unavailable"

export type PortfolioHealthFactorId =
  | "diversification"
  | "concentration"
  | "allocation"
  | "cash"
  | "currency"
  | "missing_data"

export interface PortfolioHealthFactor {
  id: PortfolioHealthFactorId
  score: number
  status: "good" | "info" | "warning"
}

export interface PortfolioScopeOption {
  id: string
  name: string
}

export interface PortfolioExecutiveViewModel {
  baseCurrency: string
  scopeOptions: PortfolioScopeOption[]
  activeScopeId: string | null
  updatedAt: string
  completenessStatus: PortfolioCompletenessStatus
  isEmpty: boolean
  value: {
    marketValue: Decimal | null
    costBasis: Decimal | null
    unrealizedGainLoss: Decimal | null
    unrealizedReturnPercent: Decimal | null
    performanceDirection: "positive" | "negative" | "neutral" | "unavailable"
    openHoldingsCount: number
    valuedHoldingsCount: number
  }
  health: {
    score: number | null
    status: PortfolioHealthStatus
    factors: PortfolioHealthFactor[]
  }
  insights: WealthInsight[]
  missingData: {
    priceCount: number
    exchangeRateCount: number
  }
  analysis: PortfolioAnalysis
  evidence: PortfolioEvidence
}
