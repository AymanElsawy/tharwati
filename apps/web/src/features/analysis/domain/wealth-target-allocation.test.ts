import { describe, expect, it } from "vitest"

import type {
  DashboardAggregate,
  DashboardAssetGroup,
} from "@/features/dashboard/services/dashboard-aggregate.service"
import { en } from "@/i18n/en/translations"

import { getWealthAnalysisEvidence } from "../utils/wealth-analysis"
import {
  calculateWealthTargetComparison,
  getExcludedValuedTargetClasses,
  summarizeWealthTargetInputs,
  summarizeWealthToleranceInput,
  type WealthTarget,
} from "./wealth-target-allocation"

const supported: DashboardAssetGroup[] = [
  "cashAndBank",
  "brokerage",
  "goldAndSilver",
  "realEstate",
  "business",
  "other",
]

function aggregate(
  overrides: Partial<DashboardAggregate> = {}
): DashboardAggregate {
  return {
    baseCurrencyCode: "EGP",
    status: "complete",
    freshness: "fresh",
    totalAssets: "100",
    totalLiabilities: "0",
    netWorth: "100",
    assetBreakdown: {
      cashAndBank: "50",
      brokerage: "50",
      goldAndSilver: "0",
      realEstate: "0",
      business: "0",
      certificates: "0",
      other: "0",
    },
    accountCount: 2,
    unavailablePairs: [],
    unavailableSources: [],
    ...overrides,
  }
}

function targets(
  values: Partial<Record<DashboardAssetGroup, string>>
): WealthTarget[] {
  return supported.map((assetClass) => ({
    assetClass,
    percentage: values[assetClass] ?? "0",
  }))
}

function comparison(
  input: DashboardAggregate,
  target: WealthTarget[],
  tolerance: string | null = "5"
) {
  return calculateWealthTargetComparison(
    input,
    getWealthAnalysisEvidence(input),
    target,
    tolerance
  )
}

describe("wealth target allocation validation", () => {
  it("accepts target percentages totaling exactly 100", () => {
    const result = summarizeWealthTargetInputs(
      {
        cashAndBank: "20",
        brokerage: "30",
        goldAndSilver: "10",
        realEstate: "20",
        business: "10",
        other: "10",
      },
      supported
    )

    expect(result).toMatchObject({ total: "100", isValid: true })
    expect(result.targets).toHaveLength(6)
  })

  it.each(["99.999999", "100.000001", "100.0000000", "+100", "not-a-number"])(
    "rejects an invalid total or value: %s",
    (cashAndBank) => {
      const result = summarizeWealthTargetInputs(
        {
          cashAndBank,
          brokerage: "0",
          goldAndSilver: "0",
          realEstate: "0",
          business: "0",
          other: "0",
        },
        supported
      )

      expect(result.isValid).toBe(false)
      expect(result.targets).toBeNull()
    }
  )

  it("rejects a non-string value without throwing if a boundary is bypassed", () => {
    const inputs = {
      cashAndBank: 20,
      brokerage: "30",
      goldAndSilver: "10",
      realEstate: "20",
      business: "10",
      other: "10",
    } as unknown as Record<string, string>

    expect(() => summarizeWealthTargetInputs(inputs, supported)).not.toThrow()
    expect(summarizeWealthTargetInputs(inputs, supported).isValid).toBe(false)
  })

  it.each(["0", "5", "100", "5.123456"])(
    "accepts a decimal tolerance: %s",
    (input) => {
      expect(summarizeWealthToleranceInput(input)).toEqual({
        isValid: true,
        tolerancePercentage: input,
      })
    }
  )

  it("normalizes a blank tolerance input to the zero-percent default", () => {
    expect(summarizeWealthToleranceInput("")).toEqual({
      isValid: true,
      tolerancePercentage: "0",
    })
  })

  it.each(["-1", "100.000001", "5.1234567", "+5", "invalid"])(
    "rejects an invalid tolerance: %s",
    (input) => {
      expect(summarizeWealthToleranceInput(input)).toEqual({
        isValid: false,
        tolerancePercentage: null,
      })
    }
  )
})

describe("wealth target allocation drift", () => {
  it("excludes zero-target classes from the comparison denominator", () => {
    const input = aggregate({
      totalAssets: "1000",
      netWorth: "1000",
      assetBreakdown: {
        cashAndBank: "900",
        brokerage: "50",
        goldAndSilver: "0",
        realEstate: "50",
        business: "0",
        certificates: "0",
        other: "0",
      },
    })
    const result = comparison(
      input,
      targets({ brokerage: "50", realEstate: "50" })
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.comparisonBase).toBe("100")
    expect(result.rows.map(({ assetClass }) => assetClass.group)).toEqual([
      "brokerage",
      "realEstate",
    ])
    expect(
      result.rows.map(({ currentPercentage }) => currentPercentage)
    ).toEqual(["50", "50"])
  })

  it("uses the existing primary-currency values without doing currency conversion", () => {
    const input = aggregate({
      baseCurrencyCode: "EGP",
      totalAssets: "3000000",
      netWorth: "3000000",
      assetBreakdown: {
        cashAndBank: "1000000",
        brokerage: "2000000",
        goldAndSilver: "0",
        realEstate: "0",
        business: "0",
        certificates: "0",
        other: "0",
      },
    })
    const result = comparison(
      input,
      targets({ cashAndBank: "50", brokerage: "50" })
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.comparisonBase).toBe("3000000")
    expect(result.rows[0]?.monetaryGap).toBe("-500000")
    expect(result.rows[1]?.monetaryGap).toBe("500000")
  })

  it("calculates current, target, signed percentage and monetary gaps", () => {
    const result = comparison(
      aggregate(),
      targets({ cashAndBank: "20", brokerage: "80" })
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows[0]).toMatchObject({
      currentPercentage: "50",
      targetPercentage: "20",
      gapPercentage: "30",
      monetaryGap: "30",
      status: "above",
    })
    expect(result.rows[1]).toMatchObject({
      currentPercentage: "50",
      targetPercentage: "80",
      gapPercentage: "-30",
      monetaryGap: "-30",
      status: "below",
    })
  })

  it("treats inclusive tolerance boundaries as within range", () => {
    const result = comparison(
      aggregate({
        assetBreakdown: {
          cashAndBank: "25",
          brokerage: "75",
          goldAndSilver: "0",
          realEstate: "0",
          business: "0",
          certificates: "0",
          other: "0",
        },
      }),
      targets({ cashAndBank: "30", brokerage: "70" }),
      "5"
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows).toMatchObject([
      {
        lowerBoundPercentage: "25",
        upperBoundPercentage: "35",
        gapPercentage: "-5",
        status: "within",
      },
      {
        lowerBoundPercentage: "65",
        upperBoundPercentage: "75",
        gapPercentage: "5",
        status: "within",
      },
    ])
  })

  it("classifies values outside the tolerance range while keeping the exact-target gap", () => {
    const result = comparison(
      aggregate(),
      targets({ cashAndBank: "40", brokerage: "60" }),
      "5"
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows).toMatchObject([
      {
        currentPercentage: "50",
        targetPercentage: "40",
        lowerBoundPercentage: "35",
        upperBoundPercentage: "45",
        gapPercentage: "10",
        status: "above",
      },
      {
        currentPercentage: "50",
        targetPercentage: "60",
        lowerBoundPercentage: "55",
        upperBoundPercentage: "65",
        gapPercentage: "-10",
        status: "below",
      },
    ])
  })

  it("clamps target ranges to zero and one hundred", () => {
    const result = comparison(
      aggregate({
        assetBreakdown: {
          cashAndBank: "1",
          brokerage: "99",
          goldAndSilver: "0",
          realEstate: "0",
          business: "0",
          certificates: "0",
          other: "0",
        },
      }),
      targets({ cashAndBank: "2", brokerage: "98" }),
      "5"
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows).toMatchObject([
      { lowerBoundPercentage: "0", upperBoundPercentage: "7" },
      { lowerBoundPercentage: "93", upperBoundPercentage: "100" },
    ])
  })

  it("uses the within-range state at exact equality with zero tolerance", () => {
    const result = comparison(
      aggregate(),
      targets({ cashAndBank: "50", brokerage: "50" }),
      "0"
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows.every(({ status }) => status === "within")).toBe(true)
    expect(result.largestDeviation).toBeNull()
  })

  it("defaults a missing persisted tolerance to zero percent", () => {
    const result = comparison(
      aggregate(),
      targets({ cashAndBank: "50", brokerage: "50" }),
      null
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows.every(({ status }) => status === "within")).toBe(true)
  })

  it("classifies above and below against the exact target with zero tolerance", () => {
    const result = comparison(
      aggregate(),
      targets({ cashAndBank: "40", brokerage: "60" }),
      "0"
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.rows.map(({ status }) => status)).toEqual(["above", "below"])
  })

  it("does not turn unavailable FX or values into zero", () => {
    const input = aggregate({
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
      unavailablePairs: ["USD/EGP"],
      unavailableSources: ["Brokerage"],
    })
    const result = comparison(
      input,
      targets({ cashAndBank: "50", brokerage: "50" })
    )

    expect(result).toEqual({
      status: "unavailable",
      reason: "valuation-incomplete",
    })
  })

  it("selects the largest absolute target deviation once", () => {
    const result = comparison(
      aggregate(),
      targets({ cashAndBank: "20", brokerage: "80" })
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.largestDeviation).toMatchObject({
      assetClass: { group: "cashAndBank" },
      gapPercentage: "30",
      monetaryGap: "30",
    })
  })

  it("reports only the largest deviation outside the selected range", () => {
    const result = comparison(
      aggregate({
        assetBreakdown: {
          cashAndBank: "60",
          brokerage: "30",
          goldAndSilver: "10",
          realEstate: "0",
          business: "0",
          certificates: "0",
          other: "0",
        },
      }),
      targets({ cashAndBank: "30", brokerage: "40", goldAndSilver: "30" }),
      "5"
    )

    expect(result.status).toBe("available")
    if (result.status !== "available") return
    expect(result.largestDeviation).toMatchObject({
      assetClass: { group: "cashAndBank" },
      gapPercentage: "30",
      monetaryGap: "30",
      status: "above",
    })
  })

  it("identifies positive reliable zero-target classes as one supporting set", () => {
    const input = aggregate({
      assetBreakdown: {
        cashAndBank: "50",
        brokerage: "30",
        goldAndSilver: "0",
        realEstate: "0",
        business: "15",
        certificates: "0",
        other: "5",
      },
    })
    const excluded = getExcludedValuedTargetClasses(
      getWealthAnalysisEvidence(input),
      targets({ cashAndBank: "50", brokerage: "50" })
    )

    expect(excluded.map(({ group }) => group)).toEqual(["business", "other"])
  })

  it("identifies one positive reliable zero-target class", () => {
    const input = aggregate({
      assetBreakdown: {
        cashAndBank: "50",
        brokerage: "35",
        goldAndSilver: "0",
        realEstate: "0",
        business: "15",
        certificates: "0",
        other: "0",
      },
    })

    expect(
      getExcludedValuedTargetClasses(
        getWealthAnalysisEvidence(input),
        targets({ cashAndBank: "50", brokerage: "50" })
      ).map(({ group }) => group)
    ).toEqual(["business"])
  })

  it("does not report true-zero or unavailable zero-target classes as holding value", () => {
    const zeroEvidence = getWealthAnalysisEvidence(aggregate())
    expect(
      getExcludedValuedTargetClasses(
        zeroEvidence,
        targets({ cashAndBank: "50", brokerage: "50" })
      )
    ).toEqual([])

    const unavailableEvidence = getWealthAnalysisEvidence(
      aggregate({
        status: "incomplete",
        assetBreakdown: {
          cashAndBank: null,
          brokerage: null,
          goldAndSilver: null,
          realEstate: null,
          business: null,
          certificates: null,
          other: null,
        },
      })
    )
    expect(
      getExcludedValuedTargetClasses(
        unavailableEvidence,
        targets({ cashAndBank: "50", brokerage: "50" })
      )
    ).toEqual([])
  })

  it("uses descriptive target copy without advice or action language", () => {
    const copy = Object.entries(en)
      .filter(([key]) => key.startsWith("analysis.targets."))
      .map(([, value]) => value)
      .join(" ")

    expect(copy).not.toMatch(
      /\b(should|recommend(?:ed|ation)?|buy|sell|increase|decrease|good|bad|risk)\b/i
    )
  })
})
