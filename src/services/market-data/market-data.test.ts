import { describe, expect, it, vi } from "vitest"

import type { TypedSupabaseClient } from "../../lib/supabase/client"
import { MarketDataError } from "./errors"
import { ManualMarketDataProvider } from "./provider"
import { MarketDataService } from "./service"

function priceReadClient(
  price: unknown,
): TypedSupabaseClient {
  const chain = {
    maybeSingle: vi.fn().mockResolvedValue({
      data: price,
      error: null,
    }),
  }
  return {
    rpc: vi.fn().mockReturnValue(chain),
  } as unknown as TypedSupabaseClient
}

const cachedPrice = {
  id: "price-id",
  asset_id: "asset-id",
  provider: "manual",
  price: 125.5,
  currency_code: "USD",
  as_of: "2026-07-24T09:00:00.000Z",
  created_at: "2026-07-24T09:01:00.000Z",
}

describe("MarketDataService", () => {
  it("returns the latest cached price without contacting a provider", async () => {
    const fetchCurrentPrices = vi.fn()
    const service = new MarketDataService({
      readClient: priceReadClient(cachedPrice),
      writeClient: priceReadClient(null),
      provider: {
        name: "test",
        fetchCurrentPrices,
      },
    })

    await expect(service.getCurrentPrice("asset-id")).resolves.toEqual({
      assetId: "asset-id",
      provider: "manual",
      price: "125.5",
      currencyCode: "USD",
      asOf: "2026-07-24T09:00:00.000Z",
      cachedAt: "2026-07-24T09:01:00.000Z",
    })
    const client = priceReadClient(cachedPrice)
    const directService = new MarketDataService({ readClient: client })
    await directService.getCurrentPrice("asset-id")
    expect(client.rpc).toHaveBeenCalledWith(
      "get_current_market_price",
      { p_asset_id: "asset-id" },
    )
    expect(fetchCurrentPrices).not.toHaveBeenCalled()
  })

  it("returns a typed unavailable error when cache and provider are absent", async () => {
    const service = new MarketDataService({
      readClient: priceReadClient(null),
    })
    await expect(
      service.getCurrentPrice("missing-asset"),
    ).rejects.toMatchObject({
      code: "market_price_unavailable",
      assetId: "missing-asset",
    } satisfies Partial<MarketDataError>)
  })

  it("manual provider returns prices only for requested assets", async () => {
    const provider = new ManualMarketDataProvider([
      {
        assetId: "requested",
        price: "10",
        currencyCode: "USD",
        asOf: "2026-07-24T09:00:00.000Z",
      },
      {
        assetId: "other",
        price: "20",
        currencyCode: "USD",
        asOf: "2026-07-24T09:00:00.000Z",
      },
    ])
    await expect(
      provider.fetchCurrentPrices([
        {
          id: "requested",
          assetTypeCode: "stock",
          name: "Requested",
          symbol: "REQ",
          exchange: "XNAS",
          currencyCode: "USD",
        },
      ]),
    ).resolves.toHaveLength(1)
  })
})
