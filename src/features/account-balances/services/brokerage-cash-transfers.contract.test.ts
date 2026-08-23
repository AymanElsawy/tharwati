import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822160000_add_brokerage_cash_transfers.sql?raw"

describe("Brokerage cash transfer database contract", () => {
  it("limits transfers to Cash/Bank and Brokerage, with no holding effects", () => {
    expect(migration).toContain("v_source.account_type_code in ('cash', 'bank') and v_destination.account_type_code = 'brokerage'")
    expect(migration).toContain("v_source.account_type_code = 'brokerage' and v_destination.account_type_code in ('cash', 'bank')")
    expect(migration).toContain("transfer must be between Cash or Bank and Brokerage")
    expect(migration).toContain("transaction_id, user_id, account_id, entry_side, transaction_amount, account_amount, memo")
    expect(migration).not.toContain("asset_id, entry_side, transaction_amount")
  })

  it("uses the locked Brokerage Available Cash helper before a Brokerage debit", () => {
    expect(migration).toContain("public.get_brokerage_available_cash(v_source.id, p_amount, true)")
    expect(migration).toContain("p_amount, true")
  })

  it("posts a same-currency forward transfer and reversal as exact opposite ledger entries", () => {
    expect(migration).toContain("v_user_id, 'transfer', v_source.currency_code, 'draft'")
    expect(migration).toContain("v_destination.id, 'debit', p_amount, v_received")
    expect(migration).toContain("v_source.id, 'credit', p_amount, p_amount")
    expect(migration).toContain("p_reverses_transaction_id")
    expect(migration).toContain("reverses_transaction_id = v_original.id")
    expect(migration).toContain("reverse_brokerage_cash_transfer")
    expect(migration).toContain("v_source.id, 'debit', v_transaction_amount, v_source_amount")
    expect(migration).toContain("v_destination.id, 'credit', v_transaction_amount, v_destination_amount")
  })

  it("reverses Cash USD to Brokerage EUR with USD 1000 and EUR 850 kept exact", () => {
    expect(migration).toContain("v_original.transaction_currency_code")
    expect(migration).toContain("v_transaction_amount, v_source_amount")
    expect(migration).toContain("v_transaction_amount, v_destination_amount")
    expect(migration).not.toContain("v_destination_amount, v_source_amount, now()")
  })

  it("reverses Brokerage EUR to Bank USD using the original EUR transaction amount and USD account amount", () => {
    expect(migration).toContain("v_reversal.id, v_user_id, v_source.id, 'debit', v_transaction_amount, v_source_amount")
    expect(migration).toContain("v_reversal.id, v_user_id, v_destination.id, 'credit', v_transaction_amount, v_destination_amount")
  })

  it("rejects a reversal that would consume Brokerage cash below zero and rejects duplicates", () => {
    expect(migration).toContain("public.get_brokerage_available_cash(v_destination.id, v_destination_amount, true)")
    expect(migration).toContain("Brokerage cash transfer has already been reversed")
  })

  it("keeps posting helpers inaccessible to authenticated clients", () => {
    expect(migration).toContain("revoke all on function public.post_brokerage_cash_transfer_internal")
    expect(migration).not.toContain("grant execute on function public.post_brokerage_cash_transfer_internal")
  })
})
