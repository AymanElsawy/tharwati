import { useCallback, useEffect, useRef, useState } from "react"

import type { WealthTarget } from "../domain/wealth-target-allocation"
import { wealthAllocationTargetsRepository } from "../repositories/wealth-allocation-targets.repository"
import { LatestRequestGuard } from "@/features/portfolio/utils/latest-request"

export function useWealthAllocationTargets() {
  const [targets, setTargets] = useState<WealthTarget[]>([])
  const [tolerancePercentage, setTolerancePercentage] = useState("0")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const requestGuard = useRef(new LatestRequestGuard())
  const activeRead = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    activeRead.current?.abort()
    const controller = new AbortController()
    activeRead.current = controller
    const request = requestGuard.current.begin()
    setIsLoading(true)
    setLoadError(false)
    try {
      const plan = await wealthAllocationTargetsRepository.load(controller.signal)
      if (!requestGuard.current.isCurrent(request)) return
      setTargets(plan.targets)
      setTolerancePercentage(plan.tolerancePercentage ?? "0")
    } catch {
      if (!requestGuard.current.isCurrent(request)) return
      setLoadError(true)
    } finally {
      if (activeRead.current === controller) activeRead.current = null
      if (requestGuard.current.isCurrent(request)) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const guard = requestGuard.current
    async function initialize() {
      await load()
    }
    void initialize()
    return () => {
      activeRead.current?.abort()
      guard.begin()
    }
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
