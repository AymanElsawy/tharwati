import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { bounded, positiveDecimal } from "./market-reliability.ts"
import { mapWithConcurrency } from "./bounded-concurrency.ts"

/** Caller-RLS recovery for Dashboard's internal Edge transport boundary. */
export async function storedPrices(client: SupabaseClient, assets: { id: string; currency_code: string }[]) {
  return (await mapWithConcurrency(assets, 12, async (asset) => {
    const candidates = await Promise.all(["twelve_data", "manual"].map(async (provider) => {
      try {
        const { data, error } = await bounded(2000, (signal) => client.from("market_prices")
          .select("price::text,currency_code,as_of,fetched_at,price_type")
          .eq("asset_id", asset.id).eq("provider", provider).eq("currency_code", asset.currency_code)
          .gt("price", 0).lte("as_of", new Date().toISOString())
          .order("fetched_at", { ascending: false }).order("as_of", { ascending: false })
          .order("id", { ascending: false }).limit(1).abortSignal(signal).maybeSingle())
        const price = positiveDecimal(data?.price)
        if (error || !data || !price) return null
        return { assetId: asset.id, available: true, price, currencyCode: data.currency_code,
          provider, effectiveAt: data.as_of, fetchedAt: data.fetched_at, priceType: data.price_type,
          stale: provider === "manual" || data.price_type === "previous_close" || data.price_type === "stale" ||
            !(Date.now() - Date.parse(data.fetched_at) < 15 * 60 * 1000) }
      } catch { return null }
    }))
    return candidates.find((row) => row !== null) ?? null
  })).filter((row) => row !== null)
}
