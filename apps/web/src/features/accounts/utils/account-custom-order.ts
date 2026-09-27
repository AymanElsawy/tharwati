import { RepositoryError, type AccountSummary } from "@/lib/supabase/types"
import { isSoldAccount } from "./account-lifecycle"

export const defaultAccountSort = "custom" as const
export type AccountSort = "custom" | "name" | "type" | "balance"

export function hasCompleteAccountOrder(accounts: readonly Pick<AccountSummary, "id">[], order: readonly string[]): boolean {
  const ids = new Set(accounts.map((account) => account.id))
  return ids.size === accounts.length && order.length === ids.size &&
    new Set(order).size === order.length && order.every((id) => ids.has(id))
}

export function isAccountSubsetFiltered(filters: {
  search: string
  type: string | null
  currency: string | null
}, metalFilter: string | null): boolean {
  return !!(filters.search.trim() || filters.type || filters.currency || metalFilter)
}

export function accountSection(account: Pick<AccountSummary, "is_active" | "closed_reason">): "active" | "closed" | "sold" {
  if (isSoldAccount(account)) return "sold"
  return account.is_active ? "active" : "closed"
}

/** Replace only this section's slots in the full canonical array. */
export function moveAccountWithinSection(
  canonicalIds: readonly string[],
  sectionIds: readonly string[],
  sourceId: string,
  targetId: string
): string[] | null {
  if (sourceId === targetId) return null
  const slots = new Set(sectionIds)
  if (slots.size !== sectionIds.length || !slots.has(sourceId) || !slots.has(targetId)) return null
  if (canonicalIds.filter((id) => slots.has(id)).length !== sectionIds.length) return null
  const nextSection = canonicalIds.filter((id) => slots.has(id))
  const sourceIndex = nextSection.indexOf(sourceId)
  const targetIndex = nextSection.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0) return null
  nextSection.splice(sourceIndex, 1)
  nextSection.splice(targetIndex, 0, sourceId)
  let index = 0
  return canonicalIds.map((id) => slots.has(id) ? nextSection[index++] : id)
}

export function sortAccountItems<T extends {
  account: Pick<AccountSummary, "id" | "name" | "account_type_code">
  currentBalance: string | null
  metalCurrentValue: string | null
}>(items: readonly T[], sort: AccountSort, direction: "asc" | "desc", canonicalIds: readonly string[]): T[] {
  if (sort === "custom") {
    const positions = new Map(canonicalIds.map((id, index) => [id, index]))
    return [...items].sort((a, b) => (positions.get(a.account.id) ?? Number.MAX_SAFE_INTEGER) -
      (positions.get(b.account.id) ?? Number.MAX_SAFE_INTEGER))
  }
  return [...items].sort((a, b) => {
    if (sort === "balance") {
      const left = Number(a.currentBalance ?? a.metalCurrentValue ?? 0)
      const right = Number(b.currentBalance ?? b.metalCurrentValue ?? 0)
      return direction === "asc" ? left - right : right - left
    }
    const left = sort === "name" ? a.account.name : a.account.account_type_code
    const right = sort === "name" ? b.account.name : b.account.account_type_code
    const result = left.localeCompare(right)
    return direction === "asc" ? result : -result
  })
}

export async function saveAccountSectionOrder(options: {
  accounts: readonly Pick<AccountSummary, "id" | "is_active" | "closed_reason">[]
  canonicalIds: readonly string[]
  sourceId: string
  targetId: string
  reorder: (expectedIds: string[], orderedIds: string[]) => Promise<string[]>
  refresh: () => Promise<boolean>
}): Promise<"saved" | "ignored" | "conflict" | "failure" | "refreshFailure"> {
  const { accounts, canonicalIds, sourceId, targetId, reorder, refresh } = options
  if (!hasCompleteAccountOrder(accounts, canonicalIds)) return "ignored"
  const source = accounts.find((account) => account.id === sourceId)
  const target = accounts.find((account) => account.id === targetId)
  if (!source || !target || accountSection(source) !== accountSection(target)) return "ignored"
  const sectionIds = accounts.filter((account) => accountSection(account) === accountSection(source)).map((account) => account.id)
  const expectedIds = [...canonicalIds]
  const orderedIds = moveAccountWithinSection(expectedIds, sectionIds, sourceId, targetId)
  if (!orderedIds) return "ignored"
  try {
    await reorder(expectedIds, orderedIds)
    return "saved"
  } catch (error) {
    if (!await refresh()) return "refreshFailure"
    return error instanceof RepositoryError && error.code === "conflict" ? "conflict" : "failure"
  }
}
