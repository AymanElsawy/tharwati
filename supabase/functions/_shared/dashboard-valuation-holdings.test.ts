import { describe, expect, it } from "vitest"

import { multiplyDecimals } from "../../../src/lib/financial-calculations/decimal.ts"
import { normalizeDashboardValuationHolding } from "./dashboard-valuation-holdings.ts"

describe("Dashboard valuation holding normalization", () => {
  it.each([
    [2, "2"],
    ["2", "2"],
    [0.4, "0.4"],
    ["0.4000000001", "0.4000000001"],
  ])("normalizes quantity %p to decimal string %p", (quantity, expected) => {
    expect(normalizeDashboardValuationHolding({
      account_id: "account", asset_id: "asset", quantity, asset: { currency_code: "USD", asset_type_code: "stock" },
    }).quantity).toBe(expected)
  })

  it("preserves Brokerage valuation inputs other than quantity", () => {
    const holding = normalizeDashboardValuationHolding({
      account_id: "account", asset_id: "asset", quantity: 1.25, asset: { currency_code: "SAR", asset_type_code: "stock" },
    })
    expect(holding).toEqual({
      account_id: "account", asset_id: "asset", quantity: "1.25", asset: { currency_code: "SAR", asset_type_code: "stock" },
    })
  })

  it("keeps the Brokerage market-value calculation identical for number and string quantities", () => {
    const numericQuantity = normalizeDashboardValuationHolding({
      account_id: "account", asset_id: "asset", quantity: 0.4, asset: { currency_code: "USD", asset_type_code: "stock" },
    }).quantity
    const stringQuantity = normalizeDashboardValuationHolding({
      account_id: "account", asset_id: "asset", quantity: "0.4", asset: { currency_code: "USD", asset_type_code: "stock" },
    }).quantity
    expect(multiplyDecimals("200", numericQuantity)).toBe("80")
    expect(multiplyDecimals("200", stringQuantity)).toBe("80")
  })
})
