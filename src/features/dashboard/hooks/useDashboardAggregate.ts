import { useCallback, useEffect, useState } from "react"

import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import {
  calculateDashboardAggregate,
  type DashboardAggregate,
} from "@/features/dashboard/services/dashboard-aggregate.service"
import { getCurrentUserBaseCurrency } from "@/features/profile/repositories/profile.repository"
import { RepositoryError } from "@/lib/supabase/types"
import {
  getDashboardValuationSnapshot,
  snapshotAccountBalances,
  snapshotRateResolver,
  type DashboardPortfolioAllocation,
} from "@/features/dashboard/services/dashboard-valuation-snapshot.service"
import {
  buildDashboardAccountsOverview,
  type DashboardAccountsOverviewItem,
} from "@/features/dashboard/utils/accounts-overview"

export function useDashboardAggregate() {
  const [result, setResult] = useState<DashboardAggregate | null>(null)
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [portfolioAllocation, setPortfolioAllocation] = useState<DashboardPortfolioAllocation | null>(null)
  const [accountsOverview, setAccountsOverview] = useState<DashboardAccountsOverviewItem[]>([])

  const load = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      const [baseCurrencyCode, accounts] = await Promise.all([
        getCurrentUserBaseCurrency(),
        accountsRepository.getAccounts(),
      ])
      if (!baseCurrencyCode) {
        setResult(null)
        setPortfolioAllocation(null)
        setAccountsOverview([])
        setError(null)
        return
      }
      const activeAccounts = accounts.filter((account) => account.is_active)
      const snapshot = await getDashboardValuationSnapshot()
      const aggregate = await calculateDashboardAggregate({
        baseCurrencyCode,
        accounts: activeAccounts,
        currentValues: snapshot.currentValues,
        accountBalances: snapshotAccountBalances(snapshot, activeAccounts),
        rates: snapshotRateResolver(snapshot),
      })
      setResult({ ...aggregate, asOf: snapshot.asOf, freshness: snapshot.freshness })
      setPortfolioAllocation(snapshot.portfolioAllocation)
      setAccountsOverview(buildDashboardAccountsOverview({
        accounts: activeAccounts,
        baseCurrencyCode,
        currentValues: snapshot.currentValues,
        rates: snapshot.rates,
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

  return { result, portfolioAllocation, accountsOverview, error, isLoading, refresh: () => load(true) }
}
