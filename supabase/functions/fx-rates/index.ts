import { createClient } from "npm:@supabase/supabase-js@2"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"
import { identityRate, positiveRate, providerCacheState } from "../_shared/fx-rate.ts"

const freshnessMs = 6 * 60 * 60 * 1000

function errorDetails(error: unknown) {
  return { message: error instanceof Error ? error.message : String(error) }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function code(value: unknown) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase())
    ? value.trim().toUpperCase() : null
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
      console.error("fx-rates authentication failed", { message: userError?.message ?? null })
      return json({ error: "authentication_required" }, 401)
    }
    const admin = createClient(url, serviceKey)
    const body = await request.json()
    const from = code(body.fromCurrencyCode)
    const to = code(body.toCurrencyCode)
    const mode = body.mode === "historical" ? "historical" : "current"
    const requestedDate = typeof body.requestedDate === "string" ? body.requestedDate : undefined
    if (!from || !to || (mode === "historical" && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? ""))) return json({ error: "invalid_currency_or_date" }, 400)
    if (from === to) {
      const fetchedAt = new Date().toISOString()
      return json(identityRate(requestedDate ?? fetchedAt.slice(0, 10), fetchedAt))
    }

    let cached: { rate: string | number; effective_at: string; fetched_at: string } | null = null
    try {
      const { data, error } = await admin.from("exchange_rates").select("rate,effective_at,fetched_at").eq("provider", "frankfurter").eq("base_currency_code", from).eq("quote_currency_code", to).lte("effective_at", mode === "historical" ? `${requestedDate}T23:59:59Z` : new Date().toISOString()).order("effective_at", { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      cached = data
    } catch (error) {
      console.error("fx-rates cache lookup failed", errorDetails(error))
    }
    const cachedRate = providerCacheState(cached, { historical: mode === "historical", now: Date.now(), freshnessMs })
    if (cachedRate?.fresh) return json({ available: true, rate: cachedRate.rate, provider: "frankfurter", effectiveAt: cachedRate.effectiveAt, fetchedAt: cachedRate.fetchedAt, stale: false, unavailable: false })
    try {
      const rate = await getFrankfurterRate(from, to, mode === "historical" ? requestedDate : undefined)
      const fetchedAt = new Date().toISOString()
      try {
        const { error } = await admin.from("exchange_rates").upsert({ user_id: null, provider: "frankfurter", base_currency_code: from, quote_currency_code: to, rate: String(rate.rate), effective_at: `${rate.date}T00:00:00Z`, source: "frankfurter", fetched_at: fetchedAt }, { onConflict: "provider,base_currency_code,quote_currency_code,effective_at" })
        if (error) throw error
      } catch (error) {
        console.error("fx-rates cache upsert failed", errorDetails(error))
      }
      return json({ available: true, rate: rate.rate, provider: "frankfurter", effectiveAt: `${rate.date}T00:00:00Z`, fetchedAt, stale: false, unavailable: false })
    } catch (error) {
      console.error("fx-rates provider request failed", errorDetails(error))
      if (cachedRate) return json({ available: true, rate: cachedRate.rate, provider: "frankfurter", effectiveAt: cachedRate.effectiveAt, fetchedAt: cachedRate.fetchedAt, stale: true, unavailable: false })
      const fallbackAt = mode === "historical" ? `${requestedDate}T23:59:59Z` : new Date().toISOString()
      const { data: fallbackRows, error: fallbackError } = await userClient.rpc("resolve_historical_exchange_rate", {
        p_source_currency_code: from,
        p_destination_currency_code: to,
        p_requested_at: fallbackAt,
      })
      if (fallbackError) {
        console.error("fx-rates manual fallback failed", errorDetails(fallbackError))
      } else {
        const fallback = fallbackRows?.[0]
        const fallbackRate = positiveRate(fallback?.rate)
        if (fallback && fallbackRate !== null) {
          return json({ available: true, rate: fallbackRate, provider: fallback.source ?? "manual", effectiveAt: fallback.effective_at, fetchedAt: null, stale: true, unavailable: false, direction: fallback.direction })
        }
      }
      return json({ available: false, provider: "frankfurter", stale: false, unavailable: true }, 422)
    }
  } catch (error) { console.error("fx-rates request failed", errorDetails(error)); return json({ error: "fx_request_failed" }, 500) }
})
