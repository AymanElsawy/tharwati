import { describe, expect, it, vi } from "vitest"

import {
  AssetSearchService,
  AssetSearchUnavailableError,
  AssetResolutionError,
  normalizeAssetSearchQuery,
  parseAssetSearchResponse,
  rankAssetSearchResults,
} from "./asset-search.service"

const result = {
  symbol: "NVDA",
  name: "NVIDIA Corporation",
  micCode: "XNAS",
  exchange: "NASDAQ",
  country: "United States",
  currencyCode: "USD",
  instrumentType: "Common Stock",
  provider: "twelve_data" as const,
}

describe("AssetSearchService", () => {
  it("normalizes a query before invoking the protected function", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { available: true, results: [result] }, error: null })
    const service = new AssetSearchService({ functions: { invoke } } as never)

    await expect(service.search("  nvda   corporation ")).resolves.toEqual([result])
    expect(invoke).toHaveBeenCalledWith("asset-search", {
      body: { query: "nvda corporation" },
    })
  })

  it("does not call the provider for a short query", async () => {
    const invoke = vi.fn()
    const service = new AssetSearchService({ functions: { invoke } } as never)

    await expect(service.search("n")).resolves.toEqual([])
    expect(invoke).not.toHaveBeenCalled()
  })

  it("ranks exact ticker matches ahead of alternate listings", () => {
    const alternateListing = { ...result, symbol: "NVDA.MX", micCode: "XMEX", exchange: "BMV" }

    expect(rankAssetSearchResults([alternateListing, result], "nvda")).toEqual([
      result,
      alternateListing,
    ])
  })

  it("keeps provider order for a name search without promoting a ticker", () => {
    const providerFirst = { ...result, symbol: "4NVDA", micCode: "XMIL", exchange: "MTA" }

    expect(rankAssetSearchResults([providerFirst, result], "NVIDIA")).toEqual([
      providerFirst,
      result,
    ])
  })

  it("preserves provider relevance order within the same ranking tier and rejects malformed values", () => {
    const secondExactMatch = { ...result, micCode: "IEXG", exchange: "IEX" }

    expect(rankAssetSearchResults([result, secondExactMatch], "NVDA")).toEqual([
      result,
      secondExactMatch,
    ])
    expect(parseAssetSearchResponse({
      available: true,
      results: [result, { ...result, symbol: "", name: "Invalid" }],
    })).toEqual([result])
    expect(normalizeAssetSearchQuery("  VOO\tETF ")).toBe("VOO ETF")
  })

  it("exposes an unavailable provider as a typed error", () => {
    expect(() => parseAssetSearchResponse({ available: false, results: [] }))
      .toThrow(AssetSearchUnavailableError)
  })

  it("resolves a selected provider result through the authenticated RPC", async () => {
    const asset = {
      id: "asset-1",
      user_id: "user-1",
      asset_type_code: "stock",
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      currency_code: "USD",
      exchange: "NASDAQ",
      is_custom: true,
      is_active: true,
      canonical_quantity_unit: "shares",
      created_at: "2026-08-25T00:00:00Z",
      updated_at: "2026-08-25T00:00:00Z",
    }
    const rpc = vi.fn().mockResolvedValue({ data: asset, error: null })
    const service = new AssetSearchService({ rpc } as never)

    await expect(service.resolve(result)).resolves.toEqual(asset)
    expect(rpc).toHaveBeenCalledWith("resolve_external_brokerage_asset", {
      p_symbol: "NVDA",
      p_name: "NVIDIA Corporation",
      p_mic_code: "XNAS",
      p_display_exchange: "NASDAQ",
      p_country: "United States",
      p_currency_code: "USD",
      p_instrument_type: "Common Stock",
    })
  })

  it("surfaces provider asset resolution failures without creating a holding", async () => {
    const service = new AssetSearchService({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "conflict" } }),
    } as never)

    await expect(service.resolve(result)).rejects.toBeInstanceOf(AssetResolutionError)
  })
})
