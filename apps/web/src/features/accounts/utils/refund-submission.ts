import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"

export type SubmissionAttempt = { fingerprint: string; idempotencyKey: string }

export function refundSubmissionFingerprint(input: {
  expenseTransactionId: string
  amount: string
  destinationAccountId: string
  occurredAt: string
  notes: string
}) {
  return JSON.stringify([
    input.expenseTransactionId,
    normalizeDecimal(input.amount),
    input.destinationAccountId,
    localDateTimeInputToIso(input.occurredAt),
    input.notes.trim() || null,
  ])
}

export function resolveSubmissionAttempt(
  current: SubmissionAttempt | null,
  fingerprint: string,
  generateKey: () => string = () => crypto.randomUUID()
): SubmissionAttempt {
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, idempotencyKey: generateKey() }
}
