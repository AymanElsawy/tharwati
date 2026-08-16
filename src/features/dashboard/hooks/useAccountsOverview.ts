import { useCallback, useEffect, useState } from "react"

import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import type { AccountTypeCode } from "@/features/accounts/types/account-form"
import { addDecimals } from "@/lib/financial-calculations/decimal"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { RepositoryError } from "@/lib/supabase/types"

export type AccountTypeCurrencyTotal = {
  currencyCode: string
  total: Decimal
}

export type AccountTypeOverview = {
  accountTypeCode: AccountTypeCode
  accountCount: number
  currencyTotals: AccountTypeCurrencyTotal[]
  goldGramsTotal: Decimal | null
}

const typeOrder: AccountTypeCode[] = [
  "cash",
  "bank",
  "brokerage",
  "gold",
  "real_estate",
  "business",
  "other",
]

function groupByType(accounts: AccountSummary[]): AccountTypeOverview[] {
  const groups = new Map<
    AccountTypeCode,
    { count: number; currencyTotals: Map<string, Decimal>; goldGrams: Decimal | null }
  >()

  for (const account of accounts) {
    const typeCode = account.account_type_code as AccountTypeCode
    const group = groups.get(typeCode) ?? {
      count: 0,
      currencyTotals: new Map<string, Decimal>(),
      goldGrams: null,
    }
    group.count += 1

    if (typeCode === "gold") {
      const grams = account.balance_grams ?? "0"
      group.goldGrams = addDecimals(group.goldGrams ?? "0", grams) ?? group.goldGrams
    } else {
      const current = group.currencyTotals.get(account.currency_code) ?? "0"
      const next = addDecimals(current, account.opening_balance)
      if (next !== null) group.currencyTotals.set(account.currency_code, next)
    }

    groups.set(typeCode, group)
  }

  return typeOrder.flatMap((typeCode) => {
    const group = groups.get(typeCode)
    if (!group) return []
    return [
      {
        accountTypeCode: typeCode,
        accountCount: group.count,
        currencyTotals: [...group.currencyTotals.entries()]
          .map(([currencyCode, total]) => ({ currencyCode, total }))
          .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode)),
        goldGramsTotal: group.goldGrams,
      },
    ]
  })
}

export function useAccountsOverview() {
  const [overview, setOverview] = useState<AccountTypeOverview[]>([])
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const accounts = await accountsRepository.getAccounts()
      setOverview(groupByType(accounts.filter((account) => account.is_active)))
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof RepositoryError
          ? cause
          : new RepositoryError({
              code: "database_error",
              message: "Account balances are unavailable",
              operation: "dashboard.accountsOverview",
              cause,
            }),
      )
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initialize() {
      await load(true)
    }
    void initialize()
  }, [load])

  useEffect(() => {
    const reload = () => void load(false)
    window.addEventListener("tharwati:data-changed", reload)
    return () => window.removeEventListener("tharwati:data-changed", reload)
  }, [load])

  return { overview, error, isLoading, refresh: () => load(true) }
}
