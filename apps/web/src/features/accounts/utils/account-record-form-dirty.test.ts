import { describe, expect, it } from "vitest"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import { isAccountRecordFormDirty } from "./account-record-form-dirty"

const expense = {
  type: "expense" as const,
  accountId: "account",
  toAccountId: "",
  amount: "100.0000000000",
  receivedAmount: "",
  mainCategoryId: "food",
  subcategoryId: "cafe",
  occurredAt: "2026-09-19T10:30:00.000Z",
  notes: "Lunch",
}

describe("isAccountRecordFormDirty", () => {
  it("keeps an unchanged formatted Expense eligible for Refund", () => {
    expect(isAccountRecordFormDirty({ ...expense, amount: "100", occurredAt: formatLocalDateTimeInput(new Date(expense.occurredAt)) }, expense)).toBe(false)
  })

  it("blocks Refund after an actual unsaved edit", () => {
    expect(isAccountRecordFormDirty({ ...expense, amount: "100.01" }, expense)).toBe(true)
  })
})
