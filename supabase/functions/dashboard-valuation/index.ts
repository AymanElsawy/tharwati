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
import { mapWithConcurrency, resolveUniquePairsWithConcurrency } from "../_shared/bounded-concurrency.ts"
import { DashboardValuationPerformance, type DashboardValuationSnapshotMode } from "../_shared/dashboard-valuation-performance.ts"

const snapshotTtlMs = 15 * 60 * 1000
const gramsPerTroyOunce = "31.1034768"
const maxFxConcurrency = 3
const maxMetalPriceConcurrency = 2
let dashboardValuationRequestsServed = 0
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
type SettledRead<Result> = { value: Result } | { cause: unknown }
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
async function settleRead<Result>(operation: () => Promise<Result>): Promise<SettledRead<Result>> {
  try { return { value: await operation() } } catch (cause) { return { cause } }
}
function readValue<Result>(result: SettledRead<Result>): Result {
  if ("cause" in result) throw result.cause
  return result.value
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405)
  const coldStartObserved = dashboardValuationRequestsServed === 0
  dashboardValuationRequestsServed += 1
  const timing = new DashboardValuationPerformance(Deno.env.get("DASHBOARD_VALUATION_TIMING_LOGS") === "true")
  let snapshotMode: DashboardValuationSnapshotMode = "error"
  const authorization = request.headers.get("Authorization")
  if (!authorization) return json({ error: "authentication_required" }, 401)
  let stage: DashboardValuationStage = "initialization"
  try {
    const url = Deno.env.get("SUPABASE_URL")!; const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } })
    const { data: { user } } = await timing.measure("auth_get_user", () => userClient.auth.getUser())
    if (!user) return json({ error: "authentication_required" }, 401)
    const { data: profile, error: profileError } = await timing.measure("profile_read", () => userClient.from("profiles").select("base_currency_code").eq("id", user.id).single())
    if (profileError || !validCurrency(profile?.base_currency_code)) return json({ error: "base_currency_unavailable" }, 422)
    const baseCurrencyCode = profile.base_currency_code
    stage = "snapshot_lookup"
    const { data: existing, error: existingError } = await timing.measure("snapshot_lookup", () => userClient.from("dashboard_valuation_snapshots").select("snapshot").eq("user_id", user.id).eq("base_currency_code", baseCurrencyCode).gt("expires_at", new Date().toISOString()).maybeSingle())
    if (existingError) throw existingError
    if (existing?.snapshot) {
      snapshotMode = "hit"
      stage = "response_serialization"
      return json(existing.snapshot)
    }

    stage = "accounts_query"
    const { data: accountRows, error: accountsError } = await timing.measure("accounts_read", () => userClient.from("financial_accounts").select("id,account_type_code,name,currency_code,opening_balance,bank_subtype,is_active,metal_type").eq("is_active", true))
    if (accountsError) throw accountsError
    const accounts = (accountRows ?? []) as Account[]; timing.setAccountCount(accounts.length)
    const valuedAccountIds = accounts.filter((account) => account.account_type_code === "real_estate" || account.account_type_code === "business").map((account) => account.id)
    const brokerageAccounts = accounts.filter((account) => account.account_type_code === "brokerage")
    const metalAccounts = accounts.filter((account) => account.account_type_code === "gold")
    const [balancesRead, valuationsRead, ownershipRead, holdingsRead, purchasesRead] = await Promise.all([
      settleRead(() => timing.measure("balances_rpc", () => userClient.rpc("get_account_balances", { p_account_ids: null }))),
      settleRead(() => timing.measure("effective_valuations_rpc", async () => valuedAccountIds.length === 0
        ? { data: [], error: null }
        : await userClient.rpc("get_effective_account_valuations" as never, { p_account_ids: valuedAccountIds } as never))),
      settleRead(() => timing.measure("current_ownership_rpc", async () => valuedAccountIds.length === 0
        ? { data: [], error: null }
        : await userClient.rpc("get_account_current_ownership" as never, { p_account_ids: valuedAccountIds } as never))),
      settleRead(() => timing.measure("holdings_read", async () => brokerageAccounts.length === 0
        ? { data: [], error: null }
        : await userClient.from("holdings").select("account_id,asset_id,quantity,asset:assets(currency_code,asset_type_code)").in("account_id", brokerageAccounts.map((account) => account.id)).gt("quantity", "0"))),
      settleRead(() => timing.measure("metal_purchases_read", async () => metalAccounts.length === 0
        ? { data: [], error: null }
        : await userClient.rpc("get_effective_metal_purchases", { p_account_ids: metalAccounts.map((account) => account.id) }))),
    ])
    stage = "account_balances"
    const { data: balanceRows, error: balancesError } = readValue(balancesRead)
    if (balancesError) throw balancesError
    const balances = new Map(((balanceRows ?? []) as Balance[]).map((row) => [row.account_id, String(row.current_balance)]))
    const { data: valuationRows, error: valuationsError } = readValue(valuationsRead)
    if (valuationsError) throw valuationsError
    const { data: ownershipRows, error: ownershipError } = readValue(ownershipRead)
    if (ownershipError) throw ownershipError
    stage = "holdings_query"
    const { data: holdingRows, error: holdingsError } = readValue(holdingsRead)
    if (holdingsError) throw holdingsError
    stage = "metal_purchases"
    const { data: purchaseRows, error: purchasesError } = readValue(purchasesRead)
    if (purchasesError) throw purchasesError
    const currentOwnership = new Map<string, Decimal | null>()
    for (const row of (ownershipRows ?? []) as Array<{ account_id: string; ownership_percentage: unknown }>) currentOwnership.set(row.account_id, row.ownership_percentage === null ? null : String(row.ownership_percentage))
    const latestValuations = new Map<string, Decimal>()
    for (const row of (valuationRows ?? []) as Array<{ account_id: string; valuation_amount: unknown }>) {
      if (!latestValuations.has(row.account_id) && typeof row.valuation_amount !== "undefined") latestValuations.set(row.account_id, String(row.valuation_amount))
    }
    const holdings = ((holdingRows ?? []) as DashboardValuationHoldingRuntime[])
      .map(normalizeDashboardValuationHolding) as DashboardValuationHolding[]
    const purchases = ((purchaseRows ?? []) as DashboardValuationMetalPurchaseRuntime[])
      .map(normalizeDashboardValuationMetalPurchase) as DashboardValuationMetalPurchase[]
    const rateCache = new Map<string, Decimal | null>(); let usedStale = false
    const inFlightRates = new Map<string, Promise<Decimal | null>>()
    const portfolioAllocationHoldings: Snapshot["portfolioAllocation"]["holdings"] = []
    let portfolioAllocationIncomplete = false
    const resolveRate = async (from: string, to: string): Promise<Decimal | null> => {
      if (from === to) return "1"; const key = `${from}/${to}`; if (rateCache.has(key)) return rateCache.get(key)!
      const inFlight = inFlightRates.get(key)
      if (inFlight) return inFlight
      timing.addFxPair()
      const request = timing.measure("fx_request_sum", async () => {
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
      })
      inFlightRates.set(key, request)
      try {
        return await request
      } finally {
        inFlightRates.delete(key)
      }
    }
    const assetIds = [...new Set(holdings.map((holding) => holding.asset_id))]
    const prices = new Map<string, Price>()
    const metalUsd = new Map<"XAU" | "XAG", Decimal | null>()
    const metalSymbols = [...new Set(metalAccounts.map((account) => account.metal_type === "silver" ? "XAG" : "XAU"))] as Array<"XAU" | "XAG">
    timing.setMetalSymbolCount(metalSymbols.length)
    stage = "market_prices_request"
    const priceRowsPromise = assetIds.length === 0
      ? Promise.resolve<Price[]>([])
      : timing.measure("market_prices_call", async () => {
        const response = await fetch(`${url}/functions/v1/market-prices`, { method: "POST", headers: { Authorization: authorization, apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ assetIds }) })
        return response.ok ? ((await response.json()) as { prices?: Price[] }).prices ?? [] : []
      })
    const metalPricesPromise = timing.measure("metal_price_calls", () => mapWithConcurrency(
      metalSymbols,
      maxMetalPriceConcurrency,
      async (symbol) => timing.measure("metal_price_request_sum", async () => {
        try {
          const response = await fetch(`https://api.gold-api.com/price/${symbol}`)
          const payload = await response.json() as { price?: unknown; currency?: unknown }
          return [symbol, typeof payload.price === "number" && Number.isFinite(payload.price) && payload.price > 0 && payload.currency === "USD" ? divide(String(payload.price), gramsPerTroyOunce, 12) : null] as const
        } catch {
          return [symbol, null] as const
        }
      }),
    ))
    const [priceRows, metalPrices] = await Promise.all([priceRowsPromise, metalPricesPromise])
    for (const item of priceRows) prices.set(item.assetId, item)
    for (const [symbol, price] of metalPrices) metalUsd.set(symbol, price)
    const requiredFxPairs = new Map<string, { from: string; to: string }>()
    const addFxPair = (from: string, to: string) => {
      if (from !== to) requiredFxPairs.set(`${from}/${to}`, { from, to })
    }
    for (const account of brokerageAccounts) {
      for (const holding of holdings.filter((candidate) => candidate.account_id === account.id)) {
        const price = prices.get(holding.asset_id)
        const currency = price?.currencyCode ?? holding.asset?.currency_code ?? null
        if (price?.available && price.price !== null && currency && holding.asset?.asset_type_code) addFxPair(currency, account.currency_code)
      }
    }
    for (const account of metalAccounts) {
      if (metalUsd.get(account.metal_type === "silver" ? "XAG" : "XAU")) addFxPair("USD", account.currency_code)
    }
    for (const account of accounts) addFxPair(account.currency_code, baseCurrencyCode)
    await timing.measure("fx_calls", () => resolveUniquePairsWithConcurrency(
      [...requiredFxPairs.values()],
      maxFxConcurrency,
      async (pair) => resolveRate(pair.from, pair.to),
    ))
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
        else if (account.account_type_code === "real_estate" || account.account_type_code === "business") {
          const valuation = latestValuations.get(account.id); const ownership = currentOwnership.get(account.id) ?? null
          currentValues[account.id] = valuation && ownership !== null ? divide(multiply(valuation, ownership) ?? "", "100") : null
        } else currentValues[account.id] = account.opening_balance
      }
      if (currentValues[account.id] === null) unavailableSources.push(account.name)
    }
    stage = "fx_conversion"
    for (const account of accounts) await resolveRate(account.currency_code, baseCurrencyCode)
    stage = "build_snapshot_payload"
    const asOf = new Date(); const snapshot: Snapshot = { asOf: asOf.toISOString(), expiresAt: new Date(asOf.getTime() + snapshotTtlMs).toISOString(), freshness: unavailableSources.length ? "unavailable" : usedStale ? "stale" : "fresh", currentValues, accountBalances: Object.fromEntries(balances), rates: Object.fromEntries(rateCache), unavailableSources, portfolioAllocation: { status: portfolioAllocationIncomplete ? "incomplete" : "complete", holdings: portfolioAllocationHoldings } }
    stage = "snapshot_persistence"
    const { data: stored, error: storeError } = await timing.measure("snapshot_persistence", () => userClient.rpc("store_dashboard_valuation_snapshot" as never, { p_base_currency_code: baseCurrencyCode, p_snapshot: snapshot, p_as_of: snapshot.asOf, p_expires_at: snapshot.expiresAt } as never))
    if (storeError) throw storeError
    snapshotMode = "rebuild"
    stage = "response_serialization"
    return json(stored ?? snapshot)
  } catch (error) {
    console.error("dashboard-valuation request failed", { stage: dashboardValuationReason(stage), message: error instanceof Error ? error.message : String(error) })
    return json({ error: "dashboard_valuation_unavailable", reason: dashboardValuationReason(stage) }, 500)
  } finally {
    const summary = timing.summary(snapshotMode, coldStartObserved)
    if (summary) console.info("dashboard-valuation timing", summary)
  }
})
