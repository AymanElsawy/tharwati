import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260821030000_add_account_record_reversal_rpc.sql?raw"

describe("Account Record reversal migration", () => {
  it("routes Income and Expense reversals through the immutable posting helper", () => {
    expect(migration).toContain("'expense', v_account_id, null, v_account_amount")
    expect(migration).toContain("'income', v_account_id, null, v_account_amount")
    expect(migration).toContain("v_original.id, null")
  })

  it("reverses same- and cross-currency transfers with both native amounts", () => {
    expect(migration).toContain("v_destination_account_amount,")
    expect(migration).toContain("v_source_account_amount,")
    expect(migration).toContain("v_transfer_transaction_amount")
  })

  it("rejects duplicate reversals and preserves balance and credit-limit guards", () => {
    expect(migration).toContain("account record has already been reversed")
    expect(migration).toContain("insufficient available balance")
    expect(migration).toContain("credit account requires a credit card limit")
    expect(migration).toContain("destination available credit would exceed its credit limit")
  })
})
