import { describe, expect, it } from "vitest"
import migration from "../../../../supabase/migrations/20260827140000_add_brokerage_partial_dividend_reinvestment.sql?raw"

describe("partial dividend reinvestment migration", () => {
  it("posts the exact partial cash and holding effects atomically", () => {
    expect(migration).toContain("v_reinvested >= v_net")
    expect(migration).toContain("v_cash_remainder := v_net - v_reinvested")
    expect(migration).toContain("v_quantity := pg_catalog.round(v_reinvested / p_unit_price, 10)")
    expect(migration).toContain("'brokerage_dividend_partial_reinvestment'")
    expect(migration).toContain("'brokerage_dividend_partial_cash'")
    expect(migration).toContain("v_quantity,v_reinvested,p_unit_price")
    expect(migration).toContain("select * into v_transaction from public.post_transaction")
  })

  it("validates ownership, currency, and positive partial inputs", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toContain("a.user_id=v_user_id")
    expect(migration).toContain("a.account_type_code='brokerage'")
    expect(migration).toContain("v_asset.currency_code <> v_account.currency_code")
    expect(migration).toContain("p_reinvested_amount <= 0")
  })
})
