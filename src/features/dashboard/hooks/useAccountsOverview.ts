import { useCallback, useEffect, useState } from "react"

import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import type { AccountTypeCode } from "@/features/accounts/types/account-form"
import { getCurrentUserBaseCurrency } from "@/features/profile/repositories/profile.repository"
import { addDecimals, multiplyDecimals } from "@/lib/financial-calculations/decimal"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { RepositoryError } from "@/lib/supabase/types"
import { convertCurrency } from "@/services/exchangeRateService"
import { getMetalPricePerGram } from "@/services/metalPriceService"

export type AccountTypeCurrencyTotal = {
  currencyCode: string
  total: Decimal
}

export type AccountTypeOverview = {
  accountTypeCode: Exclude<AccountTypeCode, "gold">
  accountCount: number
  currencyTotals: AccountTypeCurrencyTotal[]
}

export type MetalOverview = {
  metalType: "gold" | "silver"
  accountCount: number
  totalValueBase: Decimal | null
  costBasisBase: Decimal | null
  baseCurrencyCode: string | null
}

export type OverviewCard =
  | ({ kind: "type" } & AccountTypeOverview)
  | ({ kind: "metal" } & MetalOverview)

const typeOrder: Exclude<AccountTypeCode, "gold">[] = [
  "cash",
  "bank",
  "brokerage",
  "real_estate",
  "business",
  "other",
]

async function groupByType(
  accounts: AccountSummary[],
  baseCurrencyCode: string | null,
): Promise<OverviewCard[]> {
  const groups = new Map<
    Exclude<AccountTypeCode, "gold">,
    { count: number; currencyTotals: Map<string, Decimal> }
  >()
  const metalGroups = new Map<
    "gold" | "silver",
    { count: number; units: Decimal; costBasisByCurrency: Map<string, Decimal> }
  >()

  for (const account of accounts) {
    const typeCode = account.account_type_code as AccountTypeCode

    if (typeCode === "gold") {
      const metalType = account.metal_type === "silver" ? "silver" : "gold"
      const metalGroup = metalGroups.get(metalType) ?? {
        count: 0,
        units: "0",
        costBasisByCurrency: new Map<string, Decimal>(),
      }
      metalGroup.count += 1
      const units = account.balance_grams ?? "0"
      const nextUnits = addDecimals(metalGroup.units, units)
      if (nextUnits !== null) metalGroup.units = nextUnits

      const costBasisNative = multiplyDecimals(units, account.cost_per_unit ?? "0")
      if (costBasisNative !== null) {
        const currentCostBasis = metalGroup.costBasisByCurrency.get(account.currency_code) ?? "0"
        const nextCostBasis = addDecimals(currentCostBasis, costBasisNative)
        if (nextCostBasis !== null)
          metalGroup.costBasisByCurrency.set(account.currency_code, nextCostBasis)
      }

      metalGroups.set(metalType, metalGroup)
      continue
    }

    const group = groups.get(typeCode) ?? { count: 0, currencyTotals: new Map<string, Decimal>() }
    group.count += 1
    const current = group.currencyTotals.get(account.currency_code) ?? "0"
    const next = addDecimals(current, account.opening_balance)
    if (next !== null) group.currencyTotals.set(account.currency_code, next)
    groups.set(typeCode, group)
  }

  const metalOverviews = await Promise.all(
    (["gold", "silver"] as const)
      .filter((metalType) => metalGroups.has(metalType))
      .map(async (metalType) => {
        const group = metalGroups.get(metalType)!
        let totalValueBase: Decimal | null = null
        let costBasisBase: Decimal | null = null
        if (baseCurrencyCode) {
          const symbol = metalType === "silver" ? "XAG" : "XAU"
          const pricePerGramBase = await getMetalPricePerGram(symbol, baseCurrencyCode)
          if (pricePerGramBase !== null) {
            totalValueBase = multiplyDecimals(group.units, String(pricePerGramBase))
          }

          let costBasisTotal = 0
          let costBasisResolved = true
          for (const [currencyCode, amount] of group.costBasisByCurrency) {
            if (currencyCode === baseCurrencyCode) {
              costBasisTotal += Number(amount)
              continue
            }
            const converted = await convertCurrency(Number(amount), currencyCode, baseCurrencyCode)
            if (converted === null) {
              costBasisResolved = false
              break
            }
            costBasisTotal += converted
          }
          if (costBasisResolved) costBasisBase = String(costBasisTotal)
        }
        return {
          kind: "metal" as const,
          metalType,
          accountCount: group.count,
          totalValueBase,
          costBasisBase,
          baseCurrencyCode,
        }
      }),
  )

  const typeOverviews: OverviewCard[] = typeOrder.flatMap((typeCode) => {
    const group = groups.get(typeCode)
    if (!group) return []
    return [
      {
        kind: "type" as const,
        accountTypeCode: typeCode,
        accountCount: group.count,
        currencyTotals: [...group.currencyTotals.entries()]
          .map(([currencyCode, total]) => ({ currencyCode, total }))
          .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode)),
      },
    ]
  })

  const brokerageIndex = typeOverviews.findIndex(
    (item) => item.kind === "type" && item.accountTypeCode === "brokerage",
  )
  const insertAt = brokerageIndex === -1 ? 0 : brokerageIndex + 1
  typeOverviews.splice(insertAt, 0, ...metalOverviews)

  return typeOverviews
}

export function useAccountsOverview() {
  const [overview, setOverview] = useState<OverviewCard[]>([])
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const [accounts, baseCurrencyCode] = await Promise.all([
        accountsRepository.getAccounts(),
        getCurrentUserBaseCurrency(),
      ])
      setOverview(
        await groupByType(accounts.filter((account) => account.is_active), baseCurrencyCode),
      )
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
