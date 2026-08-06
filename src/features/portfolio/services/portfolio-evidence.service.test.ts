import { describe, expect, it } from "vitest"

import { PortfolioEvidenceService } from "@/features/portfolio/services/portfolio-evidence.service"
import type { PortfolioHoldingEvidence } from "@/features/portfolio/types/portfolio-evidence"

function holding(
  id: string,
  overrides: Partial<PortfolioHoldingEvidence> = {},
): PortfolioHoldingEvidence {
  return {
    id,
    assetId: `asset-${id}`,
    assetName: id,
    symbol: id.toUpperCase(),
    assetClass: "stock",
    accountId: "account-a",
    accountName: "Brokerage",
    quantity: "1",
    unit: "shares",
    averageCost: "1",
    totalCostBasis: "1",
    costCurrency: "USD",
    currentPrice: "1",
    priceCurrency: "USD",
    priceTimestamp: "2026-07-27T00:00:00Z",
    priceSource: "manual",
    marketValueBase: "1",
    unrealizedGainLossBase: "0",
    returnPercent: "0",
    dataQuality: "complete",
    ...overrides,
  }
}

describe("PortfolioEvidenceService", () => {
  const service = new PortfolioEvidenceService()

  it("searches and applies exact inherited contributor filters", () => {
    const result = service.filterHoldings(
      [holding("Alpha"), holding("Beta")],
      {
        search: "alpha",
        accountId: null,
        assetClass: null,
        contributorIds: new Set(["Alpha"]),
        sort: "asset",
        direction: "asc",
      },
    )
    expect(result.map((item) => item.id)).toEqual(["Alpha"])
  })

  it("sorts decimal evidence beyond JavaScript safe integer precision", () => {
    const result = service.filterHoldings(
      [
        holding("a", { marketValueBase: "9007199254740993.0000000001" }),
        holding("b", { marketValueBase: "9007199254740993.0000000002" }),
      ],
      {
        search: "",
        accountId: null,
        assetClass: null,
        contributorIds: null,
        sort: "market_value",
        direction: "desc",
      },
    )
    expect(result.map((item) => item.id)).toEqual(["b", "a"])
  })

  it("keeps missing prices explicit and sorts null values last", () => {
    const result = service.filterHoldings(
      [
        holding("missing", {
          marketValueBase: null,
          currentPrice: null,
          dataQuality: "missing_price",
        }),
        holding("valued", { marketValueBase: "0" }),
      ],
      {
        search: "",
        accountId: null,
        assetClass: null,
        contributorIds: null,
        sort: "market_value",
        direction: "asc",
      },
    )
    expect(result.map((item) => item.id)).toEqual(["valued", "missing"])
    expect(result[1].dataQuality).toBe("missing_price")
  })

  it("filters posted activity only through explicit account and asset links", () => {
    const activity = [
      {
        id: "one",
        type: "buy",
        description: "Buy",
        occurredAt: "",
        postedAt: "",
        currency: "USD",
        amount: "1",
        accountIds: ["account-a"],
        assetIds: ["asset-a"],
        entries: [],
      },
      {
        id: "two",
        type: "fee",
        description: "Fee",
        occurredAt: "",
        postedAt: "",
        currency: "USD",
        amount: "1",
        accountIds: ["account-b"],
        assetIds: [],
        entries: [],
      },
    ]
    expect(
      service
        .filterActivity(activity, {
          type: "buy",
          accountId: "account-a",
          assetIds: new Set(["asset-a"]),
        })
        .map((item) => item.id),
    ).toEqual(["one"])
  })

  it("keeps investment and projected cash separate and calculates exact account shares", () => {
    const rows = service.buildCustody({
      holdings: [
        holding("a", {
          accountId: "account-a",
          marketValueBase: "9007199254740993.1",
        }),
        holding("b", {
          accountId: "account-b",
          accountName: "Second",
          marketValueBase: "100",
        }),
      ],
      balances: [
        {
          accountId: "account-a",
          accountTypeCode: "brokerage",
          accountName: "Brokerage",
          currencyCode: "USD",
          isActive: true,
          openingBalance: "50",
          ledgerEffect: "0",
          currentBalance: "50",
        },
        {
          accountId: "account-b",
          accountTypeCode: "brokerage",
          accountName: "Second",
          currencyCode: "USD",
          isActive: true,
          openingBalance: "0",
          ledgerEffect: "0",
          currentBalance: "0",
        },
      ],
      cashBase: new Map([
        ["account-a", "50"],
        ["account-b", "0"],
      ]),
      baseCurrency: "USD",
    })
    expect(rows[0]).toMatchObject({
      investmentValueBase: "9007199254740993.1",
      projectedCashOriginal: "50",
      projectedCashBase: "50",
      totalContributionBase: "9007199254741043.1",
    })
    expect(rows.every((row) => row.percentage !== null)).toBe(true)
  })
})
