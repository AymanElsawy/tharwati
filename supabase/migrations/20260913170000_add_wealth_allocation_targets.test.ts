import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL("./20260913170000_add_wealth_allocation_targets.sql", import.meta.url),
  "utf8",
)

describe("wealth allocation target migration", () => {
  it("creates user-owned target rows with bounded decimal percentages", () => {
    expect(sql).toContain("create table public.wealth_allocation_targets")
    expect(sql).toContain("numeric(9, 6)")
    expect(sql).toContain("target_percentage >= 0")
    expect(sql).toContain("primary key (user_id, asset_class)")
    expect(sql).toContain("references auth.users (id) on delete cascade")
  })

  it("isolates reads with RLS and keeps writes behind the atomic RPC", () => {
    expect(sql).toContain("enable row level security")
    expect(sql).toContain("using ((select auth.uid()) = user_id)")
    expect(sql).toContain(
      "revoke all on table public.wealth_allocation_targets",
    )
    expect(sql).toContain(
      "grant select on table public.wealth_allocation_targets to authenticated",
    )
    expect(sql).toContain(
      "create function public.replace_wealth_allocation_targets(p_targets jsonb)",
    )
  })

  it("requires the complete supported set and an exact 100 percent total", () => {
    expect(sql).toContain("Targets must contain every supported wealth asset class")
    expect(sql).toContain("if v_total <> 100")
    expect(sql).toContain("Target percentages must total exactly 100")
    expect(sql).not.toContain("certificates")
  })

  it("derives ownership only from the authenticated session", () => {
    expect(sql).toContain("v_user_id uuid := auth.uid()")
    expect(sql).toContain("security definer")
    expect(sql).toContain("set search_path = ''")
    expect(sql).not.toContain("p_user_id")
  })
})
