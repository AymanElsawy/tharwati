import { useCallback, useState } from "react"

import { RepositoryError } from "../../../lib/supabase/types"
import { addInvestment } from "../services/add-investment.service"
import type {
  AddInvestmentResult,
  AddInvestmentValues,
} from "../types/add-investment"

export function useAddInvestment() {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<RepositoryError | null>(null)

  const submit = useCallback(async (values: AddInvestmentValues) => {
    if (isSaving) return null
    setIsSaving(true)
    setError(null)
    try {
      return await addInvestment(values)
    } catch (cause) {
      const nextError =
        cause instanceof RepositoryError
          ? cause
          : new RepositoryError({
              code: "database_error",
              message:
                cause instanceof Error
                  ? cause.message
                  : "Investment could not be saved",
              operation: "investments.addInvestment",
              cause,
            })
      setError(nextError)
      throw nextError
    } finally {
      setIsSaving(false)
    }
  }, [isSaving])

  return {
    error,
    isSaving,
    submit: submit as (
      values: AddInvestmentValues,
    ) => Promise<AddInvestmentResult | null>,
    clearError: () => setError(null),
  }
}
