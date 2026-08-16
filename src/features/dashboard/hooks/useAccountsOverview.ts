import { useCallback, useEffect, useState } from "react"

import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import type { AccountTypeCode } from "@/features/accounts/types/account-form"
import { addDecimals } from "@/lib/financial-calculations/decimal"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { RepositoryError } from "@/lib/supabase/types"
import { getMetalPricePerGram } from "@/services/metalPriceService"

export type AccountTypeCurrencyTotal = {
  currencyCode: string
  total: Decimal
}

export type MetalAccountDetail = {
  accountId: string
  name: string
  metalType: "gold" | "silver"
  units: Decimal
  costPerUnit: Decimal
  currencyCode: string
  currentPricePerUnit: number | null
}

export type AccountTypeOverview = {
  accountTypeCode: AccountTypeCode
  accountCount: number
  currencyTotals: AccountTypeCurrencyTotal[]
  metalAccounts: MetalAccountDetail[] | null
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

async function groupByType(accounts: AccountSummary[]): Promise<AccountTypeOverview[]> {
  const groups = new Map<
    AccountTypeCode,
    { count: number; currencyTotals: Map<string, Decimal>; metalAccounts: MetalAccountDetail[] }
  >()

  for (const account of accounts) {
    const typeCode = account.account_type_code as AccountTypeCode
    const group = groups.get(typeCode) ?? {
      count: 0,
      currencyTotals: new Map<string, Decimal>(),
      metalAccounts: [],
    }
    group.count += 1

    if (typeCode === "gold") {
      group.metalAccounts.push({
        accountId: account.id,
        name: account.name,
        metalType: account.metal_type === "silver" ? "silver" : "gold",
        units: account.balance_grams ?? "0",
        costPerUnit: account.cost_per_unit ?? "0",
        currencyCode: account.currency_code,
        currentPricePerUnit: null,
      })
    } else {
      const current = group.currencyTotals.get(account.currency_code) ?? "0"
      const next = addDecimals(current, account.opening_balance)
      if (next !== null) group.currencyTotals.set(account.currency_code, next)
    }

    groups.set(typeCode, group)
  }

  const overview = typeOrder.flatMap((typeCode) => {
    const group = groups.get(typeCode)
    if (!group) return []
    return [
      {
        accountTypeCode: typeCode,
        accountCount: group.count,
        currencyTotals: [...group.currencyTotals.entries()]
          .map(([currencyCode, total]) => ({ currencyCode, total }))
          .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode)),
        metalAccounts: typeCode === "gold" ? group.metalAccounts : null,
      },
    ]
  })

  const goldOverview = overview.find((item) => item.accountTypeCode === "gold")
  if (goldOverview?.metalAccounts) {
    await Promise.all(
      goldOverview.metalAccounts.map(async (metalAccount) => {
        const symbol = metalAccount.metalType === "silver" ? "XAG" : "XAU"
        metalAccount.currentPricePerUnit = await getMetalPricePerGram(
          symbol,
          metalAccount.currencyCode,
        )
      }),
    )
  }

  return overview
}

export function useAccountsOverview() {
  const [overview, setOverview] = useState<AccountTypeOverview[]>([])
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const accounts = await accountsRepository.getAccounts()
      setOverview(await groupByType(accounts.filter((account) => account.is_active)))
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
