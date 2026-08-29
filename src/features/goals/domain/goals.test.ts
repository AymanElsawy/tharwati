import { describe, expect, it } from "vitest"
import { formatPortfolioAmount } from "@/features/portfolio/utils/portfolio-formatters"
import type { GoalProgressEntryRow, GoalRow } from "@/lib/supabase/types"
import {
  fundedAmount,
  isGoalCurrencyLocked,
  showsCustomGoalType,
  toGoalSummary,
  validateEntryInput,
  validateGoalInput,
} from "./goals"

const goal: GoalRow = {
  id: "g",
  user_id: "u",
  name: "Home",
  goal_type: "buy_home",
  custom_type_name: null,
  target_amount: "100",
  currency_code: "SAR",
  target_date: null,
  status: "active",
  archived_at: null,
  created_at: "",
  updated_at: "",
}
const entry = (
  id: string,
  type: GoalProgressEntryRow["entry_type"],
  amount: string,
  reverses: string | null = null
): GoalProgressEntryRow => ({
  id,
  goal_id: "g",
  user_id: "u",
  entry_type: type,
  amount,
  effective_on: "2026-08-01",
  note: null,
  reverses_entry_id: reverses,
  replacement_for_entry_id: null,
  created_at: id,
})
describe("Goals domain", () => {
  it("calculates additions, withdrawals and sign-aware reversals", () =>
    expect(
      fundedAmount([
        entry("p", "progress", "80"),
        entry("w", "withdrawal", "20"),
        entry("rw", "reversal", "20", "w"),
      ])
    ).toBe("80"))
  it("calculates an effective replacement correction chain", () => {
    const corrected = entry("corrected", "progress", "60")
    corrected.replacement_for_entry_id = "original"
    const finalReplacement = entry("final", "progress", "80")
    finalReplacement.replacement_for_entry_id = "corrected"
    expect(
      fundedAmount([
        entry("original", "progress", "100"),
        entry("original-reversal", "reversal", "100", "original"),
        corrected,
        entry("corrected-reversal", "reversal", "60", "corrected"),
        finalReplacement,
      ])
    ).toBe("80")
  })
  it("preserves overfunded truth while capping display progress", () => {
    const result = toGoalSummary(goal, [entry("p", "progress", "125")])
    expect(result?.fundedAmount).toBe("125")
    expect(result?.progressPercent).toBe("125")
    expect(result?.displayPercent).toBe("100")
    expect(result?.surplusAmount).toBe("25")
  })
  it("validates custom types and positive targets", () =>
    expect(
      validateGoalInput({
        name: "X",
        goalType: "other",
        customTypeName: null,
        targetAmount: "0",
        currencyCode: "SAR",
        targetDate: null,
      })
    ).toBeTruthy())
  it("rejects future progress dates", () =>
    expect(
      validateEntryInput({
        entryType: "progress",
        amount: "1",
        effectiveOn: "2999-01-01",
        note: null,
      })
    ).toBe("date_not_future"))
  it("shares Other visibility and currency-lock rules", () => {
    expect(showsCustomGoalType("other")).toBe(true)
    expect(showsCustomGoalType("travel")).toBe(false)
    expect(isGoalCurrencyLocked(true)).toBe(true)
  })
  it("keeps large decimal values exact through calculation and formatting", () => {
    const largeGoal = { ...goal, target_amount: "9007199254740993.25" }
    const result = toGoalSummary(largeGoal, [
      entry("large", "progress", "9007199254740993.25"),
    ])
    expect(result?.fundedAmount).toBe("9007199254740993.25")
    expect(formatPortfolioAmount(result!.fundedAmount, "SAR", "en-US")).toBe(
      "SAR 9,007,199,254,740,993.25"
    )
  })
})
