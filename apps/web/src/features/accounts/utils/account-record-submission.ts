import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import type { AccountRecordFormValues } from "../types/account-record"

export function accountRecordSubmissionFingerprint(
  values: AccountRecordFormValues
) {
  const isTransfer = values.type === "transfer"
  return JSON.stringify([
    values.type,
    values.accountId,
    isTransfer ? values.toAccountId : null,
    normalizeDecimal(values.amount),
    isTransfer ? normalizeDecimal(values.receivedAmount) : null,
    localDateTimeInputToIso(values.occurredAt),
    isTransfer ? null : values.mainCategoryId,
    isTransfer ? null : values.subcategoryId,
    values.notes.trim() || null,
  ])
}
