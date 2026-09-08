export type ResolvedFxRate = {
  available: true
  rate: number
  provider: "frankfurter" | "identity"
  effectiveAt: string
  fetchedAt: string
  stale: false
  unavailable: false
}

type FrankfurterPayload = {
  date?: unknown
  base?: unknown
  quote?: unknown
  rate?: unknown
}

const cacheDurationMs = 6 * 60 * 60 * 1000

function currency(value: string) {
  return value.trim().toUpperCase()
}

export class CurrentFxClient {
  private readonly cache = new Map<string, { value: ResolvedFxRate; expiresAt: number }>()
  private readonly pending = new Map<string, Promise<ResolvedFxRate | null>>()
  private readonly fetcher: typeof fetch
  private readonly now: () => number

  constructor(fetcher: typeof fetch = globalThis.fetch.bind(globalThis), now: () => number = Date.now) {
    this.fetcher = fetcher
    this.now = now
  }

  async get(fromCurrencyCode: string, toCurrencyCode: string, retry = false): Promise<ResolvedFxRate | null> {
    const from = currency(fromCurrencyCode)
    const to = currency(toCurrencyCode)
    const fetchedAt = new Date(this.now()).toISOString()
    if (from === to) return { available: true, rate: 1, provider: "identity", effectiveAt: fetchedAt.slice(0, 10), fetchedAt, stale: false, unavailable: false }
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return null
    const key = `${from}/${to}`
    const cached = this.cache.get(key)
    if (!retry && cached && cached.expiresAt > this.now()) return cached.value
    const inFlight = this.pending.get(key)
    if (inFlight) return inFlight
    const request = this.fetchRate(from, to)
    this.pending.set(key, request)
    try {
      return await request
    } finally {
      this.pending.delete(key)
    }
  }

  private async fetchRate(from: string, to: string): Promise<ResolvedFxRate | null> {
    const url = `https://api.frankfurter.dev/v2/rate/${from}/${to}`
    try {
      const response = await this.fetcher(url)
      if (!response.ok) return null
      const payload = await response.json() as FrankfurterPayload
      const failures = [
        payload.base !== from && "base_mismatch",
        payload.quote !== to && "quote_mismatch",
        typeof payload.date !== "string" && "missing_date",
        typeof payload.rate !== "number" && "rate_not_number",
        typeof payload.rate === "number" && !Number.isFinite(payload.rate) && "rate_not_finite",
        typeof payload.rate === "number" && payload.rate <= 0 && "rate_not_positive",
      ].filter(Boolean)
      if (failures.length > 0) return null
      const value: ResolvedFxRate = { available: true, rate: payload.rate as number, provider: "frankfurter", effectiveAt: `${payload.date as string}T00:00:00Z`, fetchedAt: new Date(this.now()).toISOString(), stale: false, unavailable: false }
      this.cache.set(`${from}/${to}`, { value, expiresAt: this.now() + cacheDurationMs })
      return value
    } catch (error) {
      console.error("Current Frankfurter FX request failed", { url, message: error instanceof Error ? error.message : String(error) })
      return null
    }
  }
}

const currentFxClient = new CurrentFxClient()

export function getExchangeRate(fromCurrencyCode: string, toCurrencyCode: string, options: { retry?: boolean } = {}) {
  return currentFxClient.get(fromCurrencyCode, toCurrencyCode, options.retry)
}

export async function convertCurrency(amount: number, fromCurrencyCode: string, toCurrencyCode: string): Promise<number | null> {
  const resolved = await getExchangeRate(fromCurrencyCode, toCurrencyCode)
  return resolved ? amount * resolved.rate : null
}
