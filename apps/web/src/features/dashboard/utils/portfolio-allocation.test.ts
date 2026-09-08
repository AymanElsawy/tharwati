import { describe, expect, it } from "vitest"

import { addDecimals } from "@/lib/financial-calculations/decimal"
import { getDashboardPortfolioAllocationItems } from "./portfolio-allocation"

const complete = {
  status: "complete" as const,
  holdings: [
    { assetId: "stock-a", assetTypeCode: "stock", marketValueBaseCurrency: "10" },
    { assetId: "stock-b", assetTypeCode: "stock", marketValueBaseCurrency: "5" },
    { assetId: "etf", assetTypeCode: "etf", marketValueBaseCurrency: "20" },
    { assetId: "bond", assetTypeCode: "bond", marketValueBaseCurrency: "15" },
    { assetId: "fund", assetTypeCode: "mutual_fund", marketValueBaseCurrency: "25" },
    { assetId: "crypto", assetTypeCode: "cryptocurrency", marketValueBaseCurrency: "10" },
    { assetId: "other", assetTypeCode: "commodity", marketValueBaseCurrency: "5" },
  ],
}

describe("Dashboard portfolio allocation", () => {
  it("aggregates valued holdings from multiple Brokerage accounts by asset type", () => {
    const items = getDashboardPortfolioAllocationItems(complete, "USD")
    expect(items.map((item) => [item.group, item.value])).toEqual([
      ["stocks", "15"], ["etfs", "20"], ["bonds", "15"], ["mutualFunds", "25"], ["cryptocurrency", "10"], ["other", "5"],
    ])
  })

  it("uses base-currency snapshot values and excludes cash or non-Brokerage values not present in the payload", () => {
    const items = getDashboardPortfolioAllocationItems({
      ...complete,
      holdings: [
        { assetId: "usd-stock", assetTypeCode: "stock", marketValueBaseCurrency: "10" },
        { assetId: "eur-etf", assetTypeCode: "etf", marketValueBaseCurrency: "12.5" },
      ],
    }, "USD")
    expect(items.map((item) => item.value)).toEqual(["10", "12.5"])
    expect(items.map((item) => item.group)).not.toContain("cash")
  })

  it("assigns all positive holdings an exact 100 percent total", () => {
    const total = getDashboardPortfolioAllocationItems(complete, "USD").reduce(
      (sum, item) => addDecimals(sum, item.percentage) ?? sum,
      "0",
    )
    expect(total).toBe("100")
  })

  it("returns no allocation for incomplete holding valuation", () => {
    expect(getDashboardPortfolioAllocationItems({ ...complete, status: "incomplete" }, "USD")).toEqual([])
  })
})
