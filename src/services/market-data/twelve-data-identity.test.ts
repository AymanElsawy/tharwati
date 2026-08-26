import { describe, expect, it } from "vitest"

import { resolveTwelveDataInstrument } from "../../../supabase/functions/_shared/twelve-data-identity"

describe("resolveTwelveDataInstrument", () => {
  it.each([
    ["NVDA", "twelve_data:XNGS", "NVDA", "XNGS"],
    ["VOO", "twelve_data:ARCX", "VOO", "ARCX"],
  ])("resolves %s through its persisted Twelve Data identity", (symbol, namespace, value, micCode) => {
    expect(resolveTwelveDataInstrument(
      { id: "asset-1", symbol },
      [{ asset_id: "asset-1", namespace, normalized_value: value }],
    )).toEqual({ assetId: "asset-1", symbol, micCode })
  })

  it("rejects missing, malformed, or mismatched persisted provider identities", () => {
    const asset = { id: "asset-1", symbol: "NVDA" }

    expect(resolveTwelveDataInstrument(asset, [])).toBeNull()
    expect(resolveTwelveDataInstrument(asset, [
      { asset_id: "asset-1", namespace: "twelve_data:XNGS", normalized_value: "VOO" },
    ])).toBeNull()
    expect(resolveTwelveDataInstrument(asset, [
      { asset_id: "asset-1", namespace: "twelve_data:NASDAQ", normalized_value: "NVDA" },
    ])).toBeNull()
  })

  it("uses a valid matching identity when an asset has more than one provider identifier", () => {
    expect(resolveTwelveDataInstrument(
      { id: "asset-1", symbol: "NVDA" },
      [
        { asset_id: "asset-1", namespace: "twelve_data:XNGS", normalized_value: "VOO" },
        { asset_id: "asset-1", namespace: "twelve_data:XNGS", normalized_value: "NVDA" },
      ],
    )).toEqual({ assetId: "asset-1", symbol: "NVDA", micCode: "XNGS" })
  })
})
