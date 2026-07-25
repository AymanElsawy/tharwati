import { useCallback, useEffect, useState } from "react"

import { portfolioValuationRepository } from "@/features/portfolio-valuation/repositories/portfolio-valuation.repository"
import { portfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"
import type { PortfolioValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"

export function usePortfolioValuation() {
  const [result, setResult] =
    useState<PortfolioValuationResult | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const source = await portfolioValuationRepository.getSource()
      setResult(await portfolioValuationService.calculate(source))
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Portfolio valuation is unavailable"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initialize() {
      await refresh()
    }
    void initialize()
  }, [refresh])

  useEffect(() => {
    const reload = () => void refresh()
    window.addEventListener("tharwati:data-changed", reload)
    return () =>
      window.removeEventListener("tharwati:data-changed", reload)
  }, [refresh])

  return { result, error, isLoading, refresh }
}
