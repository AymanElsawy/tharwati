import {
  accountRecordsRepository,
  type AccountRecordRow,
} from "../repositories/account-records.repository"
import type { AccountRecord } from "../types/account-record"
import type { AccountRecordFormValues } from "../types/account-record"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { divideDecimals, multiplyDecimals } from "@/lib/financial-calculations/decimal"
import { exchangeRateService } from "@/services/exchange-rates"

export function mapAccountRecordRows(
  rows: readonly AccountRecordRow[]
): AccountRecord[] {
  return rows.flatMap((row) => {
    const entry = row.account_entries[0]
    if (!entry?.account_amount) return []
    return [
      {
        id: row.id,
        occurredAt: row.occurred_at,
        type: row.transaction_type_code,
        description: row.description,
        amount: entry.entry_side === "credit"
          ? `-${entry.account_amount}`
          : entry.account_amount,
        currencyCode: entry.account?.currency_code ?? row.transaction_currency_code,
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

export function getRecordAccounts(accounts: readonly AccountSummary[]) {
  return accounts.filter((account) => account.is_active && (
    account.account_type_code === "cash" || account.account_type_code === "bank"
  ))
}

export async function estimateTransferReceived(
  amount: Decimal,
  from: AccountSummary,
  to: AccountSummary
): Promise<Decimal> {
  if (from.currency_code === to.currency_code) return amount
  const resolved = await exchangeRateService.resolveCurrentRate({
    sourceCurrencyCode: from.currency_code,
    destinationCurrencyCode: to.currency_code,
  })
  const converted = multiplyDecimals(amount, resolved.rate)
  if (converted === null) throw new Error("Invalid transfer amount or exchange rate")
  return divideDecimals(converted, "1", 2) ?? converted
}

export async function addAccountRecord(values: AccountRecordFormValues) {
  await accountRecordsRepository.addAccountRecord(values)
}

export async function getAccountRecordBalances(accountIds: string[]) {
  const rows = await accountRecordsRepository.getAccountBalances(accountIds)
  return new Map(rows.map((row) => [row.account_id, row.current_balance] as const))
}
