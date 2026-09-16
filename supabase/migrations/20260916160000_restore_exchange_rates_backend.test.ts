import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("./20260916160000_restore_exchange_rates_backend.sql", import.meta.url),
  "utf8",
)
const behavior = readFileSync(
  new URL("../tests/exchange_rates_backend.sql", import.meta.url),
  "utf8",
)
const fxRates = readFileSync(
  new URL("../functions/fx-rates/index.ts", import.meta.url),
  "utf8",
)
const investmentFx = readFileSync(
  new URL("../functions/investment-fx/index.ts", import.meta.url),
  "utf8",
)

describe("restored exchange-rates backend contract", () => {
  it("creates decimal-safe provider and manual rows with lookup indexes", () => {
    for (const fragment of [
      "create table public.currencies",
      "('SAR', 'Saudi Riyal', 'ر.س')",
      "create policy currencies_select_active",
      "create table public.exchange_rates",
      "rate numeric(30, 12) not null",
      "check (rate > 0 and rate <> 'NaN'::numeric)",
      "exchange_rates_distinct_pair_check",
      "exchange_rates_manual_pair_effective_key",
      "exchange_rates_provider_pair_effective_key",
      "exchange_rates_manual_lookup_idx",
      "exchange_rates_provider_cache_lookup_idx",
    ]) expect(migration).toContain(fragment)
  })

  it("isolates manual rows and protects shared provider cache rows", () => {
    expect(migration).toContain("alter table public.exchange_rates enable row level security")
    expect(migration).toContain("revoke all on table public.exchange_rates from public, anon")
    expect(migration).toContain("user_id = (select auth.uid())")
    expect(migration).toContain("provider = 'frankfurter'")
    expect(migration).toContain("source = 'manual'")
    expect(migration).not.toMatch(/to anon[\s\S]*for (insert|update|delete)/i)
  })

  it("resolves provider then caller-owned manual direct and inverse rates", () => {
    expect(migration).toContain("create or replace function public.resolve_historical_exchange_rate")
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration.match(/if found then return; end if;/g)).toHaveLength(3)
    expect(migration).toContain("select 1::numeric / er.rate")
    expect(migration).toContain("er.user_id = v_user_id")
  })

  it("uses the restored resolver in both backend FX entry points", () => {
    for (const source of [fxRates, investmentFx]) {
      expect(source).toContain('rpc("resolve_historical_exchange_rate"')
      expect(source).toContain("fallbackRate")
    }
    expect(investmentFx).toContain("fallbackRate <= 0")
    expect(fxRates).toContain("fallbackRate !== null")
    expect(fxRates).toContain("identityRate(")
    expect(fxRates).toContain("if (cachedRate?.fresh)")
    expect(fxRates).toContain("if (cachedRate) return json")
    expect(fxRates).toContain("available: false")
  })

  it("covers SAR pairs, cache states, fallbacks, invalid values, and isolation", () => {
    for (const label of [
      "USD/SAR provider direct",
      "EUR/SAR provider direct",
      "SAR/USD provider inverse",
      "SAR/SAR identity remains backend-owned",
      "manual direct fallback",
      "manual inverse fallback",
      "no fallback returns no row",
      "invalid rates are rejected instead of becoming zero",
      "manual rows are isolated by authenticated user",
      "provider cache rows cannot be changed by authenticated users",
    ]) expect(behavior).toContain(label)
  })
})
