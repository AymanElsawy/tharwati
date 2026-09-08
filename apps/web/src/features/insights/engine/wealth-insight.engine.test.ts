import { describe, expect, it } from "vitest"

import { generateWealthInsights } from "./wealth-insight.engine"
import type { WealthInsightSnapshot } from "../types/wealth-insight"

const snapshot: WealthInsightSnapshot = {
  allocation: {
    cashPercent: "32",
    preferredCashMaximumPercent: "24",
  },
  concentration: {
    holdingName: "NVIDIA",
    holdingPercent: "31",
    warningThresholdPercent: "25",
  },
  currencyExposure: {
    currencyCode: "USD",
    exposurePercent: "74",
    warningThresholdPercent: "60",
  },
  idleCash: {
    amount: "180000",
    formattedAmount: "SAR 180,000",
    idleDays: 94,
    minimumIdleDays: 90,
  },
}

describe("generateWealthInsights", () => {
  it("prioritizes and limits visible insights deterministically", () => {
    const insights = generateWealthInsights(snapshot)

    expect(insights).toHaveLength(3)
    expect(insights.map((insight) => insight.category)).toEqual([
      "risk",
      "currency",
      "opportunities",
    ])
  })

  it("updates its output when financial data changes", () => {
    const insights = generateWealthInsights({
      ...snapshot,
      concentration: {
        holdingName: "NVIDIA",
        holdingPercent: "20",
        warningThresholdPercent: "25",
      },
    })

    expect(insights.some((insight) => insight.category === "risk")).toBe(false)
    expect(insights.some((insight) => insight.category === "allocation")).toBe(
      true,
    )
  })

  it("does not return duplicate IDs or categories", () => {
    const insights = generateWealthInsights({
      ...snapshot,
      performance: { benchmarkDifferencePercent: "3.2" },
    }, 9)

    expect(new Set(insights.map((insight) => insight.id)).size).toBe(
      insights.length,
    )
    expect(new Set(insights.map((insight) => insight.category)).size).toBe(
      insights.length,
    )
  })

  it("returns no insights for an empty snapshot", () => {
    expect(generateWealthInsights({})).toEqual([])
  })
})
