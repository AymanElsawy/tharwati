import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ProviderBudgetError, reserveProviderCall } from "./provider-budget.ts"
import { getFrankfurterRate } from "./frankfurter.ts"

describe("provider reservation boundary", () => {
  beforeEach(() => { vi.spyOn(console, "warn").mockImplementation(() => {}) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
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
      const rpc = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(() => {}))
      const providerAttempt = vi.fn()
      const reservation = reserveProviderCall({ rpc }, "fx").then(providerAttempt)
      const pending = expect(reservation)
        .rejects.toMatchObject({ code: "provider_budget_unavailable" })
      await vi.advanceTimersByTimeAsync(1999)
      expect(console.warn).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(console.warn).toHaveBeenCalledExactlyOnceWith("provider reservation failed", { failure: "timeout", elapsedMs: 2000 })
      expect(rpc).toHaveBeenCalledTimes(1)
      expect(providerAttempt).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
  it("allows a reservation slower than the old deadline without retrying", async () => {
    vi.useFakeTimers()
    const rpc = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(resolve => {
      setTimeout(() => resolve({ data: { allowed: true }, error: null }), 1500)
    }))
    const providerAttempt = vi.fn()
    const pending = reserveProviderCall({ rpc }, "metal").then(providerAttempt)
    await vi.advanceTimersByTimeAsync(750)
    expect(providerAttempt).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(750)
    await pending
    expect(providerAttempt).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(console.warn).not.toHaveBeenCalled()
  })
  it.each([
    ["rpc", { data: null, error: { message: "private JWT financial data" } }],
    ["invalid_response", { data: null, error: null }],
    ["rpc", { data: { allowed: true }, error: "private JWT" }],
    ["invalid_response", { data: { allowed: false, code: "private JWT" }, error: null }],
    ["invalid_response", { data: { allowed: "true" }, error: null }],
  ])("sanitizes %s failures and fails closed", async (failure, result) => {
    const rpc = vi.fn(async () => result)
    await expect(reserveProviderCall({ rpc }, "metal")).rejects.toMatchObject({
      code: "provider_budget_unavailable", message: "provider_budget_unavailable",
    })
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("provider reservation failed", {
      failure, elapsedMs: expect.any(Number),
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it("sanitizes thrown transport errors", async () => {
    const rpc = vi.fn(async () => { throw new Error("private JWT financial data") })
    await expect(reserveProviderCall({ rpc }, "metal")).rejects.toMatchObject({ code: "provider_budget_unavailable" })
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("provider reservation failed", { failure: "rpc", elapsedMs: expect.any(Number) })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it.each(["provider_refresh_paused", "provider_capacity_unconfigured", "provider_refresh_rate_limited"])(
    "preserves %s without logging a reservation failure", async code => {
      const rpc = vi.fn(async () => ({ data: { allowed: false, code, retryAfterSeconds: 30 }, error: null }))
      await expect(reserveProviderCall({ rpc }, "metal")).rejects.toMatchObject({
        code, retryAfterSeconds: code === "provider_refresh_rate_limited" ? 30 : undefined,
      })
      expect(console.warn).not.toHaveBeenCalled()
      expect(rpc).toHaveBeenCalledTimes(1)
    },
  )
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
