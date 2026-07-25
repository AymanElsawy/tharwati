import { describe, expect, it } from "vitest"

import { addDecimals } from "./decimal"
import type { HoldingValuationInput } from "./types"
import {
  calculateHoldingMarketValue,
  calculateHoldingPerformance,
  calculatePortfolioAllocation,
  calculatePortfolioMarketValue,
  calculatePortfolioPerformance,
} from "./valuation"

function holding(
  overrides: Partial<HoldingValuationInput> = {},
): HoldingValuationInput {
  return {
    id: "holding-one",
    quantity: "10",
    averageCost: "80",
    totalCostBasis: "800",
    costCurrencyCode: "USD",
    marketPrice: {
      price: "100",
      currencyCode: "USD",
      asOf: "2026-07-24T12:00:00.000Z",
    },
    ...overrides,
  }
}

describe("holding valuation", () => {
  it("calculates a profitable holding", () => {
    expect(calculateHoldingPerformance(holding())).toMatchObject({
      currentMarketPrice: "100",
      marketValue: "1000",
      totalCostBasis: "800",
      unrealizedGainLoss: "200",
      unrealizedReturnPercentage: "25",
    })
  })

  it("calculates a losing holding", () => {
    expect(
      calculateHoldingPerformance(
        holding({
          averageCost: "120",
          totalCostBasis: "1200",
        }),
      ),
    ).toMatchObject({
      marketValue: "1000",
      unrealizedGainLoss: "-200",
      unrealizedReturnPercentage: "-16.66666667",
    })
  })

  it("returns a typed zero cost-basis error", () => {
    expect(() =>
      calculateHoldingPerformance(
        holding({ averageCost: null, totalCostBasis: "0" }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "zero_cost_basis" }),
    )
  })

  it("returns a typed missing-price error", () => {
    expect(() =>
      calculateHoldingMarketValue(holding({ marketPrice: null })),
    ).toThrowError(
      expect.objectContaining({
        code: "market_price_unavailable",
      }),
    )
  })

  it("returns a typed currency mismatch error", () => {
    expect(() =>
      calculateHoldingMarketValue(
        holding({
          marketPrice: {
            price: "100",
            currencyCode: "SAR",
            asOf: "2026-07-24T12:00:00.000Z",
          },
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "currency_mismatch" }),
    )
  })
})

describe("portfolio valuation", () => {
  const portfolio = [
    holding(),
    holding({
      id: "holding-two",
      quantity: "20",
      averageCost: "60",
      totalCostBasis: "1200",
      marketPrice: {
        price: "50",
        currencyCode: "USD",
        asOf: "2026-07-24T12:00:00.000Z",
      },
    }),
  ]

  it("calculates exact portfolio totals", () => {
    expect(calculatePortfolioMarketValue(portfolio)).toMatchObject({
      currencyCode: "USD",
      totalMarketValue: "2000",
      totalCostBasis: "2000",
    })
    expect(calculatePortfolioPerformance(portfolio)).toMatchObject({
      totalUnrealizedGainLoss: "0",
      totalReturnPercentage: "0",
    })
  })

  it("calculates allocations that total 100 percent", () => {
    const result = calculatePortfolioAllocation(portfolio)
    expect(result.allocations).toEqual([
      {
        holdingId: "holding-one",
        marketValue: "1000",
        allocationPercentage: "50",
      },
      {
        holdingId: "holding-two",
        marketValue: "1000",
        allocationPercentage: "50",
      },
    ])
    expect(
      result.allocations.reduce(
        (total, allocation) =>
          addDecimals(total, allocation.allocationPercentage) ?? "",
        "0",
      ),
    ).toBe("100")
  })

  it("rejects an empty allocation portfolio", () => {
    expect(() => calculatePortfolioAllocation([])).toThrowError(
      expect.objectContaining({ code: "empty_portfolio" }),
    )
  })

  it("rejects one zero-value holding", () => {
    expect(() =>
      calculatePortfolioAllocation([
        holding({ quantity: "0", totalCostBasis: "0" }),
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "zero_market_value" }),
    )
  })

  it("rejects multiple zero-value holdings", () => {
    expect(() =>
      calculatePortfolioAllocation([
        holding({ quantity: "0", totalCostBasis: "0" }),
        holding({
          id: "holding-two",
          quantity: "0",
          totalCostBasis: "0",
        }),
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "zero_market_value" }),
    )
  })

  it("rejects holdings that would produce a negative market value", () => {
    expect(() =>
      calculatePortfolioAllocation([
        holding({ quantity: "-1" }),
      ]),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_quantity" }),
    )
  })

  it("keeps zero-value holdings at zero allocation", () => {
    expect(
      calculatePortfolioAllocation([
        holding(),
        holding({
          id: "holding-zero",
          quantity: "0",
          totalCostBasis: "0",
        }),
      ]).allocations,
    ).toEqual([
      {
        holdingId: "holding-one",
        marketValue: "1000",
        allocationPercentage: "100",
      },
      {
        holdingId: "holding-zero",
        marketValue: "0",
        allocationPercentage: "0",
      },
    ])
  })

  it("assigns deterministic residual rounding to the last positive holding", () => {
    const result = calculatePortfolioAllocation([
      holding({
        id: "holding-one",
        quantity: "1",
        totalCostBasis: "1",
        marketPrice: {
          price: "1",
          currencyCode: "USD",
          asOf: "2026-07-24T12:00:00.000Z",
        },
      }),
      holding({
        id: "holding-two",
        quantity: "1",
        totalCostBasis: "1",
        marketPrice: {
          price: "1",
          currencyCode: "USD",
          asOf: "2026-07-24T12:00:00.000Z",
        },
      }),
      holding({
        id: "holding-three",
        quantity: "1",
        totalCostBasis: "1",
        marketPrice: {
          price: "1",
          currencyCode: "USD",
          asOf: "2026-07-24T12:00:00.000Z",
        },
      }),
      holding({
        id: "holding-zero",
        quantity: "0",
        totalCostBasis: "0",
      }),
    ])

    expect(
      result.allocations.map(
        ({ holdingId, allocationPercentage }) => ({
          holdingId,
          allocationPercentage,
        }),
      ),
    ).toEqual([
      {
        holdingId: "holding-one",
        allocationPercentage: "33.33333333",
      },
      {
        holdingId: "holding-two",
        allocationPercentage: "33.33333333",
      },
      {
        holdingId: "holding-three",
        allocationPercentage: "33.33333334",
      },
      {
        holdingId: "holding-zero",
        allocationPercentage: "0",
      },
    ])
    expect(
      result.allocations.reduce(
        (total, allocation) =>
          addDecimals(total, allocation.allocationPercentage) ?? "",
        "0",
      ),
    ).toBe("100")
  })
})
