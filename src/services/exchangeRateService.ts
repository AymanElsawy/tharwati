import { supabase } from "@/lib/supabase"

export type ResolvedFxRate = {
  rate: number
  provider: "frankfurter" | "identity"
  effectiveAt: string
  fetchedAt: string
  stale: boolean
  unavailable: boolean
}

export async function getExchangeRate(
  fromCurrencyCode: string,
  toCurrencyCode: string,
  options: { requestedDate?: string; historical?: boolean } = {},
): Promise<ResolvedFxRate | null> {
  const { data, error } = await supabase.functions.invoke<ResolvedFxRate>(
    "fx-rates",
    {
      body: {
        fromCurrencyCode: fromCurrencyCode.trim().toUpperCase(),
        toCurrencyCode: toCurrencyCode.trim().toUpperCase(),
        mode: options.historical ? "historical" : "current",
        requestedDate: options.requestedDate,
      },
    },
  )
  if (error) {
    console.error("Unable to resolve Frankfurter exchange rate", error)
    return null
  }
  if (!data || data.unavailable || !Number.isFinite(data.rate) || data.rate <= 0) {
    return null
  }
  return data
}

export async function convertCurrency(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
): Promise<number | null> {
  const resolved = await getExchangeRate(fromCurrencyCode, toCurrencyCode)
  return resolved ? amount * resolved.rate : null
}
