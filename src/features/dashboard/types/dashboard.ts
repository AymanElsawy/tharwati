import type { Decimal } from "@/lib/supabase/types"
import type { NetWorthResult } from "@/features/net-worth/types/net-worth"
import type {
  MissingExchangeRatePair,
  PortfolioValuationResult,
} from "@/features/portfolio-valuation/types/portfolio-valuation"

export type DashboardAllocationGroup =
  | "stocks"
  | "etfs"
  | "cash"
  | "other"

export interface DashboardAllocation {
  group: DashboardAllocationGroup
  marketValue: Decimal
  percentage: Decimal
}

export interface DashboardActivity {
  id: string
  kind: "transaction" | "exchange_rate"
  type: string
  title: string
  description: string
  occurredAt: string
}

export interface DashboardViewModel {
  baseCurrency: string
  netWorth: NetWorthResult
  cash: {
    projectedBalanceBase: Decimal
    accountCount: number
    currencyCode: string
    isPartial: boolean
  }
  investments: {
    marketValueBase: Decimal | null
    unrealizedGainLossBase: Decimal | null
    unrealizedReturnPercent: Decimal | null
    holdingsCount: number
    currencyCode: string
  }
  allocation: DashboardAllocation[]
  performance: {
    marketValueBase: Decimal | null
    unrealizedGainLossBase: Decimal | null
    unrealizedReturnPercent: Decimal | null
    isHistorical: false
  }
  activities: DashboardActivity[]
  missingData: {
    priceHoldings: PortfolioValuationResult["missingPriceHoldings"]
    exchangeRatePairs: MissingExchangeRatePair[]
  }
  isEmpty: boolean
}
