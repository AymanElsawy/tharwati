import { describe, expect, it } from "vitest"

import migration from "../../../../supabase/migrations/20260822172000_fix_post_transaction_asset_check.sql?raw"

describe("post transaction asset check reconciliation", () => {
  it("keeps the authenticated owned-draft posting contract with qualified references", () => {
    expect(migration).toContain("create or replace function public.post_transaction(transaction_id uuid)")
    expect(migration).toContain("transactions.id = post_transaction.transaction_id")
    expect(migration).toContain("transactions.id = v_transaction.id")
    expect(migration).toContain("entries.transaction_id = v_transaction.id")
    expect(migration).toContain("perform public.assert_account_record_transaction_balanced(v_transaction.id)")
    expect(migration).toContain("perform public.rebuild_holding_projection(v_user_id)")
    expect(migration).toContain("grant execute on function public.post_transaction(uuid) to authenticated")
  })
})
