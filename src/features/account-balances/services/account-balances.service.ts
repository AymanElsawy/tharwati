import { accountBalancesRepository } from "@/features/account-balances/repositories/account-balances.repository"
import type {
  AccountBalance,
  AccountBalanceRepository,
  CurrencyAccountBalance,
} from "@/features/account-balances/types/account-balance"
import { addDecimals } from "@/lib/financial-calculations/decimal"
import { RepositoryError } from "@/lib/supabase/types"

// These account containers can hold owned cash alongside any projected assets.
// Asset-like account categories are excluded because their opening balances may
// represent the asset itself and could duplicate a separate holding valuation.
const wealthCashAccountTypes = new Set([
  "cash",
  "bank",
  "brokerage",
])

export function supportsProjectedWealthCash(accountTypeCode: string): boolean {
  return wealthCashAccountTypes.has(accountTypeCode)
}

export class AccountBalancesService {
  private readonly repository: AccountBalanceRepository

  constructor(
    repository: AccountBalanceRepository = accountBalancesRepository,
  ) {
    this.repository = repository
  }

  getAccountBalances(
    accountIds?: readonly string[],
  ): Promise<AccountBalance[]> {
    return this.repository.getAccountBalances(accountIds)
  }

  async getCashAccountBalances(): Promise<AccountBalance[]> {
    const balances = await this.getAccountBalances()
    return balances.filter(
      (balance) =>
        balance.accountTypeCode === "cash" && balance.isActive,
    )
  }

  async getEligibleWealthCashBalances(): Promise<AccountBalance[]> {
    const balances = await this.getAccountBalances()
    return balances.filter(
      (balance) =>
        balance.isActive &&
        supportsProjectedWealthCash(balance.accountTypeCode),
    )
  }

  async getCashBalancesByCurrency(): Promise<CurrencyAccountBalance[]> {
    const totals = new Map<string, CurrencyAccountBalance>()
    for (const balance of await this.getCashAccountBalances()) {
      const current = totals.get(balance.currencyCode)
      const currentBalance = addDecimals(
        current?.currentBalance ?? "0",
        balance.currentBalance,
      )
      if (currentBalance === null) {
        throw new RepositoryError({
          code: "database_error",
          message: `Unable to aggregate ${balance.currencyCode} account balances`,
          operation: "accountBalances.getCashBalancesByCurrency",
        })
      }
      totals.set(balance.currencyCode, {
        currencyCode: balance.currencyCode,
        currentBalance,
        accountCount: (current?.accountCount ?? 0) + 1,
      })
    }
    return [...totals.values()].sort((left, right) =>
      left.currencyCode.localeCompare(right.currencyCode),
    )
  }
}

export const accountBalancesService = new AccountBalancesService()
