import { describe, expect, it, vi } from "vitest"

import { CurrentFxClient } from "@/services/exchangeRateService"

const usdEgp = { date: "2026-08-06", base: "USD", quote: "EGP", rate: 49.841 }

describe("CurrentFxClient", () => {
  it("returns a valid direct USD/EGP Frankfurter rate", async () => {
    const client = new CurrentFxClient(vi.fn().mockResolvedValue(new Response(JSON.stringify(usdEgp))))
    await expect(client.get("USD", "EGP")).resolves.toMatchObject({ available: true, rate: 49.841, provider: "frankfurter" })
  })

  it("deduplicates concurrent requests and reuses the six-hour cache", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(usdEgp)))
    const client = new CurrentFxClient(fetcher)
    await Promise.all([client.get("USD", "EGP"), client.get("USD", "EGP")])
    await client.get("USD", "EGP")
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it("does not cache failures and retries the provider", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("no", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify(usdEgp)))
    const client = new CurrentFxClient(fetcher)
    await expect(client.get("USD", "EGP")).resolves.toBeNull()
    await expect(client.get("USD", "EGP", true)).resolves.toMatchObject({ rate: 49.841 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("rejects malformed and unsupported responses, while identity is one", async () => {
    const client = new CurrentFxClient(vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...usdEgp, quote: "USD" }))))
    await expect(client.get("USD", "EGP")).resolves.toBeNull()
    await expect(client.get("USD", "USD")).resolves.toMatchObject({ rate: 1, provider: "identity" })
    await expect(client.get("USD", "XYZ")).resolves.toBeNull()
  })
})
