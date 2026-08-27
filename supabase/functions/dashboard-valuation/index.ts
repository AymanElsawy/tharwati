import { createClient } from "npm:@supabase/supabase-js@2"
import {
  dashboardValuationReason,
  type DashboardValuationStage,
} from "../_shared/dashboard-valuation-diagnostics.ts"
import {
  normalizeDashboardValuationHolding,
  type DashboardValuationHolding,
  type DashboardValuationHoldingRuntime,
} from "../_shared/dashboard-valuation-holdings.ts"
import {
  normalizeDashboardValuationMetalPurchase,
  type DashboardValuationMetalPurchase,
  type DashboardValuationMetalPurchaseRuntime,
} from "../_shared/dashboard-valuation-metal-purchases.ts"

const snapshotTtlMs = 15 * 60 * 1000
const gramsPerTroyOunce = "31.1034768"
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Decimal = string
type Account = {
  id: string; account_type_code: string; name: string; currency_code: string; opening_balance: Decimal
  bank_subtype: "debit" | "credit" | null; is_active: boolean; metal_type: "gold" | "silver" | null
}
type Balance = { account_id: string; current_balance: Decimal }
type Price = { assetId: string; available: boolean; price: number | null; currencyCode: string | null; stale: boolean }
type Snapshot = {
  asOf: string; expiresAt: string; freshness: "fresh" | "stale" | "unavailable"
  currentValues: Record<string, Decimal | null>
  accountBalances: Record<string, Decimal>
  rates: Record<string, Decimal | null>
  unavailableSources: string[]
  portfolioAllocation: {
    status: "complete" | "incomplete"
    holdings: Array<{ assetId: string; assetTypeCode: string; marketValueBaseCurrency: Decimal }>
  }
}

type Parsed = { coefficient: bigint; scale: number }
const decimalPattern = /^[+-]?\d+(?:\.\d+)?$/
function parse(value: string): Parsed | null {
  const trimmed = value.trim()
  if (!decimalPattern.test(trimmed)) return null
  const negative = trimmed.startsWith("-")
  const unsigned = trimmed.replace(/^[+-]/, "")
  const [integer, fractional = ""] = unsigned.split(".")
  return { coefficient: BigInt(`${integer}${fractional}`.replace(/^0+(?=\d)/, "") || "0") * (negative ? -1n : 1n), scale: fractional.length }
}
function format(coefficient: bigint, scale: number): Decimal {
  const negative = coefficient < 0n; const digits = (negative ? -coefficient : coefficient).toString()
  if (scale === 0) return `${negative ? "-" : ""}${digits}`
  const padded = digits.padStart(scale + 1, "0"); const fractional = padded.slice(-scale).replace(/0+$/, "")
  return fractional ? `${negative ? "-" : ""}${padded.slice(0, -scale)}.${fractional}` : `${negative ? "-" : ""}${padded.slice(0, -scale)}`
}
function add(left: Decimal, right: Decimal): Decimal | null {
  const a = parse(left); const b = parse(right); if (!a || !b) return null
  const scale = Math.max(a.scale, b.scale)
  return format(a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale), scale)
}
function multiply(left: Decimal, right: Decimal): Decimal | null {
  const a = parse(left); const b = parse(right); return a && b ? format(a.coefficient * b.coefficient, a.scale + b.scale) : null
}
function divide(left: Decimal, right: Decimal, scale = 10): Decimal | null {
  const a = parse(left); const b = parse(right); if (!a || !b || b.coefficient === 0n) return null
  const negative = (a.coefficient < 0n) !== (b.coefficient < 0n); const numerator = a.coefficient < 0n ? -a.coefficient : a.coefficient; const denominator = b.coefficient < 0n ? -b.coefficient : b.coefficient
  const scaled = numerator * 10n ** BigInt(b.scale + scale); const divisor = denominator * 10n ** BigInt(a.scale); const quotient = scaled / divisor; const remainder = scaled % divisor
  return format(negative ? -(quotient + (remainder * 2n >= divisor ? 1n : 0n)) : quotient + (remainder * 2n >= divisor ? 1n : 0n), scale)
}
function sum(values: readonly Decimal[]): Decimal | null { return values.reduce<Decimal | null>((total, value) => total === null ? null : add(total, value), "0") }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } }) }
function validCurrency(value: unknown): value is string { return typeof value === "string" && /^[A-Z]{3}$/.test(value) }
function metalFactor(purity: string): Decimal | null {
  const karat = /^([0-9]+)k$/.exec(purity)?.[1]
  if (karat && ["24", "22", "21", "18", "14", "10", "9"].includes(karat)) return divide(karat, "24", 18)
  return ({ "999": "0.999", "958": "0.958", "950": "0.95", "925": "0.925", "900": "0.9", "835": "0.835", "800": "0.8" } as Record<string, Decimal>)[purity] ?? null
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const authorization = request.headers.get("Authorization")
  if (!authorization) return json({ error: "authentication_required" }, 401)
  let stage: DashboardValuationStage = "initialization"
  try {
    const url = Deno.env.get("SUPABASE_URL")!; const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: "authentication_required" }, 401)
    const { data: profile, error: profileError } = await userClient.from("profiles").select("base_currency_code").eq("id", user.id).single()
    if (profileError || !validCurrency(profile?.base_currency_code)) return json({ error: "base_currency_unavailable" }, 422)
    const baseCurrencyCode = profile.base_currency_code
    stage = "snapshot_lookup"
    const { data: existing, error: existingError } = await userClient.from("dashboard_valuation_snapshots").select("snapshot").eq("user_id", user.id).eq("base_currency_code", baseCurrencyCode).gt("expires_at", new Date().toISOString()).maybeSingle()
    if (existingError) throw existingError
    if (existing?.snapshot) {
      stage = "response_serialization"
      return json(existing.snapshot)
    }

    stage = "accounts_query"
    const { data: accountRows, error: accountsError } = await userClient.from("financial_accounts").select("id,account_type_code,name,currency_code,opening_balance,bank_subtype,is_active,metal_type").eq("is_active", true)
    if (accountsError) throw accountsError
    stage = "account_balances"
    const { data: balanceRows, error: balancesError } = await userClient.rpc("get_account_balances", { p_account_ids: null })
    if (balancesError) throw balancesError
    const accounts = (accountRows ?? []) as Account[]; const balances = new Map(((balanceRows ?? []) as Balance[]).map((row) => [row.account_id, String(row.current_balance)]))
    const brokerageAccounts = accounts.filter((account) => account.account_type_code === "brokerage")
    const metalAccounts = accounts.filter((account) => account.account_type_code === "gold")
    stage = "holdings_query"
    const { data: holdingRows, error: holdingsError } = brokerageAccounts.length === 0 ? { data: [], error: null } : await userClient.from("holdings").select("account_id,asset_id,quantity,asset:assets(currency_code,asset_type_code)").in("account_id", brokerageAccounts.map((account) => account.id)).gt("quantity", "0")
    if (holdingsError) throw holdingsError
    stage = "metal_purchases"
    const { data: purchaseRows, error: purchasesError } = metalAccounts.length === 0 ? { data: [], error: null } : await userClient.rpc("get_effective_metal_purchases", { p_account_ids: metalAccounts.map((account) => account.id) })
    if (purchasesError) throw purchasesError
    const holdings = ((holdingRows ?? []) as DashboardValuationHoldingRuntime[])
      .map(normalizeDashboardValuationHolding) as DashboardValuationHolding[]
    const purchases = ((purchaseRows ?? []) as DashboardValuationMetalPurchaseRuntime[])
      .map(normalizeDashboardValuationMetalPurchase) as DashboardValuationMetalPurchase[]
    const rateCache = new Map<string, Decimal | null>(); let usedStale = false
    const portfolioAllocationHoldings: Snapshot["portfolioAllocation"]["holdings"] = []
    let portfolioAllocationIncomplete = false
    const resolveRate = async (from: string, to: string): Promise<Decimal | null> => {
      if (from === to) return "1"; const key = `${from}/${to}`; if (rateCache.has(key)) return rateCache.get(key)!
      try {
        const response = await fetch(`${url}/functions/v1/fx-rates`, {
          method: "POST",
          headers: { Authorization: authorization, apikey: anon, "Content-Type": "application/json" },
          body: JSON.stringify({ fromCurrencyCode: from, toCurrencyCode: to, mode: "current" }),
        })
        const resolved = await response.json() as { available?: unknown; rate?: unknown; stale?: unknown }
        if (response.ok && resolved.available === true && typeof resolved.rate === "number" && Number.isFinite(resolved.rate) && resolved.rate > 0) {
          if (resolved.stale === true) usedStale = true
          const value = String(resolved.rate); rateCache.set(key, value); return value
        }
        throw new Error("FX provider unavailable")
      } catch {
        const { data: direct } = await userClient.from("exchange_rates").select("rate").eq("base_currency_code", from).eq("quote_currency_code", to).order("effective_at", { ascending: false }).limit(1).maybeSingle()
        if (direct?.rate) { usedStale = true; const value = String(direct.rate); rateCache.set(key, value); return value }
        const { data: inverse } = await userClient.from("exchange_rates").select("rate").eq("base_currency_code", to).eq("quote_currency_code", from).order("effective_at", { ascending: false }).limit(1).maybeSingle()
        const value = inverse?.rate ? divide("1", String(inverse.rate), 18) : null; if (value) usedStale = true; rateCache.set(key, value); return value
      }
    }
    const assetIds = [...new Set(holdings.map((holding) => holding.asset_id))]
    const prices = new Map<string, Price>()
    if (assetIds.length > 0) {
      stage = "market_prices_request"
      const response = await fetch(`${url}/functions/v1/market-prices`, { method: "POST", headers: { Authorization: authorization, apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ assetIds }) })
      if (response.ok) for (const item of ((await response.json()) as { prices?: Price[] }).prices ?? []) prices.set(item.assetId, item)
    }
    const metalUsd = new Map<"XAU" | "XAG", Decimal | null>()
    for (const symbol of [...new Set(metalAccounts.map((account) => account.metal_type === "silver" ? "XAG" : "XAU"))] as Array<"XAU" | "XAG">) {
      try { const response = await fetch(`https://api.gold-api.com/price/${symbol}`); const payload = await response.json() as { price?: unknown; currency?: unknown }; metalUsd.set(symbol, typeof payload.price === "number" && Number.isFinite(payload.price) && payload.price > 0 && payload.currency === "USD" ? divide(String(payload.price), gramsPerTroyOunce, 12) : null) } catch { metalUsd.set(symbol, null) }
    }
    stage = "build_account_values"
    const currentValues: Record<string, Decimal | null> = {}; const unavailableSources: string[] = []
    for (const account of accounts) {
      if (account.account_type_code === "brokerage") {
        stage = "build_brokerage_values"
        const accountHoldings = holdings.filter((holding) => holding.account_id === account.id)
        const values: Decimal[] = []; let unavailable = false
        for (const holding of accountHoldings) {
          const price = prices.get(holding.asset_id); const currency = price?.currencyCode ?? holding.asset?.currency_code ?? null
          if (!price?.available || price.price === null || !currency || !holding.asset?.asset_type_code) { unavailable = true; portfolioAllocationIncomplete = true; break }
          if (price.stale) usedStale = true
          stage = "fx_conversion"
          const rate = await resolveRate(currency, account.currency_code)
          stage = "build_brokerage_values"
          const marketValue = rate ? multiply(String(price.price), holding.quantity) : null
          const converted = marketValue && rate ? multiply(marketValue, rate) : null
          if (!converted) { unavailable = true; portfolioAllocationIncomplete = true; break }
          stage = "fx_conversion"
          const baseRate = await resolveRate(account.currency_code, baseCurrencyCode)
          stage = "build_brokerage_values"
          const marketValueBaseCurrency = baseRate ? multiply(converted, baseRate) : null
          if (!marketValueBaseCurrency) { unavailable = true; portfolioAllocationIncomplete = true; break }
          portfolioAllocationHoldings.push({ assetId: holding.asset_id, assetTypeCode: holding.asset.asset_type_code, marketValueBaseCurrency })
          values.push(converted)
        }
        const holdingsValue = unavailable ? null : sum(values); const cash = balances.get(account.id)
        currentValues[account.id] = holdingsValue === null || !cash ? null : add(cash, holdingsValue)
      } else if (account.account_type_code === "gold") {
        stage = "build_metal_values"
        const usd = metalUsd.get(account.metal_type === "silver" ? "XAG" : "XAU") ?? null
        stage = "fx_conversion"
        const rate = usd ? await resolveRate("USD", account.currency_code) : null
        stage = "build_metal_values"
        const price = usd && rate ? multiply(usd, rate) : null
        const values = purchases.filter((purchase) => purchase.account_id === account.id).map((purchase) => { const factor = metalFactor(purchase.purity); return price && factor ? multiply(purchase.quantity_grams, multiply(price, factor) ?? "") : null })
        currentValues[account.id] = values.some((value) => value === null) ? null : sum(values as Decimal[])
      } else {
        stage = "build_account_values"
        if (account.account_type_code === "cash" || account.account_type_code === "bank") currentValues[account.id] = balances.get(account.id) ?? null
        else currentValues[account.id] = account.opening_balance
      }
      if (currentValues[account.id] === null) unavailableSources.push(account.name)
    }
    stage = "fx_conversion"
    for (const account of accounts) await resolveRate(account.currency_code, baseCurrencyCode)
    stage = "build_snapshot_payload"
    const asOf = new Date(); const snapshot: Snapshot = { asOf: asOf.toISOString(), expiresAt: new Date(asOf.getTime() + snapshotTtlMs).toISOString(), freshness: unavailableSources.length ? "unavailable" : usedStale ? "stale" : "fresh", currentValues, accountBalances: Object.fromEntries(balances), rates: Object.fromEntries(rateCache), unavailableSources, portfolioAllocation: { status: portfolioAllocationIncomplete ? "incomplete" : "complete", holdings: portfolioAllocationHoldings } }
    stage = "snapshot_persistence"
    const { data: stored, error: storeError } = await userClient.rpc("store_dashboard_valuation_snapshot" as never, { p_base_currency_code: baseCurrencyCode, p_snapshot: snapshot, p_as_of: snapshot.asOf, p_expires_at: snapshot.expiresAt } as never)
    if (storeError) throw storeError
    stage = "response_serialization"
    return json(stored ?? snapshot)
  } catch (error) {
    console.error("dashboard-valuation request failed", { stage: dashboardValuationReason(stage), message: error instanceof Error ? error.message : String(error) })
    return json({ error: "dashboard_valuation_unavailable", reason: dashboardValuationReason(stage) }, 500)
  }
})
