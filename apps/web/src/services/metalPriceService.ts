import { getExchangeRate } from "@/services/exchangeRateService"
import {
  divideDecimals,
  multiplyDecimals,
} from "@/lib/financial-calculations/decimal"
import { readWithDeadline } from "@/lib/network/read-deadline"
import { supabase } from "@/lib/supabase/client"
import {
  parseMetalQuote,
  metalQuoteFreshMs,
  type MetalQuote,
  type MetalSymbol,
} from "../../../../supabase/functions/_shared/metal-quote"

export type { MetalSymbol }
export type ResolvedMetalPrice = MetalQuote & {
  pricePerGram: string
  currencyCode: string
  fxStale?: boolean
}

const protectedMetalFetch: typeof fetch = async (input, init) => {
  const symbol = new URL(String(input), "http://edge.invalid").searchParams.get(
    "symbol"
  )
  const { data, error } = await supabase.functions.invoke("gold-price", {
    body: { symbol },
    signal: init?.signal ?? undefined,
  })
  return new Response(JSON.stringify(data), { status: error ? 503 : 200 })
}
async function storedMetalQuote(
  symbol: MetalSymbol
): Promise<MetalQuote | null> {
  try {
    const { data, error } = await readWithDeadline(2000, () =>
      supabase.rpc("read_metal_spot_quote", { p_symbol: symbol })
    )
    const quote = error ? null : parseMetalQuote(data, symbol)
    return quote ? { ...quote, stale: true } : null
  } catch {
    return null
  }
}

export class CurrentMetalPriceClient {
  private readonly cache = new Map<MetalSymbol, MetalQuote>()
  private readonly pending = new Map<MetalSymbol, Promise<MetalQuote | null>>()
  private readonly fetcher: typeof fetch
  private readonly now: () => number
  private readonly fallback: typeof storedMetalQuote
  constructor(
    fetcher: typeof fetch = protectedMetalFetch,
    now: () => number = Date.now,
    fallback: typeof storedMetalQuote = storedMetalQuote
  ) {
    this.fetcher = fetcher
    this.now = now
    this.fallback = fallback
  }

  async getQuote(
    symbol: MetalSymbol,
    retry = false
  ): Promise<MetalQuote | null> {
    const cached = this.cache.get(symbol)
    if (
      !retry &&
      cached &&
      !cached.stale &&
      this.now() - Date.parse(cached.effectiveAt) < metalQuoteFreshMs &&
      this.now() - Date.parse(cached.fetchedAt) < metalQuoteFreshMs
    )
      return cached
    const pending = this.pending.get(symbol)
    if (pending) return pending
    const request = (async () => {
      try {
        // Leave room inside the market deadline for direct database recovery.
        const quote = await readWithDeadline(6000, async (signal) => {
          const response = await this.fetcher(`gold-price?symbol=${symbol}`, {
            signal,
          })
          return response.ok
            ? parseMetalQuote(await response.json(), symbol, this.now())
            : null
        })
        if (quote) {
          this.cache.set(symbol, quote)
          return quote
        }
      } catch {
        /* Stored recovery below also handles timeout/service failure. */
      }
      const stored = await this.fallback(symbol)
      const recovered =
        stored && cached
          ? Date.parse(cached.effectiveAt) > Date.parse(stored.effectiveAt)
            ? cached
            : stored
          : (stored ?? cached)
      return recovered ? { ...recovered, stale: true } : null
    })()
    this.pending.set(symbol, request)
    try {
      return await request
    } finally {
      this.pending.delete(symbol)
    }
  }

  async getPricePerGramUsd(
    symbol: MetalSymbol,
    retry = false
  ): Promise<number | null> {
    const quote = await this.getQuote(symbol, retry)
    const price = quote ? divideDecimals(quote.price, "31.1034768", 12) : null
    return price === null ? null : Number(price)
  }
}

const currentMetalPriceClient = new CurrentMetalPriceClient()
export function getMetalPricePerGramUsd(symbol: MetalSymbol) {
  return currentMetalPriceClient.getPricePerGramUsd(symbol)
}
export async function getResolvedMetalPrice(
  symbol: MetalSymbol,
  targetCurrencyCode: string
): Promise<ResolvedMetalPrice | null> {
  const quote = await currentMetalPriceClient.getQuote(symbol)
  if (!quote) return null
  const usd = divideDecimals(quote.price, "31.1034768", 12)
  if (usd === null) return null
  const currencyCode = targetCurrencyCode.toUpperCase()
  if (currencyCode === "USD")
    return { ...quote, pricePerGram: usd, currencyCode }
  const rate = await getExchangeRate("USD", currencyCode)
  const pricePerGram = rate ? multiplyDecimals(usd, rate.rate) : null
  return pricePerGram === null
    ? null
    : { ...quote, pricePerGram, currencyCode, fxStale: rate!.stale }
}
export async function getMetalPricePerGram(
  symbol: MetalSymbol,
  targetCurrencyCode: string
): Promise<number | null> {
  const resolved = await getResolvedMetalPrice(symbol, targetCurrencyCode)
  return resolved ? Number(resolved.pricePerGram) : null
}
