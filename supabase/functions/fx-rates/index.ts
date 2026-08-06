import { createClient } from "npm:@supabase/supabase-js@2"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"

const freshnessMs = 6 * 60 * 60 * 1000


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
  const url = Deno.env.get("SUPABASE_URL")!
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: "authentication_required" }, 401)
  const admin = createClient(url, serviceKey)
  try {
    const body = await request.json()
    const from = code(body.fromCurrencyCode)
    const to = code(body.toCurrencyCode)
    const mode = body.mode === "historical" ? "historical" : "current"
    const requestedDate = typeof body.requestedDate === "string" ? body.requestedDate : undefined
    if (!from || !to || (mode === "historical" && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? ""))) return json({ error: "invalid_currency_or_date" }, 400)
    if (from === to) return json({ rate: 1, provider: "identity", effectiveAt: requestedDate ?? new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString(), stale: false, unavailable: false })

    const { data: cached } = await admin.from("exchange_rates").select("rate,effective_at,fetched_at").eq("provider", "frankfurter").eq("base_currency_code", from).eq("quote_currency_code", to).lte("effective_at", mode === "historical" ? `${requestedDate}T23:59:59Z` : new Date().toISOString()).order("effective_at", { ascending: false }).limit(1).maybeSingle()
    const cacheFresh = mode === "historical" || (cached?.fetched_at && Date.now() - Date.parse(cached.fetched_at) < freshnessMs)
    if (cached && cacheFresh) return json({ rate: Number(cached.rate), provider: "frankfurter", effectiveAt: cached.effective_at, fetchedAt: cached.fetched_at, stale: false, unavailable: false })
    try {
      const rate = await getFrankfurterRate(from, to, mode === "historical" ? requestedDate : undefined)
      const fetchedAt = new Date().toISOString()
      const { error } = await admin.from("exchange_rates").upsert({ user_id: null, provider: "frankfurter", base_currency_code: from, quote_currency_code: to, rate: String(rate.rate), effective_at: `${rate.date}T00:00:00Z`, source: "frankfurter", fetched_at: fetchedAt }, { onConflict: "provider,base_currency_code,quote_currency_code,effective_at" })
      if (error) throw error
      return json({ rate: rate.rate, provider: "frankfurter", effectiveAt: `${rate.date}T00:00:00Z`, fetchedAt, stale: false, unavailable: false })
    } catch (error) {
      if (cached) return json({ rate: Number(cached.rate), provider: "frankfurter", effectiveAt: cached.effective_at, fetchedAt: cached.fetched_at, stale: true, unavailable: false })
      console.error("Frankfurter rate request failed", error)
      return json({ provider: "frankfurter", stale: false, unavailable: true }, 422)
    }
  } catch (error) { console.error(error); return json({ error: "fx_request_failed" }, 500) }
})
