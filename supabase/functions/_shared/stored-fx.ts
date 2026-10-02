import type { SupabaseClient } from "npm:@supabase/supabase-js@2"
import { bounded, inverseDecimal, positiveDecimal } from "./market-reliability.ts"

/** Same source order as resolve_historical_exchange_rate, with text-cast decimals. */
export async function storedFxCandidates(client: SupabaseClient, from: string, to: string, at: string, userId?: string) {
  return await Promise.all([
    [from, to, "frankfurter", "direct"], [to, from, "frankfurter", "inverse"],
    [from, to, "manual", "direct"], [to, from, "manual", "inverse"],
  ].map(async ([base, quote, source, direction]) => {
    try {
      let query = client.from("exchange_rates").select("rate::text,effective_at,fetched_at,source")
        .eq("base_currency_code", base).eq("quote_currency_code", quote).lte("effective_at", at)
      query = source === "manual" ? query.is("provider", null) : query.eq("provider", source).is("user_id", null)
      if (source === "manual" && userId) query = query.eq("user_id", userId)
      const { data, error } = await bounded(2000, (signal) => query
        .order("effective_at", { ascending: false }).order("id", { ascending: false })
        .limit(1).abortSignal(signal).maybeSingle())
      if (error) throw error
      const decimal = positiveDecimal(data?.rate)
      if (!decimal) return null
      const rate = direction === "inverse" ? inverseDecimal(decimal) : decimal
      return rate ? { available: true as const, rate, provider: data.source ?? (source === "manual" ? "manual" : "frankfurter"),
        effectiveAt: data.effective_at, fetchedAt: data.fetched_at,
        stale: true, unavailable: false as const, direction: direction as "direct" | "inverse" } : null
    } catch {
      return null
    }
  }))
}
