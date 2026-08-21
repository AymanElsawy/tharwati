import {
  accountRecordsRepository,
  type AccountRecordHistoryCursor,
  type AccountRecordHistoryRow,
  type AccountRecordRow,
} from "../repositories/account-records.repository"
import type { AccountRecord } from "../types/account-record"
import type { AccountRecordFormValues, EditableAccountRecord } from "../types/account-record"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { divideDecimals, multiplyDecimals, normalizeDecimal } from "@/lib/financial-calculations/decimal"
import { exchangeRateService } from "@/services/exchange-rates"
import { formatLocalDateTimeInput } from "@/lib/formatting/local-date-time"
import type { VisibleRecordMainCategory } from "../types/record-category"

export function mapAccountRecordHistoryRows(rows: readonly AccountRecordHistoryRow[]): AccountRecord[] {
  return rows.flatMap((row) => {
    if (!row.account_amount) return []
    return [
      {
        id: row.id,
        occurredAt: row.occurred_at,
        type: row.transaction_type_code,
        description: row.description,
        notes: row.notes,
        mainCategoryId: row.main_category_id,
        subcategoryId: row.subcategory_id,
        amount: row.entry_side === "credit" ? `-${row.account_amount}` : row.account_amount,
        currencyCode: row.currency_code,
        localDate: row.local_date,
        dailyNet: row.daily_net,
      },
    ]
  })
}

export type AccountRecordHistoryPage = {
  records: AccountRecord[]
  nextCursor: AccountRecordHistoryCursor | null
  hasMore: boolean
}

export function mapAccountRecordHistoryPage(
  rows: readonly AccountRecordHistoryRow[],
  pageSize: number
): AccountRecordHistoryPage {
  const last = rows.at(-1)
  return {
    records: mapAccountRecordHistoryRows(rows),
    nextCursor: last ? { occurredAt: last.occurred_at, id: last.id } : null,
    hasMore: rows.length === pageSize,
  }
}

export function mapEditableAccountRecord(row: AccountRecordRow): EditableAccountRecord {
  const entryFor = (side: "debit" | "credit") => row.account_entries.find(
    (entry) => entry.entry_side === side && entry.account_id
  )
  const occurredAt = formatLocalDateTimeInput(new Date(row.occurred_at))

  if (row.transaction_type_code === "income" || row.transaction_type_code === "expense") {
    const accountEntry = entryFor(row.transaction_type_code === "income" ? "debit" : "credit")
    if (!accountEntry?.account_id || !accountEntry.account_amount) throw new Error("Account record cannot be edited")
    return {
      id: row.id,
      values: {
        type: row.transaction_type_code,
        accountId: accountEntry.account_id,
        toAccountId: "",
        amount: normalizeDecimal(accountEntry.account_amount) ?? accountEntry.account_amount,
        receivedAmount: "",
        mainCategoryId: row.main_category_id ?? "",
        subcategoryId: row.subcategory_id ?? "",
        occurredAt,
        notes: row.notes ?? "",
      },
    }
  }

  const source = entryFor("credit")
  const destination = entryFor("debit")
  if (row.transaction_type_code !== "transfer" || !source?.account_id || !destination?.account_id) {
    throw new Error("Account record cannot be edited")
  }
  return {
    id: row.id,
    values: {
      type: "transfer",
      accountId: source.account_id,
      toAccountId: destination.account_id,
      amount: normalizeDecimal(source.account_amount) ?? source.account_amount,
      receivedAmount: normalizeDecimal(destination.account_amount) ?? destination.account_amount,
      mainCategoryId: "",
      subcategoryId: "",
      occurredAt,
      notes: row.notes ?? "",
    },
  }
}

export type AccountRecordDateGroup = {
  date: string
  dailyNet: Decimal
  currencyCode: string
  records: AccountRecord[]
}

/** Groups newest-first records by the caller-supplied local calendar date and complete server total. */
export function groupAccountRecordsByLocalDate(
  records: readonly AccountRecord[]
): AccountRecordDateGroup[] {
  const groups = new Map<string, AccountRecordDateGroup>()
  for (const record of records) {
    const date = record.localDate
    const existing = groups.get(date)
    if (existing) {
      existing.records.push(record)
    } else {
      groups.set(date, { date, dailyNet: record.dailyNet, currencyCode: record.currencyCode, records: [record] })
    }
  }
  return [...groups.values()]
}

export function getAccountRecordCategoryLabel(
  record: AccountRecord,
  categories: readonly VisibleRecordMainCategory[]
) {
  if (record.type === "transfer") return null
  for (const main of categories) {
    const subcategory = main.subcategories.find((item) => item.id === record.subcategoryId)
    if (subcategory) return subcategory.name
  }
  return record.description.replace(/^(Income|Expense):\s*/i, "") || record.type
}

export async function getAccountRecordHistoryPage(
  accountId: string,
  cursor: AccountRecordHistoryCursor | null,
  pageSize = 50,
  timeZone = "UTC"
): Promise<AccountRecordHistoryPage> {
  return mapAccountRecordHistoryPage(
    await accountRecordsRepository.getAccountRecordHistory(accountId, cursor, pageSize, timeZone),
    pageSize
  )
}

export async function getEditableAccountRecord(recordId: string) {
  return mapEditableAccountRecord(await accountRecordsRepository.getAccountRecordDetail(recordId))
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

export async function correctAccountRecord(recordId: string, values: AccountRecordFormValues) {
  await accountRecordsRepository.correctAccountRecord(recordId, values)
}

export async function reverseAccountRecord(recordId: string) {
  await accountRecordsRepository.reverseAccountRecord(recordId)
}

export async function getAccountRecordBalances(accountIds: string[]) {
  const rows = await accountRecordsRepository.getAccountBalances(accountIds)
  return new Map(rows.map((row) => [row.account_id, row.current_balance] as const))
}
