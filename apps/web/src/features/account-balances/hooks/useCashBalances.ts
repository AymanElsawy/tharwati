import { useCallback, useEffect, useState } from "react"

import { accountBalancesService } from "@/features/account-balances/services/account-balances.service"
import type { CurrencyAccountBalance } from "@/features/account-balances/types/account-balance"

export function useCashBalances() {
  const [balances, setBalances] = useState<CurrencyAccountBalance[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setBalances(await accountBalancesService.getCashBalancesByCurrency())
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Cash balances are unavailable"),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initialize() {
      await load()
    }
    void initialize()
    const refresh = () => void load()
    window.addEventListener("tharwati:data-changed", refresh)
    return () =>
      window.removeEventListener("tharwati:data-changed", refresh)
  }, [load])

  return { balances, error, isLoading }
}
