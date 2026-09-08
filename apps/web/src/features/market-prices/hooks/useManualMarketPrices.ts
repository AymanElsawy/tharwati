import { useCallback, useEffect, useRef, useState } from "react"

import { manualMarketPricesRepository } from "@/features/market-prices/repositories/manual-market-prices.repository"
import type {
  ManualMarketPrice,
  ManualMarketPriceInput,
} from "@/features/market-prices/types/manual-market-price"
import type { AssetSummary } from "@/lib/supabase/types"

export function useManualMarketPrices() {
  const [prices, setPrices] = useState<ManualMarketPrice[]>([])
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const result =
        await manualMarketPricesRepository.getConfiguration()
      setPrices(result.prices)
      setAssets(result.assets)
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Market prices are unavailable"),
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
  }, [load])

  const save = useCallback(
    async (id: string | null, input: ManualMarketPriceInput) => {
      if (saving.current) return
      saving.current = true
      setIsSaving(true)
      setError(null)
      try {
        if (id) {
          await manualMarketPricesRepository.update(id, input)
        } else {
          await manualMarketPricesRepository.create(input)
        }
        await load()
        window.dispatchEvent(new Event("tharwati:data-changed"))
      } catch (cause) {
        const nextError =
          cause instanceof Error
            ? cause
            : new Error("Market price could not be saved.")
        setError(nextError)
        throw nextError
      } finally {
        saving.current = false
        setIsSaving(false)
      }
    },
    [load],
  )

  return {
    assets,
    prices,
    error,
    isLoading,
    isSaving,
    refresh: load,
    save,
  }
}
