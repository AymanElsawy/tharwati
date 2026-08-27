import { describe, expect, it } from "vitest"

import { dashboardValuationReason } from "./dashboard-valuation-diagnostics.ts"

describe("dashboard valuation diagnostics", () => {
  it("returns only approved fixed stage codes", () => {
    expect(dashboardValuationReason("market_prices_request")).toBe("market_prices_request")
    expect(dashboardValuationReason("build_brokerage_values")).toBe("build_brokerage_values")
    expect(dashboardValuationReason("fx_conversion")).toBe("fx_conversion")
    expect(dashboardValuationReason("response_serialization")).toBe("response_serialization")
    expect(dashboardValuationReason("snapshot_persistence")).toBe("snapshot_persistence")
  })

  it("maps arbitrary runtime values to the non-sensitive fallback", () => {
    expect(dashboardValuationReason("postgres://secret")).toBe("unexpected_runtime")
    expect(dashboardValuationReason(new Error("sensitive detail"))).toBe("unexpected_runtime")
  })
})
