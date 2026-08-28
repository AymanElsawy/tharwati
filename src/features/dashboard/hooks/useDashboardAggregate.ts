import { useCallback, useEffect, useState } from "react"

import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import {
  calculateDashboardAggregate,
  type DashboardAggregate,
} from "@/features/dashboard/services/dashboard-aggregate.service"
import { getCurrentUserBaseCurrency } from "@/features/profile/repositories/profile.repository"
import { RepositoryError } from "@/lib/supabase/types"
import {
  parseDashboardValuationSnapshot,
  requestDashboardValuationSnapshot,
  snapshotAccountBalances,
  snapshotRateResolver,
  type DashboardPortfolioAllocation,
} from "@/features/dashboard/services/dashboard-valuation-snapshot.service"
import { DashboardLoadCoordinator } from "@/features/dashboard/services/dashboard-load-coordinator"
import { createDashboardLoadPerformance } from "@/features/dashboard/services/dashboard-load-performance"
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
    const performance = createDashboardLoadPerformance()
    if (showLoading) setIsLoading(true)
    const snapshotRequest = performance.measurePromise(
      "edge-snapshot-request",
      requestDashboardValuationSnapshot(),
    ).then(
      (data) => ({ data }),
      (cause) => ({ cause }),
    )
    let isReady = false
    try {
      const [baseCurrencyCode, accounts] = await Promise.all([
        performance.measurePromise("profile-load", getCurrentUserBaseCurrency()),
        performance.measurePromise("accounts-load", accountsRepository.getAccounts()),
      ])
      if (!baseCurrencyCode) {
        setResult(null)
        setPortfolioAllocation(null)
        setAccountsOverview([])
        setError(null)
        return
      }
      const activeAccounts = accounts.filter((account) => account.is_active)
      const snapshotResult = await snapshotRequest
      if ("cause" in snapshotResult) throw snapshotResult.cause

      await performance.measure("snapshot-parsing-aggregation", async () => {
        const snapshot = parseDashboardValuationSnapshot(snapshotResult.data)
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
      })
      setError(null)
      isReady = true
    } catch (cause) {
      setError(cause instanceof RepositoryError ? cause : new RepositoryError({
        code: "database_error",
        message: "Net worth is unavailable",
        operation: "dashboard.aggregate",
        cause,
      }))
    } finally {
      if (isReady) performance.finish()
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const [loadCoordinator] = useState(() => new DashboardLoadCoordinator(load))
  const requestLoad = useCallback((showLoading: boolean) => loadCoordinator.request(showLoading), [loadCoordinator])

  useEffect(() => {
    async function initialize() {
      await loadCoordinator.requestInitial()
    }
    void initialize()
  }, [loadCoordinator])
  useEffect(() => {
    const reload = () => void requestLoad(false)
    window.addEventListener("tharwati:data-changed", reload)
    return () => window.removeEventListener("tharwati:data-changed", reload)
  }, [requestLoad])

  return { result, portfolioAllocation, accountsOverview, error, isLoading, refresh: () => requestLoad(true) }
}
