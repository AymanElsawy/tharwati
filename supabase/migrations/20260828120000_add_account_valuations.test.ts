// Migration contract coverage is intentionally source-level: remote deployment is out of scope.
import { describe, expect, it } from "vitest"
import sql from "./20260828120000_add_account_valuations.sql?raw"

describe("account valuations migration", () => {
  it("keeps immutable correction chains and dashboard invalidation", () => {
    expect(sql).toContain("account_valuations_one_direct_correction_idx")
  expect(sql).toContain("correct_account_valuation")
  expect(sql).toContain("account_disposals")
  expect(sql).toContain("correct_account_disposal")
  expect(sql).toContain("recalculate_account_disposal_projection")
  expect(sql).toContain("initial_ownership_percentage")
  expect(sql).toContain("p_disposed_on > current_date")
  expect(sql).toContain("Real Estate supports full sale only")
  expect(sql).toContain("revoke all on function public.recalculate_account_disposal_projection")
    expect(sql).toContain("dashboard_snapshot_account_valuations")
    expect(sql).toContain("currency_code is distinct from old.currency_code")
    expect(sql).not.toContain("update public.account_valuations")
  })
  it("does not backfill legacy opening balances", () => {
    expect(sql).not.toMatch(/insert into public\.account_valuations[\s\S]{0,300}select/i)
  })
})

it("keeps trigger-only fields out of the projection helper", () => {
  const projection = sql.match(/create function public\.recalculate_account_disposal_projection[\s\S]*?\$\$;/)?.[0] ?? ""
  const guard = sql.match(/create function public\.prevent_legacy_non_market_opening_balance_write[\s\S]*?\$\$;/)?.[0] ?? ""
  expect(projection).not.toContain("tg_op")
  expect(projection).not.toContain("new.account_type_code")
  expect(guard).toContain("new.initial_ownership_percentage")
})
