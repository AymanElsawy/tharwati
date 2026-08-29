import { describe, expect, it } from "vitest"
import type { GoalProgressEntryRow } from "@/lib/supabase/types"
import { buildGoalHistoryEntries, groupGoalHistoryEntries } from "./goals.service"

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
