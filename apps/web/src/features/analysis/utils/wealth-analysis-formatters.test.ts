import { describe, expect, it } from "vitest"

import {
  formatWealthAnalysisAmount,
  formatWealthAnalysisPercent,
  formatWealthAnalysisRoundedAmount,
  normalizeWealthAnalysisDecimalInput,
} from "./wealth-analysis-formatters"

describe("Wealth Analysis presentation formatting", () => {
  it("keeps Western digits and financial punctuation in Arabic presentation", () => {
    expect(formatWealthAnalysisAmount("4152314", "EGP")).toBe("EGP 4,152,314")
    expect(formatWealthAnalysisPercent("48.14")).toBe("48.14%")
    expect(formatWealthAnalysisRoundedAmount("961421.6", "EGP")).toBe(
      "EGP 961,422"
    )
    expect(
      `+${formatWealthAnalysisPercent("23.14")} · +${formatWealthAnalysisRoundedAmount("961421.6", "EGP")}`
    ).toBe("+23.14% · +EGP 961,422")
  })

  it("normalizes Arabic and Persian form digits at the input boundary", () => {
    expect(normalizeWealthAnalysisDecimalInput("٢٥٫٥")).toBe("25.5")
    expect(normalizeWealthAnalysisDecimalInput("۲۵.۵")).toBe("25.5")
    expect(normalizeWealthAnalysisDecimalInput("25.5")).toBe("25.5")
  })
})
