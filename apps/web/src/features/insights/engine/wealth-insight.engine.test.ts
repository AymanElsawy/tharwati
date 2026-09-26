import { describe, expect, it } from "vitest"
import appRoutesSource from "@/app/App.tsx?raw"

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

  it("routes Review Concentration to the existing Portfolio risk section", () => {
    const insight = generateWealthInsights({ concentration: snapshot.concentration }, 10)
      .find((item) => item.action?.label === "Review Concentration")
    expect(insight?.action?.href).toBe("/portfolio#portfolio-concentration")
  })

  it("routes See Holdings to the existing Portfolio holdings section", () => {
    const insight = generateWealthInsights({
      diversification: { sectorName: "Technology", equityPercent: "40", warningThresholdPercent: "25" },
    }, 10).find((item) => item.action?.label === "See Holdings")
    expect(insight?.action?.href).toBe("/portfolio#portfolio-holdings-title")
  })

  it("resolves every insight action to a registered application route", () => {
    const registeredPaths = new Set(
      [...appRoutesSource.matchAll(/<Route\s+path="(\/[^"]+)"/g)].map((match) => match[1]),
    )
    const completeSnapshot: WealthInsightSnapshot = {
      ...snapshot,
      diversification: { sectorName: "Technology", equityPercent: "40", warningThresholdPercent: "25" },
      cashFlow: { savingsRatePercent: "35", targetSavingsRatePercent: "25" },
      goalProgress: { goalName: "Home", monthsAhead: 2 },
      performance: { benchmarkDifferencePercent: "2" },
      missingData: { missingPriceCount: 1, missingExchangeRateCount: 0 },
    }
    const actions = [
      ...generateWealthInsights(completeSnapshot, 20),
      ...generateWealthInsights({ ...completeSnapshot, performance: { benchmarkDifferencePercent: "-2" } }, 20),
    ].flatMap((item) => item.action ? [item.action] : [])
    expect(actions.length).toBeGreaterThan(2)
    for (const action of actions) {
      expect(registeredPaths.has(new URL(action.href, "http://localhost").pathname), action.label).toBe(true)
    }
  })
})
