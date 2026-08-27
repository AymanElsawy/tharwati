import { compareDecimals } from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"
import { getCreditCardAmountDue } from "../types/account-form"

export type BankCreditSummary = {
  creditLimit: Decimal
  availableCredit: Decimal
  amountDue: Decimal
  dueDayOfMonth: number | null
}

export function getBankCreditSummary(input: {
  creditCardLimit: Decimal | null
  currentBalance: Decimal | null
  dueDayOfMonth: number | null
}): BankCreditSummary | null {
  if (input.creditCardLimit === null || input.currentBalance === null) return null
  if (compareDecimals(input.creditCardLimit, "0") !== 1 || compareDecimals(input.currentBalance, "0") === -1) return null
  const amountDue = getCreditCardAmountDue(input.creditCardLimit, input.currentBalance)
  if (amountDue === null || compareDecimals(amountDue, "0") === -1) return null
  return {
    creditLimit: input.creditCardLimit,
    availableCredit: input.currentBalance,
    amountDue,
    dueDayOfMonth: input.dueDayOfMonth,
  }
}
