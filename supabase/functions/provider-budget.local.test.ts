import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

// Explicitly opt in; fixed dedicated-local targets and no provider egress.
it.skipIf(process.env.S2_LOCAL_PROBES !== "1")("S2 authenticated durable budgets and actual Edge handlers", async () => {
  const base = "http://127.0.0.1:58321"
  const status = JSON.parse(readFileSync(new URL("../../mobile-development.local/status.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""))
  expect(status.API_URL).toBe(base)
  const nativeFetch = globalThis.fetch
  const users: { id: string; token: string }[] = []
  const assets: string[] = []
  const fxIds: string[] = []
  const prefix = `s2-${randomUUID()}`
  async function api(path: string, body?: unknown, token?: string, admin = false, method?: string) {
    const response = await nativeFetch(base + path, {
      redirect: "error", method: method ?? (body ? "POST" : "GET"),
      headers: { apikey: admin ? status.SECRET_KEY : status.PUBLISHABLE_KEY, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) throw new Error(`Local S2 API ${path.split("?")[0]}: ${response.status}`)
    const text = await response.text(); return text ? JSON.parse(text) : null
  }
  function sql(query: string) {
    const result = spawnSync("docker", ["exec", "-i", "supabase_db_TharwatiMobileDevelopment", "psql", "-X", "-U", "postgres", "-d", "postgres", "-At", "--set=ON_ERROR_STOP=1"], { input: query, encoding: "utf8" })
    if (result.status !== 0) throw new Error("Local S2 SQL fixture failed")
    return result.stdout.trim()
  }
  let providerCalls = 0
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = new URL(input instanceof Request ? input.url : String(input))
    if (target.origin === base) return nativeFetch(input, { ...init, redirect: "error" })
    if (!["api.twelvedata.com", "api.frankfurter.dev"].includes(target.hostname)) throw new Error("Unexpected nonlocal test target")
    providerCalls++
    if (target.pathname === "/symbol_search") return new Response(JSON.stringify({ data: [{ symbol: "S2", instrument_name: "Synthetic", mic_code: "XNAS", exchange: "NASDAQ", country: "United States", currency: "USD", instrument_type: "Common Stock" }] }))
    if (target.hostname === "api.twelvedata.com") return new Response(JSON.stringify({ price: "12.1234567890", symbol: target.searchParams.get("symbol") }))
    return new Response(JSON.stringify({ base: "GBP", quote: "EGP", date: "2026-10-02", rate: 60 }))
  })
  async function load(kind: "asset-search" | "market-prices" | "fx-rates" | "investment-fx") {
    vi.resetModules()
    let handler!: (request: Request) => Promise<Response>
    vi.stubGlobal("Deno", { env: { get: (name: string) => ({ SUPABASE_URL: base,
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: status.PUBLISHABLE_KEY }),
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: status.SECRET_KEY }), TWELVE_DATA_API_KEY: "LOCAL-MOCK-NOT-A-SECRET",
    } as Record<string, string>)[name] }, serve: (callback: typeof handler) => { handler = callback } })
    if (kind === "asset-search") await import("./asset-search/index.ts")
    if (kind === "market-prices") await import("./market-prices/index.ts")
    if (kind === "fx-rates") await import("./fx-rates/index.ts")
    if (kind === "investment-fx") await import("./investment-fx/index.ts")
    return async (body: unknown, token = users[0].token) => {
      const response = await handler(new Request(base, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      return { status: response.status, body: await response.json() }
    }
  }
  const old = new Date(Date.now() - 10 * 86400000).toISOString()
  // Explicit historical S2-A test policy only; restore protected local config.
  const savedConfig = sql("select coalesce(jsonb_agg(to_jsonb(c)), '[]') from provider_private.capacity c;")
  const savedGlobal = sql("select coalesce(jsonb_agg(to_jsonb(c)), '[]') from provider_private.global_budgets c;")
  try {
    sql("select public.configure_provider_capacity('twelve_data',240,4000,10000,100000,true); select public.configure_provider_capacity('asset_search',40,400,null,null,true); select public.configure_provider_capacity('frankfurter',120,2000,10000,100000,true); delete from provider_private.global_budgets;")
    for (let n = 0; n < 2; n++) {
      const email = `${prefix}-${n}@example.invalid`, password = `Local!9${randomUUID()}`
      const user = await api("/auth/v1/admin/users", { email, password, email_confirm: true }, undefined, true)
      const session = await api("/auth/v1/token?grant_type=password", { email, password })
      users.push({ id: user.id, token: session.access_token })
    }
    const search = await load("asset-search")
    for (let n = 0; n < 40; n++) expect((await search({ query: `${prefix}-${n}` })).status).toBe(200)
    expect(providerCalls).toBe(40)
    // Real locally served Edge runtime sees the same protected durable cache.
    expect((await api("/functions/v1/asset-search", { query: `${prefix}-0` }, users[0].token)).available).toBe(true)
    const denied = await search({ query: `${prefix}-41`, userId: users[1].id })
    expect(denied).toMatchObject({ status: 429, body: { error: "provider_refresh_rate_limited" } })
    expect(providerCalls).toBe(40)
    // Persistent normalized cache survives a fresh handler/instance and budget exhaustion.
    const anotherInstance = await load("asset-search")
    expect((await anotherInstance({ query: `  ${prefix.toUpperCase()}-0  ` })).body.available).toBe(true)
    expect(providerCalls).toBe(40)
    expect((await search({ query: `${prefix}-42` }, users[1].token)).body.available).toBe(true)
    expect(providerCalls).toBe(41)
    expect((await search({ query: `${prefix}-43`, country: "x".repeat(81) })).status).toBe(400)

    // Pin a day boundary rather than relying on minute timing in concurrent probes.
    sql(`insert into provider_private.budgets values ('${users[0].id}','frankfurter',date_trunc('minute',now()),0,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',1998,now());`)
    const decisions = await Promise.all(Array.from({ length: 12 }, () => api("/rest/v1/rpc/reserve_provider_budget", { p_provider: "frankfurter", p_operation: "fx", p_units: 1 }, users[0].token)))
    expect(decisions.filter(d => d.allowed)).toHaveLength(2)
    expect(sql(`select day_used from provider_private.budgets where user_id='${users[0].id}' and bucket='frankfurter'`)).toBe("2000")
    expect((await api("/rest/v1/rpc/reserve_provider_budget", { p_provider: "frankfurter", p_operation: "fx", p_units: 1 }, users[1].token)).allowed).toBe(true)

    const fx = await load("fx-rates")
    const beforeFx = providerCalls
    expect((await fx({ fromCurrencyCode: "SAR", toCurrencyCode: "SAR" })).body.rate).toBe(1)
    const fxId = randomUUID(); fxIds.push(fxId)
    await api("/rest/v1/exchange_rates", { id: fxId, user_id: users[0].id, provider: null, source: "manual", base_currency_code: "GBP", quote_currency_code: "EGP", rate: "60.123456789012", effective_at: old }, users[0].token)
    expect((await fx({ fromCurrencyCode: "GBP", toCurrencyCode: "EGP" })).body).toMatchObject({ provider: "manual", rate: "60.123456789012", stale: true, refreshError: "provider_refresh_rate_limited" })
    expect(await api("/functions/v1/fx-rates", { fromCurrencyCode: "GBP", toCurrencyCode: "EGP" }, users[0].token))
      .toMatchObject({ provider: "manual", rate: "60.123456789012", stale: true, refreshError: "provider_refresh_rate_limited" })
    expect(providerCalls).toBe(beforeFx)
    await api(`/rest/v1/exchange_rates?id=eq.${fxId}`, undefined, undefined, true, "DELETE")
    expect(await fx({ fromCurrencyCode: "GBP", toCurrencyCode: "EGP" })).toMatchObject({ status: 422, body: { unavailable: true, refreshError: "provider_refresh_rate_limited" } })

    // Legacy direct helper entry point shares the exhausted provider budget.
    const investment = await load("investment-fx")
    const result = await investment({ operation: "add", args: { p_new_account_currency_code: "EGP", p_new_asset_currency_code: "GBP", p_occurred_at: old } })
    expect(result.status).toBe(422)
    expect(providerCalls).toBe(beforeFx)

    const token = users[0].token
    const asset = await api("/rest/v1/rpc/resolve_external_brokerage_asset", { p_symbol: "S2SYNTH", p_name: "S2 synthetic", p_mic_code: "XNAS", p_display_exchange: "NASDAQ", p_country: "United States", p_currency_code: "USD", p_instrument_type: "Common Stock" }, token)
    assets.push(asset.id)
    const market = await load("market-prices")
    expect((await market({ assetIds: assets })).body.prices[0]).toMatchObject({ available: true, price: "12.1234567890", stale: false })
    const afterNormal = providerCalls
    expect((await market({ assetIds: assets })).body.prices[0].available).toBe(true)
    expect(providerCalls).toBe(afterNormal)
    sql(`update public.market_prices set fetched_at='${old}', as_of='${old}' where asset_id='${asset.id}'; update provider_private.budgets set day_used=4000 where user_id='${users[0].id}' and bucket='twelve_data';`)
    expect((await market({ assetIds: assets })).body).toMatchObject({ refreshError: "provider_refresh_rate_limited", prices: [{ available: true, price: "12.1234567890", stale: true }] })
    expect((await api("/functions/v1/market-prices", { assetIds: assets }, token)).prices[0])
      .toMatchObject({ available: true, price: "12.1234567890", stale: true })
    expect(providerCalls).toBe(afterNormal)
    await api(`/rest/v1/market_prices?asset_id=eq.${asset.id}`, undefined, undefined, true, "DELETE")
    await api("/rest/v1/market_prices", { asset_id: asset.id, user_id: users[0].id, provider: "manual", price: "7.1234567890", currency_code: "USD", as_of: old, fetched_at: old, price_type: "manual" }, token)
    expect((await market({ assetIds: assets })).body.prices[0]).toMatchObject({ provider: "manual", price: "7.1234567890", stale: true })
    expect(providerCalls).toBe(afterNormal)
    console.info("PASS S2 local: 40 unique searches bounded; durable cache/normalization; independent users/providers; 12 concurrent reservations allow exactly 2 remaining; precise stored/manual fallback after denial; legacy bypass blocked. All external transports mocked.")
  } finally {
    if (fxIds.length) await api(`/rest/v1/exchange_rates?id=in.(${fxIds.join(",")})`, undefined, undefined, true, "DELETE")
    for (const id of assets) await api(`/rest/v1/market_prices?asset_id=eq.${id}`, undefined, undefined, true, "DELETE")
    for (const user of users) await api(`/auth/v1/admin/users/${user.id}`, undefined, undefined, true, "DELETE")
    for (const id of assets) await api(`/rest/v1/assets?id=eq.${id}`, undefined, undefined, true, "DELETE")
    sql(`delete from provider_private.asset_search_cache where cache_key like '%${prefix}%';`)
    sql(`delete from provider_private.capacity; insert into provider_private.capacity select * from jsonb_populate_recordset(null::provider_private.capacity,'${savedConfig.replaceAll("'", "''")}'::jsonb); delete from provider_private.global_budgets; insert into provider_private.global_budgets select * from jsonb_populate_recordset(null::provider_private.global_budgets,'${savedGlobal.replaceAll("'", "''")}'::jsonb);`)
  }
}, 90_000)
