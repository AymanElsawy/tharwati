import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822180000_resolve_external_brokerage_assets.sql?raw"

describe("external Brokerage asset resolution database contract", () => {
  it("normalizes and serializes the user-scoped MIC and symbol identity", () => {
    expect(migration).toContain("v_symbol text := upper(btrim(p_symbol))")
    expect(migration).toContain("v_mic_code text := upper(btrim(p_mic_code))")
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock")
    expect(migration).toContain("v_identifier_namespace := 'twelve_data:' || v_mic_code")
    expect(migration).toContain("on conflict do nothing")
  })

  it("stores a provider identity and creates only an authenticated user custom asset", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toContain("'provider',\n    v_identifier_namespace")
    expect(migration).toContain("'twelve_data'")
    expect(migration).toContain("v_user_id,\n      v_asset_type_code")
    expect(migration).toContain("true,\n      true")
    expect(migration).not.toContain("insert into public.holdings")
    expect(migration).not.toContain("insert into public.financial_transactions")
  })

  it("maps only explicitly supported Twelve Data instrument types", () => {
    expect(migration).toContain("when 'common stock' then 'stock'")
    expect(migration).toContain("when 'preferred stock' then 'stock'")
    expect(migration).toContain("when 'depositary receipt' then 'stock'")
    expect(migration).toContain("when 'etf' then 'etf'")
    expect(migration).toContain("when 'warrant' then 'other'")
    expect(migration).toContain("else null")
    expect(migration).toContain(
      "raise exception 'external asset instrument type is not supported'",
    )
    expect(migration).not.toContain("else 'other'")
  })

  it("keeps global rows server-managed and exposes only the public authenticated RPC", () => {
    expect(migration).toContain("assets.user_id is null or assets.user_id = v_user_id")
    expect(migration).toContain("Global catalog rows remain server-managed")
    expect(migration).toContain(
      "revoke all on function public.resolve_external_brokerage_asset",
    )
    expect(migration).toContain(
      "grant execute on function public.resolve_external_brokerage_asset",
    )
  })
})
