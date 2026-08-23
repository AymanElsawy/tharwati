import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822173000_add_existing_holding_correction.sql?raw"

describe("Existing Holding correction database contract", () => {
  it("posts an exact reversal and a linked replacement in one correction RPC", () => {
    expect(migration).toContain("create function public.correct_existing_holding")
    expect(migration).toContain("v_reversal_result := public.reverse_existing_holding(v_original.id)")
    expect(migration).toContain("v_replacement_result := public.post_existing_holding_with_links_internal")
    expect(migration).toContain("v_original.id\n  )")
    expect(migration).toContain("corrects_transaction_id")
    expect(migration).toContain("'reversal_transaction'")
    expect(migration).toContain("'replacement_transaction'")
  })

  it("rejects duplicate correction or reversal before posting replacement", () => {
    expect(migration).toContain("transactions.reverses_transaction_id = v_original.id")
    expect(migration).toContain("transactions.corrects_transaction_id = v_original.id")
    expect(migration).toContain("existing holding has already been changed")
  })

  it("preserves asset-currency cost input and historical FX rules", () => {
    expect(migration).toContain("v_user_id, 'opening_position', v_asset.currency_code, 'draft'")
    expect(migration).toContain("p_quantity * p_average_cost")
    expect(migration).toContain("cross-currency existing holdings require a positive historical account FX rate")
    expect(migration).toContain("pg_catalog.round(v_total_cost_basis * p_account_fx_rate, 10)")
    expect(migration).toContain("'opening_position_input'")
  })

  it("keeps internal posting helpers inaccessible and does not create cash effects", () => {
    expect(migration).toContain("revoke all on function public.post_existing_holding_with_links_internal")
    expect(migration).toContain("revoke all on function public.post_existing_holding_internal")
    expect(migration).toContain("grant execute on function public.correct_existing_holding")
    expect(migration).not.toContain("opening_balance =")
    expect(migration).not.toContain("investment_payment")
  })
})
