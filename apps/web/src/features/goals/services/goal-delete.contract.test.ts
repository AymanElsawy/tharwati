import { describe, expect, it } from "vitest"
import types from "../../../lib/supabase/types.ts?raw"
import dialog from "../components/GoalDeleteDialog.tsx?raw"
import page from "../pages/GoalsPage.tsx?raw"
import repository from "../repositories/goals.repository.ts?raw"
import service from "./goals.service.ts?raw"

describe("Goal hard-delete client contract", () => {
  it("routes deletion through the dedicated RPC and service", () => {
    expect(repository).toContain('supabase.rpc("delete_goal", { p_goal_id: id })')
    expect(service).toContain("goalsRepository.delete(id)")
  })

  it("opens a custom named-goal confirmation before deleting", () => {
    expect(page).not.toContain("goals.deleteConfirm")
    expect(page).toContain("setDeleteTarget(selected)")
    expect(page).toContain("<GoalDeleteDialog")
    expect(page).toContain("goalName={deleteTarget.name}")
    expect(page).toContain("onConfirm={() => void remove(deleteTarget)}")
    expect(dialog).toContain('t("goals.deleteTitle")')
    expect(dialog).toContain('t("goals.deletePrompt", { goalName })')
    expect(dialog).toContain('t("goals.keepGoal")')
    expect(dialog).toContain('variant="destructive"')
  })

  it("deletes only after confirmation, then refreshes and clears selection", () => {
    expect(page).toContain("await deleteGoal(goal.id)")
    expect(page).toContain("setSelectedId(null)")
    expect(page).toContain("await load()")
    expect(page).toContain("canDelete={!selected.hasHistory}")
    expect(page.indexOf("await deleteGoal(goal.id)"))
      .toBeGreaterThan(page.indexOf("const remove = async"))
  })

  it("keeps the generated RPC type in sync", () => {
    expect(types).toContain("delete_goal:")
    expect(types).toContain("Args: { p_goal_id: string }")
  })
})
