import type { AccountRecordFormValues } from "../types/account-record"

export function normalizeTransferValues(
  values: AccountRecordFormValues
): AccountRecordFormValues {
  if (
    values.type !== "transfer" ||
    !values.accountId ||
    values.accountId !== values.toAccountId
  )
    return values

  return { ...values, toAccountId: "" }
}
