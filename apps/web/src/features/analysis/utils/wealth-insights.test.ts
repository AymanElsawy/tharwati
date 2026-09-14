import { describe, expect, it } from "vitest"

import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import { en } from "@/i18n/en/translations"

import { getWealthAnalysisEvidence } from "./wealth-analysis"
import { getWealthInsights } from "./wealth-insights"

function aggregate(
  overrides: Partial<DashboardAggregate> = {},
): DashboardAggregate {
  return {
    baseCurrencyCode: "USD",
    status: "complete",
    freshness: "fresh",
    totalAssets: "100",
    totalLiabilities: "0",
    netWorth: "100",
    assetBreakdown: {
      cashAndBank: "25",
      brokerage: "25",
      goldAndSilver: "25",
      realEstate: "25",
      business: "0",
      certificates: "0",
      other: "0",
    },
    accountCount: 4,
    unavailablePairs: [],
    unavailableSources: [],
    ...overrides,
  }
}

function insights(input: DashboardAggregate) {
  return getWealthInsights(input, getWealthAnalysisEvidence(input))
}

describe("getWealthInsights", () => {
  it("surfaces concentration at the inclusive 50% threshold", () => {
    const result = insights(
      aggregate({
        assetBreakdown: {
          cashAndBank: "50",
          brokerage: "50",
          goldAndSilver: "0",
          realEstate: "0",
          business: "0",
          certificates: "0",
          other: "0",
        },
      }),
    )

    expect(result.find(({ kind }) => kind === "concentration")).toMatchObject({
      assetClass: { group: "cashAndBank" },
      percentage: "50",
    })
  })

  it("reports multiple reliably valued asset classes without scoring breadth", () => {
    const result = insights(aggregate())

    expect(result.find(({ kind }) => kind === "breadth")).toEqual({
      id: "breadth",
      kind: "breadth",
      assetClassCount: 4,
    })
  })

  it("calculates positive liabilities relative to gross assets with decimal math", () => {
    const result = insights(
      aggregate({ totalLiabilities: "20", netWorth: "80" }),
    )

    expect(result.find(({ kind }) => kind === "liabilities")).toEqual({
      id: "liabilities",
      kind: "liabilities",
      percentage: "20",
    })
  })

  it.each([
    ["zero", "0"],
    ["unavailable", null],
  ] as const)(
    "preserves an unavailable liability ratio for a %s denominator",
    (_, totalAssets) => {
      const result = insights(
        aggregate({
          totalAssets,
          totalLiabilities: "10",
          netWorth: "-10",
          assetBreakdown: {
            cashAndBank: "0",
            brokerage: "0",
            goldAndSilver: "0",
            realEstate: "0",
            business: "0",
            certificates: "0",
            other: "0",
          },
        }),
      )

      expect(result.find(({ kind }) => kind === "liabilities")).toEqual({
        id: "liabilities",
        kind: "liabilities",
        percentage: null,
      })
    },
  )

  it.each(["stale", "unavailable"] as const)(
    "preserves the %s valuation-confidence state",
    (freshness) => {
      const result = insights(aggregate({ freshness }))

      expect(result[0]).toMatchObject({
        kind: "valuation-confidence",
        state: freshness,
      })
    },
  )

  it("allows a concise complete/current confidence observation", () => {
    const result = insights(aggregate())

    expect(
      result.find(({ kind }) => kind === "valuation-confidence"),
    ).toMatchObject({
      kind: "valuation-confidence",
      state: "complete-current",
    })
  })

  it("caps prioritized observations at four", () => {
    const result = insights(
      aggregate({
        totalLiabilities: "10",
        netWorth: "90",
        assetBreakdown: {
          cashAndBank: "60",
          brokerage: "20",
          goldAndSilver: "10",
          realEstate: "10",
          business: "0",
          certificates: "0",
          other: "0",
        },
      }),
    )

    expect(result).toHaveLength(4)
    expect(result.map(({ kind }) => kind)).toEqual([
      "concentration",
      "liabilities",
      "liquidity",
      "breadth",
    ])
  })

  it("contains no recommendation or action language", () => {
    const copy = Object.entries(en)
      .filter(([key]) => key.startsWith("analysis.insights."))
      .map(([, value]) => value)
      .join(" ")

    expect(copy).not.toMatch(
      /\b(should|recommend(?:ed|ation)?|buy|sell|increase|decrease)\b/i,
    )
  })
})
