import {
  addDecimals,
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import type {
  Decimal,
  GoalEntryType,
  GoalProgressEntryRow,
  GoalRow,
  GoalStatus,
  GoalType,
} from "@/lib/supabase/types"

export const goalTypes: GoalType[] = [
  "buy_home",
  "buy_car",
  "travel",
  "education",
  "other",
]
export const goalStatuses: GoalStatus[] = ["active", "completed", "cancelled"]
export type GoalFormInput = {
  name: string
  goalType: GoalType
  customTypeName: string | null
  targetAmount: Decimal
  currencyCode: string
  targetDate: string | null
  savedSoFar?: Decimal | null
  savedOn?: string | null
}
export type GoalEntryInput = {
  entryType: Exclude<GoalEntryType, "reversal">
  amount: Decimal
  effectiveOn: string
  note: string | null
}
export type GoalSummary = GoalRow & {
  fundedAmount: Decimal
  progressPercent: Decimal
  displayPercent: Decimal
  surplusAmount: Decimal
  hasHistory: boolean
}
export type GoalValidationCode =
  | "name_required"
  | "type_invalid"
  | "custom_type_required"
  | "target_positive"
  | "currency_invalid"
  | "saved_positive"
  | "date_not_future"
  | "amount_positive"
export const showsCustomGoalType = (goalType: GoalType) => goalType === "other"
export const isGoalCurrencyLocked = (hasHistory: boolean) => hasHistory

export function validateGoalInput(
  input: GoalFormInput
): GoalValidationCode | null {
  if (!input.name.trim()) return "name_required"
  if (!goalTypes.includes(input.goalType)) return "type_invalid"
  if (input.goalType === "other" && !input.customTypeName?.trim())
    return "custom_type_required"
  if (compareDecimals(input.targetAmount, "0") !== 1) return "target_positive"
  if (!/^(USD|SAR|EGP|EUR|GBP)$/.test(input.currencyCode))
    return "currency_invalid"
  if (input.savedSoFar && compareDecimals(input.savedSoFar, "0") !== 1)
    return "saved_positive"
  if (input.savedOn && input.savedOn > today()) return "date_not_future"
  return null
}

export function validateEntryInput(
  input: GoalEntryInput
): GoalValidationCode | null {
  if (compareDecimals(input.amount, "0") !== 1) return "amount_positive"
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveOn) ||
    input.effectiveOn > today()
  )
    return "date_not_future"
  return null
}

export function fundedAmount(entries: GoalProgressEntryRow[]): Decimal | null {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  let total: Decimal = "0"
  for (const entry of entries) {
    let next: Decimal | null
    if (entry.entry_type === "progress") next = addDecimals(total, entry.amount)
    else if (entry.entry_type === "withdrawal")
      next = subtractDecimals(total, entry.amount)
    else {
      const original = entry.reverses_entry_id
        ? byId.get(entry.reverses_entry_id)
        : null
      next =
        original?.entry_type === "progress"
          ? subtractDecimals(total, entry.amount)
          : original?.entry_type === "withdrawal"
            ? addDecimals(total, entry.amount)
            : null
    }
    if (next === null) return null
    total = next
  }
  return total
}

export function toGoalSummary(
  goal: GoalRow,
  entries: GoalProgressEntryRow[]
): GoalSummary | null {
  const funded = fundedAmount(entries)
  if (funded === null) return null
  const percentage = multiplyDecimals(
    divideDecimals(funded, goal.target_amount, 8) ?? "",
    "100"
  )
  const surplus =
    compareDecimals(funded, goal.target_amount) === 1
      ? subtractDecimals(funded, goal.target_amount)
      : "0"
  if (percentage === null || surplus === null) return null
  return {
    ...goal,
    fundedAmount: funded,
    progressPercent: percentage,
    displayPercent:
      compareDecimals(percentage, "100") === 1 ? "100" : percentage,
    surplusAmount: surplus,
    hasHistory: entries.length > 0,
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}
