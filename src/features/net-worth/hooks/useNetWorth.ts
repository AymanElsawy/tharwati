import { useCallback, useEffect, useState } from "react"

import { netWorthRepository } from "@/features/net-worth/repositories/net-worth.repository"
import { netWorthService } from "@/features/net-worth/services/net-worth.service"
import type { NetWorthResult } from "@/features/net-worth/types/net-worth"
import { portfolioValuationRepository } from "@/features/portfolio-valuation/repositories/portfolio-valuation.repository"
import { portfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"

export function useNetWorth() {
  const [result, setResult] = useState<NetWorthResult | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [source, valuationSource] = await Promise.all([
        netWorthRepository.getSourceData(),
        portfolioValuationRepository.getSource(),
      ])
      const portfolio =
        await portfolioValuationService.calculate(valuationSource)
      setResult(
        await netWorthService.calculate({ ...source, portfolio }),
      )
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError
          : new Error("Net worth could not be loaded"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initializeNetWorth() {
      await refresh()
    }
    void initializeNetWorth()
  }, [refresh])

  useEffect(() => {
    const reload = () => void refresh()
    window.addEventListener("tharwati:data-changed", reload)
    return () => window.removeEventListener("tharwati:data-changed", reload)
  }, [refresh])

  return { result, error, isLoading, refresh }
}
