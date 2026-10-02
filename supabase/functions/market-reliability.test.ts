import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inverseDecimal, positiveDecimal } from "./_shared/market-reliability.ts"

const state = vi.hoisted(() => ({ tables: {} as Record<string, Record<string, any>[]>, errors: new Set<string>(), writes: [] as any[], budget: "allowed", reservations: [] as any[] }))
vi.mock("npm:@supabase/supabase-js@2", () => ({ createClient: () => ({
  auth: { getUser: async () => ({ data: { user: { id: "caller" } }, error: null }) },
  from: (table: string) => new Query(table),
  rpc: async (name: string, args: unknown) => {
    state.reservations.push({ name, args })
    return state.budget === "outage" ? { data: null, error: new Error("private DB failure") }
      : { data: state.budget !== "allowed" ? { allowed: false, code: state.budget === "denied" ? "provider_refresh_rate_limited" : state.budget, retryAfterSeconds: 60 } : { allowed: true }, error: null }
  },
}) }))

// Evaluate filters/order/limit instead of canned query responses: history and
// caller scoping regressions must change the actual handler result.
class Query {
  filters: ((row: any) => boolean)[] = []
  ordering: { key: string; ascending: boolean }[] = []
  count = 1000
  single = false
  offset = 0
  constructor(readonly table: string) {}
  select() { return this }
  eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this }
  is(key: string, value: unknown) { return this.eq(key, value) }
  in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this }
  gt(key: string, value: number) { this.filters.push(row => Number(row[key]) > value); return this }
  lte(key: string, value: string) { this.filters.push(row => row[key] <= value); return this }
  order(key: string, options: { ascending: boolean }) { this.ordering.push({ key, ...options }); return this }
  limit(count: number) { this.count = count; return this }
  range(from: number, to: number) { this.offset = from; this.count = to - from + 1; return this }
  maybeSingle() { this.single = true; return this }
  abortSignal() { return this }
  insert(value: unknown) { state.writes.push(value); return this }
  upsert(value: unknown) { state.writes.push(value); return this }
  then(resolve: (result: unknown) => unknown) {
    if (state.errors.has(this.table)) return Promise.resolve(resolve({ data: null, error: new Error("fixture query failure") }))
    const rows = (state.tables[this.table] ?? []).filter(row => this.filters.every(filter => filter(row)))
      .sort((a, b) => { for (const { key, ascending } of this.ordering) {
        if (a[key] !== b[key]) return (a[key] < b[key] ? -1 : 1) * (ascending ? 1 : -1)
      } return 0 }).slice(this.offset, this.offset + this.count)
    return Promise.resolve(resolve({ data: this.single ? rows[0] ?? null : rows, error: null }))
  }
}

const now = "2026-10-02T12:00:00.000Z"
const old = "2026-09-01T00:00:00.000Z"
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
function asset(n = 1) {
  const row = { id: id(n), symbol: `S${n}`, asset_type_code: "stock", currency_code: "USD", is_active: true }
  state.tables.assets.push(row)
  state.tables.asset_identifiers.push({ id: n, asset_id: row.id, scheme: "provider", provider: "twelve_data", namespace: "twelve_data:xnas", normalized_value: row.symbol })
  return row.id
}
function price(assetId: string, overrides: Record<string, unknown> = {}) {
  state.tables.market_prices.push({ id: state.tables.market_prices.length, asset_id: assetId, provider: "twelve_data", price: "123.123456789012", currency_code: "USD", as_of: old, fetched_at: old, price_type: "realtime", user_id: null, ...overrides })
}
function fx(overrides: Record<string, unknown> = {}) {
  state.tables.exchange_rates.push({ id: state.tables.exchange_rates.length, base_currency_code: "USD", quote_currency_code: "SAR", rate: "3.750000000001", effective_at: old, fetched_at: old, source: "frankfurter", provider: "frankfurter", user_id: null, ...overrides })
}
async function handler(kind: "market-prices" | "fx-rates", key = false) {
  let captured: (request: Request) => Promise<Response>
  vi.stubGlobal("Deno", { env: { get: (name: string) => ({
    SUPABASE_URL: "http://local.invalid", SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_fixture"}',
    SUPABASE_SECRET_KEYS: '{"default":"sb_secret_fixture"}', TWELVE_DATA_API_KEY: key ? "fixture-only" : undefined,
  } as Record<string, string | undefined>)[name] }, serve: (callback: typeof captured) => { captured = callback } })
  if (kind === "market-prices") await import("./market-prices/index.ts")
  else await import("./fx-rates/index.ts")
  return async (body: unknown) => {
    const response = await captured!(new Request("http://local.invalid/", { method: "POST", headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" }, body: JSON.stringify(body) }))
    return { status: response.status, body: await response.json() }
  }
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(now)
  state.tables = { assets: [], market_prices: [], asset_identifiers: [], exchange_rates: [] }
  state.errors.clear(); state.writes = []
  state.budget = "allowed"; state.reservations = []
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fixture provider offline") }))
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe("M1 securities actual handler", () => {
  it.each(["denied", "outage", "provider_capacity_unconfigured", "provider_refresh_paused"])("provider budget %s preserves stale/manual/unavailable results without external work", async (budget) => {
    const a = asset(); price(a)
    const b = asset(2); price(b, { provider: "manual", user_id: "caller", price_type: "manual", price: "7" })
    const c = asset(3)
    state.budget = budget
    const result = await (await handler("market-prices", true))({ assetIds: [a, b, c] })
    expect(result.status).toBe(200)
    expect(result.body.refreshError).toBe(budget === "denied" ? "provider_refresh_rate_limited" : budget === "outage" ? "provider_budget_unavailable" : budget)
    expect(result.body.prices[0]).toMatchObject({ price: "123.123456789012", stale: true })
    expect(result.body.prices[1]).toMatchObject({ price: "7", provider: "manual", stale: true })
    expect(result.body.prices[2]).toMatchObject({ available: false, price: null })
    expect(fetch).not.toHaveBeenCalled()
    expect(state.reservations).toHaveLength(1)
    expect(state.reservations[0].args.p_units).toBe(3)
  })
  it("returns precise fresh cache without calling the provider", async () => {
    const a = asset(); price(a, { fetched_at: now, as_of: now })
    const call = await handler("market-prices", true)
    const result = await call({ assetIds: [a] })
    expect(result.body.prices[0]).toMatchObject({ price: "123.123456789012", stale: false, priceType: "realtime" })
    expect(fetch).not.toHaveBeenCalled()
    expect(state.reservations).toHaveLength(0)
  })
  it("uses stale provider before own manual, rejects other callers' prices", async () => {
    const a = asset(); price(a); price(a, { provider: "manual", user_id: "caller", price_type: "manual", price: "7" })
    const b = asset(2); price(b, { provider: "manual", user_id: "other", price_type: "manual" })
    const result = await (await handler("market-prices"))({ assetIds: [a, b] })
    expect(result.body.prices[0]).toMatchObject({ provider: "twelve_data", stale: true, priceType: "stale" })
    expect(result.body.prices[1]).toMatchObject({ available: false, price: null })
  })
  it("returns caller manual as conservatively stale, and no usable price as unavailable", async () => {
    const a = asset(); price(a, { provider: "manual", user_id: "caller", price_type: "manual", fetched_at: now })
    const b = asset(2); price(b, { price: "0" })
    const result = await (await handler("market-prices"))({ assetIds: [a, b] })
    expect(result.body.prices[0]).toMatchObject({ provider: "manual", stale: true, priceType: "manual" })
    expect(result.body.prices[1]).toMatchObject({ available: false, price: null })
  })
  it("retains stored fallback after identifier refresh failure", async () => {
    const a = asset(); price(a); state.errors.add("asset_identifiers")
    expect((await (await handler("market-prices", true))({ assetIds: [a] })).body.prices[0].available).toBe(true)
  })
  it.each(["timeout", "body hang", "error"])("%s cannot discard stored fallback", async (failure) => {
    const a = asset(); price(a)
    vi.stubGlobal("fetch", vi.fn(() => failure === "error" ? Promise.reject(new TypeError("offline"))
      : failure === "body hang" ? Promise.resolve({ ok: true, json: () => new Promise(() => {}) }) : new Promise(() => {})))
    const call = await handler("market-prices", true)
    const pending = call({ assetIds: [a] }); await vi.advanceTimersByTimeAsync(8000)
    expect((await pending).body.prices[0]).toMatchObject({ price: "123.123456789012", stale: true })
  })
  it("keeps successful current price and previous close precedence; previous close stays stale", async () => {
    const a = asset(); const b = asset(2); price(a); price(b)
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("/price?")
      ? { S1: { price: "10.123456789012" } } : { S2: { previous_close: "20.5", datetime: old } }))))
    const result = await (await handler("market-prices", true))({ assetIds: [a, b] })
    expect(result.body.prices[0]).toMatchObject({ price: "10.123456789012", stale: false })
    expect(result.body.prices[1]).toMatchObject({ price: "20.5", priceType: "previous_close", stale: true, effectiveAt: old })
    expect(state.reservations.map(row => row.args.p_units)).toEqual([2, 1])
  })
  it("returns all 61 requested accessible assets and never exposes unrequested assets", async () => {
    const ids = Array.from({ length: 61 }, (_, n) => { const a = asset(n + 1); price(a); return a })
    asset(99)
    const result = await (await handler("market-prices"))({ assetIds: ids })
    expect(result.body.prices).toHaveLength(61)
    expect(result.body.prices[60].assetId).toBe(ids[60])
  })
  it("1201 rows of one asset cannot crowd out another asset's fallback", async () => {
    const a = asset(); const b = asset(2)
    for (let n = 0; n < 1201; n++) price(a)
    price(b, { price: "987.000000000001" })
    expect((await (await handler("market-prices"))({ assetIds: [a, b] })).body.prices[1].price).toBe("987.000000000001")
  })
  it("preserves stored-only fallback for portfolios larger than 1000 assets", async () => {
    const ids = Array.from({ length: 1001 }, (_, n) => { const a = asset(n + 1); price(a); return a })
    const result = await (await handler("market-prices"))({ assetIds: ids })
    expect(result.status).toBe(200)
    expect(result.body.prices).toHaveLength(1001)
    expect(result.body.prices[1000]).toMatchObject({ available: true, stale: true })
    expect(state.reservations).toHaveLength(0)
  })
  it("refreshes 61 assets in provider batches of at most 50", async () => {
    const ids = Array.from({ length: 61 }, (_, n) => asset(n + 1))
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const symbols = new URL(url).searchParams.get("symbol")!.split(",")
      expect(symbols.length).toBeLessThanOrEqual(50)
      return new Response(JSON.stringify(Object.fromEntries(symbols.map((symbol) => [symbol, { price: "12.5" }]))))
    }))
    const result = await (await handler("market-prices", true))({ assetIds: ids })
    expect(result.body.prices).toHaveLength(61)
    expect(result.body.prices[60]).toMatchObject({ price: "12.5", stale: false })
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it("independent provider groups retain successful current values after another group fails", async () => {
    const a = asset(); const b = asset(2); price(a); price(b)
    state.tables.asset_identifiers[1].namespace = "twelve_data:xnys"
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (new URL(url).searchParams.get("mic_code") === "XNYS") throw new TypeError("fixture listing offline")
      return new Response(JSON.stringify({ S1: { price: "12.5" } }))
    }))
    const result = await (await handler("market-prices", true))({ assetIds: [a, b] })
    expect(result.body.prices[0]).toMatchObject({ price: "12.5", stale: false })
    expect(result.body.prices[1]).toMatchObject({ price: "123.123456789012", stale: true })
    expect(state.writes.flat()).toEqual(expect.arrayContaining([expect.objectContaining({ asset_id: a, price: "12.5" })]))
  })
})

describe("M1 FX actual handler", () => {
  it.each(["denied", "outage", "provider_capacity_unconfigured", "provider_refresh_paused"])("FX budget %s preserves provider then manual fallback", async (budget) => {
    fx(); fx({ provider: null, source: "manual", user_id: "caller", rate: "4" })
    state.budget = budget
    const call = await handler("fx-rates")
    const args = { fromCurrencyCode: "USD", toCurrencyCode: "SAR" }
    const provider = await call(args)
    expect(provider.body).toMatchObject({ rate: "3.750000000001", provider: "frankfurter", stale: true })
    expect(provider.body.refreshError).toBe(budget === "denied" ? "provider_refresh_rate_limited" : budget === "outage" ? "provider_budget_unavailable" : budget)
    state.tables.exchange_rates.shift()
    fx({ base_currency_code: "SAR", quote_currency_code: "USD", rate: "0.25" })
    expect((await call(args)).body).toMatchObject({ rate: "4.000000000000000000", provider: "frankfurter", direction: "inverse", stale: true })
    state.tables.exchange_rates.pop()
    expect((await call(args)).body).toMatchObject({ rate: "4", provider: "manual", stale: true })
    state.tables.exchange_rates = []
    expect(await call(args)).toMatchObject({ status: 422, body: { available: false, unavailable: true } })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("identity is 1 and requires no provider", async () => {
    const result = await (await handler("fx-rates"))({ fromCurrencyCode: "SAR", toCurrencyCode: "SAR" })
    expect(result.body).toMatchObject({ rate: 1, stale: false })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("returns fresh provider cache as decimal text", async () => {
    fx({ fetched_at: now })
    const result = await (await handler("fx-rates"))({ fromCurrencyCode: "USD", toCurrencyCode: "SAR" })
    expect(result.body).toMatchObject({ rate: "3.750000000001", stale: false })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(["error", "timeout"])("%s still returns stale provider FX ahead of manual", async (failure) => {
    fx(); fx({ provider: null, source: "manual", user_id: "caller", rate: "3.8" })
    if (failure === "timeout") vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
    const pending = (await handler("fx-rates"))({ fromCurrencyCode: "USD", toCurrencyCode: "SAR" })
    await vi.advanceTimersByTimeAsync(4000)
    expect((await pending).body).toMatchObject({ rate: "3.750000000001", stale: true, provider: "frankfurter" })
  })
  it("returns own manual FX; another caller's manual cannot be used", async () => {
    fx({ provider: null, source: "manual", user_id: "other", rate: "99" })
    fx({ provider: null, source: "manual", user_id: "caller", rate: "3.800000000001" })
    expect((await (await handler("fx-rates"))({ fromCurrencyCode: "USD", toCurrencyCode: "SAR" })).body)
      .toMatchObject({ rate: "3.800000000001", provider: "manual", stale: true })
  })
  it("retains a usable provider row when optional source metadata is absent", async () => {
    fx({ source: null })
    expect((await (await handler("fx-rates"))({ fromCurrencyCode: "USD", toCurrencyCode: "SAR" })).body)
      .toMatchObject({ rate: "3.750000000001", provider: "frankfurter", stale: true })
  })
  it("supports inverse provider before direct manual without floating-point arithmetic", async () => {
    fx({ base_currency_code: "SAR", quote_currency_code: "USD", rate: "0.25" })
    fx({ provider: null, source: "manual", user_id: "caller", rate: "3.8" })
    expect((await (await handler("fx-rates"))({ fromCurrencyCode: "USD", toCurrencyCode: "SAR" })).body)
      .toMatchObject({ rate: "4.000000000000000000", direction: "inverse", stale: true })
  })
  it("returns unavailable with no usable FX, never zero", async () => {
    const result = await (await handler("fx-rates"))({ fromCurrencyCode: "USD", toCurrencyCode: "SAR" })
    expect(result.status).toBe(422); expect(result.body.available).toBe(false); expect(result.body.rate).toBeUndefined()
  })
})

it("preserves stored decimal strings and decimal-safe inverses", () => {
  expect(positiveDecimal("1234567890123456.123456789012")).toBe("1234567890123456.123456789012")
  expect(positiveDecimal("0")).toBeNull()
  expect(inverseDecimal("0.25")).toBe("4.000000000000000000")
})
