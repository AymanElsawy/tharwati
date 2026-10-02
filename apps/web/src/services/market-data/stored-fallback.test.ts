import { describe, expect, it, vi } from "vitest"
import { createClient } from "@supabase/supabase-js"
import type { TypedSupabaseClient } from "../../lib/supabase/client"
import { MarketDataService } from "./service"

describe("Web persisted recovery after Edge service failure", () => {
  it.each(["twelve_data", "manual"])("recovers exact %s price with stale provenance", async (provider) => {
    const transport = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.pathname.startsWith("/functions/")) return new Response("fixture service unavailable", { status: 503 })
      const rows = url.pathname.endsWith("/assets") ? [{ id: "asset", currency_code: "USD" }]
        : url.searchParams.get("provider") === `eq.${provider}` ? [{
          asset_id: "asset", provider, price: "123.1234567890", currency_code: "USD", as_of: "2026-01-01T00:00:00Z",
          fetched_at: "2026-01-01T00:00:00Z", price_type: provider === "manual" ? "manual" : "realtime",
        }] : []
      // maybeSingle accepts array responses, as does local PostgREST.
      return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } })
    })
    const client = createClient("http://127.0.0.1:58321", "fixture-only", {
      global: { fetch: transport }, auth: { persistSession: false, autoRefreshToken: false },
    }) as TypedSupabaseClient
    const prices = await new MarketDataService({ readClient: client }).getCurrentPrices(["asset"])
    expect(prices).toHaveLength(1)
    expect(prices[0]).toMatchObject({ provider, price: "123.1234567890", stale: true,
      priceType: provider === "manual" ? "manual" : "stale" })
    expect(transport.mock.calls.some(([input]) => String(input).includes("price%3A%3Atext"))).toBe(true)
  })
})
