import { describe, expect, it } from "vitest"

import { getBrokerageBuyPreview } from "./brokerage-buy.service"

describe("getBrokerageBuyPreview", () => {
  it("keeps same-currency amounts decimal-safe", () => {
    expect(getBrokerageBuyPreview({ quantity: "10", unitPrice: "100", fees: "5", accountFxRate: null })).toEqual({ purchaseAmount: "1000", fees: "5", assetTotal: "1005", accountTotal: "1005" })
  })

  it("uses the supplied historical rate only for the account-currency preview", () => {
    expect(getBrokerageBuyPreview({ quantity: "10", unitPrice: "120", fees: "2", accountFxRate: "3.75" })).toEqual({ purchaseAmount: "1200", fees: "2", assetTotal: "1202", accountTotal: "4507.5" })
  })
})
