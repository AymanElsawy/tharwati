import type { Decimal } from "@/lib/supabase/types"

export interface AccountBalance {
  accountId: string
  accountTypeCode: string
  accountName: string
  currencyCode: string
  isActive: boolean
  openingBalance: Decimal
  ledgerEffect: Decimal
  currentBalance: Decimal
}

export interface AccountBalanceRepository {
  getAccountBalances(accountIds?: readonly string[]): Promise<AccountBalance[]>
}

export interface CurrencyAccountBalance {
  currencyCode: string
  currentBalance: Decimal
  accountCount: number
}
