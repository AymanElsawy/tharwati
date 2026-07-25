import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import { supabase } from "@/lib/supabase"
import { requireAuthenticatedUserId, requireQueryData } from "@/lib/supabase/repository"
import type { AccountSummary, Decimal, TableRow } from "@/lib/supabase/types"

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

export class CashAccountsRepository {
  async getCashAccounts(): Promise<AccountSummary[]> {
    const operation = "cashAccounts.getAll"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const { data, error } = await supabase
      .from("financial_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("account_type_code", "cash")
      .order("created_at", { ascending: false })

    return requireQueryData(data, error, operation)
  }

  async getConfiguration(): Promise<CashAccountConfiguration> {
    const operation = "cashAccounts.getConfiguration"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const [profileResult, currenciesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("default_currency_code")
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

    return {
      baseCurrencyCode: profile.default_currency_code,
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
