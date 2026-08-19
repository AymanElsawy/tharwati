import {
  accountRecordsRepository,
  type AccountRecordRow,
} from "../repositories/account-records.repository"
import type { AccountRecord } from "../types/account-record"

export function mapAccountRecordRows(
  rows: readonly AccountRecordRow[]
): AccountRecord[] {
  return rows.flatMap((row) => {
    const entry = row.account_entries[0]
    if (!entry?.transaction_amount) return []
    return [
      {
        id: row.id,
        occurredAt: row.occurred_at,
        type: row.transaction_type_code,
        description: row.description,
        amount: entry.transaction_amount,
        currencyCode: row.transaction_currency_code,
      },
    ]
  })
}

export async function getAccountRecords(
  accountId: string
): Promise<AccountRecord[]> {
  return mapAccountRecordRows(
    await accountRecordsRepository.getAccountRecordRows(accountId)
  )
}
