import { useCallback, useEffect, useState } from "react"

import { useTranslation } from "../../../i18n/useTranslation"
import { RepositoryError } from "../../../lib/supabase/types"
import { holdingsRepository } from "../repositories/holdings.repository"
import type { HoldingDetails } from "../types/holding"

function normalizeError(
  cause: unknown,
  fallback: string,
): RepositoryError {
  if (cause instanceof RepositoryError) return cause
  return new RepositoryError({
    code: "database_error",
    message: cause instanceof Error ? cause.message : fallback,
    operation: "holdings.getHoldings",
    cause,
  })
}

export function useHoldings() {
  const { t } = useTranslation()
  const [holdings, setHoldings] = useState<HoldingDetails[]>([])
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadHoldings = useCallback(async (showLoading: boolean) => {
    if (showLoading) setIsLoading(true)
    try {
      setHoldings(await holdingsRepository.getHoldings())
      setError(null)
    } catch (cause) {
      setError(normalizeError(cause, t("holdings.error.unexpected")))
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    async function initialize() {
      await loadHoldings(true)
    }
    void initialize()
  }, [loadHoldings])

  useEffect(() => {
    const refresh = () => void loadHoldings(false)
    window.addEventListener("tharwati:data-changed", refresh)
    return () =>
      window.removeEventListener("tharwati:data-changed", refresh)
  }, [loadHoldings])

  return {
    holdings,
    error,
    isLoading,
    refresh: () => loadHoldings(true),
  }
}
