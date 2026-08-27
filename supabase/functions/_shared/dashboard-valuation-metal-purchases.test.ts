import { describe, expect, it } from "vitest"

import { multiplyDecimals } from "../../../src/lib/financial-calculations/decimal.ts"
import { normalizeDashboardValuationMetalPurchase } from "./dashboard-valuation-metal-purchases.ts"

describe("Dashboard valuation metal purchase normalization", () => {
  it.each([
    [10, "10"],
    ["10", "10"],
    [0.4, "0.4"],
    ["0.400", "0.400"],
  ])("normalizes grams %p to decimal string %p", (quantityGrams, expected) => {
    expect(normalizeDashboardValuationMetalPurchase({
      account_id: "account", purity: "24k", quantity_grams: quantityGrams,
    }).quantity_grams).toBe(expected)
  })

  it("keeps the metal valuation identical for number and string grams", () => {
    const numericGrams = normalizeDashboardValuationMetalPurchase({
      account_id: "account", purity: "24k", quantity_grams: 0.4,
    }).quantity_grams
    const stringGrams = normalizeDashboardValuationMetalPurchase({
      account_id: "account", purity: "24k", quantity_grams: "0.4",
    }).quantity_grams
    expect(multiplyDecimals(numericGrams, "500")).toBe("200")
    expect(multiplyDecimals(stringGrams, "500")).toBe("200")
  })
})
