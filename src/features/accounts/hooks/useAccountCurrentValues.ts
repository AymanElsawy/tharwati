import { useCallback, useEffect, useRef, useState } from "react"

import { getAccountCurrentValues } from "../services/account-values.service"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

/** Loads resolved account values without placing value-selection logic in a React component. */
export function useAccountCurrentValues(accounts: readonly AccountSummary[]) {
  const [values, setValues] = useState<Map<string, Decimal | null>>(new Map())
  const [isLoading, setIsLoading] = useState(accounts.length > 0)
  const requestVersion = useRef(0)

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    if (accounts.length === 0) {
      setValues(new Map())
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const nextValues = await getAccountCurrentValues(accounts)
      if (version === requestVersion.current) setValues(nextValues)
    } catch {
      // Keep the last resolved values; callers preserve their existing fallback display.
    } finally {
      if (version === requestVersion.current) setIsLoading(false)
    }
  }, [accounts])

  useEffect(() => { void refresh() }, [refresh])

  return { values, isLoading, refresh }
}
