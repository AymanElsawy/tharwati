import { createClient } from "npm:@supabase/supabase-js@2"

const provider = "twelve_data"
const minimumQueryLength = 2
const maximumQueryLength = 80
const maximumResults = 10
const cacheDurationMs = 60_000
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

type CachedSearch = {
  expiresAt: number
  results: AssetSearchResult[]
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

const cache = new Map<string, CachedSearch>()

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
  const query = value.trim().replace(/\s+/g, " ")
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
  if (!authorization) return false
  const url = Deno.env.get("SUPABASE_URL")!
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error } = await userClient.auth.getUser()
  if (!user) {
    console.error("asset-search authentication failed", errorDetails(error))
    return false
  }
  return true
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse()
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  if (!await authenticate(request)) return json({ error: "authentication_required" }, 401)

  try {
    const body = await request.json()
    const query = normalizeQuery(body?.query)
    if (!query) return json({ error: "invalid_query" }, 400)

    const cacheKey = query.toLocaleLowerCase()
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return json({ available: true, results: cached.results })
    }

    const apiKey = Deno.env.get("TWELVE_DATA_API_KEY")
    if (!apiKey) {
      console.error("asset-search provider key is not configured")
      return json({ available: false, results: [] })
    }

    const url = new URL("https://api.twelvedata.com/symbol_search")
    url.searchParams.set("symbol", query)
    url.searchParams.set("outputsize", String(maximumResults))
    url.searchParams.set("apikey", apiKey)
    const response = await fetch(url)
    if (!response.ok) {
      console.error("asset-search provider request failed", { status: response.status })
      return json({ available: false, results: [] })
    }
    const payload = await response.json() as { data?: unknown; status?: unknown }
    if (payload.status === "error" || !Array.isArray(payload.data)) {
      console.error("asset-search provider returned an unavailable response")
      return json({ available: false, results: [] })
    }

    const results = payload.data
      .flatMap((item) => item && typeof item === "object" ? [normalizeResult(item as TwelveDataSearchItem)] : [])
      .filter((item): item is AssetSearchResult => item !== null)
      .slice(0, maximumResults)
    cache.set(cacheKey, { results, expiresAt: Date.now() + cacheDurationMs })
    return json({ available: true, results })
  } catch (error) {
    console.error("asset-search request failed", errorDetails(error))
    return json({ available: false, results: [] })
  }
})
