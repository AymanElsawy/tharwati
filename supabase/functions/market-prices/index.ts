import { createClient } from "npm:@supabase/supabase-js@2"
import { projectApiKey } from "../_shared/project-api-keys.ts"
import { bounded, chunks, positiveDecimal } from "../_shared/market-reliability.ts"
import { mapWithConcurrency } from "../_shared/bounded-concurrency.ts"
import { ProviderBudgetError } from "../_shared/provider-budget.ts"
import { reserveTwelveDataSymbols } from "../_shared/twelve-data-reservation.ts"
import { twelveDataHttpRateLimit, twelveDataRateLimit } from "../_shared/twelve-data-errors.ts"
import {
  resolveTwelveDataInstrument,
  type TwelveDataIdentifier,
} from "../_shared/twelve-data-identity.ts"

const provider = "twelve_data"
const freshnessMs = 15 * 60 * 1000
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Asset = {
  id: string
  asset_type_code: string
  symbol: string | null
  exchange: string | null
  currency_code: string
}

type StoredPrice = {
  asset_id: string
  provider: string
  price: string | number
  currency_code: string
  as_of: string
  fetched_at: string
  price_type: "realtime" | "delayed" | "previous_close" | "stale" | "manual"
  user_id: string | null
}

type ResolvedPrice = {
  assetId: string
  available: boolean
  provider: string | null
  price: string | null
  currencyCode: string | null
  effectiveAt: string | null
  fetchedAt: string | null
  priceType: StoredPrice["price_type"] | null
  stale: boolean
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}

function preflightResponse() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

function errorDetails(error: unknown) {
  return { message: error instanceof Error ? error.message : String(error) }
}

const validPrice = positiveDecimal

function isFresh(price: StoredPrice) {
  return Date.now() - Date.parse(price.fetched_at) < freshnessMs
}

function toResolved(price: StoredPrice, stale = false): ResolvedPrice {
  stale ||= price.price_type === "previous_close" || price.price_type === "manual" || price.price_type === "stale"
  const value = validPrice(price.price)
  return {
    assetId: price.asset_id,
    available: value !== null,
    provider: price.provider,
    price: value,
    currencyCode: price.currency_code,
    effectiveAt: price.as_of,
    fetchedAt: price.fetched_at,
    priceType: stale && price.price_type !== "manual" && price.price_type !== "previous_close" ? "stale" : price.price_type,
    stale,
  }
}

function quoteUrl(
  path: "price" | "quote",
  symbols: string[],
  micCode: string,
  apiKey: string,
) {
  const query = new URLSearchParams({
    symbol: symbols.join(","),
    mic_code: micCode,
    apikey: apiKey,
  })
  return `https://api.twelvedata.com/${path}?${query}`
}

async function getJson(url: string, deadline: number) {
  return await bounded(refreshTimeout(deadline, 2500), async (signal) => {
    const response = await fetch(url, { signal })
    const throttled = twelveDataHttpRateLimit(response)
    if (throttled) throw throttled
    if (!response.ok) throw new Error(`Twelve Data returned HTTP ${response.status}`)
    const payload = await response.json() as Record<string, unknown>
    const rateLimit = twelveDataRateLimit(payload, response.headers.get("Retry-After"))
    if (rateLimit) throw rateLimit
    return payload
  })
}

function refreshTimeout(deadline: number, maximum: number) {
  const remaining = deadline - Date.now()
  if (remaining <= 0) throw new DOMException("Provider refresh budget exhausted", "AbortError")
  return Math.min(maximum, remaining)
}

function itemFor(response: Record<string, unknown>, symbol: string): Record<string, unknown> | null {
  const item = response[symbol]
  return item && typeof item === "object" && !Array.isArray(item)
    ? item as Record<string, unknown>
    : response.symbol === symbol ? response : null
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse()
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization) return json({ error: "authentication_required" }, 401)

  try {
    const url = Deno.env.get("SUPABASE_URL")!
    const publishableKey = projectApiKey("publishable")
    const secretKey = projectApiKey("secret")
    const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (!user) {
      console.error("market-prices authentication failed", errorDetails(userError))
      return json({ error: "authentication_required" }, 401)
    }
    const body = await request.json()
    const assetIds = Array.isArray(body.assetIds)
      ? [...new Set(body.assetIds.filter((id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))]
      : []
    if (assetIds.length === 0) return json({ error: "invalid_asset_ids" }, 400)

    const assets: Asset[] = []
    for (const batch of chunks(assetIds, 100)) {
      const { data: accessibleAssets, error: assetsError } = await userClient
        .from("assets")
        .select("id,asset_type_code,symbol,exchange,currency_code")
        .in("id", batch)
        .eq("is_active", true)
      if (assetsError) throw assetsError
      assets.push(...(accessibleAssets ?? []) as Asset[])
    }
    const admin = createClient(url, secretKey)
    // Independent top-one reads prevent another asset's history from consuming
    // the API row cap. Each source can fail without discarding the other source.
    const rows = (await mapWithConcurrency(assets, 12, async (asset) => {
      const candidates = await Promise.all([provider, "manual"].map(async (source) => {
        try {
          let query = admin.from("market_prices")
            .select("asset_id,provider,price::text,currency_code,as_of,fetched_at,price_type,user_id")
            .eq("asset_id", asset.id).eq("provider", source)
            .eq("currency_code", asset.currency_code).gt("price", 0)
            .lte("as_of", new Date().toISOString())
          query = source === "manual" ? query.eq("user_id", user.id) : query.is("user_id", null)
          const { data, error } = await bounded(2000, (signal) => query
            .order("fetched_at", { ascending: false }).order("as_of", { ascending: false })
            .order("id", { ascending: false }).limit(1).abortSignal(signal).maybeSingle())
          if (error) throw error
          return data as StoredPrice | null
        } catch (error) {
          console.error("market-prices persisted source lookup failed", errorDetails(error))
          return null
        }
      }))
      return candidates.filter((row): row is StoredPrice => row !== null)
    })).flat()
    const fresh = new Map<string, StoredPrice>()
    const stale = new Map<string, StoredPrice>()
    const manual = new Map<string, StoredPrice>()
    for (const row of rows) {
      if (validPrice(row.price) === null) continue
      if (row.provider === provider && !fresh.has(row.asset_id) && isFresh(row)) fresh.set(row.asset_id, row)
      else if (row.provider === provider && !stale.has(row.asset_id)) stale.set(row.asset_id, row)
      else if (row.user_id === user.id && row.provider === "manual" && !manual.has(row.asset_id)) manual.set(row.asset_id, row)
    }

    const results = new Map<string, ResolvedPrice>()
    for (const price of fresh.values()) results.set(price.asset_id, toResolved(price))
    const pending = assets.filter((asset) => !results.has(asset.id))
    let refreshError: string | undefined
    let retryAfterSeconds: number | undefined
    let providerThrottled = false
    const providerJson = async (path: "price" | "quote", symbols: string[], micCode: string, apiKey: string, deadline: number) => {
      if (providerThrottled) throw new ProviderBudgetError("provider_refresh_rate_limited", retryAfterSeconds)
      refreshTimeout(deadline, 2500)
      const requested = symbols.slice(0, 50) // Existing RPC/provider batch bound, not a plan limit.
      const granted = await reserveTwelveDataSymbols(userClient, requested.length)
      const batchSymbols = requested.slice(0, granted)
      let payload: Record<string, unknown> = {}
      try { payload = await getJson(quoteUrl(path, batchSymbols, micCode, apiKey), deadline) }
      catch (error) {
        if (error instanceof ProviderBudgetError) throw error
        console.error("market-prices provider request failed", errorDetails(error))
      }
      return { payload, symbols: batchSymbols }
    }
    const recordRefreshError = (error: unknown) => {
      if (error instanceof ProviderBudgetError) {
        refreshError = error.code
        retryAfterSeconds = Math.max(retryAfterSeconds ?? 0, error.retryAfterSeconds ?? 0) || undefined
      }
    }
    const identifiers: TwelveDataIdentifier[] = []
    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY")
    // One request-wide refresh budget includes identifiers and every listing group.
    const providerDeadline = Date.now() + 8000
    if (apiKey) try {
      for (const batch of chunks(pending, 100)) {
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await bounded(refreshTimeout(providerDeadline, 2000), (signal) => admin
            .from("asset_identifiers").select("asset_id,namespace,normalized_value")
            .in("asset_id", batch.map((asset) => asset.id))
            .eq("scheme", "provider").eq("provider", provider)
            .order("id", { ascending: true }).range(offset, offset + 499).abortSignal(signal))
          if (error) throw error
          identifiers.push(...(data ?? []) as TwelveDataIdentifier[])
          if ((data ?? []).length < 500) break
        }
      }
    } catch (error) {
      console.error("market-prices identifier refresh failed", errorDetails(error))
    }
    const mapped = pending.flatMap((asset) => {
      const instrument = resolveTwelveDataInstrument(asset, identifiers)
      return instrument ? [{ asset, instrument }] : []
    })
    if (mapped.length > 0 && apiKey) {
      try {
        const byMicCode = new Map<string, typeof mapped>()
        for (const item of mapped) {
          const instruments = byMicCode.get(item.instrument.micCode) ?? []
          instruments.push(item)
          byMicCode.set(item.instrument.micCode, instruments)
        }
        // Serialize outbound work so an observed denial/429 stops later requests.
        for (const [micCode, instruments] of byMicCode) {
          if (providerThrottled) break
          try {
            let remaining = [...new Set(instruments.map(({ instrument }) => instrument.symbol))]
            while (remaining.length > 0 && !providerThrottled) {
              const { payload: current, symbols } = await providerJson("price", remaining, micCode, apiKey, providerDeadline)
              remaining = remaining.slice(symbols.length)
              for (const item of Object.values(current)) {
                const rateLimit = twelveDataRateLimit(item)
                if (rateLimit) { providerThrottled = true; recordRefreshError(rateLimit) }
              }
              const batchInstruments = instruments.filter(({ instrument }) => symbols.includes(instrument.symbol))
              const missingCurrent = batchInstruments.filter(({ asset, instrument }) => {
                const item = itemFor(current, instrument.symbol) ??
                  (symbols.length === 1 && current.symbol === undefined && current.status !== "error" ? current : null)
                const price = item ? validPrice(item.price) : null
                if (!price) return true
                const fetchedAt = new Date().toISOString()
                const resolved: ResolvedPrice = {
                  assetId: asset.id,
                  available: true,
                  provider,
                  price,
                  currencyCode: asset.currency_code,
                  effectiveAt: fetchedAt,
                  fetchedAt,
                  priceType: "realtime",
                  stale: false,
                }
                results.set(asset.id, resolved)
                return false
              })
              if (missingCurrent.length > 0 && !providerThrottled) {
                let missingSymbols = [...new Set(missingCurrent.map(({ instrument }) => instrument.symbol))]
                while (missingSymbols.length > 0 && !providerThrottled) {
                  const { payload: quotes, symbols: quoteSymbols } = await providerJson(
                    "quote",
                    missingSymbols,
                    micCode,
                    apiKey,
                    providerDeadline,
                  )
                  missingSymbols = missingSymbols.slice(quoteSymbols.length)
                  for (const item of Object.values(quotes)) {
                    const rateLimit = twelveDataRateLimit(item)
                    if (rateLimit) { providerThrottled = true; recordRefreshError(rateLimit) }
                  }
                  for (const { asset, instrument } of missingCurrent) {
                    if (!quoteSymbols.includes(instrument.symbol)) continue
                    const quote = itemFor(quotes, instrument.symbol)
                    const price = quote ? validPrice(quote.previous_close) : null
                    if (!quote || !price) continue
                    const fetchedAt = new Date().toISOString()
                    const effectiveAt = typeof quote.datetime === "string" ? quote.datetime : fetchedAt
                    results.set(asset.id, {
                      assetId: asset.id,
                      available: true,
                      provider,
                      price,
                      currencyCode: asset.currency_code,
                      effectiveAt,
                      fetchedAt,
                      priceType: "previous_close",
                      stale: true,
                    })
                  }
                }
              }
            }
          } catch (error) {
            // Denial, reservation outage, or deadline: never wait or continue refresh.
            providerThrottled = true
            recordRefreshError(error)
            console.error("market-prices provider request failed", errorDetails(error))
          }
        }
        const cacheRows = pending.map((asset) => results.get(asset.id)).filter((price): price is ResolvedPrice => Boolean(price))
          .filter((price) => price.provider === provider && price.price !== null)
          .map((price) => ({ user_id: null, asset_id: price.assetId, provider, price: String(price.price), currency_code: price.currencyCode, as_of: price.effectiveAt, fetched_at: price.fetchedAt, price_type: price.priceType }))
        if (cacheRows.length > 0) {
          const { error } = await bounded(1000, (signal) => admin.from("market_prices").insert(cacheRows).abortSignal(signal))
          if (error) console.error("market-prices cache write failed", errorDetails(error))
        }
      } catch (error) {
        console.error("market-prices provider request failed", errorDetails(error))
      }
    }
    for (const asset of pending) {
      if (results.has(asset.id)) continue
      const stalePrice = stale.get(asset.id)
      if (stalePrice) results.set(asset.id, toResolved(stalePrice, true))
      else if (manual.has(asset.id)) results.set(asset.id, toResolved(manual.get(asset.id)!))
      else results.set(asset.id, { assetId: asset.id, available: false, provider: null, price: null, currencyCode: null, effectiveAt: null, fetchedAt: null, priceType: null, stale: false })
    }
    return json({ prices: assets.map((asset) => results.get(asset.id)!).filter(Boolean), refreshError, retryAfterSeconds })
  } catch (error) {
    console.error("market-prices request failed", errorDetails(error))
    return json({ error: "market_prices_request_failed" }, 500)
  }
})
