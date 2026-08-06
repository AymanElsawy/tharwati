import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { portfolioAnalysisService } from "@/features/portfolio/services/portfolio-analysis.service"
import { portfolioExecutiveService } from "@/features/portfolio/services/portfolio-executive.service"
import type {
  DiversificationDimensionId,
  PortfolioRiskId,
} from "@/features/portfolio/types/portfolio-analysis"
import type { PortfolioExecutiveViewModel } from "@/features/portfolio/types/portfolio-executive"
import { LatestRequestGuard } from "@/features/portfolio/utils/latest-request"
import { portfolioEvidenceService } from "@/features/portfolio/services/portfolio-evidence.service"
import type {
  PortfolioHoldingSort,
} from "@/features/portfolio/types/portfolio-evidence"

export function usePortfolioExecutive() {
  const [portfolio, setPortfolio] =
    useState<PortfolioExecutiveViewModel | null>(null)
  const [activeScopeId, setScopeId] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [assetClassSelection, setAssetClassSelection] = useState<
    string | null | undefined
  >(undefined)
  const [dimension, setDimensionState] =
    useState<DiversificationDimensionId>("asset_class")
  const [exposureId, setExposureId] = useState<string | null>(null)
  const [riskId, setRiskId] = useState<PortfolioRiskId | null>(null)
  const [holdingSearch, setHoldingSearch] = useState("")
  const [holdingAccountId, setHoldingAccountId] = useState<string | null>(null)
  const [holdingAssetClass, setHoldingAssetClass] = useState<string | null>(null)
  const [holdingSort, setHoldingSort] = useState<PortfolioHoldingSort>("asset")
  const [holdingSortDirection, setHoldingSortDirection] = useState<"asc" | "desc">("asc")
  const [activityType, setActivityType] = useState<string | null>(null)
  const [activityAccountId, setActivityAccountId] = useState<string | null>(null)
  const [holdingDetailId, setHoldingDetailId] = useState<string | null>(null)
  const [transactionDetailId, setTransactionDetailId] = useState<string | null>(null)
  const requestGuard = useRef(new LatestRequestGuard())
  const hasStarted = useRef(false)

  const load = useCallback(
    async (scopeId: string | null, initial = false) => {
      const currentRequest = requestGuard.current.begin()
      if (initial) setIsLoading(true)
      else setIsUpdating(true)

      try {
        const nextPortfolio =
          await portfolioExecutiveService.load(scopeId)
        if (!requestGuard.current.isCurrent(currentRequest)) return
        setPortfolio(nextPortfolio)
        setError(null)
      } catch (cause) {
        if (!requestGuard.current.isCurrent(currentRequest)) return
        setError(
          cause instanceof Error
            ? cause
            : new Error("Portfolio data is unavailable"),
        )
      } finally {
        if (requestGuard.current.isCurrent(currentRequest)) {
          setIsLoading(false)
          setIsUpdating(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    const initial = !hasStarted.current
    hasStarted.current = true
    void load(activeScopeId, initial)
  }, [activeScopeId, load])

  useEffect(() => {
    const refresh = () => void load(activeScopeId)
    window.addEventListener("tharwati:data-changed", refresh)
    return () =>
      window.removeEventListener("tharwati:data-changed", refresh)
  }, [activeScopeId, load])

  const refresh = useCallback(
    () => load(activeScopeId, portfolio === null),
    [activeScopeId, load, portfolio],
  )

  const assetClassId =
    assetClassSelection === undefined
      ? (portfolio?.analysis.allocation[0]?.id ?? null)
      : assetClassSelection

  const selection = useMemo(
    () => ({ assetClassId, dimension, exposureId, riskId }),
    [assetClassId, dimension, exposureId, riskId],
  )
  const risks = useMemo(
    () =>
      portfolio
        ? portfolioAnalysisService.filteredRisks(
            portfolio.analysis,
            selection,
            portfolio.baseCurrency,
          )
        : [],
    [portfolio, selection],
  )
  const activeDimension = useMemo(
    () =>
      portfolio
        ? portfolioAnalysisService.filteredDimension(
            portfolio.analysis,
            selection,
            portfolio.baseCurrency,
          )
        : null,
    [portfolio, selection],
  )

  const selectAssetClass = useCallback((id: string | null) => {
    setAssetClassSelection(id)
    setExposureId(null)
    setRiskId(null)
  }, [])
  const setActiveScopeId = useCallback((id: string | null) => {
    setScopeId(id)
    setAssetClassSelection(undefined)
    setDimensionState("asset_class")
    setExposureId(null)
    setRiskId(null)
  }, [])

  const selectDimension = useCallback(
    (nextDimension: DiversificationDimensionId) => {
      setDimensionState(nextDimension)
      setExposureId(null)
      setRiskId(null)
    },
    [],
  )

  const selectExposure = useCallback((id: string | null) => {
    setExposureId(id)
    setRiskId(null)
  }, [])

  const selectRisk = useCallback(
    (id: PortfolioRiskId | null) => {
      setRiskId(id)
      if (!portfolio || !id) return
      if (id === "dominant_currency") {
        const currency = portfolio.analysis.diversification.find(
          (item) => item.id === "currency",
        )
        setDimensionState("currency")
        setExposureId(currency?.dominantExposureId ?? null)
      } else if (id === "dominant_sector") {
        setDimensionState("sector")
        setExposureId(null)
      }
    },
    [portfolio],
  )
  const highlightedHealthFactor = useMemo(() => {
    if (
      riskId === "largest_holding" ||
      riskId === "top_five"
    ) {
      return "concentration" as const
    }
    if (riskId === "dominant_currency") return "currency" as const
    if (riskId === "unpriced_exposure") return "missing_data" as const
    if (
      riskId === "dominant_sector" ||
      riskId === "illiquid_exposure"
    ) {
      return "diversification" as const
    }
    return null
  }, [riskId])
  const inheritedContributorIds = useMemo(() => {
    if (!portfolio) return null
    const sets: Set<string>[] = []
    if (assetClassId) {
      sets.push(
        new Set(
          portfolio.analysis.holdings
            .filter((holding) => holding.assetClass === assetClassId)
            .map((holding) => holding.id),
        ),
      )
    }
    if (exposureId) {
      const exposure = activeDimension?.exposures.find(
        (item) => item.id === exposureId,
      )
      if (exposure) sets.push(new Set(exposure.contributorIds))
    }
    if (riskId) {
      const risk = risks.find((item) => item.id === riskId)
      if (risk?.available) sets.push(new Set(risk.contributorIds))
    }
    if (sets.length === 0) return null
    return new Set(
      [...sets[0]].filter((id) => sets.every((set) => set.has(id))),
    )
  }, [activeDimension, assetClassId, exposureId, portfolio, riskId, risks])
  const filteredHoldings = useMemo(
    () =>
      portfolio
        ? portfolioEvidenceService.filterHoldings(portfolio.evidence.holdings, {
            search: holdingSearch,
            accountId: holdingAccountId,
            assetClass: holdingAssetClass,
            contributorIds: inheritedContributorIds,
            sort: holdingSort,
            direction: holdingSortDirection,
          })
        : [],
    [
      holdingAccountId,
      holdingAssetClass,
      holdingSearch,
      holdingSort,
      holdingSortDirection,
      inheritedContributorIds,
      portfolio,
    ],
  )
  const filteredActivity = useMemo(() => {
    if (!portfolio) return []
    const assetIds = inheritedContributorIds
      ? new Set(
          portfolio.evidence.holdings
            .filter((holding) => inheritedContributorIds.has(holding.id))
            .map((holding) => holding.assetId),
        )
      : null
    return portfolioEvidenceService.filterActivity(portfolio.evidence.activity, {
      type: activityType,
      accountId: activityAccountId,
      assetIds,
    })
  }, [activityAccountId, activityType, inheritedContributorIds, portfolio])

  const toggleHoldingSort = useCallback((sort: PortfolioHoldingSort) => {
    setHoldingSort((current) => {
      if (current === sort) {
        setHoldingSortDirection((direction) => direction === "asc" ? "desc" : "asc")
        return current
      }
      setHoldingSortDirection("asc")
      return sort
    })
  }, [])

  return {
    portfolio,
    error,
    isLoading,
    isUpdating,
    activeScopeId,
    setActiveScopeId,
    refresh,
    analysis: {
      selection,
      risks,
      activeDimension,
      highlightedHealthFactor,
      selectAssetClass,
      selectDimension,
      selectExposure,
      selectRisk,
    },
    evidence: {
      holdings: filteredHoldings,
      custody: portfolio?.evidence.custody ?? [],
      activity: filteredActivity,
      filters: {
        holdingSearch,
        holdingAccountId,
        holdingAssetClass,
        holdingSort,
        holdingSortDirection,
        activityType,
        activityAccountId,
        hasInherited: inheritedContributorIds !== null,
      },
      setHoldingSearch,
      setHoldingAccountId,
      setHoldingAssetClass,
      toggleHoldingSort,
      setActivityType,
      setActivityAccountId,
      holdingDetailId,
      setHoldingDetailId,
      transactionDetailId,
      setTransactionDetailId,
    },
  }
}
