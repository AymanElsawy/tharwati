import { createClient } from "npm:@supabase/supabase-js@2"
import { projectApiKey } from "../_shared/project-api-keys.ts"
import { bounded } from "../_shared/market-reliability.ts"
import { ProviderBudgetError, reserveProviderCall } from "../_shared/provider-budget.ts"

const provider = "twelve_data"
const minimumQueryLength = 2
const maximumQueryLength = 80
const maximumResults = 10
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type TwelveDataSearchItem = {
  symbol?: unknown
  instrument_name?: unknown
  mic_code?: unknown
  exchange?: unknown
  country?: unknown
  currency?: unknown
  instrument_type?: unknown
}

type AssetSearchResult = {
  symbol: string
  name: string
  micCode: string
  exchange: string
  country: string
  currencyCode: string
  instrumentType: string
  provider: typeof provider
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

function normalizeQuery(value: unknown): string | null {
  if (typeof value !== "string") return null
  const query = value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
  return query.length >= minimumQueryLength && query.length <= maximumQueryLength
    ? query
    : null
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeResult(item: TwelveDataSearchItem): AssetSearchResult | null {
  const symbol = nonEmptyString(item.symbol)
  const name = nonEmptyString(item.instrument_name)
  const micCode = nonEmptyString(item.mic_code)?.toUpperCase() ?? null
  const exchange = nonEmptyString(item.exchange)
  const country = nonEmptyString(item.country)
  const currencyCode = nonEmptyString(item.currency)?.toUpperCase() ?? null
  const instrumentType = nonEmptyString(item.instrument_type)
  if (!symbol || !name || !micCode || !exchange || !country || !instrumentType || !currencyCode || !/^[A-Z]{3}$/.test(currencyCode)) {
    return null
  }
  return { symbol, name, micCode, exchange, country, currencyCode, instrumentType, provider }
}

async function authenticate(request: Request) {
  const authorization = request.headers.get("Authorization")
  if (!authorization) return null
  const url = Deno.env.get("SUPABASE_URL")!
  const userClient = createClient(url, projectApiKey("publishable"), {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (!user) {
    console.error("asset-search authentication failed", errorDetails(error))
    return null
  }
  return userClient
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse()
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  try {
    const userClient = await authenticate(request)
    if (!userClient) return json({ error: "authentication_required" }, 401)
    const body = await request.json()
    const query = normalizeQuery(body?.query)
    if (!query) return json({ error: "invalid_query" }, 400)
    const rawCountry = body?.country
    if (rawCountry != null && typeof rawCountry !== "string") return json({ error: "invalid_country" }, 400)
    const country = nonEmptyString(rawCountry)?.normalize("NFKC").replace(/\s+/g, " ").toLowerCase() ?? null
    if (country && country.length > 80) return json({ error: "invalid_country" }, 400)

    const cacheKey = JSON.stringify([query, country])
    // Durable, bounded shared cache; failures never authorize an unbudgeted call.
    try {
      const { data, error } = await bounded(750, () => userClient.rpc("read_asset_search_cache", { p_cache_key: cacheKey }))
      if (!error && Array.isArray(data)) return json({ available: true, results: data })
    } catch { /* Proceed through the durable provider budget. */ }

    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY")
    if (!apiKey) {
      console.error("asset-search provider key is not configured")
      return json({ available: false, results: [] })
    }

    const url = new URL("https://api.twelvedata.com/symbol_search")
    url.searchParams.set("symbol", query)
    url.searchParams.set("outputsize", String(country ? maximumResults * 10 : maximumResults))
    if (country) url.searchParams.set("country", country)
    url.searchParams.set("apikey", apiKey)
    await reserveProviderCall(userClient, "search")
    const payload = await bounded(2500, async (signal) => {
      const response = await fetch(url, { signal })
      if (!response.ok) throw new Error("asset search provider unavailable")
      return await response.json() as { data?: unknown; status?: unknown }
    })
    if (payload.status === "error" || !Array.isArray(payload.data)) {
      console.error("asset-search provider returned an unavailable response")
      return json({ available: false, results: [] })
    }

    const normalizedCountry = country
    const results = payload.data
      .flatMap((item) => item && typeof item === "object" ? [normalizeResult(item as TwelveDataSearchItem)] : [])
      .filter((item): item is AssetSearchResult => item !== null)
      // Twelve Data's symbol_search does not reliably filter by the `country` param, so re-filter here.
      .filter((item) => !normalizedCountry || item.country.toLocaleLowerCase() === normalizedCountry)
      .slice(0, maximumResults)
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, projectApiKey("secret"))
      await bounded(750, () => admin.rpc("write_asset_search_cache", { p_cache_key: cacheKey, p_results: results }))
    } catch { /* Cache failure does not discard validated provider results. */ }
    return json({ available: true, results })
  } catch (error) {
    if (error instanceof ProviderBudgetError) return json({ available: false, results: [],
      error: error.code, retryAfterSeconds: error.retryAfterSeconds }, error.code === "provider_refresh_rate_limited" ? 429 : 503)
    console.error("asset-search request failed", errorDetails(error))
    return json({ available: false, results: [] })
  }
})
