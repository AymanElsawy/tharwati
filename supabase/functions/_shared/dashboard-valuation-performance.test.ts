import { describe, expect, it } from "vitest"

import { DashboardValuationPerformance } from "./dashboard-valuation-performance.ts"

describe("dashboard valuation performance telemetry", () => {
  it("is disabled unless explicitly enabled", async () => {
    const telemetry = new DashboardValuationPerformance(false)
    await telemetry.measure("accounts_read", async () => undefined)

    expect(telemetry.summary("rebuild", false)).toBeNull()
  })

  it("reports aggregate stage durations and safe counts only", async () => {
    const telemetry = new DashboardValuationPerformance(true)
    telemetry.setAccountCount(3)
    telemetry.addFxPair()
    telemetry.addFxPair()
    telemetry.setMetalSymbolCount(1)
    await telemetry.measure("auth_get_user", async () => undefined)
    await telemetry.measure("fx_calls", async () => undefined)
    await telemetry.measure("fx_request_sum", async () => undefined)
    await telemetry.measure("metal_price_calls", async () => undefined)
    await telemetry.measure("metal_price_request_sum", async () => undefined)

    expect(telemetry.summary("rebuild", true)).toMatchObject({
      snapshotMode: "rebuild",
      coldStartObserved: true,
      stagesMs: {
        auth_get_user: expect.any(Number),
        fx_calls: expect.any(Number),
        fx_request_sum: expect.any(Number),
        metal_price_calls: expect.any(Number),
        metal_price_request_sum: expect.any(Number),
      },
      counts: { accounts: 3, fxPairs: 2, metalSymbols: 1 },
    })
  })
})
