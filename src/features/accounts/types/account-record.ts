import type { Decimal } from "@/lib/supabase/types"

export type AccountRecord = {
  id: string
  occurredAt: string
  type: string
  description: string
  amount: Decimal
  currencyCode: string
}

export type AccountRecordType = "expense" | "income" | "transfer"

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
