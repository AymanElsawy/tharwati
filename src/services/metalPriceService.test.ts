import { describe, expect, it, vi } from "vitest"

import { CurrentMetalPriceClient } from "@/services/metalPriceService"

const goldUsd = { name: "Gold", price: 4340.28, symbol: "XAU", currency: "USD" }

describe("CurrentMetalPriceClient", () => {
  it("converts the troy-ounce spot price to a per-gram USD price", async () => {
    const client = new CurrentMetalPriceClient(vi.fn().mockResolvedValue(new Response(JSON.stringify(goldUsd))))
    await expect(client.getPricePerGramUsd("XAU")).resolves.toBeCloseTo(4340.28 / 31.1034768, 5)
  })

  it("deduplicates concurrent requests and reuses the six-hour cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(goldUsd)))
    const client = new CurrentMetalPriceClient(fetcher)
    await Promise.all([client.getPricePerGramUsd("XAU"), client.getPricePerGramUsd("XAU")])
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
    await expect(client.getPricePerGramUsd("XAU", true)).resolves.toBeCloseTo(4340.28 / 31.1034768, 5)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("rejects malformed responses", async () => {
    const client = new CurrentMetalPriceClient(
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...goldUsd, currency: "EUR" }))),
    )
    await expect(client.getPricePerGramUsd("XAU")).resolves.toBeNull()
  })
})
