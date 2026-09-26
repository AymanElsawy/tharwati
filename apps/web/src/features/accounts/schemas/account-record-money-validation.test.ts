import { describe, expect, it } from "vitest"
import type { Translate } from "@/i18n/context"
import { visibleMoneyInputError } from "@/lib/formatting/money-input"
import { emptyAccountRecordFormValues } from "../types/account-record"
import { createAccountRecordSchema } from "./account-record.schema"

const schema = createAccountRecordSchema(((key: string) => key) as Translate)
const record = { ...emptyAccountRecordFormValues, type: "transfer" as const,
  accountId: "source", toAccountId: "destination",
  receivedAmount: "1000", occurredAt: "2026-09-26T12:00" }

function amountError(amount: string) {
  const result = schema.safeParse({ ...record, amount })
  return result.success ? undefined : result.error.issues.find((issue) => issue.path[0] === "amount")?.message
}

function issuesFor(amount: string, receivedAmount = "") {
  const result = schema.safeParse({ ...record, amount, receivedAmount })
  return result.success ? [] : result.error.issues.map((issue) => ({
    field: issue.path[0], message: issue.message,
  }))
}

describe("record money validation while editing", () => {
  it("shows a format error for invalid non-empty input", () => {
    expect(visibleMoneyInputError("1,00", amountError("1,00"), true))
      .toBe("accounts.records.validation.amount")
  })

  it("removes the stale format error when the input is cleared", () => {
    expect(visibleMoneyInputError("", amountError("1,00"), true)).toBeUndefined()
    expect(visibleMoneyInputError("", amountError(""), true)).toBeUndefined()
  })

  it("uses a required error for empty submit or blur", () => {
    expect(amountError("")).toBe("accounts.records.validation.amountRequired")
    expect(visibleMoneyInputError("", amountError(""), false))
      .toBe("accounts.records.validation.amountRequired")
  })

  it("clears the error as soon as the value becomes valid", () => {
    expect(amountError("1,00")).toBe("accounts.records.validation.amount")
    expect(amountError("1000")).toBeUndefined()
    expect(visibleMoneyInputError("1000", amountError("1000"), false)).toBeUndefined()
  })

  it("assigns an empty sent amount error only to Amount sent", () => {
    expect(issuesFor("")).toEqual([
      { field: "amount", message: "accounts.records.validation.amountRequired" },
    ])
  })

  it("assigns an invalid sent amount error only to Amount sent", () => {
    expect(issuesFor("1,00")).toEqual([
      { field: "amount", message: "accounts.records.validation.amount" },
    ])
  })

  it("validates a user-required received amount only after sent is valid", () => {
    expect(issuesFor("1000")).toEqual([
      { field: "receivedAmount", message: "accounts.records.validation.amountRequired" },
    ])
    expect(issuesFor("1000", "1,00")).toEqual([
      { field: "receivedAmount", message: "accounts.records.validation.amount" },
    ])
    expect(issuesFor("1000", "1250.00")).toEqual([])
  })

  it("clears dependent errors after invalid sent is corrected and FX fills received", () => {
    expect(issuesFor("1,00")).toHaveLength(1)
    expect(issuesFor("1000", "1250.00")).toEqual([])
  })
})
