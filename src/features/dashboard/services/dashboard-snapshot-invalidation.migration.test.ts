import { describe, expect, it } from "vitest"
import migration from "../../../../supabase/migrations/20260827160000_add_dashboard_snapshot_invalidation.sql?raw"

describe("Dashboard snapshot invalidation migration", () => {
  it("centrally invalidates the affected user after every valuation-relevant mutation", () => {
    expect(migration).toContain("invalidate_dashboard_valuation_snapshots(v_user_id)")
    for (const table of ["financial_transactions", "holdings", "metal_purchases", "financial_accounts", "assets", "market_prices"]) expect(migration).toContain(`on public.${table}`)
  })
  it("covers buy, sell, dividends, cash/bank and Bank Credit through posted transaction rows", () => {
    expect(migration).toContain("dashboard_snapshot_financial_transactions")
    expect(migration).toContain("after insert or update or delete")
  })
  it("keeps invalidation scoped to the affected user and leaves fresh snapshots to rebuild", () => {
    expect(migration).toContain("where user_id = p_user_id")
    expect(migration).toContain("holdings.user_id = snapshots.user_id")
  })
  it("does not invalidate shared provider-cache rows because they have no user id", () => {
    expect(migration).toContain("if v_user_id is not null")
  })
})
