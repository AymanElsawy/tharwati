import type { AccountSummary } from "@/lib/supabase/types"

export interface CashAccountFormValues {
  name: string
  currencyCode: string
  balance: string
  notes: string
}

export function cashAccountToFormValues(
  account: AccountSummary,
): CashAccountFormValues {
  return {
    name: account.name,
    currencyCode: account.currency_code,
    balance: account.opening_balance,
    notes: account.notes ?? "",
  }
}
