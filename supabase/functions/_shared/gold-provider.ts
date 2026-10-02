import { bounded } from "./market-reliability.ts"
import { reserveProviderCall } from "./provider-budget.ts"

type CallerClient = Parameters<typeof reserveProviderCall>[0]
export type MetalSymbol = "XAU" | "XAG"

/** Separate metal spot source. No securities cache, price/cost or FX substitution. */
export async function getGoldQuote(client: CallerClient, symbol: MetalSymbol) {
  await reserveProviderCall(client, "metal")
  return bounded(2500, async (signal) => {
    const response = await fetch(`https://api.gold-api.com/price/${symbol}`, {
      signal,
    })
    if (!response.ok) throw new Error("metal_provider_unavailable")
    const payload = (await response.json()) as {
      price?: unknown
      currency?: unknown
    }
    if (
      typeof payload.price !== "number" ||
      !Number.isFinite(payload.price) ||
      payload.price <= 0 ||
      payload.currency !== "USD"
    ) {
      throw new Error("metal_provider_unavailable")
    }
    return { price: payload.price, currency: "USD" as const }
  })
}
