import { useCallback, useEffect, useState } from "react"

import type { WealthTarget } from "../domain/wealth-target-allocation"
import { wealthAllocationTargetsRepository } from "../repositories/wealth-allocation-targets.repository"

export function useWealthAllocationTargets() {
  const [targets, setTargets] = useState<WealthTarget[]>([])
  const [tolerancePercentage, setTolerancePercentage] = useState("0")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(false)
    try {
      const plan = await wealthAllocationTargetsRepository.load()
      setTargets(plan.targets)
      setTolerancePercentage(plan.tolerancePercentage ?? "0")
    } catch {
      setLoadError(true)
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

  const save = useCallback(
    async (nextTargets: WealthTarget[], nextTolerancePercentage: string) => {
      setIsSaving(true)
      setSaveError(false)
      try {
        await wealthAllocationTargetsRepository.replace(
          nextTargets,
          nextTolerancePercentage
        )
        setTargets(nextTargets)
        setTolerancePercentage(nextTolerancePercentage)
        return true
      } catch {
        setSaveError(true)
        return false
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  return {
    targets,
    tolerancePercentage,
    isLoading,
    isSaving,
    loadError,
    saveError,
    retry: load,
    save,
  }
}
