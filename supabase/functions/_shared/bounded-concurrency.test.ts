import { describe, expect, it } from "vitest"

import { mapWithConcurrency, resolveUniquePairsWithConcurrency } from "./bounded-concurrency.ts"

describe("mapWithConcurrency", () => {
  it("caps concurrent work and preserves input result order", async () => {
    let active = 0
    let peak = 0
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 3, async (value) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      return value * 2
    })

    expect(peak).toBeLessThanOrEqual(3)
    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it("preserves unavailable results without changing their mapping", async () => {
    const results = await mapWithConcurrency(["available", "unavailable", "available"], 3, async (value) => (
      value === "unavailable" ? null : value
    ))

    expect(results).toEqual(["available", null, "available"])
  })

  it("resolves duplicate FX pairs once with the same deterministic mapping", async () => {
    const calls: string[] = []
    const resolved = await resolveUniquePairsWithConcurrency([
      { from: "USD", to: "SAR" },
      { from: "EUR", to: "SAR" },
      { from: "USD", to: "SAR" },
    ], 3, async (pair) => {
      const key = `${pair.from}/${pair.to}`
      calls.push(key)
      return key === "EUR/SAR" ? null : "3.75"
    })

    expect(calls.sort()).toEqual(["EUR/SAR", "USD/SAR"])
    expect([...resolved.entries()]).toEqual([["USD/SAR", "3.75"], ["EUR/SAR", null]])
  })

  it("propagates an underlying request failure", async () => {
    await expect(mapWithConcurrency([1, 2], 3, async (value) => {
      if (value === 2) throw new Error("request failed")
      return value
    })).rejects.toThrow("request failed")
  })
})
