import { createClient } from "npm:@supabase/supabase-js@2"
import { projectApiKey } from "../_shared/project-api-keys.ts"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"
import { identityRate, providerCacheState } from "../_shared/fx-rate.ts"
import { json, preflightResponse } from "./http.ts"

import { storedFxCandidates } from "../_shared/stored-fx.ts"
import { bounded, positiveDecimal } from "../_shared/market-reliability.ts"
import { ProviderBudgetError, reserveProviderCall } from "../_shared/provider-budget.ts"

const freshnessMs = 6 * 60 * 60 * 1000

function errorDetails(error: unknown) {
  return { message: error instanceof Error ? error.message : String(error) }
}

function code(value: unknown) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase())
    ? value.trim().toUpperCase() : null
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
      console.error("fx-rates authentication failed", { message: userError?.message ?? null })
      return json({ error: "authentication_required" }, 401)
    }
    const admin = createClient(url, secretKey)
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

    const fallbackAt = mode === "historical" ? `${requestedDate}T23:59:59Z` : new Date().toISOString()
    const stored = await storedFxCandidates(admin, from, to, fallbackAt, user.id)
    const direct = stored[0]
    const cachedRate = providerCacheState(direct ? {
      rate: direct.rate, effective_at: direct.effectiveAt, fetched_at: direct.fetchedAt,
    } : null, { historical: mode === "historical", now: Date.now(), freshnessMs })
    if (cachedRate?.fresh) return json({ available: true, rate: cachedRate.rate, provider: "frankfurter", effectiveAt: cachedRate.effectiveAt, fetchedAt: cachedRate.fetchedAt, stale: false, unavailable: false })
    try {
      const rate = await getFrankfurterRate(from, to, mode === "historical" ? requestedDate : undefined, 1500,
        () => reserveProviderCall(userClient, "fx"))
      const fetchedAt = new Date().toISOString()
      try {
        const { error } = await bounded(1000, (signal) => admin.from("exchange_rates").upsert({ user_id: null, provider: "frankfurter", base_currency_code: from, quote_currency_code: to, rate: String(rate.rate), effective_at: `${rate.date}T00:00:00Z`, source: "frankfurter", fetched_at: fetchedAt }, { onConflict: "provider,base_currency_code,quote_currency_code,effective_at" }).abortSignal(signal))
        if (error) throw error
      } catch (error) {
        console.error("fx-rates cache upsert failed", errorDetails(error))
      }
      return json({ available: true, rate: positiveDecimal(rate.rate), provider: "frankfurter", effectiveAt: `${rate.date}T00:00:00Z`, fetchedAt, stale: false, unavailable: false })
    } catch (error) {
      const refresh = error instanceof ProviderBudgetError
        ? { refreshError: error.code, retryAfterSeconds: error.retryAfterSeconds } : {}
      console.error("fx-rates provider request failed", errorDetails(error))
      if (cachedRate) return json({ available: true, rate: cachedRate.rate, provider: "frankfurter", effectiveAt: cachedRate.effectiveAt, fetchedAt: cachedRate.fetchedAt, stale: true, unavailable: false, ...refresh })
      const fallback = stored.find((row) => row !== null)
      if (fallback) return json({ ...fallback, ...refresh })
      return json({ available: false, provider: "frankfurter", stale: false, unavailable: true, ...refresh }, 422)
    }
  } catch (error) { console.error("fx-rates request failed", errorDetails(error)); return json({ error: "fx_request_failed" }, 500) }
})
