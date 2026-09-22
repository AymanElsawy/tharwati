import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL("./20260922120000_add_safe_goal_delete.sql", import.meta.url),
  "utf8",
)
const behavior = readFileSync(
  new URL("../tests/goal_hard_delete.sql", import.meta.url),
  "utf8",
)

describe("safe Goal hard delete migration", () => {
  it("uses one owned-row lock and raw-history invariant", () => {
    expect(migration).toContain("create function public.delete_goal(p_goal_id uuid)")
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain("v_user_id uuid := auth.uid()")
    expect(migration).toMatch(/where id = p_goal_id and user_id = v_user_id\s+for update/)
    expect(migration).toMatch(/exists \([\s\S]*from public\.goal_progress_entries[\s\S]*where goal_id = v_goal\.id/)
    expect(migration).not.toContain("goal_funded_amount")
  })

  it("keeps direct table deletes unavailable", () => {
    expect(migration).toContain("revoke delete on public.goals, public.goal_progress_entries")
    expect(migration).toContain("from public, anon, authenticated")
    expect(migration).toContain("grant execute on function public.delete_goal(uuid) to authenticated")
  })

  it("links executable coverage for every product invariant", () => {
    for (const label of [
      "zero-history goals in every lifecycle state are deleted",
      "missing and wrong-user goals are rejected",
      "all raw history shapes permanently block deletion",
      "net-zero history still blocks deletion",
      "unrelated goals remain untouched",
    ]) expect(behavior).toContain(label)
  })
})
