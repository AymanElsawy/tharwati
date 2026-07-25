import type { Decimal } from "@/lib/supabase/types"

export interface CashBalanceInput {
  accountId: string
  balance: Decimal
  currencyCode: string
}

export interface NetWorthSourceData {
  accounts: CashBalanceInput[]
  baseCurrency: string
}

export interface MissingCurrencyPair {
  destinationCurrencyCode: string
  sourceCurrencyCode: string
}

interface NetWorthResultBase {
  accountCount: number
  baseCurrency: string
  totalLiabilities: Decimal
}

export interface CompleteNetWorthResult extends NetWorthResultBase {
  status: "success" | "empty"
  totalAssets: Decimal
  netWorth: Decimal
  missingCurrencyPairs: []
}

export interface IncompleteNetWorthResult extends NetWorthResultBase {
  status: "incomplete"
  totalAssets: null
  netWorth: null
  missingCurrencyPairs: MissingCurrencyPair[]
}

export type NetWorthResult = CompleteNetWorthResult | IncompleteNetWorthResult
