import { describe, expect, it, vi } from "vitest"

import {
  CurrentFxClient,
  type FxFunctionInvoker,
} from "@/services/exchangeRateService"

function invokerReturning(data: unknown): FxFunctionInvoker {
  return vi.fn().mockResolvedValue({ data, error: null })
}

function resolvedRate(overrides: Record<string, unknown> = {}) {
  return {
    available: true,
    rate: 3.75,
    provider: "frankfurter",
    effectiveAt: "2026-09-16T00:00:00Z",
    fetchedAt: "2026-09-16T12:00:00Z",
    stale: false,
    unavailable: false,
    ...overrides,
  }
}

describe("CurrentFxClient", () => {
  it.each([
    ["USD", "SAR", 3.75],
    ["EUR", "SAR", 4.3324],
    ["SAR", "USD", 0.26667],
    ["USD", "EGP", 50.305],
  ])("resolves %s/%s through fx-rates", async (from, to, rate) => {
    const invoke = invokerReturning(resolvedRate({ rate }))
    const client = new CurrentFxClient(invoke)

    await expect(client.get(from, to)).resolves.toMatchObject({
      rate: String(rate),
      provider: "frankfurter",
      stale: false,
      direction: "direct",
    })
    expect(invoke).toHaveBeenCalledWith({
      fromCurrencyCode: from,
      toCurrencyCode: to,
      mode: "current",
    })
  })

  it("uses the shared identity response for SAR/SAR", async () => {
    const invoke = invokerReturning(resolvedRate({
      rate: 1,
      provider: "identity",
      effectiveAt: "2026-09-16",
    }))
    const client = new CurrentFxClient(invoke)

    await expect(client.get("SAR", "SAR")).resolves.toMatchObject({
      rate: "1",
      provider: "identity",
      stale: false,
    })
    expect(invoke).toHaveBeenCalledOnce()
  })

  it("preserves stale manual inverse fallback provenance", async () => {
    const client = new CurrentFxClient(invokerReturning(resolvedRate({
      rate: 0.266666666667,
      provider: "manual",
      fetchedAt: null,
      stale: true,
      direction: "inverse",
    })))

    await expect(client.get("SAR", "USD")).resolves.toMatchObject({
      rate: "0.266666666667",
      provider: "manual",
      fetchedAt: undefined,
      stale: true,
      direction: "inverse",
    })
  })

  it("deduplicates concurrent requests without adding a browser rate cache", async () => {
    const invoke = invokerReturning(resolvedRate())
    const client = new CurrentFxClient(invoke)
    await Promise.all([client.get("USD", "SAR"), client.get("USD", "SAR")])
    await client.get("USD", "SAR")
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it("returns unavailable when fx-rates is unavailable or invocation fails", async () => {
    const unavailable = new CurrentFxClient(invokerReturning({
      available: false,
      provider: "frankfurter",
      stale: false,
      unavailable: true,
    }))
    const failed = new CurrentFxClient(vi.fn().mockResolvedValue({
      data: null,
      error: new Error("provider unavailable"),
    }))

    await expect(unavailable.get("USD", "SAR")).resolves.toBeNull()
    await expect(failed.get("USD", "SAR")).resolves.toBeNull()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, "0", "malformed"])(
    "rejects invalid rate %s without substituting zero",
    async (rate) => {
      const client = new CurrentFxClient(invokerReturning(resolvedRate({ rate })))
      await expect(client.get("USD", "SAR")).resolves.toBeNull()
    },
  )

  it("rejects malformed pairs before invoking the Edge Function", async () => {
    const invoke = invokerReturning(resolvedRate())
    const client = new CurrentFxClient(invoke)
    await expect(client.get("US", "SAR")).resolves.toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })
})
