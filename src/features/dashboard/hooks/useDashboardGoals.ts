import { useCallback, useEffect, useState } from "react"

import {
  listActiveGoalSummaries,
  type DashboardGoalsReadModel,
} from "@/features/goals/services/goals.service"

export function useDashboardGoals() {
  const [model, setModel] = useState<DashboardGoalsReadModel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setModel(await listActiveGoalSummaries(3))
      setIsError(false)
    } catch {
      setModel(null)
      setIsError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initialize() {
      await load()
    }
    void initialize()
  }, [load])
  useEffect(() => {
    const reload = () => void load()
    window.addEventListener("tharwati:data-changed", reload)
    return () => window.removeEventListener("tharwati:data-changed", reload)
  }, [load])

  return { model, isLoading, isError, retry: load }
}
