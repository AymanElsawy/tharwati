import { useCallback, useEffect, useRef, useState } from "react"

import { getAccountCurrentValues, type AccountCurrentValueStatus, type BrokerageCurrentValue } from "../services/account-values.service"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { READ_DEADLINE_MS, readWithDeadline } from "@/lib/network/read-deadline"

/** Loads resolved account values without placing value-selection logic in a React component. */
export function useAccountCurrentValues(accounts: readonly AccountSummary[]) {
  const [values, setValues] = useState<Map<string, Decimal | null>>(new Map())
  const [isLoading, setIsLoading] = useState(accounts.length > 0)
  const [hasResolutionError, setHasResolutionError] = useState(false)
  const [statuses, setStatuses] = useState<Map<string, AccountCurrentValueStatus>>(new Map())
  const [brokerageValues, setBrokerageValues] = useState<Map<string, BrokerageCurrentValue>>(new Map())
  const requestVersion = useRef(0)
  const readAbort = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current
    readAbort.current?.abort()
    const controller = new AbortController()
    readAbort.current = controller
    if (accounts.length === 0) {
      setValues(new Map())
      setHasResolutionError(false)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const nextBrokerageValues = new Map<string, BrokerageCurrentValue>()
      const nextValues = await readWithDeadline(READ_DEADLINE_MS.composite,
        (signal) => getAccountCurrentValues(accounts, (current) => {
          if (signal.aborted) return
          for (const [accountId, value] of current) nextBrokerageValues.set(accountId, value)
        }), controller.signal)
      if (version === requestVersion.current) {
        setValues(nextValues)
        setStatuses(new Map([...nextBrokerageValues].map(([id, value]) => [id, value.status])))
        setBrokerageValues(nextBrokerageValues)
        setHasResolutionError(false)
      }
    } catch {
      if (version === requestVersion.current) setHasResolutionError(true)
    } finally {
      if (readAbort.current === controller) readAbort.current = null
      if (version === requestVersion.current) setIsLoading(false)
    }
  }, [accounts])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh])
  useEffect(() => () => {
    requestVersion.current += 1
    readAbort.current?.abort()
  }, [])
  useEffect(() => {
    const reload = () => void refresh()
    window.addEventListener("tharwati:data-changed", reload)
    return () => window.removeEventListener("tharwati:data-changed", reload)
  }, [refresh])

  return {
    values,
    statuses,
    brokerageValues,
    isLoading,
    hasResolutionError,
    refresh,
  }
}
