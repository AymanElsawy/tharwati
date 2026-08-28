import type { AccountSummary } from "@/lib/supabase/types"

/** A sale is a financial lifecycle state, distinct from a manually archived account. */
export function isSoldAccount(account: Pick<AccountSummary, "closed_reason">): boolean {
  return account.closed_reason === "sold"
}

export function partitionSoldAccounts<T extends { account: Pick<AccountSummary, "closed_reason"> }>(items: readonly T[]) {
  return {
    activeItems: items.filter((item) => !isSoldAccount(item.account)),
    soldItems: items.filter((item) => isSoldAccount(item.account)),
  }
}
