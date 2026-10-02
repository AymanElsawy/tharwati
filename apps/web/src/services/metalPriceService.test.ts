import { describe, expect, it, vi } from "vitest"

import { CurrentMetalPriceClient } from "@/services/metalPriceService"
import { supabase } from "@/lib/supabase/client"

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}))

const goldUsd = {
  price: "4340.28",
  symbol: "XAU",
  currency: "USD",
  provider: "gold-api",
  effectiveAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  timestampBasis: "provider",
  stale: false,
} as const

describe("CurrentMetalPriceClient", () => {
  it("routes default transport through authenticated Gold Edge and caches successful reads", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: goldUsd,
      error: null,
      response: new Response(),
    })
    const client = new CurrentMetalPriceClient()
    await expect(client.getPricePerGramUsd("XAU")).resolves.toBeCloseTo(
      4340.28 / 31.1034768,
      5
    )
    await client.getPricePerGramUsd("XAU")
    expect(supabase.functions.invoke).toHaveBeenCalledOnce()
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "gold-price",
      expect.objectContaining({ body: { symbol: "XAU" } })
    )
    vi.mocked(supabase.functions.invoke).mockClear()
  })
  it("converts the troy-ounce spot price to a per-gram USD price", async () => {
    const client = new CurrentMetalPriceClient(
      vi.fn().mockResolvedValue(new Response(JSON.stringify(goldUsd)))
    )
    await expect(client.getPricePerGramUsd("XAU")).resolves.toBeCloseTo(
      4340.28 / 31.1034768,
      5
    )
  })

  it("deduplicates concurrent requests and reuses the six-hour cache", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(goldUsd)))
    const client = new CurrentMetalPriceClient(fetcher)
    await Promise.all([
      client.getPricePerGramUsd("XAU"),
      client.getPricePerGramUsd("XAU"),
    ])
    await client.getPricePerGramUsd("XAU")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it("does not cache failures and retries the provider", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("no", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(goldUsd)))
    const client = new CurrentMetalPriceClient(fetcher)
    await expect(client.getPricePerGramUsd("XAU")).resolves.toBeNull()
    await expect(client.getPricePerGramUsd("XAU", true)).resolves.toBeCloseTo(
      4340.28 / 31.1034768,
      5
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("rejects malformed responses", async () => {
    const client = new CurrentMetalPriceClient(
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...goldUsd, currency: "EUR" }))
        )
    )
    await expect(client.getPricePerGramUsd("XAU")).resolves.toBeNull()
  })

  it("Edge outage recovers exact persisted stale price and provenance", async () => {
    const quote = {
      ...goldUsd,
      price: "4340.123456789012345678",
      effectiveAt: "2026-09-01T00:00:00Z",
      fetchedAt: "2026-09-01T00:01:00Z",
      stale: true,
    } as const
    const client = new CurrentMetalPriceClient(
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
      Date.now,
      async () => quote
    )
    expect(await client.getQuote("XAU")).toEqual(quote)
  })
  it("expired browser cache survives service/database failure marked stale", async () => {
    let now = Date.now()
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(goldUsd)))
      .mockRejectedValueOnce(new Error("service unavailable"))
    const client = new CurrentMetalPriceClient(
      fetcher,
      () => now,
      async () => null
    )
    await client.getQuote("XAU")
    now += 6 * 60 * 60 * 1000 + 1
    expect(await client.getQuote("XAU")).toMatchObject({
      price: goldUsd.price,
      stale: true,
      effectiveAt: goldUsd.effectiveAt,
    })
  })
  it("stale transport is never promoted to a six-hour fresh browser quote", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ ...goldUsd, stale: true }))
      )
    const client = new CurrentMetalPriceClient(fetcher)
    expect((await client.getQuote("XAU"))?.stale).toBe(true)
    await client.getQuote("XAU")
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
