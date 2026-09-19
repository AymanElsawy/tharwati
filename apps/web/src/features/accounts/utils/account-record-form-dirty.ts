import { normalizeDecimal } from "@/lib/financial-calculations/decimal"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import type { AccountRecordFormValues } from "../types/account-record"

function canonicalDecimal(value: string | undefined) {
  return normalizeDecimal(value ?? "") ?? (value ?? "").trim()
}

function canonicalLocalDateTime(value: string | undefined) {
  const source = value ?? ""
  const date = new Date(source)
  return Number.isNaN(date.getTime()) ? source.trim() : formatLocalDateTimeInput(date)
}

/** Compares persisted and displayed form values without decimal/date formatting noise. */
export function isAccountRecordFormDirty(
  current: Partial<AccountRecordFormValues>,
  initial: AccountRecordFormValues
) {
  return current.type !== initial.type ||
    current.accountId !== initial.accountId ||
    current.toAccountId !== initial.toAccountId ||
    canonicalDecimal(current.amount) !== canonicalDecimal(initial.amount) ||
    canonicalDecimal(current.receivedAmount) !== canonicalDecimal(initial.receivedAmount) ||
    current.mainCategoryId !== initial.mainCategoryId ||
    current.subcategoryId !== initial.subcategoryId ||
    canonicalLocalDateTime(current.occurredAt) !== canonicalLocalDateTime(initial.occurredAt) ||
    current.notes !== initial.notes
}
