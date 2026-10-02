import type { TypedSupabaseClient } from "../../lib/supabase/client"
import type { CurrentMarketPrice } from "./types"
import { bounded, chunks, positiveDecimal } from "../../../../../supabase/functions/_shared/market-reliability"

/** Caller-RLS reads only; never use the latest-price RPC's different precedence. */
export async function storedMarketPrices(client: TypedSupabaseClient, ids: readonly string[]) {
  const result = new Map<string, CurrentMarketPrice>()
  for (const batch of chunks(ids, 100)) {
    try {
      const { data: assets, error } = await bounded(2000, (signal) => client.from("assets")
        .select("id,currency_code").in("id", batch).eq("is_active", true).abortSignal(signal))
      if (error) continue
      for (const group of chunks(assets ?? [], 12)) await Promise.all(group.map(async (asset) => {
        const candidates = await Promise.all(["twelve_data", "manual"].map(async (provider) => {
          try {
            const { data, error } = await bounded(2000, (signal) => client.from("market_prices")
              .select("asset_id,provider,price::text,currency_code,as_of,fetched_at,price_type,user_id")
              .eq("asset_id", asset.id).eq("provider", provider).eq("currency_code", asset.currency_code)
              .gt("price", 0).lte("as_of", new Date().toISOString())
              .order("fetched_at", { ascending: false }).order("as_of", { ascending: false })
              .order("id", { ascending: false }).limit(1).abortSignal(signal).maybeSingle())
            const price = positiveDecimal(data?.price)
            if (error || !data || !price) return null
            const stale = provider === "manual" || data.price_type === "previous_close" || data.price_type === "stale" ||
              !(Date.now() - Date.parse(data.fetched_at) < 15 * 60 * 1000)
            return { assetId: data.asset_id, provider, price, currencyCode: data.currency_code,
              asOf: data.as_of, cachedAt: data.fetched_at, fetchedAt: data.fetched_at,
              priceType: stale && data.price_type !== "manual" && data.price_type !== "previous_close" ? "stale" : data.price_type,
              stale } as CurrentMarketPrice
          } catch { return null }
        }))
        const usable = candidates.find((price) => price !== null)
        if (usable) result.set(asset.id, usable)
      }))
    } catch { /* No usable authorized source remains. */ }
  }
  return result
}
