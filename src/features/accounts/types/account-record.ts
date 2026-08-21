import type { Decimal } from "@/lib/supabase/types"

export type AccountRecord = {
  id: string
  occurredAt: string
  type: string
  description: string
  notes: string | null
  mainCategoryId: string | null
  subcategoryId: string | null
  amount: Decimal
  currencyCode: string
  localDate: string
  dailyNet: Decimal
}

export type EditableAccountRecord = {
  id: string
  values: AccountRecordFormValues
}

export type AccountRecordType = "expense" | "income" | "transfer"

export type AccountRecordHistoryFilters = {
  search: string
  fromDate: string
  toDate: string
  recordType: "" | AccountRecordType
  mainCategoryId: string
  subcategoryId: string
  minAmount: string
  maxAmount: string
}

export const emptyAccountRecordHistoryFilters: AccountRecordHistoryFilters = {
  search: "",
  fromDate: "",
  toDate: "",
  recordType: "",
  mainCategoryId: "",
  subcategoryId: "",
  minAmount: "",
  maxAmount: "",
}

export type AccountRecordFormValues = {
  type: AccountRecordType
  accountId: string
  toAccountId: string
  amount: Decimal
  receivedAmount: Decimal
  mainCategoryId: string
  subcategoryId: string
  occurredAt: string
  notes: string
}

export const emptyAccountRecordFormValues: AccountRecordFormValues = {
  type: "expense",
  accountId: "",
  toAccountId: "",
  amount: "",
  receivedAmount: "",
  mainCategoryId: "",
  subcategoryId: "",
  occurredAt: "",
  notes: "",
}
