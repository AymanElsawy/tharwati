import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sql = readFileSync(
  new URL(
    "./20260829133000_fix_goals_user_deletion_cascade.sql",
    import.meta.url
  ),
  "utf8"
)

describe("Goals user deletion cascade migration", () => {
  it("cascades Auth user deletion through Goals", () => {
    expect(sql).toContain("constraint goals_user_id_fkey")
    expect(sql).toMatch(
      /foreign key \(user_id\) references auth\.users\(id\) on delete cascade/
    )
  })

  it("allows only parent or Auth-user cascade entry deletion", () => {
    expect(sql).toContain("from public.goals")
    expect(sql).toContain("from auth.users")
    expect(sql).toContain("raise exception 'Goal progress history is immutable'")
  })

  it("keeps the internal immutable trigger function unavailable to clients", () => {
    expect(sql).toMatch(
      /revoke all on function public\.prevent_goal_progress_mutation\(\)[\s\S]*from public, anon, authenticated/
    )
  })

  it("does not change Goals RLS or table grants", () => {
    expect(sql).not.toMatch(/create policy|drop policy|grant .* on public\.(goals|goal_progress_entries)/i)
  })
})
