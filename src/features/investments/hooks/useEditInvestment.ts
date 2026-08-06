import { useCallback, useState } from "react"
import { editInvestment, loadEditableInvestment } from "../services/edit-investment.service"
import type { EditInvestmentValues } from "../types/edit-investment"

export function useEditInvestment() {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const load = useCallback(async (id: string) => {
    setIsLoading(true); setError(null)
    try { return await loadEditableInvestment(id) }
    catch (cause) { const next = cause instanceof Error ? cause : new Error("Investment could not be loaded"); setError(next); throw next }
    finally { setIsLoading(false) }
  }, [])
  const save = useCallback(async (values: EditInvestmentValues) => {
    setIsSaving(true); setError(null)
    try { return await editInvestment(values) }
    catch (cause) { const next = cause instanceof Error ? cause : new Error("Investment could not be corrected"); setError(next); throw next }
    finally { setIsSaving(false) }
  }, [])
  return { load, save, isLoading, isSaving, error, clearError: () => setError(null) }
}
