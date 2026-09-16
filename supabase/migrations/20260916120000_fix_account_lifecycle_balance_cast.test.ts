import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("./20260916120000_fix_account_lifecycle_balance_cast.sql", import.meta.url),
  "utf8"
)
const behaviorSql = readFileSync(
  new URL("../tests/account_lifecycle_balance_types.sql", import.meta.url),
  "utf8"
)

describe("account lifecycle balance cast migration", () => {
  it("replaces only the private lifecycle helper with an explicit guarded decimal cast", () => {
    expect(sql).toContain(
      "create or replace function public.get_account_lifecycle_state(p_account_id uuid)"
    )
    expect(sql).toContain("v_current_value_text text")
    expect(sql).toContain("select balances.current_balance into v_current_value_text")
    expect(sql).toContain("btrim(v_current_value_text) !~ '^[+-]?[0-9]+([.][0-9]+)?$'")
    expect(sql).toContain("v_current_value := v_current_value_text::numeric")
    expect(sql).toContain("v_close_reason := 'current_value_unavailable'")
    expect(sql).not.toMatch(/coalesce\s*\(\s*v_current_value_text/i)
  })

  it("preserves lifecycle rules and authenticated ownership checks", () => {
    for (const fragment of [
      "where id = p_account_id and user_id = v_user_id",
      "outstanding_credit_balance",
      "remaining_cash",
      "remaining_holdings",
      "remaining_metal_quantity",
      "ownership_still_held",
      "financial_history",
    ]) {
      expect(sql).toContain(fragment)
    }
    expect(sql).toContain("security definer")
    expect(sql).toContain("set search_path = ''")
  })

  it("covers all affected account variants, balance states, and user isolation", () => {
    for (const label of [
      "Cash zero and positive balances",
      "Bank Debit zero and positive balances",
      "Bank Credit zero and positive amounts due",
      "Brokerage zero and positive available cash",
      "invalid and unavailable text balances fail closed",
      "authenticated lifecycle results are isolated to the caller",
    ]) {
      expect(behaviorSql).toContain(label)
    }
  })
})
