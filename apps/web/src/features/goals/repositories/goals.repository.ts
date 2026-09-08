import { supabase } from "@/lib/supabase"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import {
  toRepositoryError,
  type Decimal,
  type GoalProgressEntryRow,
  type GoalRow,
  type GoalStatus,
} from "@/lib/supabase/types"
import type { GoalEntryInput, GoalFormInput } from "../domain/goals"

const goalSelect =
  "id,user_id,name,goal_type,custom_type_name,target_amount::text,currency_code,target_date,status,archived_at,created_at,updated_at" as const
const entrySelect =
  "id,goal_id,user_id,entry_type,amount::text,effective_on,note,reverses_entry_id,replacement_for_entry_id,created_at" as const
function failure(error: unknown, operation: string) {
  if (error)
    throw toRepositoryError(
      error as Parameters<typeof toRepositoryError>[0],
      operation
    )
}

export const goalsRepository = {
  async listActiveSummaries(limit: number): Promise<{
    goals: GoalRow[]
    entries: GoalProgressEntryRow[]
    hasAnyGoals: boolean
  }> {
    const operation = "goals.listActiveSummaries"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const [goalsResult, countResult] = await Promise.all([
      supabase
        .from("goals")
        .select(goalSelect)
        .eq("user_id", userId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("target_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(limit),
      supabase
        .from("goals")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ])
    const goals = requireQueryData(
      goalsResult.data,
      goalsResult.error,
      operation
    )
    failure(countResult.error, operation)
    if (goals.length === 0)
      return { goals, entries: [], hasAnyGoals: (countResult.count ?? 0) > 0 }

    const entriesResult = await supabase
      .from("goal_progress_entries")
      .select(entrySelect)
      .eq("user_id", userId)
      .in(
        "goal_id",
        goals.map((goal) => goal.id)
      )
      .order("created_at", { ascending: true })
    return {
      goals,
      entries: requireQueryData(
        entriesResult.data,
        entriesResult.error,
        operation
      ),
      hasAnyGoals: (countResult.count ?? 0) > 0,
    }
  },
  async list(): Promise<{ goals: GoalRow[]; entries: GoalProgressEntryRow[] }> {
    const operation = "goals.list"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const [goalsResult, entriesResult] = await Promise.all([
      supabase
        .from("goals")
        .select(goalSelect)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_progress_entries")
        .select(entrySelect)
        .eq("user_id", userId)
        .order("effective_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ])
    return {
      goals: requireQueryData(goalsResult.data, goalsResult.error, operation),
      entries: requireQueryData(
        entriesResult.data,
        entriesResult.error,
        operation
      ),
    }
  },
  async create(input: GoalFormInput): Promise<string> {
    const { data, error } = await supabase.rpc("create_goal", {
      p_name: input.name,
      p_goal_type: input.goalType,
      p_custom_type_name: input.customTypeName,
      p_target_amount: input.targetAmount,
      p_currency_code: input.currencyCode,
      p_target_date: input.targetDate,
      p_saved_so_far: input.savedSoFar ?? null,
      p_saved_on: input.savedOn ?? null,
    })
    failure(error, "goals.create")
    return data!
  },
  async update(id: string, input: GoalFormInput) {
    const { error } = await supabase.rpc("update_goal", {
      p_goal_id: id,
      p_name: input.name,
      p_goal_type: input.goalType,
      p_custom_type_name: input.customTypeName,
      p_target_amount: input.targetAmount,
      p_currency_code: input.currencyCode,
      p_target_date: input.targetDate,
    })
    failure(error, "goals.update")
  },
  async addEntry(goalId: string, input: GoalEntryInput) {
    const { error } = await supabase.rpc("add_goal_progress_entry", {
      p_goal_id: goalId,
      p_entry_type: input.entryType,
      p_amount: input.amount,
      p_effective_on: input.effectiveOn,
      p_note: input.note,
    })
    failure(error, "goals.addEntry")
  },
  async correctEntry(
    entryId: string,
    replacement: {
      amount: Decimal | null
      effectiveOn: string | null
      note: string | null
    }
  ) {
    const { error } = await supabase.rpc("correct_goal_progress_entry", {
      p_entry_id: entryId,
      p_replacement_amount: replacement.amount,
      p_replacement_effective_on: replacement.effectiveOn,
      p_note: replacement.note,
    })
    failure(error, "goals.correctEntry")
  },
  async setStatus(goalId: string, status: GoalStatus) {
    const { error } = await supabase.rpc("set_goal_status", {
      p_goal_id: goalId,
      p_status: status,
    })
    failure(error, "goals.setStatus")
  },
  async setArchived(goalId: string, archived: boolean) {
    const { error } = await supabase.rpc("set_goal_archived", {
      p_goal_id: goalId,
      p_archived: archived,
    })
    failure(error, "goals.setArchived")
  },
}
