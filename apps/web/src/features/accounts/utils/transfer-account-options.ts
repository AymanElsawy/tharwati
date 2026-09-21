import type { AccountSummary } from "@/lib/supabase/types"

/**
 * Record-account eligibility is established by the caller. Transfers only add
 * the reciprocal constraint that an account cannot be both sides of a record.
 */
export function transferAccountOptions(
  accounts: AccountSummary[],
  oppositeAccountId: string
): AccountSummary[] {
  return accounts.filter((account) => account.id !== oppositeAccountId)
}
