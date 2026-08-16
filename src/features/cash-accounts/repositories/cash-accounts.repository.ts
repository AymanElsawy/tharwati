import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import { accountBalancesService } from "@/features/account-balances/services/account-balances.service"
import { supabase } from "@/lib/supabase"
import { requireAuthenticatedUserId, requireQueryData } from "@/lib/supabase/repository"
import {
  RepositoryError,
  type AccountSummary,
  type Decimal,
  type TableRow,
} from "@/lib/supabase/types"

export interface CashAccountConfiguration {
  baseCurrencyCode: string
  currencies: TableRow<"currencies">[]
}

export interface SaveCashAccountInput {
  name: string
  currencyCode: string
  balance: Decimal
  notes: string | null
}

export type CashAccountSummary = AccountSummary & {
  current_balance: Decimal
  has_financial_history: boolean
}

export class CashAccountsRepository {
  async getCashAccounts(): Promise<CashAccountSummary[]> {
    const operation = "cashAccounts.getAll"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const { data, error } = await supabase
      .from("financial_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("account_type_code", "cash")
      .order("created_at", { ascending: false })

    const accounts = requireQueryData(data, error, operation)
    const accountIds = accounts.map((account) => account.id)
    const [balances, eligibility] = await Promise.all([
      accountBalancesService.getAccountBalances(accountIds),
      accountsRepository.getAccountDeletionEligibility(accountIds),
    ])
    const currentBalanceByAccount = new Map(
      balances.map((balance) => [
        balance.accountId,
        balance.currentBalance,
      ]),
    )
    const historyByAccount = new Map(
      eligibility.map((item) => [
        item.accountId,
        item.hasFinancialHistory,
      ]),
    )

    return accounts.map((account) => {
      const currentBalance = currentBalanceByAccount.get(account.id)
      if (currentBalance === undefined) {
        throw new RepositoryError({
          code: "database_error",
          message: `Projected balance is unavailable for account ${account.id}`,
          operation,
        })
      }
      return {
        ...account,
        current_balance: currentBalance,
        has_financial_history:
          historyByAccount.get(account.id) ?? false,
      }
    })
  }

  async getConfiguration(): Promise<CashAccountConfiguration> {
    const operation = "cashAccounts.getConfiguration"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const [profileResult, currenciesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("base_currency_code")
        .eq("id", userId)
        .single(),
      supabase
        .from("currencies")
        .select("*")
        .eq("is_active", true)
        .order("code"),
    ])

    const profile = requireQueryData(
      profileResult.data,
      profileResult.error,
      operation,
    )
    const availableCurrencies = requireQueryData(
      currenciesResult.data,
      currenciesResult.error,
      operation,
    )

    if (profile.base_currency_code === null) {
      throw new RepositoryError({
        code: "not_found",
        message: "The user has not completed onboarding",
        operation,
      })
    }

    return {
      baseCurrencyCode: profile.base_currency_code,
      currencies: availableCurrencies,
    }
  }

  async create(input: SaveCashAccountInput) {
    return accountsRepository.createAccount({
      accountTypeCode: "cash",
      name: input.name,
      currencyCode: input.currencyCode,
      openingBalance: input.balance,
      notes: input.notes,
    })
  }

  async update(accountId: string, input: SaveCashAccountInput) {
    const account = await accountsRepository.getAccount(accountId)
    if (account.account_type_code !== "cash") {
      throw new Error("Only cash accounts can be updated from this feature")
    }

    return accountsRepository.updateAccount(accountId, {
      name: input.name,
      currencyCode: input.currencyCode,
      openingBalance: input.balance,
      notes: input.notes,
    })
  }

  async delete(accountId: string) {
    return accountsRepository.deleteAccount(accountId)
  }
}

export const cashAccountsRepository = new CashAccountsRepository()
