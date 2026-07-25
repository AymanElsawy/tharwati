import type { Decimal } from "@/lib/supabase/types"
import type { PortfolioValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"

export interface CashBalanceInput {
  accountId: string
  balance: Decimal
  currencyCode: string
}

export interface NetWorthSourceData {
  accounts: CashBalanceInput[]
  baseCurrency: string
  portfolio?: PortfolioValuationResult
}

export interface MissingCurrencyPair {
  destinationCurrencyCode: string
  sourceCurrencyCode: string
}

interface NetWorthResultBase {
  accountCount: number
  baseCurrency: string
  totalLiabilities: Decimal
  cashAssets: Decimal
  investmentAssets: Decimal
  investmentHoldingCount: number
  missingPriceHoldings: PortfolioValuationResult["missingPriceHoldings"]
  missingCurrencyPairs: MissingCurrencyPair[]
}

export interface CompleteNetWorthResult extends NetWorthResultBase {
  status: "success" | "empty"
  totalAssets: Decimal
  netWorth: Decimal
}

export interface IncompleteNetWorthResult extends NetWorthResultBase {
  status: "partial"
  totalAssets: Decimal
  netWorth: Decimal
}

export type NetWorthResult = CompleteNetWorthResult | IncompleteNetWorthResult
