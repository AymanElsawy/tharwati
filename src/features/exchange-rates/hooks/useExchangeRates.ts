import { useCallback, useEffect, useRef, useState } from "react"

import { findCurrency, type CurrencyOption } from "@/features/onboarding/data/currencies"
import { managedExchangeRatesRepository } from "@/features/exchange-rates/repositories/exchange-rates.repository"
import type { ExchangeRateFormValues } from "@/features/exchange-rates/types/exchange-rate-form"
import type { StoredExchangeRate } from "@/services/exchange-rates/repository"

export function useExchangeRates() {
  const [rates, setRates] = useState<StoredExchangeRate[]>([])
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const mutation = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [nextRates, activeCurrencies] = await Promise.all([
        managedExchangeRatesRepository.list(),
        managedExchangeRatesRepository.listActiveCurrencies(),
      ])
      setRates(nextRates)
      setCurrencies(
        activeCurrencies.flatMap((currency) => {
          const option = findCurrency(currency.code)
          return option ? [option] : []
        }),
      )
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError : new Error("Rates could not be loaded"))
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

  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (mutation.current) return
    mutation.current = true
    setIsSaving(true)
    setError(null)
    try {
      await action()
      await load()
      window.dispatchEvent(new Event("tharwati:data-changed"))
    } catch (actionError) {
      const nextError =
        actionError instanceof Error ? actionError : new Error("Rate action failed")
      setError(nextError)
      throw nextError
    } finally {
      mutation.current = false
      setIsSaving(false)
    }
  }, [load])

  return {
    rates,
    currencies,
    error,
    isLoading,
    isSaving,
    refresh: load,
    clearError: () => setError(null),
    create: (values: ExchangeRateFormValues) =>
      run(() => managedExchangeRatesRepository.create(values)),
    update: (id: string, values: ExchangeRateFormValues) =>
      run(() => managedExchangeRatesRepository.update(id, values)),
    remove: (id: string) => run(() => managedExchangeRatesRepository.delete(id)),
  }
}
