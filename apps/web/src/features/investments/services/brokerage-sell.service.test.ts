import { describe, expect, it } from "vitest"

import { getBrokerageSellPreview } from "./brokerage-sell.service"

describe("getBrokerageSellPreview", () => {
  it("uses normalized asset-currency components for same-currency proceeds", () => {
    expect(getBrokerageSellPreview({ quantity: "2", unitSalePrice: "100", fees: "5", accountFxRate: null })).toEqual({
      grossProceeds: "200", fees: "5", netAssetProceeds: "195", estimatedNetCashProceeds: "195",
    })
  })

  it("converts and rounds gross and fees separately before subtracting", () => {
    expect(getBrokerageSellPreview({ quantity: "10", unitSalePrice: "120", fees: "2", accountFxRate: "3.75" })).toEqual({
      grossProceeds: "1200", fees: "2", netAssetProceeds: "1198", estimatedNetCashProceeds: "4492.5",
    })
  })

  it("matches the ledger's component rounding at 10 decimal places", () => {
    expect(getBrokerageSellPreview({ quantity: "1", unitSalePrice: "0.00000000006", fees: "0.00000000005", accountFxRate: "1" })).toEqual({
      grossProceeds: "0.0000000001", fees: "0.0000000001", netAssetProceeds: "0", estimatedNetCashProceeds: "0",
    })
  })
})
