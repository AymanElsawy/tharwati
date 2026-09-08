import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "../../lib/supabase/client"
import { ManualMarketDataProvider } from "./provider"
import { MarketDataService, parseMarketPricesResponse } from "./service"

function marketPriceClient(response: unknown): TypedSupabaseClient {
  return {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: response, error: null }),
    },
  } as unknown as TypedSupabaseClient
}

describe("MarketDataService", () => {
  it("uses the protected market-prices function and preserves Twelve Data provenance", async () => {
    const client = marketPriceClient({
      prices: [{
        assetId: "asset-aapl",
        available: true,
        provider: "twelve_data",
        price: 210.15,
        currencyCode: "USD",
        effectiveAt: "2026-08-07T14:30:00.000Z",
        fetchedAt: "2026-08-07T14:31:00.000Z",
        priceType: "realtime",
        stale: false,
      }],
    })
    const service = new MarketDataService({ readClient: client })

    await expect(service.getCurrentPrice("asset-aapl")).resolves.toMatchObject({
      provider: "twelve_data",
      price: "210.15",
      currencyCode: "USD",
      priceType: "realtime",
      stale: false,
    })
    expect(client.functions.invoke).toHaveBeenCalledWith("market-prices", {
      body: { assetIds: ["asset-aapl"] },
    })
  })

  it("rejects malformed or unavailable function results without fabricating a price", () => {
    const result = parseMarketPricesResponse([
      { assetId: "asset-aapl", available: true, provider: "twelve_data", price: 0, currencyCode: "USD", effectiveAt: "2026-08-07", fetchedAt: "2026-08-07", priceType: "realtime", stale: false },
      { assetId: "asset-voo", available: false, provider: null, price: null, currencyCode: null, effectiveAt: null, fetchedAt: null, priceType: null, stale: false },
    ], ["asset-aapl", "asset-voo"])
    expect(result.size).toBe(0)
  })

  it("manual provider remains an isolated test fixture", async () => {
    const provider = new ManualMarketDataProvider([{ assetId: "requested", price: "10", currencyCode: "USD", asOf: "2026-07-24T09:00:00.000Z" }])
    await expect(provider.fetchCurrentPrices([{ id: "requested", assetTypeCode: "stock", name: "Requested", symbol: "REQ", exchange: "XNAS", currencyCode: "USD" }])).resolves.toHaveLength(1)
  })
})
