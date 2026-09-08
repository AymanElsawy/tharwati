import { convertCurrency } from "@/services/exchangeRateService"

export type MetalSymbol = "XAU" | "XAG"

export type ResolvedMetalPrice = {
  available: true
  pricePerGram: number
  currencyCode: string
  provider: "gold-api"
  fetchedAt: string
}

type MetalApiPayload = {
  price?: unknown
  currency?: unknown
}

const gramsPerTroyOunce = 31.1034768
const cacheDurationMs = 6 * 60 * 60 * 1000

export class CurrentMetalPriceClient {
  private readonly cache = new Map<MetalSymbol, { value: number; expiresAt: number }>()
  private readonly pending = new Map<MetalSymbol, Promise<number | null>>()
  private readonly fetcher: typeof fetch
  private readonly now: () => number

  constructor(fetcher: typeof fetch = globalThis.fetch.bind(globalThis), now: () => number = Date.now) {
    this.fetcher = fetcher
    this.now = now
  }

  async getPricePerGramUsd(symbol: MetalSymbol, retry = false): Promise<number | null> {
    const cached = this.cache.get(symbol)
    if (!retry && cached && cached.expiresAt > this.now()) return cached.value
    const inFlight = this.pending.get(symbol)
    if (inFlight) return inFlight
    const request = this.fetchPricePerGramUsd(symbol)
    this.pending.set(symbol, request)
    try {
      return await request
    } finally {
      this.pending.delete(symbol)
    }
  }

  private async fetchPricePerGramUsd(symbol: MetalSymbol): Promise<number | null> {
    const url = `https://api.gold-api.com/price/${symbol}`
    try {
      const response = await this.fetcher(url)
      if (!response.ok) return null
      const payload = (await response.json()) as MetalApiPayload
      const failures = [
        typeof payload.price !== "number" && "price_not_number",
        typeof payload.price === "number" && !Number.isFinite(payload.price) && "price_not_finite",
        typeof payload.price === "number" && payload.price <= 0 && "price_not_positive",
        payload.currency !== "USD" && "currency_not_usd",
      ].filter(Boolean)
      if (failures.length > 0) return null
      const pricePerGram = (payload.price as number) / gramsPerTroyOunce
      this.cache.set(symbol, { value: pricePerGram, expiresAt: this.now() + cacheDurationMs })
      return pricePerGram
    } catch (error) {
      console.error("Metal price request failed", {
        url,
        message: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }
}

const currentMetalPriceClient = new CurrentMetalPriceClient()

export function getMetalPricePerGramUsd(symbol: MetalSymbol) {
  return currentMetalPriceClient.getPricePerGramUsd(symbol)
}

export async function getMetalPricePerGram(
  symbol: MetalSymbol,
  targetCurrencyCode: string,
): Promise<number | null> {
  const pricePerGramUsd = await currentMetalPriceClient.getPricePerGramUsd(symbol)
  if (pricePerGramUsd === null) return null
  if (targetCurrencyCode.toUpperCase() === "USD") return pricePerGramUsd
  return convertCurrency(pricePerGramUsd, "USD", targetCurrencyCode)
}
