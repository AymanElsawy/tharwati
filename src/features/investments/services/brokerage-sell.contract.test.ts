import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822175000_add_brokerage_sell.sql?raw"

describe("Brokerage Sell database contract", () => {
  it("uses proportional moving-average cost reduction without realized P/L", () => {
    expect(migration).toContain("v_current_asset_basis * p_quantity / v_current_quantity")
    expect(migration).toContain("v_current_account_basis * p_quantity / v_current_quantity")
    expect(migration).toContain("p_quantity = v_current_quantity")
    expect(migration).toContain("'brokerage_sell_cost_basis'")
    expect(migration).toContain("-v_account_basis_reduction")
    expect(migration).not.toContain("realized_gain")
  })

  it("preserves exact cross-currency carrying basis rather than re-deriving it from rounded FX", () => {
    expect(migration).toContain("new.memo = 'brokerage_sell_cost_basis'")
    expect(migration).toContain("new.account_cost_basis_delta is null")
    expect(migration).toContain("full sell must remove the exact remaining account cost basis")
    expect(migration).toContain("partial sell would leave a positive holding with unusable cost basis")
  })

  it("keeps normal account amounts positive while narrowly allowing the zero-cash basis entry", () => {
    expect(migration).toContain("drop constraint transaction_entries_account_amount_positive_check")
    expect(migration).toContain("account_amount > 0")
    expect(migration).toContain("memo = 'brokerage_sell_cost_basis'")
    expect(migration).toContain("asset_id is not null")
    expect(migration).toContain("account_id is not null")
    expect(migration).toContain("quantity_delta = 0")
    expect(migration).toContain("transaction_amount = 0")
    expect(migration).toContain("cost_basis_delta < 0")
    expect(migration).toContain("account_cost_basis_delta < 0")
    expect(migration).toContain("drop constraint transaction_entries_transaction_amount_positive_check")
    expect(migration).toContain("transaction_amount > 0")
  })

  it("credits only Brokerage Available Cash with net proceeds", () => {
    expect(migration).toContain("v_net_proceeds := v_gross_proceeds - v_fees")
    expect(migration).toContain("'brokerage_sell_cash'")
    expect(migration).toContain("'brokerage_sell_fee'")
    expect(migration).not.toContain("cash_account")
  })

  it("keeps the helper internal and grants only the public RPC", () => {
    expect(migration).toContain("revoke all on function public.post_brokerage_sell_internal")
    expect(migration).toContain("grant execute on function public.add_brokerage_sell")
  })
})
