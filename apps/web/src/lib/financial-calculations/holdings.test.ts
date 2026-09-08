import { describe, expect, it } from "vitest"

import {
  calculateHoldingFinancials,
  calculatePortfolioCostBasisByCurrency,
  getOpenHoldings,
} from "./holdings"
import { validateQuantity } from "./quantities"
import type { HoldingCalculationInput } from "./types"

const holdings: HoldingCalculationInput[] = [
  {
    id: "usd-one",
    quantity: "31.0000000000",
    averageCost: "100.6451612903",
    totalCostBasis: "3120.0000000000",
    costCurrencyCode: "USD",
  },
  {
    id: "usd-two",
    quantity: "5",
    averageCost: "101",
    totalCostBasis: "505",
    costCurrencyCode: "USD",
  },
  {
    id: "closed",
    quantity: "0",
    averageCost: null,
    totalCostBasis: "0",
    costCurrencyCode: "SAR",
  },
]

describe("financial calculations", () => {
  it("exposes database-derived holding financial values", () => {
    expect(calculateHoldingFinancials(holdings[0])).toEqual({
      holdingId: "usd-one",
      quantity: "31",
      averageCost: "100.6451612903",
      totalCostBasis: "3120",
      costCurrencyCode: "USD",
      isOpen: true,
    })
  })

  it("returns open holdings only", () => {
    expect(getOpenHoldings(holdings).map((holding) => holding.holdingId))
      .toEqual(["usd-one", "usd-two"])
  })

  it("groups cost basis exactly without mixing currencies", () => {
    expect(calculatePortfolioCostBasisByCurrency(holdings)).toEqual([
      {
        currencyCode: "USD",
        totalCostBasis: "3625",
        holdingCount: 2,
      },
    ])
  })

  it("validates quantity sign, zero, and scale", () => {
    expect(validateQuantity("1.2500")).toEqual({
      valid: true,
      normalized: "1.25",
    })
    expect(validateQuantity("0")).toEqual({
      valid: false,
      reason: "zero",
    })
    expect(validateQuantity("-1")).toEqual({
      valid: false,
      reason: "negative",
    })
    expect(validateQuantity("1.234", { maximumScale: 2 })).toEqual({
      valid: false,
      reason: "scale_exceeded",
    })
  })
})
