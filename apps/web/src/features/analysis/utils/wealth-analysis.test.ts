import { describe, expect, it } from "vitest"

import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import {
  getWealthAnalysisEvidence,
  getWealthAssetClasses,
} from "./wealth-analysis"

function aggregate(
  overrides: Partial<DashboardAggregate> = {},
): DashboardAggregate {
  return {
    baseCurrencyCode: "USD",
    status: "complete",
    totalAssets: "100",
    totalLiabilities: "15",
    netWorth: "85",
    assetBreakdown: {
      cashAndBank: "40",
      brokerage: "30",
      goldAndSilver: "10",
      realEstate: "20",
      business: "0",
      certificates: "0",
      other: "0",
    },
    accountCount: 5,
    unavailablePairs: [],
    unavailableSources: [],
    ...overrides,
  }
}

describe("getWealthAssetClasses", () => {
  it("reuses decimal-safe Dashboard allocation and routes Brokerage only", () => {
    const classes = getWealthAssetClasses(aggregate())

    expect(classes.find(({ group }) => group === "cashAndBank")).toMatchObject({
      value: "40",
      percentage: "40",
      destination: null,
    })
    expect(classes.find(({ group }) => group === "brokerage")).toMatchObject({
      value: "30",
      percentage: "30",
      destination: "/portfolio",
    })
  })

  it("never converts unavailable class values into zero", () => {
    const classes = getWealthAssetClasses(
      aggregate({
        status: "incomplete",
        totalAssets: null,
        totalLiabilities: null,
        netWorth: null,
        assetBreakdown: {
          cashAndBank: null,
          brokerage: null,
          goldAndSilver: null,
          realEstate: null,
          business: null,
          certificates: null,
          other: null,
        },
        unavailableSources: ["Unpriced holding"],
      }),
    )

    expect(classes.every(({ value }) => value === null)).toBe(true)
    expect(classes.every(({ percentage }) => percentage === null)).toBe(true)
  })

  it("derives qualitative evidence without inventing a health state or score", () => {
    const evidence = getWealthAnalysisEvidence(aggregate())

    expect(evidence.positiveAssetClassCount).toBe(4)
    expect(evidence.largestExposure).toMatchObject({
      group: "cashAndBank",
      percentage: "40",
    })
    expect(evidence.cashAndBankExposure).toMatchObject({
      group: "cashAndBank",
      percentage: "40",
    })
    expect(evidence).not.toHaveProperty("score")
    expect(evidence).not.toHaveProperty("healthState")
  })
})
