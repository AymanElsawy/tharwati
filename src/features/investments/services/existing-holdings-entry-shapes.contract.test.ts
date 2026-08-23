import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822171000_fix_existing_holding_entry_shapes.sql?raw"

describe("existing holding entry shape reconciliation", () => {
  it("replaces only the affected Existing Holding functions", () => {
    expect(migration).toContain("create or replace function public.post_existing_holding_internal")
    expect(migration).toContain("create or replace function public.reverse_existing_holding")
    expect(migration).not.toContain("create or replace function public.add_existing_holding")
  })

  it("supplies every metadata value for accountless opening-equity entries", () => {
    expect(migration).toContain(
      "v_total_cost_basis, v_total_cost_basis, null, null,\n    null, null, null, null, 'existing_holding_opening_equity'"
    )
    expect(migration).toContain(
      "v_opening_entry.transaction_amount, v_opening_entry.account_amount,\n    null, null, null, null, null, null, 'existing_holding_opening_equity_reversal'"
    )
  })
})
