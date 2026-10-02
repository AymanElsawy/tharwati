import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

// Opt in explicitly. Targets only the dedicated development project, never a
// linked project or old local stack. All synthetic records are removed finally.
it.skipIf(process.env.M1_LOCAL_PROBES !== "1")("M1 authenticated local DB/API/Edge fallback probes", async () => {
  const status = JSON.parse(readFileSync(new URL("../../mobile-development.local/status.json", import.meta.url), "utf8").replace(/^\uFEFF/, ""))
  const base = "http://127.0.0.1:58321"
  expect(status.API_URL).toBe(base)
  const nativeFetch = globalThis.fetch
  let token = ""
  async function api(path: string, body?: unknown, admin = false, method?: string) {
    const response = await nativeFetch(base + path, { method: method ?? (body ? "POST" : "GET"),
      headers: { apikey: admin ? status.SECRET_KEY : status.PUBLISHABLE_KEY, "Content-Type": "application/json", ...(token && !admin ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined })
    if (!response.ok) throw new Error(`Local fixture API ${path.split("?")[0]} failed: ${response.status}`)
    const text = await response.text()
    return text ? JSON.parse(text) : null
  }
  const password = `Local!9${randomUUID()}`
  const email = `m1-${randomUUID()}@example.invalid`
  const user = await api("/auth/v1/admin/users", { email, password, email_confirm: true }, true)
  const ids = Array.from({ length: 61 }, () => randomUUID())
  const now = new Date().toISOString()
  const old = new Date(Date.now() - 10 * 86400000).toISOString()
  let fxIds: string[] = []
  try {
    token = (await api("/auth/v1/token?grant_type=password", { email, password })).access_token
    expect(token).toBeTruthy()
    await api("/rest/v1/assets", ids.map((id, n) => ({ id, user_id: user.id, asset_type_code: "stock", name: `M1 synthetic ${n}`, symbol: `M1${n}`, currency_code: "GBP", is_custom: true, is_active: true })))
    await api("/rest/v1/market_prices", [
      ...ids.slice(0, 59).map((asset_id, n) => ({ asset_id, user_id: null, provider: "twelve_data", price: "123.1234567890", currency_code: "GBP", as_of: n === 0 ? now : old, fetched_at: n === 0 ? now : old, price_type: "realtime" })),
      { asset_id: ids[59], user_id: user.id, provider: "manual", price: "77.1234567890", currency_code: "GBP", as_of: old, fetched_at: now, price_type: "manual" },
      ...Array.from({ length: 1201 }, (_, n) => ({ asset_id: ids[0], user_id: null, provider: "twelve_data", price: "1", currency_code: "GBP", as_of: new Date(Date.parse(old) - (n + 1) * 1000).toISOString(), fetched_at: new Date(Date.parse(old) - n * 1000).toISOString(), price_type: "realtime" })),
    ], true)
    // Probe the real locally served function before the provider-isolated tests.
    const served = await api("/functions/v1/market-prices", { assetIds: [...ids, randomUUID()] })
    expect(served.prices).toHaveLength(61)
    expect(served.prices[0]).toMatchObject({ price: "123.1234567890", stale: false })
    expect(served.prices[58]).toMatchObject({ available: true, stale: true })
    expect(served.prices[59]).toMatchObject({ provider: "manual", stale: true, priceType: "manual" })
    expect(served.prices[60]).toMatchObject({ available: false, price: null })
    const identity = await api("/functions/v1/fx-rates", { fromCurrencyCode: "SAR", toCurrencyCode: "SAR" })
    expect(identity).toMatchObject({ rate: 1, stale: false })

    // Run the actual handler against local Auth and PostgREST, while the test
    // transport returns 503 for every external host (no provider network calls).
    let edgeUnavailable = false
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = new URL(input instanceof Request ? input.url : String(input))
      if (edgeUnavailable && target.pathname.startsWith("/functions/v1/")) return new Response("Fixture Edge unavailable", { status: 503 })
      if (target.origin === base) return nativeFetch(input, init)
      return new Response("Provider intentionally absent in M1 test", { status: 503 })
    })
    let handler: (request: Request) => Promise<Response>
    vi.stubGlobal("Deno", { env: { get: (name: string) => ({ SUPABASE_URL: base,
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: status.PUBLISHABLE_KEY }),
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: status.SECRET_KEY }),
    } as Record<string, string>)[name] }, serve: (callback: typeof handler) => { handler = callback } })
    await import("./fx-rates/index.ts")
    const fxHandler = handler!
    const callFx = async (from: string, to: string) => {
      const response = await fxHandler(new Request(base, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fromCurrencyCode: from, toCurrencyCode: to }) }))
      return { status: response.status, body: await response.json() }
    }
    // Assert a clean pair before writing shared synthetic provider fixtures.
    const existing = await api("/rest/v1/exchange_rates?select=id&base_currency_code=eq.GBP&quote_currency_code=eq.EGP", undefined, true)
    const inverse = await api("/rest/v1/exchange_rates?select=id&base_currency_code=eq.EGP&quote_currency_code=eq.GBP", undefined, true)
    expect([...existing, ...inverse]).toHaveLength(0)
    fxIds = [randomUUID(), randomUUID()]
    await api("/rest/v1/exchange_rates", { id: fxIds[0], user_id: null, provider: "frankfurter", base_currency_code: "GBP", quote_currency_code: "EGP", rate: "60.123456789012", effective_at: old, fetched_at: old, source: "frankfurter" }, true)
    expect((await callFx("GBP", "EGP")).body).toMatchObject({ rate: "60.123456789012", stale: true, provider: "frankfurter" })
    await api(`/rest/v1/exchange_rates?id=eq.${fxIds[0]}`, undefined, true, "DELETE")
    await api("/rest/v1/exchange_rates", { id: fxIds[1], user_id: user.id, provider: null, base_currency_code: "GBP", quote_currency_code: "EGP", rate: "61.123456789012", effective_at: old, source: "manual" })
    expect((await callFx("GBP", "EGP")).body).toMatchObject({ rate: "61.123456789012", stale: true, provider: "manual" })
    expect((await callFx("EGP", "GBP")).body).toMatchObject({ available: true, direction: "inverse", stale: true })
    // Dashboard must recover both internal Edge failures through stored data,
    // retaining Available Cash + positive holdings and ignoring transaction FX.
    await api(`/rest/v1/profiles?id=eq.${user.id}`, { base_currency_code: "EGP" }, false, "PATCH")
    const account = await api("/rest/v1/rpc/create_financial_account_v2", { p_account_type_code: "brokerage", p_name: "M1 synthetic brokerage", p_currency_code: "EGP", p_opening_balance: "100", p_idempotency_key: randomUUID() })
    await api("/rest/v1/rpc/add_existing_holding_v2", { p_account_id: account.id, p_asset_id: ids[1], p_quantity: "2", p_average_cost: "1", p_account_fx_rate: "1", p_occurred_at: old, p_idempotency_key: randomUUID() })
    edgeUnavailable = true
    await import("./dashboard-valuation/index.ts")
    const dashboard = await handler!(new Request(base, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" }))
    expect(dashboard.status).toBe(200)
    const snapshot = await dashboard.json()
    expect(snapshot.freshness).toBe("stale")
    expect(snapshot.currentValues[account.id]).toBe("15151.462581512455344004936")
    expect(snapshot.unavailableSources).toHaveLength(0)
    await api(`/rest/v1/exchange_rates?id=eq.${fxIds[1]}`, undefined, true, "DELETE")
    expect(await callFx("GBP", "EGP")).toMatchObject({ status: 422, body: { available: false, unavailable: true } })
    console.info("PASS M1 local: confirmed user/auth, 61 assets, 1201 history, precise fresh/stale/manual/unavailable prices, identity/stale/manual/inverse/unavailable FX; external providers blocked")
  } finally {
    if (fxIds.length) await api(`/rest/v1/exchange_rates?id=in.(${fxIds.join(",")})`, undefined, true, "DELETE")
    await api(`/rest/v1/market_prices?asset_id=in.(${ids.join(",")})`, undefined, true, "DELETE")
    await api(`/auth/v1/admin/users/${user.id}`, undefined, true, "DELETE")
    await api(`/rest/v1/assets?id=in.(${ids.join(",")})`, undefined, true, "DELETE")
  }
}, 60_000)
