import { createClient } from "npm:@supabase/supabase-js@2"
import { getFrankfurterRate } from "../_shared/frankfurter.ts"

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  })
}

function preflightResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  })
}

function currency(value: unknown) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null
}

async function providerRate(from: string, to: string, requestedDate: string) {
  if (from === to) return { rate: 1, date: requestedDate, identity: true }
  const rate = await getFrankfurterRate(from, to, requestedDate)
  return { rate: rate.rate, date: rate.date, identity: false }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return preflightResponse()
  if (request.method !== "POST") return response({ error: "method_not_allowed" }, 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization) return response({ error: "authentication_required" }, 401)
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return response({ error: "authentication_required" }, 401)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  try {
    const { operation, args } = await request.json()
    if (operation !== "add" && operation !== "edit") return response({ error: "invalid_operation" }, 400)
    let accountId: string | null
    let sourceCurrency: string | null
    const occurredAt: string | null = args?.p_occurred_at
    if (operation === "add") {
      accountId = args.p_account_id
      sourceCurrency = args.p_new_asset_currency_code
      if (!accountId && !currency(args.p_new_account_currency_code)) return response({ error: "invalid_account_currency" }, 400)
      if (!sourceCurrency && !args.p_asset_id) return response({ error: "invalid_asset_currency" }, 400)
    } else {
      const { data: transaction, error } = await userClient.from("financial_transactions").select("transaction_currency_code,transaction_entries(account_id,asset_id,memo)").eq("id", args.p_transaction_id).eq("user_id", user.id).single()
      if (error || !transaction) return response({ error: "investment_not_found" }, 404)
      const assetEntry = transaction.transaction_entries.find((entry: { memo: string | null }) => entry.memo === "investment_asset")
      accountId = assetEntry?.account_id ?? null
      sourceCurrency = transaction.transaction_currency_code
    }
    let accountCurrency = currency(args.p_new_account_currency_code)
    if (accountId) {
      const { data: account, error } = await userClient.from("financial_accounts").select("currency_code").eq("id", accountId).eq("user_id", user.id).single()
      if (error || !account) return response({ error: "account_not_found" }, 404)
      accountCurrency = account.currency_code
    }
    if (operation === "add" && !sourceCurrency) {
      // The caller-scoped client enforces the asset visibility policy; catalog
      // assets may be global and therefore have no user_id.
      const { data: asset, error } = await userClient.from("assets").select("currency_code").eq("id", args.p_asset_id).single()
      if (error || !asset) return response({ error: "asset_not_found" }, 404)
      sourceCurrency = asset.currency_code
    }
    const from = currency(sourceCurrency), to = currency(accountCurrency)
    const requestedDate = typeof occurredAt === "string" ? occurredAt.slice(0, 10) : null
    if (!from || !to || !requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return response({ error: "invalid_fx_request" }, 400)
    const { data: cachedRate } = from === to ? { data: null } : await admin
      .from("exchange_rates")
      .select("rate,effective_at,fetched_at")
      .eq("provider", "frankfurter")
      .eq("base_currency_code", from)
      .eq("quote_currency_code", to)
      .lte("effective_at", `${requestedDate}T23:59:59Z`)
      .order("effective_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    let fx: { rate: number; date: string; identity: boolean }
    let stale = false
    try {
      fx = await providerRate(from, to, requestedDate)
    } catch (error) {
      if (!cachedRate || !Number.isFinite(Number(cachedRate.rate)) || Number(cachedRate.rate) <= 0) throw error
      fx = { rate: Number(cachedRate.rate), date: cachedRate.effective_at.slice(0, 10), identity: false }
      stale = true
    }
    if (!fx.identity) {
      const { error } = await admin.from("exchange_rates").upsert({ user_id: null, provider: "frankfurter", base_currency_code: from, quote_currency_code: to, rate: String(fx.rate), effective_at: `${fx.date}T00:00:00Z`, source: "frankfurter", fetched_at: new Date().toISOString() }, { onConflict: "provider,base_currency_code,quote_currency_code,effective_at" })
      if (error) throw error
    }
    const { data, error } = operation === "add"
      ? await userClient.rpc("add_investment", args)
      : await userClient.rpc("edit_investment", args)
    if (error) return response({ error: error.message }, 422)
    return response({ result: data, fx: { provider: fx.identity ? "identity" : "frankfurter", effectiveAt: fx.date, stale } })
  } catch (error) { console.error("Investment FX orchestration failed", error); return response({ error: "historical_fx_unavailable" }, 422) }
})
