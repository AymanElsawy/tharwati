import type { AccountsWorkspaceSnapshot } from "@/features/accounts/types/account-workspace"

export interface AccountRefreshViewState {
  snapshot: AccountsWorkspaceSnapshot
  selectedAccountId: string | null
}

export function preserveAccountRefreshState(state: AccountRefreshViewState): AccountRefreshViewState {
  return state
}

export function commitAccountRefresh(state: AccountRefreshViewState, snapshot: AccountsWorkspaceSnapshot, preferredSelectedAccountId?: string | null): AccountRefreshViewState {
  const candidate = preferredSelectedAccountId === undefined ? state.selectedAccountId : preferredSelectedAccountId
  return { snapshot, selectedAccountId: candidate && snapshot.items.some((item) => item.account.id === candidate) ? candidate : null }
}
