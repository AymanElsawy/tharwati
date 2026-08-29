import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
const sql = readFileSync(
  new URL("./20260829130000_add_goals_mvp.sql", import.meta.url),
  "utf8"
)
describe("Goals migration", () => {
  it("creates isolated goals and immutable progress history", () => {
    expect(sql).toContain("create table public.goals")
    expect(sql).toContain("create table public.goal_progress_entries")
    expect(sql).toContain("goal_progress_entries_immutable")
    expect(sql).toContain("auth.uid()")
  })
  it("keeps amounts positive and dates non-future", () => {
    expect(sql).toMatch(/amount numeric\(20,2\) not null check \(amount > 0\)/)
    expect(sql).toContain("effective_on <= current_date")
  })
  it("uses atomic sign-aware correction and one reversal", () => {
    expect(sql).toContain("goal_progress_entries_one_reversal_idx")
    expect(sql).toContain(
      "when original.entry_type = 'withdrawal' then e.amount"
    )
    expect(sql).toContain("Correction would make funded amount negative")
  })
  it("locks currency after any progress history", () =>
    expect(sql).toContain(
      "Goal currency is locked after progress history exists"
    ))
  it("links replacements and supports reconstructable correction chains", () => {
    expect(sql).toContain("replacement_for_entry_id")
    expect(sql).toContain("goal_progress_entries_one_replacement_idx")
    expect(sql).toContain("v_original.id) returning id into v_replacement_id")
  })
  it("creates Saved so far atomically as progress", () => {
    expect(sql).toContain("if p_saved_so_far is not null then")
    expect(sql).toContain("values(v_goal_id,v_user_id,'progress'")
  })
  it("guards withdrawals, correction rollback, double reversal, lifecycle, and future dates", () => {
    expect(sql).toContain("Withdrawal exceeds funded amount")
    expect(sql).toContain("Correction would make funded amount negative")
    expect(sql).toContain("Entry already reversed")
    expect(sql).toContain("Goal must be active and unarchived")
    expect(sql).toContain("Progress date cannot be in the future")
  })
  it("derives ownership from auth and prevents cross-goal linkage", () => {
    expect(sql).toContain("uuid := auth.uid()")
    expect(sql).toContain(
      "foreign key (replacement_for_entry_id, goal_id, user_id)"
    )
    expect(sql).toContain("foreign key (reverses_entry_id, goal_id, user_id)")
  })
  it("allows only parent cascade deletion through the immutable trigger", () => {
    expect(sql).toContain("not exists (\n    select 1 from public.goals")
    expect(sql).toContain(
      "references public.goals(id, user_id) on delete cascade"
    )
  })
})
