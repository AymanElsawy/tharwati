import { describe, expect, it } from "vitest"

import {
  refundSubmissionFingerprint,
  resolveSubmissionAttempt,
} from "./refund-submission"

describe("refund submission attempts", () => {
  it("reuses a key for the same normalized payload and rotates it when changed", () => {
    const input = {
      expenseTransactionId: "expense",
      amount: "40.00",
      destinationAccountId: "cash",
      occurredAt: "2026-09-22T10:30",
      notes: " note ",
    }
    const first = resolveSubmissionAttempt(
      null,
      refundSubmissionFingerprint(input),
      () => "key-1"
    )
    const unchanged = resolveSubmissionAttempt(
      first,
      refundSubmissionFingerprint({ ...input, amount: "40.0", notes: "note" }),
      () => "key-2"
    )
    const changed = resolveSubmissionAttempt(
      unchanged,
      refundSubmissionFingerprint({ ...input, amount: "41" }),
      () => "key-2"
    )

    expect(unchanged).toBe(first)
    expect(changed.idempotencyKey).toBe("key-2")
  })
})
