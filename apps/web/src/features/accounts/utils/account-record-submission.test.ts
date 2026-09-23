import { describe, expect, it } from "vitest"

import type { AccountRecordFormValues } from "../types/account-record"
import { resolveSubmissionAttempt } from "./refund-submission"
import { accountRecordSubmissionFingerprint } from "./account-record-submission"

const values: AccountRecordFormValues = {
  type: "income",
  accountId: "account",
  toAccountId: "",
  amount: "10.00",
  receivedAmount: "",
  mainCategoryId: "main",
  subcategoryId: "sub",
  occurredAt: "2026-09-23T10:30",
  notes: " note ",
}

describe("account record submission attempts", () => {
  it("reuses a key for the same normalized payload and rotates it when changed", () => {
    const first = resolveSubmissionAttempt(
      null,
      accountRecordSubmissionFingerprint(values),
      () => "key-1"
    )
    const unchanged = resolveSubmissionAttempt(
      first,
      accountRecordSubmissionFingerprint({
        ...values,
        amount: "10.0",
        notes: "note",
      }),
      () => "unexpected"
    )
    const changed = resolveSubmissionAttempt(
      unchanged,
      accountRecordSubmissionFingerprint({ ...values, amount: "11" }),
      () => "key-2"
    )

    expect(unchanged.idempotencyKey).toBe("key-1")
    expect(changed.idempotencyKey).toBe("key-2")
  })

  it("ignores fields that are not submitted for non-transfer records", () => {
    expect(
      accountRecordSubmissionFingerprint({
        ...values,
        toAccountId: "ignored",
        receivedAmount: "999",
      })
    ).toBe(accountRecordSubmissionFingerprint(values))
  })
})
