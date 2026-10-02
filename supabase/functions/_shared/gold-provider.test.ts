import { afterEach, expect, it, vi } from "vitest"
import { getGoldQuote } from "./gold-provider.ts"

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})
it("protects Gold independently with no securities or FX identity", async () => {
  const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }))
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(JSON.stringify({ price: 4340.28, currency: "USD" }))
    )
  expect(await getGoldQuote({ rpc }, "XAU")).toEqual({
    price: 4340.28,
    currency: "USD",
  })
  expect(rpc).toHaveBeenCalledWith("reserve_provider_budget", {
    p_provider: "gold_api",
    p_operation: "metal",
    p_units: 1,
  })
  expect(String(fetchMock.mock.calls[0][0])).toBe(
    "https://api.gold-api.com/price/XAU"
  )
})
it.each([
  "provider_capacity_unconfigured",
  "provider_refresh_paused",
  "provider_refresh_rate_limited",
])("Gold %s makes no provider call", async (code) => {
  const fetchMock = vi.spyOn(globalThis, "fetch")
  await expect(
    getGoldQuote(
      { rpc: async () => ({ data: { allowed: false, code }, error: null }) },
      "XAG"
    )
  ).rejects.toMatchObject({ code })
  expect(fetchMock).not.toHaveBeenCalled()
})
it("bounds a hung Gold fetch and never invents a value", async () => {
  vi.useFakeTimers()
  vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}))
  const pending = expect(
    getGoldQuote(
      { rpc: async () => ({ data: { allowed: true }, error: null }) },
      "XAU"
    )
  ).rejects.toMatchObject({ name: "AbortError" })
  await vi.advanceTimersByTimeAsync(2500)
  await pending
})
