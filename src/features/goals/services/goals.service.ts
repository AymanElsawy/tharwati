import type {
  GoalProgressEntryRow,
  GoalRow,
  GoalStatus,
} from "@/lib/supabase/types"
import { goalsRepository } from "../repositories/goals.repository"
import {
  toGoalSummary,
  validateEntryInput,
  validateGoalInput,
  type GoalEntryInput,
  type GoalFormInput,
  type GoalSummary,
  type GoalValidationCode,
} from "../domain/goals"

export class GoalValidationError extends Error {
  readonly code: GoalValidationCode
  constructor(code: GoalValidationCode) {
    super(code)
    this.code = code
  }
}

export type GoalHistoryEntry = GoalProgressEntryRow & {
  reversedByEntryId: string | null
  replacementEntryId: string | null
}
export type GoalsReadModel = {
  goals: GoalSummary[]
  entriesByGoal: ReadonlyMap<string, GoalHistoryEntry[]>
}
export type GoalHistoryGroup = {
  root: GoalHistoryEntry
  related: GoalHistoryEntry[]
}
export function buildGoalHistoryEntries(
  entries: GoalProgressEntryRow[]
): Map<string, GoalHistoryEntry[]> {
  const reversalByOriginal = new Map(
    entries
      .filter((entry) => entry.reverses_entry_id)
      .map((entry) => [entry.reverses_entry_id!, entry.id])
  )
  const replacementByOriginal = new Map(
    entries
      .filter((entry) => entry.replacement_for_entry_id)
      .map((entry) => [entry.replacement_for_entry_id!, entry.id])
  )
  const entriesByGoal = new Map<string, GoalHistoryEntry[]>()
  for (const entry of entries)
    entriesByGoal.set(entry.goal_id, [
      ...(entriesByGoal.get(entry.goal_id) ?? []),
      {
        ...entry,
        reversedByEntryId: reversalByOriginal.get(entry.id) ?? null,
        replacementEntryId: replacementByOriginal.get(entry.id) ?? null,
      },
    ])
  return entriesByGoal
}
export function groupGoalHistoryEntries(
  entries: GoalHistoryEntry[]
): GoalHistoryGroup[] {
  const byOriginal = new Map<string, GoalHistoryEntry[]>()
  const roots: GoalHistoryEntry[] = []
  for (const entry of entries) {
    const originalId = entry.reverses_entry_id ?? entry.replacement_for_entry_id
    if (originalId) {
      byOriginal.set(originalId, [...(byOriginal.get(originalId) ?? []), entry])
    } else {
      roots.push(entry)
    }
  }
  const collect = (entry: GoalHistoryEntry): GoalHistoryEntry[] =>
    (byOriginal.get(entry.id) ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .flatMap((child) => [child, ...collect(child)])
  return roots.map((root) => ({ root, related: collect(root) }))
}
export async function loadGoals(): Promise<GoalsReadModel> {
  const data = await goalsRepository.list()
  const entriesByGoal = buildGoalHistoryEntries(data.entries)
  const goals = data.goals.map((goal: GoalRow) => {
    const summary = toGoalSummary(goal, entriesByGoal.get(goal.id) ?? [])
    if (!summary)
      throw new Error(
        "Goal progress is unavailable because stored decimal data is invalid."
      )
    return summary
  })
  return { goals, entriesByGoal }
}
export async function saveGoal(input: GoalFormInput, id?: string) {
  const error = validateGoalInput(input)
  if (error) throw new GoalValidationError(error)
  return id ? goalsRepository.update(id, input) : goalsRepository.create(input)
}
export async function addGoalEntry(goalId: string, input: GoalEntryInput) {
  const error = validateEntryInput(input)
  if (error) throw new GoalValidationError(error)
  return goalsRepository.addEntry(goalId, input)
}
export const correctGoalEntry = goalsRepository.correctEntry
export const setGoalStatus = (id: string, status: GoalStatus) =>
  goalsRepository.setStatus(id, status)
export const setGoalArchived = goalsRepository.setArchived
