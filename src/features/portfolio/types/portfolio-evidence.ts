import type {
  QuantityUnit,
  Decimal,
  TransactionDetails,
} from "@/lib/supabase/types"

export type PortfolioDataQuality =
  "complete" | "missing_price" | "missing_fx" | "partial"
export type PortfolioHoldingSort =
  | "asset"
  | "account"
  | "quantity"
  | "average_cost"
  | "cost_basis"
  | "current_price"
  | "market_value"
  | "gain_loss"
  | "return"

export interface PortfolioHoldingEvidence {
  id: string
  assetId: string
  assetName: string
  symbol: string | null
  assetClass: string
  accountId: string
  accountName: string
  quantity: Decimal
  unit: QuantityUnit
  averageCost: Decimal | null
  totalCostBasis: Decimal
  costCurrency: string
  currentPrice: Decimal | null
  priceCurrency: string | null
  priceTimestamp: string | null
  priceSource: string | null
  marketValueBase: Decimal | null
  unrealizedGainLossBase: Decimal | null
  returnPercent: Decimal | null
  dataQuality: PortfolioDataQuality
}

export interface PortfolioCustodyAccount {
  accountId: string
  accountName: string
  accountType: string
  accountCurrency: string
  investmentValueBase: Decimal
  projectedCashOriginal: Decimal
  projectedCashBase: Decimal | null
  totalContributionBase: Decimal | null
  holdingCount: number
  percentage: Decimal | null
  dataQuality: PortfolioDataQuality
}

export interface PortfolioActivityEntry {
  id: string
  accountId: string
  assetId: string | null
  side: "debit" | "credit"
  amount: Decimal
  accountAmount: Decimal
  quantityDelta: Decimal | null
  memo: string | null
}

export interface PortfolioActivityItem {
  id: string
  type: string
  description: string
  occurredAt: string
  postedAt: string
  currency: string
  amount: Decimal
  accountIds: string[]
  assetIds: string[]
  entries: PortfolioActivityEntry[]
}

export interface PortfolioEvidence {
  holdings: PortfolioHoldingEvidence[]
  custody: PortfolioCustodyAccount[]
  activity: PortfolioActivityItem[]
}

export interface PortfolioHoldingFilters {
  search: string
  accountId: string | null
  assetClass: string | null
  contributorIds: ReadonlySet<string> | null
  sort: PortfolioHoldingSort
  direction: "asc" | "desc"
}

export interface PortfolioActivityFilters {
  type: string | null
  accountId: string | null
  assetIds: ReadonlySet<string> | null
}

export type PortfolioTransactionDetail = TransactionDetails
