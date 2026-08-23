import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822165000_reconcile_investment_foundation.sql?raw"

describe("investment foundation database contract", () => {
  it("creates global and user-owned asset catalog records with exchange-scoped identities", () => {
    expect(migration).toContain("create table public.asset_types")
    expect(migration).toContain("create table public.assets")
    expect(migration).toContain("create table public.asset_identifiers")
    expect(migration).toContain("assets_global_exchange_symbol_key")
    expect(migration).toContain("assets_custom_user_exchange_symbol_key")
    expect(migration).not.toContain("assets_custom_user_name_key")
    expect(migration).toContain("asset_identifiers_global_identity_key")
    expect(migration).toContain("asset_identifiers_custom_identity_key")
    expect(migration).toContain("lower(coalesce(exchange, '')), lower(btrim(symbol))")
    expect(migration).toContain("user_id is null or user_id = auth.uid()")
  })

  it("adds deterministic quantity and account-currency cost-basis metadata only for asset entries", () => {
    expect(migration).toContain("add column cost_basis_delta")
    expect(migration).toContain("add column account_cost_basis_delta")
    expect(migration).toContain("add column account_fx_rate")
    expect(migration).toContain("create function public.prepare_investment_entry_metadata")
    expect(migration).toContain("new.account_cost_basis_delta := new.cost_basis_delta")
    expect(migration).toContain("new.account_fx_rate := 1::numeric")
    expect(migration).toContain("new.account_fx_effective_at := v_occurred_at")
    expect(migration).toContain("new.account_fx_source := 'identity'")
    expect(migration).toContain(
      "pg_catalog.round(\n      new.transaction_amount * new.account_fx_rate,\n      10\n    )"
    )
    expect(migration).toContain(
      "new.account_cost_basis_delta := pg_catalog.round(\n      new.cost_basis_delta * new.account_fx_rate,\n      10\n    )"
    )
    expect(migration).toContain("cross-currency asset entries require immutable historical FX metadata")
    expect(migration).toContain("if new.asset_id is null then")
  })

  it("rebuilds a Brokerage holding from posted asset effects and preserves non-asset balances", () => {
    expect(migration).toContain("create table public.holdings")
    expect(migration).toContain("create function public.rebuild_holding_projection")
    expect(migration).toContain("sum(entries.quantity_delta)")
    expect(migration).toContain("sum(entries.account_cost_basis_delta)")
    expect(migration).toContain("accounts.account_type_code <> 'brokerage'")
    expect(migration).toContain("where transaction_id = v_transaction.id and asset_id is not null")
    expect(migration).not.toContain("opening_balance =")
  })

  it("adds only roadmap transaction types and does not restore old Buy/Edit RPCs", () => {
    expect(migration).toContain("'opening_position', 'Opening position'")
    expect(migration).toContain("'buy', 'Buy'")
    expect(migration).toContain("'sell', 'Sell'")
    expect(migration).toContain("'dividend', 'Dividend'")
    expect(migration).not.toContain("create function public.add_investment")
    expect(migration).not.toContain("create function public.edit_investment")
    expect(migration).not.toContain("investment_external_funding")
  })

  it("preserves authenticated owned-draft posting", () => {
    expect(migration).toContain(
      "grant execute on function public.post_transaction(uuid) to authenticated;"
    )
  })
})
