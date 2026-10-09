import { describe, expect, it, vi } from "vitest"
import { reserveTwelveDataSymbols } from "./twelve-data-reservation.ts"

describe("atomic Twelve Data symbol reservation", () => {
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
  })
  it("rejects oversized partial grants and database errors without exposing details", async () => {
    for (const reply of [{ data: { grantedSymbolCount: 3 }, error: null }, { data: null, error: "private credential" }]) {
      await expect(reserveTwelveDataSymbols({ rpc: async () => reply }, 2)).rejects.toMatchObject({ message: "provider_budget_unavailable" })
    }
  })
  it("bounds a hung reservation without attempting a provider call", async () => {
    vi.useFakeTimers()
    try {
      const pending = expect(reserveTwelveDataSymbols({ rpc: () => new Promise(() => {}) }, 1)).rejects.toMatchObject({ code: "provider_budget_unavailable" })
      await vi.advanceTimersByTimeAsync(750)
      await pending
    } finally { vi.useRealTimers() }
  })
})
