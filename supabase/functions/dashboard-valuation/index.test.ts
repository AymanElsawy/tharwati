import { describe, expect, it } from "vitest"
import source from "./index.ts?raw"

describe("dashboard valuation non-market account values", () => {
  it("uses effective valuations and ownership rather than legacy opening balances", () => {
    expect(source).toContain("get_effective_account_valuations")
    expect(source).toContain("latestValuations")
    expect(source).toContain("multiply(valuation, ownership)")
  })
})
