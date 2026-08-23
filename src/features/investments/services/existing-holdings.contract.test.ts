import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822170000_add_brokerage_existing_holdings.sql?raw"

describe("existing holding database contract", () => {
  it("uses a distinct opening-position transaction type and asset-side entry", () => {
    expect(migration).toContain("'opening_position', 'Existing holding'")
    expect(migration).toContain("'opening_position_reversal', 'Existing holding reversal'")
    expect(migration).toContain("'existing_holding_asset'")
    expect(migration).toContain("'existing_holding_opening_equity'")
    expect(migration).toContain("'Existing holding: ' || v_asset.name")
    expect(migration).not.toContain("'investment_payment'")
  })

  it("creates quantity and historical cost basis without a Brokerage cash entry", () => {
    expect(migration).toContain("v_total_cost_basis := p_quantity * p_average_cost")
    expect(migration).toContain("v_account.id, v_asset.id, 'debit'")
    expect(migration).toContain("p_quantity, v_total_cost_basis")
    expect(migration).toContain("null, null, 'credit'")
    expect(migration).toContain("This is an asset-side holding effect, not a Brokerage cash movement")
    expect(migration).not.toContain("update public.financial_accounts")
    expect(migration).not.toContain("opening_balance =")
  })

  it("requires an owned active Brokerage account and visible active asset", () => {
    expect(migration).toContain("accounts.user_id = v_user_id")
    expect(migration).toContain("accounts.is_active")
    expect(migration).toContain("accounts.account_type_code = 'brokerage'")
    expect(migration).toContain("assets.is_active")
    expect(migration).toContain("assets.user_id is null or assets.user_id = v_user_id")
  })

  it("allows multiple opening entries for the same asset so the shared holding projection aggregates them", () => {
    expect(migration).not.toContain("already has an existing holding")
    expect(migration).toContain("select * into v_holding")
    expect(migration).toContain("from public.holdings as holdings")
  })

  it("preflights the post-reversal holding state before creating an exact immutable reversal", () => {
    expect(migration).toContain("create function public.reverse_existing_holding")
    expect(migration).toContain("transactions.reverses_transaction_id = v_original.id")
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock")
    expect(migration).toContain("v_remaining_quantity := v_current_quantity - v_asset_entry.quantity_delta")
    expect(migration).toContain("v_remaining_cost_basis := v_current_cost_basis")
    expect(migration).toContain("coalesce(sum(entries.account_cost_basis_delta), 0::numeric)")
    expect(migration).not.toContain("when entries.cost_basis_delta is not null")
    expect(migration).toContain("existing holding reversal would make the holding quantity negative")
    expect(migration).toContain("existing holding reversal would make the holding cost basis negative")
    expect(migration).toContain("v_remaining_quantity = 0 and v_remaining_cost_basis <> 0")
    expect(migration).toContain("existing holding reversal would leave zero quantity with non-zero cost basis")
    expect(migration).toContain("-v_asset_entry.quantity_delta, -v_asset_entry.cost_basis_delta")
    expect(migration).toContain("'existing_holding_asset_reversal'")
    expect(migration).toContain("'existing_holding_opening_equity_reversal'")
    expect(migration).toContain("existing holding has already been reversed")
  })

  it("uses asset currency and canonical units, with explicit historical FX only when needed", () => {
    expect(migration).toContain("v_user_id, 'opening_position', v_asset.currency_code, 'draft'")
    expect(migration).toContain("p_quantity, v_total_cost_basis")
    expect(migration).toContain("p_average_cost, 'existing_holding_asset'")
    expect(migration).toContain("p_account_fx_rate numeric default null")
    expect(migration).toContain("cross-currency existing holdings require a positive historical account FX rate")
    expect(migration).toContain("v_account_cost_basis := pg_catalog.round(v_total_cost_basis * p_account_fx_rate, 10)")
    expect(migration).toContain("'opening_position_input'")
  })

  it("reverses original asset and account amounts with the original immutable FX metadata", () => {
    expect(migration).toContain("v_asset_entry.account_fx_rate, v_asset_entry.account_fx_effective_at")
    expect(migration).toContain("v_asset_entry.account_fx_source")
    expect(migration).toContain("-v_asset_entry.cost_basis_delta")
  })

  it("retains independent same-asset opening positions and never creates a cash effect", () => {
    expect(migration).not.toContain("already has an existing holding")
    expect(migration).toContain("v_current_quantity - v_asset_entry.quantity_delta")
    expect(migration).toContain("v_current_cost_basis")
    expect(migration).not.toContain("opening_balance =")
    expect(migration).not.toContain("'investment_payment'")
  })

  it("keeps the internal helper inaccessible to authenticated clients", () => {
    expect(migration).toContain("revoke all on function public.post_existing_holding_internal")
    expect(migration).not.toContain("grant execute on function public.post_existing_holding_internal")
  })
})
