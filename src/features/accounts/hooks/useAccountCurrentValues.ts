import { useCallback, useEffect, useRef, useState } from "react"

import { getAccountCurrentValues, type AccountCurrentValueStatus, type BrokerageCurrentValue } from "../services/account-values.service"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

/** Loads resolved account values without placing value-selection logic in a React component. */
export function useAccountCurrentValues(accounts: readonly AccountSummary[]) {
  const [values, setValues] = useState<Map<string, Decimal | null>>(new Map())
  const [isLoading, setIsLoading] = useState(accounts.length > 0)
  const [statuses, setStatuses] = useState<Map<string, AccountCurrentValueStatus>>(new Map())
  const [brokerageValues, setBrokerageValues] = useState<Map<string, BrokerageCurrentValue>>(new Map())
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
      const nextBrokerageValues = new Map<string, BrokerageCurrentValue>()
      const nextValues = await getAccountCurrentValues(accounts, (current) => {
        for (const [accountId, value] of current) nextBrokerageValues.set(accountId, value)
      })
      if (version === requestVersion.current) {
        setValues(nextValues)
        setStatuses(new Map([...nextBrokerageValues].map(([id, value]) => [id, value.status])))
        setBrokerageValues(nextBrokerageValues)
      }
    } catch {
      // Keep the last resolved values; callers preserve their existing fallback display.
    } finally {
      if (version === requestVersion.current) setIsLoading(false)
    }
  }, [accounts])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const reload = () => void refresh()
    window.addEventListener("tharwati:data-changed", reload)
    return () => window.removeEventListener("tharwati:data-changed", reload)
  }, [refresh])

  return { values, statuses, brokerageValues, isLoading, refresh }
}
