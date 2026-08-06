import { describe, expect, it } from "vitest"

import {
  formatPortfolioAmount,
  formatPortfolioDecimal,
} from "./portfolio-formatters"

describe("portfolio formatters", () => {
  it("formats values beyond JavaScript safe integer precision exactly", () => {
    expect(
      formatPortfolioDecimal("9007199254740993.25", "en-US"),
    ).toBe("9,007,199,254,740,993.25")
  })

  it("rounds display precision without converting through Number", () => {
    expect(formatPortfolioDecimal("999.999", "en-US")).toBe("1,000")
    expect(formatPortfolioAmount("-1250.5", "SAR", "en-US")).toBe(
      "SAR -1,250.5",
    )
  })
})
