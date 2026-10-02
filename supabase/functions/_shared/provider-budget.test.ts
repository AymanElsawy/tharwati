import { describe, expect, it, vi } from "vitest"
import { ProviderBudgetError, reserveProviderCall } from "./provider-budget.ts"
import { getFrankfurterRate } from "./frankfurter.ts"

describe("provider reservation boundary", () => {
  it("sends only fixed provider/operation/units, never a caller-controlled user id", async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }))
    await reserveProviderCall({ rpc }, "market", 50)
    expect(rpc).toHaveBeenCalledWith("reserve_provider_budget", { p_provider: "twelve_data", p_operation: "market", p_units: 50 })
  })
  it("fails closed for malformed/database decisions using safe errors", async () => {
    await expect(reserveProviderCall({ rpc: async () => ({ data: null, error: "private secret" }) }, "search"))
      .rejects.toMatchObject({ code: "provider_budget_unavailable", message: "provider_budget_unavailable" })
  })
  it("bounds a hung reservation and authorizes no provider attempt", async () => {
    vi.useFakeTimers()
    try {
      const pending = expect(reserveProviderCall({ rpc: () => new Promise(() => {}) }, "fx"))
        .rejects.toMatchObject({ code: "provider_budget_unavailable" })
      await vi.advanceTimersByTimeAsync(750)
      await pending
    } finally { vi.useRealTimers() }
  })
  it("counts every Frankfurter retry and stops when its reservation is denied", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("offline", { status: 503 }))
    const guard = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new ProviderBudgetError("provider_refresh_rate_limited", 30))
    try {
      await expect(getFrankfurterRate("USD", "SAR", undefined, 1500, guard)).rejects.toMatchObject({ code: "provider_refresh_rate_limited" })
      expect(guard).toHaveBeenCalledTimes(2)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { fetchMock.mockRestore() }
  })
})
