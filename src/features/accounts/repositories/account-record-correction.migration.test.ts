import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260821040000_add_account_record_correction_rpc.sql?raw"

describe("Account Record correction migration", () => {
  it("reverses Income and Expense before posting their immutable replacements", () => {
    expect(migration).toContain("v_reversal := public.reverse_account_record(v_original.id)")
    expect(migration).toContain("v_replacement := public.post_account_record_internal(")
    expect(migration).toContain("v_original.id\n  );")
  })

  it("keeps Transfer replacement inputs, including cross-currency received amount", () => {
    expect(migration).toContain("p_record_type,")
    expect(migration).toContain("p_counterparty_account_id,")
    expect(migration).toContain("p_received_amount,")
    expect(migration).toContain("p_occurred_at,")
  })

  it("rejects duplicate corrections and retains balance and credit-limit validation", () => {
    expect(migration).toContain("reversed account record cannot be corrected")
    expect(migration).toContain("account record has already been corrected")
    expect(migration).toContain("public.reverse_account_record(v_original.id)")
    expect(migration).toContain("public.post_account_record_internal(")
  })

  it("keeps correction atomic when the replacement helper raises an error", () => {
    expect(migration).toContain("Any error from the")
    expect(migration).toContain("rolls back both newly-created transactions")
    expect(migration).not.toContain("exception when others")
  })
})
