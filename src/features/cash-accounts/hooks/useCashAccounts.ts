import { useCallback, useEffect, useRef, useState } from "react"

import { findCurrency, type CurrencyOption } from "@/features/onboarding/data/currencies"
import {
  cashAccountsRepository,
  type SaveCashAccountInput,
} from "@/features/cash-accounts/repositories/cash-accounts.repository"
import type { CashAccountFormValues } from "@/features/cash-accounts/types/cash-account-form"
import type { AccountSummary } from "@/lib/supabase/types"
import { RepositoryError } from "@/lib/supabase/types"

function normalizeError(error: unknown, operation: string) {
  return error instanceof RepositoryError
    ? error
    : new RepositoryError({
        code: "database_error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        operation,
        cause: error,
      })
}

function toInput(values: CashAccountFormValues): SaveCashAccountInput {
  const notes = values.notes.trim()
  return {
    name: values.name.trim(),
    currencyCode: values.currencyCode,
    balance: values.balance.trim(),
    notes: notes || null,
  }
}

export function useCashAccounts() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [baseCurrencyCode, setBaseCurrencyCode] = useState("")
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([])
  const [error, setError] = useState<RepositoryError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const mutationInFlight = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [nextAccounts, configuration] = await Promise.all([
        cashAccountsRepository.getCashAccounts(),
        cashAccountsRepository.getConfiguration(),
      ])
      setAccounts(nextAccounts)
      setBaseCurrencyCode(configuration.baseCurrencyCode)
      setCurrencyOptions(
        configuration.currencies.flatMap((currency) => {
          const option = findCurrency(currency.code)
          return option ? [option] : []
        }),
      )
      setError(null)
    } catch (loadError) {
      setError(normalizeError(loadError, "cashAccounts.load"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    async function initializeCashAccounts() {
      await load()
    }

    void initializeCashAccounts()
  }, [load])

  const mutate = useCallback(
    async (operation: string, action: () => Promise<unknown>) => {
      if (mutationInFlight.current) return
      mutationInFlight.current = true
      setIsSaving(true)
      setError(null)
      try {
        await action()
        await load()
      } catch (mutationError) {
        const nextError = normalizeError(mutationError, operation)
        setError(nextError)
        throw nextError
      } finally {
        mutationInFlight.current = false
        setIsSaving(false)
      }
    },
    [load],
  )

  return {
    accounts,
    baseCurrencyCode,
    currencyOptions,
    error,
    isLoading,
    isSaving,
    refresh: load,
    clearError: () => setError(null),
    createAccount: (values: CashAccountFormValues) =>
      mutate("cashAccounts.create", () => cashAccountsRepository.create(toInput(values))),
    updateAccount: (id: string, values: CashAccountFormValues) =>
      mutate("cashAccounts.update", () =>
        cashAccountsRepository.update(id, toInput(values)),
      ),
    deleteAccount: (id: string) =>
      mutate("cashAccounts.delete", () => cashAccountsRepository.delete(id)),
  }
}
