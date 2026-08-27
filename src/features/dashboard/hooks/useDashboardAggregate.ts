import { useCallback, useEffect, useState } from "react"

import { accountBalancesRepository } from "@/features/account-balances/repositories/account-balances.repository"
import { getAccountCurrentValues } from "@/features/accounts/services/account-values.service"
import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import {
  calculateDashboardAggregate,
  type DashboardAggregate,
} from "@/features/dashboard/services/dashboard-aggregate.service"
import { getCurrentUserBaseCurrency } from "@/features/profile/repositories/profile.repository"
import { RepositoryError } from "@/lib/supabase/types"
import { exchangeRateService } from "@/services/exchange-rates"

export function useDashboardAggregate() {
  const [result, setResult] = useState<DashboardAggregate | null>(null)
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
      const [currentValues, accountBalances] = await Promise.all([
        getAccountCurrentValues(activeAccounts),
        accountBalancesRepository.getAccountBalances(activeAccounts.map((account) => account.id)),
      ])
      setResult(await calculateDashboardAggregate({
        baseCurrencyCode,
        accounts: activeAccounts,
        currentValues,
        accountBalances,
        rates: exchangeRateService,
      }))
      setError(null)
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause : new RepositoryError({
        code: "database_error",
        message: "Net worth is unavailable",
        operation: "dashboard.aggregate",
        cause,
      }))
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
