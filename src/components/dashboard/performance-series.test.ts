import { describe, expect, it } from "vitest"

import * as FinancialCalculations from "../../lib/financial-calculations"
import { calculateSeriesPerformance } from "./performance-series"

describe("dashboard performance series", () => {
  it("preserves the existing static chart behavior", () => {
    expect(calculateSeriesPerformance([100, 125])).toEqual({
      currentValue: 125,
      difference: 25,
      percentage: 25,
      isPositive: true,
    })
  })

  it("is not exported by the Financial Calculation Layer", () => {
    expect(FinancialCalculations).not.toHaveProperty(
      "calculateSeriesPerformance",
    )
  })
})
