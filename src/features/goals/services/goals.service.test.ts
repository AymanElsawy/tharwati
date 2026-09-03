import { afterEach, describe, expect, it, vi } from "vitest"
import type { GoalProgressEntryRow, GoalRow } from "@/lib/supabase/types"
import { goalsRepository } from "../repositories/goals.repository"
import {
  buildGoalHistoryEntries,
  groupGoalHistoryEntries,
  listActiveGoalSummaries,
} from "./goals.service"

const row = (
  id: string,
  type: GoalProgressEntryRow["entry_type"],
  links: Partial<GoalProgressEntryRow> = {}
): GoalProgressEntryRow => ({
  id,
  goal_id: "goal",
  user_id: "user",
  entry_type: type,
  amount: "10",
  effective_on: "2026-08-01",
  note: null,
  reverses_entry_id: null,
  replacement_for_entry_id: null,
  created_at: id,
  ...links,
})

describe("Goals history read model", () => {
  it("reconstructs original, reversal, and replacement links", () => {
    const entries = buildGoalHistoryEntries([
      row("original", "progress"),
      row("reversal", "reversal", { reverses_entry_id: "original" }),
      row("replacement", "progress", { replacement_for_entry_id: "original" }),
    ]).get("goal")!
    expect(entries.find((entry) => entry.id === "original")).toMatchObject({
      reversedByEntryId: "reversal",
      replacementEntryId: "replacement",
    })
    expect(
      entries.find((entry) => entry.id === "replacement")
        ?.replacement_for_entry_id
    ).toBe("original")
  })
  it("preserves a replacement correction chain", () => {
    const entries = buildGoalHistoryEntries([
      row("first", "withdrawal"),
      row("second", "withdrawal", { replacement_for_entry_id: "first" }),
      row("second-reversal", "reversal", { reverses_entry_id: "second" }),
      row("third", "withdrawal", { replacement_for_entry_id: "second" }),
    ]).get("goal")!
    expect(entries.find((entry) => entry.id === "second")).toMatchObject({
      reversedByEntryId: "second-reversal",
      replacementEntryId: "third",
      replacement_for_entry_id: "first",
    })
  })
  it("groups a correction chain beneath its original entry", () => {
    const entries = buildGoalHistoryEntries([
      row("original", "progress"),
      row("reversal", "reversal", { reverses_entry_id: "original" }),
      row("replacement", "progress", { replacement_for_entry_id: "original" }),
      row("replacement-reversal", "reversal", { reverses_entry_id: "replacement" }),
      row("replacement-2", "progress", { replacement_for_entry_id: "replacement" }),
    ]).get("goal")!
    expect(groupGoalHistoryEntries(entries)).toEqual([
      expect.objectContaining({
        root: expect.objectContaining({ id: "original" }),
        related: expect.arrayContaining([
          expect.objectContaining({ id: "reversal" }),
          expect.objectContaining({ id: "replacement" }),
          expect.objectContaining({ id: "replacement-reversal" }),
          expect.objectContaining({ id: "replacement-2" }),
        ]),
      }),
    ])
  })
})

const goal = (overrides: Partial<GoalRow> = {}): GoalRow => ({
  id: "goal",
  user_id: "user",
  name: "Home",
  goal_type: "buy_home",
  custom_type_name: null,
  target_amount: "100",
  currency_code: "EGP",
  target_date: "2027-01-01",
  status: "active",
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
})

describe("Dashboard Goals read model", () => {
  afterEach(() => vi.restoreAllMocks())

  it("returns exact zero and uncapped over-target progress", async () => {
    vi.spyOn(goalsRepository, "listActiveSummaries")
      .mockResolvedValueOnce({ goals: [goal()], entries: [], hasAnyGoals: true })
      .mockResolvedValueOnce({
        goals: [goal()],
        entries: [row("progress", "progress", { amount: "125" })],
        hasAnyGoals: true,
      })

    await expect(listActiveGoalSummaries()).resolves.toMatchObject({
      goals: [{ fundedAmount: "0", progressPercent: "0" }],
    })
    await expect(listActiveGoalSummaries()).resolves.toMatchObject({
      goals: [{
        fundedAmount: "125",
        progressPercent: "125",
        displayPercent: "100",
        surplusAmount: "25",
      }],
    })
  })

  it("fails honestly when stored goal money is invalid", async () => {
    vi.spyOn(goalsRepository, "listActiveSummaries").mockResolvedValue({
      goals: [goal({ target_amount: "invalid" })],
      entries: [],
      hasAnyGoals: true,
    })
    await expect(listActiveGoalSummaries()).rejects.toThrow(
      "Goal progress is unavailable"
    )
  })
})
