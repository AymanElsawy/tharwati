import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(new URL("./20260829140000_add_account_close_lifecycle.sql", import.meta.url), "utf8")

describe("account close lifecycle migration", () => {
  it("uses server-authoritative close, reopen, and pristine-delete RPCs", () => {
    expect(sql).toContain("create function public.close_financial_account")
    expect(sql).toContain("create function public.reopen_financial_account")
    expect(sql).toContain("create function public.delete_pristine_financial_account")
    expect(sql).toContain("from public.get_account_balances(array[p_account_id])")
    expect(sql).toContain("from public.get_effective_metal_purchases(array[p_account_id])")
  })

  it("enforces every zero-exposure close rule", () => {
    for (const reason of ["remaining_cash", "outstanding_credit_balance", "remaining_holdings", "remaining_metal_quantity", "ownership_still_held"]) {
      expect(sql).toContain(reason)
    }
  })

  it("removes direct hard delete and direct lifecycle mutation", () => {
    expect(sql).toContain("revoke delete on public.financial_accounts from authenticated")
    expect(sql).toContain("drop policy if exists financial_accounts_delete_own")
    expect(sql).toContain("create trigger financial_accounts_15_prevent_direct_lifecycle_change")
    expect(sql).toContain("before update of is_active, closed_reason, closed_on")
    expect(sql).toContain("new.closed_reason is distinct from old.closed_reason")
    expect(sql).toContain("new.closed_on is distinct from old.closed_on")
    expect(sql).toContain("account sale status is derived from disposal history")
  })

  it("keeps internal helpers private and public RPCs narrowly granted", () => {
    expect(sql).toContain("revoke all on function public.get_account_lifecycle_state(uuid) from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.close_financial_account(uuid) to authenticated")
  })

  it("checks all dependent account history, including funding links", () => {
    for (const table of ["transaction_entries", "holdings", "metal_purchases", "account_valuations", "account_disposals"]) {
      expect(sql).toContain(`from public.${table}`)
    }
    expect(sql).toContain("where funding_account_id = p_account_id")
  })
})
