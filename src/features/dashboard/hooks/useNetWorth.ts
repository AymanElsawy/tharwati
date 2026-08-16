import { useCallback, useEffect, useState } from "react"

import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import type { AccountTypeCode } from "@/features/accounts/types/account-form"
import { getCurrentUserBaseCurrency } from "@/features/profile/repositories/profile.repository"
import { RepositoryError } from "@/lib/supabase/types"
import { convertCurrency } from "@/services/exchangeRateService"
import { getMetalPricePerGram } from "@/services/metalPriceService"

// Types converted into the net worth total today. Brokerage, business, and
// other are not yet supported and are reported back as `skippedTypes`.
const convertibleCurrencyTypes = new Set<AccountTypeCode>(["cash", "bank", "real_estate"])

export type NetWorthResult = {
  baseCurrencyCode: string
  total: number
  accountCount: number
  skippedTypes: AccountTypeCode[]
  unavailablePairs: string[]
}

export function useNetWorth() {
  const [result, setResult] = useState<NetWorthResult | null>(null)
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const [baseCurrencyCode, accounts] = await Promise.all([
        getCurrentUserBaseCurrency(),
        accountsRepository.getAccounts(),
      ])

      if (!baseCurrencyCode) {
        setResult(null)
        setError(null)
        return
      }

      const activeAccounts = accounts.filter((account) => account.is_active)
      const skippedTypes = new Set<AccountTypeCode>()
      const unavailablePairs = new Set<string>()
      let total = 0
      let accountCount = 0

      for (const account of activeAccounts) {
        const typeCode = account.account_type_code as AccountTypeCode

        if (typeCode === "gold") {
          const grams = Number(account.balance_grams ?? "0")
          if (grams > 0) {
            const pricePerGram = await getMetalPricePerGram("XAU", baseCurrencyCode)
            if (pricePerGram === null) {
              unavailablePairs.add(`XAU/${baseCurrencyCode}`)
            } else {
              total += grams * pricePerGram
              accountCount += 1
            }
          }
          continue
        }

        if (!convertibleCurrencyTypes.has(typeCode)) {
          skippedTypes.add(typeCode)
          continue
        }

        const amount = Number(account.opening_balance)
        if (account.currency_code === baseCurrencyCode) {
          total += amount
          accountCount += 1
          continue
        }

        const converted = await convertCurrency(amount, account.currency_code, baseCurrencyCode)
        if (converted === null) {
          unavailablePairs.add(`${account.currency_code}/${baseCurrencyCode}`)
        } else {
          total += converted
          accountCount += 1
        }
      }

      setResult({
        baseCurrencyCode,
        total,
        accountCount,
        skippedTypes: [...skippedTypes],
        unavailablePairs: [...unavailablePairs],
      })
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof RepositoryError
          ? cause
          : new RepositoryError({
              code: "database_error",
              message: "Net worth is unavailable",
              operation: "dashboard.netWorth",
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

  return { result, error, isLoading, refresh: () => load(true) }
}
