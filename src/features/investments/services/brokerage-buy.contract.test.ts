import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822174000_add_brokerage_buy.sql?raw"

describe("Brokerage Buy database contract", () => {
  it("uses an owned active Brokerage account and its locked available-cash helper", () => {
    expect(migration).toContain("accounts.account_type_code = 'brokerage'")
    expect(migration).toContain(
      "public.get_brokerage_available_cash(p_account_id, v_required_cash, true)"
    )
  })

  it("normalizes component amounts before the same-currency Buy cash calculation", () => {
    expect(migration).toContain(
      "v_purchase_amount := pg_catalog.round(p_quantity * p_unit_price, 10)"
    )
    expect(migration).toContain(
      "v_fees := pg_catalog.round(coalesce(p_fees, 0::numeric), 10)"
    )
    expect(migration).toContain(
      "v_transaction_total := v_purchase_amount + v_fees"
    )
    expect(migration).toContain("normalized Buy total must be positive")
    expect(migration).toContain(
      "v_transaction_total, v_required_cash, 'brokerage_buy_cash'"
    )
  })

  it("preserves separate-component precision where rounding the sum would differ", () => {
    // For example, two 0.00000000006 components become 0.0000000001 each.
    // The cash total must be their normalized sum, not round(0.00000000012, 10).
    expect(migration).toContain("v_required_cash := v_purchase_account_amount + v_fees_account_amount")
    expect(migration).not.toContain("pg_catalog.round(v_transaction_total * p_account_fx_rate, 10)")
  })

  it("posts balanced asset, optional fee, and Brokerage cash entries only", () => {
    expect(migration).toContain("'brokerage_buy_asset'")
    expect(migration).toContain("'brokerage_buy_fee'")
    expect(migration).toContain("'brokerage_buy_cash'")
    expect(migration).not.toContain("cash_account")
    expect(migration).not.toContain("opening_balance =")
  })

  it("handles zero fees and keeps fee-inclusive cost basis with immutable cross-currency FX", () => {
    expect(migration).toContain("if v_fees > 0 then")
    expect(migration).toContain("v_fees_account_amount := pg_catalog.round(")
    expect(migration).toContain("v_fees * p_account_fx_rate")
    expect(migration).toContain("'buy_input'")
    expect(migration).toContain("cross-currency Brokerage buys require a positive historical account FX rate")
  })

  it("uses the exact normalized required cash at the insufficient-cash boundary and aggregates buys through holdings", () => {
    expect(migration).toContain(
      "public.get_brokerage_available_cash(p_account_id, v_required_cash, true)"
    )
    expect(migration).toContain("select * into v_transaction from public.post_transaction(v_transaction.id)")
    expect(migration).toContain("'buy', v_asset.currency_code, 'draft'")
  })

  it("exposes only the public RPC to authenticated clients", () => {
    expect(migration).toContain("revoke all on function public.post_brokerage_buy_internal")
    expect(migration).toContain("grant execute on function public.add_brokerage_buy")
  })
})
