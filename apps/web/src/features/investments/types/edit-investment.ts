import type { Decimal, TableRow } from "@/lib/supabase/types"

export type EditInvestmentValues = {
  transactionId: string
  accountId: string
  accountName: string
  assetId: string
  assetName: string
  quantity: Decimal
  unitPrice: Decimal
  fees: Decimal
  occurredAt: string
  notes: string
}

export type EditInvestmentResult = {
  original_transaction: TableRow<"financial_transactions">
  reversal_transaction: TableRow<"financial_transactions">
  replacement: {
    transaction: TableRow<"financial_transactions">
    entries: TableRow<"transaction_entries">[]
    holding: TableRow<"holdings">
  }
}
