import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { reserveTwelveDataSymbols } from "./twelve-data-reservation.ts"

describe("atomic Twelve Data symbol reservation", () => {
  beforeEach(() => { vi.spyOn(console, "warn").mockImplementation(() => {}) })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
  it("uses one caller RPC and accepts an affordable partial count", async () => {
    const rpc = vi.fn(async () => ({ data: { grantedSymbolCount: 3 }, error: null }))
    expect(await reserveTwelveDataSymbols({ rpc }, 20)).toBe(3)
    expect(rpc).toHaveBeenCalledExactlyOnceWith("reserve_twelve_data_symbols", { p_requested_symbols: 20 })
  })
  it.each([0, -1, 1.5, 51, "2", undefined])("fails closed for malformed grants: %s", async grantedSymbolCount => {
    await expect(reserveTwelveDataSymbols({ rpc: async () => ({ data: { grantedSymbolCount }, error: null }) }, 50))
      .rejects.toMatchObject({ code: "provider_budget_unavailable" })
  })
  it.each(["provider_capacity_unconfigured", "provider_refresh_paused", "provider_refresh_rate_limited"])("returns safe denial %s", async code => {
    await expect(reserveTwelveDataSymbols({ rpc: async () => ({ data: { grantedSymbolCount: 0, code, retryAfterSeconds: 60, secret: "private" }, error: null }) }, 5))
      .rejects.toMatchObject({ code, message: code, retryAfterSeconds: 60 })
    expect(console.warn).not.toHaveBeenCalled()
  })
  it("rejects oversized partial grants and database errors without exposing details", async () => {
    for (const reply of [{ data: { grantedSymbolCount: 3 }, error: null }, { data: null, error: "private credential" }]) {
      await expect(reserveTwelveDataSymbols({ rpc: async () => reply }, 2)).rejects.toMatchObject({ message: "provider_budget_unavailable" })
    }
  })
  it("bounds a hung reservation without attempting a provider call", async () => {
    vi.useFakeTimers()
    try {
      const rpc = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(() => {}))
      const providerCall = vi.fn()
      const pending = expect(reserveTwelveDataSymbols({ rpc }, 1).then(providerCall)).rejects.toMatchObject({ code: "provider_budget_unavailable" })
      await vi.advanceTimersByTimeAsync(1999)
      expect(console.warn).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(console.warn).toHaveBeenCalledExactlyOnceWith("Twelve Data reservation failed", { failure: "timeout", elapsedMs: 2000 })
      expect(providerCall).not.toHaveBeenCalled()
      expect(rpc).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })
  it("accepts a delayed partial grant beyond the old deadline with one charge", async () => {
    vi.useFakeTimers()
    const rpc = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(resolve => {
      setTimeout(() => resolve({ data: { grantedSymbolCount: 3 }, error: null }), 1500)
    }))
    const providerCall = vi.fn()
    const pending = reserveTwelveDataSymbols({ rpc }, 20).then(providerCall)
    await vi.advanceTimersByTimeAsync(750)
    expect(providerCall).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(750)
    await pending
    expect(providerCall).toHaveBeenCalledExactlyOnceWith(3)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(console.warn).not.toHaveBeenCalled()
  })
  it("does not authorize a late grant or retry after timeout", async () => {
    vi.useFakeTimers()
    const rpc = vi.fn(() => new Promise<{ data: unknown; error: unknown }>(resolve => {
      setTimeout(() => resolve({ data: { grantedSymbolCount: 1 }, error: null }), 2500)
    }))
    const providerCall = vi.fn()
    const pending = expect(reserveTwelveDataSymbols({ rpc }, 1).then(providerCall)).rejects.toMatchObject({ code: "provider_budget_unavailable" })
    await vi.advanceTimersByTimeAsync(2000)
    await pending
    await vi.advanceTimersByTimeAsync(500)
    expect(providerCall).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
  it.each([
    ["rpc", { data: { grantedSymbolCount: 1 }, error: { message: "private JWT financial data" } }],
    ["invalid_response", { data: null, error: null }],
    ["invalid_response", { data: { grantedSymbolCount: 0, code: "private JWT financial data" }, error: null }],
  ])("logs only sanitized %s diagnostics", async (failure, reply) => {
    const rpc = vi.fn(async () => reply)
    await expect(reserveTwelveDataSymbols({ rpc }, 1)).rejects.toMatchObject({ code: "provider_budget_unavailable" })
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("Twelve Data reservation failed", { failure, elapsedMs: expect.any(Number) })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it("fails closed and sanitizes thrown transport errors", async () => {
    const rpc = vi.fn(async () => { throw new Error("private JWT financial data") })
    await expect(reserveTwelveDataSymbols({ rpc }, 1)).rejects.toMatchObject({ code: "provider_budget_unavailable" })
    expect(console.warn).toHaveBeenCalledExactlyOnceWith("Twelve Data reservation failed", { failure: "rpc", elapsedMs: expect.any(Number) })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
