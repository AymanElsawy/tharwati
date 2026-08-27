import { describe, expect, it } from "vitest"
import migration from "../../../../supabase/migrations/20260827161000_fix_dashboard_snapshot_invalidation_triggers.sql?raw"

describe("Dashboard snapshot invalidation correction migration", () => {
  it("keeps status access exclusive to the financial transaction trigger", () => {
    const genericFunction = migration.slice(
      migration.indexOf("create or replace function public.invalidate_dashboard_snapshot_for_row()"),
      migration.indexOf("create or replace function public.invalidate_dashboard_snapshot_for_financial_transaction()"),
    )
    expect(genericFunction).not.toContain("status")
    expect(migration).toContain("invalidate_dashboard_snapshot_for_financial_transaction")
    expect(migration).toContain("new.status = 'posted'")
    expect(migration).toContain("old.status = 'posted'")
  })

  it("recreates every covered trigger row-level with its compatible function", () => {
    const expectedTriggers = [
      ["financial_transactions", "invalidate_dashboard_snapshot_for_financial_transaction"],
      ["holdings", "invalidate_dashboard_snapshot_for_row"],
      ["metal_purchases", "invalidate_dashboard_snapshot_for_row"],
      ["financial_accounts", "invalidate_dashboard_snapshot_for_row"],
      ["assets", "invalidate_dashboard_snapshot_for_asset"],
      ["market_prices", "invalidate_dashboard_snapshot_for_row"],
    ]
    for (const [table, fn] of expectedTriggers) {
      expect(migration).toContain(`after insert or update or delete on public.${table}\nfor each row execute function public.${fn}()`)
    }
  })

  it("handles INSERT, UPDATE, and DELETE without cross-user invalidation", () => {
    expect(migration).toContain("if tg_op <> 'INSERT' then")
    expect(migration).toContain("if tg_op <> 'DELETE' then")
    expect(migration).toContain("v_new_user_id is distinct from v_old_user_id")
    expect(migration).toContain("invalidate_dashboard_valuation_snapshots(v_old_user_id)")
    expect(migration).toContain("invalidate_dashboard_valuation_snapshots(v_new_user_id)")
  })

  it("preserves global-asset invalidation for only users holding that asset", () => {
    expect(migration).toContain("holdings.user_id = snapshots.user_id")
    expect(migration).toContain("holdings.asset_id = v_asset_id")
  })
})
