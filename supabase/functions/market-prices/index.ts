import { createClient } from "npm:@supabase/supabase-js@2"
import {
  resolveTwelveDataInstrument,
  type TwelveDataIdentifier,
} from "../_shared/twelve-data-identity.ts"

const provider = "twelve_data"
const freshnessMs = 15 * 60 * 1000

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
  price: number | null
  currencyCode: string | null
  effectiveAt: string | null
  fetchedAt: string | null
  priceType: StoredPrice["price_type"] | null
  stale: boolean
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function errorDetails(error: unknown) {
  return { message: error instanceof Error ? error.message : String(error) }
}

function validPrice(value: unknown): number | null {
  const price = typeof value === "number" ? value : Number(value)
  return Number.isFinite(price) && price > 0 ? price : null
}

function isFresh(price: StoredPrice) {
  return Date.now() - Date.parse(price.fetched_at) < freshnessMs
}

function toResolved(price: StoredPrice, stale = false): ResolvedPrice {
  const value = validPrice(price.price)
  return {
    assetId: price.asset_id,
    available: value !== null,
    provider: price.provider,
    price: value,
    currencyCode: price.currency_code,
    effectiveAt: price.as_of,
    fetchedAt: price.fetched_at,
    priceType: stale ? "stale" : price.price_type,
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

async function getJson(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Twelve Data returned HTTP ${response.status}`)
  return response.json() as Promise<Record<string, unknown>>
}

function itemFor(response: Record<string, unknown>, symbol: string): Record<string, unknown> | null {
  const item = response[symbol]
  return item && typeof item === "object" && !Array.isArray(item)
    ? item as Record<string, unknown>
    : response.symbol === symbol ? response : null
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization) return json({ error: "authentication_required" }, 401)

  try {
    const url = Deno.env.get("SUPABASE_URL")!
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (!user) {
      console.error("market-prices authentication failed", errorDetails(userError))
      return json({ error: "authentication_required" }, 401)
    }
    const body = await request.json()
    const assetIds = Array.isArray(body.assetIds)
      ? [...new Set(body.assetIds.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 50)
      : []
    if (assetIds.length === 0) return json({ error: "invalid_asset_ids" }, 400)

    const { data: accessibleAssets, error: assetsError } = await userClient
      .from("assets")
      .select("id,asset_type_code,symbol,exchange,currency_code")
      .in("id", assetIds)
      .eq("is_active", true)
    if (assetsError) throw assetsError
    const assets = (accessibleAssets ?? []) as Asset[]
    const admin = createClient(url, serviceKey)
    const { data: storedRows, error: cacheError } = await admin
      .from("market_prices")
      .select("asset_id,provider,price,currency_code,as_of,fetched_at,price_type,user_id")
      .in("asset_id", assets.map((asset) => asset.id))
      .order("fetched_at", { ascending: false })
    if (cacheError) throw cacheError
    const rows = (storedRows ?? []) as StoredPrice[]
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
    const { data: providerIdentifierRows, error: providerIdentifiersError } = pending.length === 0
      ? { data: [], error: null }
      : await admin
        .from("asset_identifiers")
        .select("asset_id,namespace,normalized_value")
        .in("asset_id", pending.map((asset) => asset.id))
        .eq("scheme", "provider")
        .eq("provider", provider)
    if (providerIdentifiersError) throw providerIdentifiersError

    const identifiers = (providerIdentifierRows ?? []) as TwelveDataIdentifier[]
    const mapped = pending.flatMap((asset) => {
      const instrument = resolveTwelveDataInstrument(asset, identifiers)
      return instrument ? [{ asset, instrument }] : []
    })
    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY")
    if (mapped.length > 0 && apiKey) {
      try {
        const byMicCode = new Map<string, typeof mapped>()
        for (const item of mapped) {
          const instruments = byMicCode.get(item.instrument.micCode) ?? []
          instruments.push(item)
          byMicCode.set(item.instrument.micCode, instruments)
        }
        for (const [micCode, instruments] of byMicCode) {
          if (!micCode || !instruments) continue
          const symbols = [...new Set(instruments.map(({ instrument }) => instrument.symbol))]
          const current = await getJson(quoteUrl("price", symbols, micCode, apiKey))
          const missingCurrent = instruments.filter(({ asset, instrument }) => {
            const item = itemFor(current, instrument.symbol)
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
          if (missingCurrent.length > 0) {
            const quotes = await getJson(quoteUrl(
              "quote",
              missingCurrent.map(({ instrument }) => instrument.symbol),
              micCode,
              apiKey,
            ))
            for (const { asset, instrument } of missingCurrent) {
              const quote = itemFor(quotes, instrument.symbol)
              const price = quote ? validPrice(quote.previous_close) : null
              if (!price) continue
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
                stale: false,
              })
            }
          }
        }
        const cacheRows = [...results.values()]
          .filter((price) => price.provider === provider && price.price !== null)
          .map((price) => ({ user_id: null, asset_id: price.assetId, provider, price: String(price.price), currency_code: price.currencyCode, as_of: price.effectiveAt, fetched_at: price.fetchedAt, price_type: price.priceType }))
        if (cacheRows.length > 0) {
          const { error } = await admin.from("market_prices").insert(cacheRows)
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
    return json({ prices: assets.map((asset) => results.get(asset.id)!).filter(Boolean) })
  } catch (error) {
    console.error("market-prices request failed", errorDetails(error))
    return json({ error: "market_prices_request_failed" }, 500)
  }
})
