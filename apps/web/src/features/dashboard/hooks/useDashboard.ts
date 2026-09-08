import { useCallback, useEffect, useState } from "react"

import { dashboardService } from "@/features/dashboard/services/dashboard.service"
import type { DashboardViewModel } from "@/features/dashboard/types/dashboard"

export function useDashboard() {
  const [dashboard, setDashboard] =
    useState<DashboardViewModel | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      setDashboard(await dashboardService.load())
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Dashboard data is unavailable"),
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

  return { dashboard, error, isLoading, refresh }
}
