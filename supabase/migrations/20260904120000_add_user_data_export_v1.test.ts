import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("./20260904120000_add_user_data_export_v1.sql", import.meta.url),
  "utf8",
).toLowerCase()

describe("Download My Data migration", () => {
  it("exposes a caller-only, hardened no-argument RPC", () => {
    expect(sql).toContain("create function public.export_my_data_v1()")
    expect(sql).toContain("v_user_id uuid := auth.uid()")
    expect(sql).toContain("security definer")
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain("revoke all on function public.export_my_data_v1() from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.export_my_data_v1() to authenticated")
  })

  it("uses explicit projections and excludes stale/global stores", () => {
    expect(sql).not.toMatch(/select\s+\*/)
    expect(sql).not.toContain("public.financial_settings")
    expect(sql).not.toContain("public.exchange_rates")
    expect(sql).not.toContain("public.dashboard_valuation_snapshots")
    expect(sql).toContain("m.user_id = v_user_id and m.provider = 'manual'")
    expect(sql).toContain("::text")
    expect(sql).toContain("order by")
  })
})
