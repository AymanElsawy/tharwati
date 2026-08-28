import type { AccountCurrentValueStatus } from "../services/account-values.service"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

export type AccountListCurrentValue = {
  value: Decimal | null
  isLoading: boolean
  status: AccountCurrentValueStatus
}

const asynchronouslyValuedAccountTypes = new Set([
  "cash",
  "bank",
  "brokerage",
  "gold",
  "real_estate",
  "business",
])

/** Keeps stored-value accounts immediate while never presenting stored balances as live values. */
export function resolveAccountListCurrentValue({
  account,
  values,
  statuses,
  isLoading,
  hasResolutionError,
}: {
  account: AccountSummary
  values: ReadonlyMap<string, Decimal | null>
  statuses: ReadonlyMap<string, AccountCurrentValueStatus>
  isLoading: boolean
  hasResolutionError: boolean
}): AccountListCurrentValue {
  if (!asynchronouslyValuedAccountTypes.has(account.account_type_code)) {
    return { value: account.opening_balance, isLoading: false, status: "complete" }
  }

  if (isLoading || (!hasResolutionError && !values.has(account.id))) {
    return { value: null, isLoading: true, status: "complete" }
  }

  const value = values.get(account.id)
  const status = statuses.get(account.id) ?? "complete"
  if (hasResolutionError || value === undefined || value === null) {
    return { value: null, isLoading: false, status: "incomplete" }
  }

  return { value, isLoading: false, status }
}
