import { describe, expect, it } from "vitest"
import type { AccountsWorkspaceSnapshot } from "@/features/accounts/types/account-workspace"
import { commitAccountRefresh, preserveAccountRefreshState } from "./account-refresh-state"

function snapshot(ids: string[]): AccountsWorkspaceSnapshot {
  return { items: ids.map((id) => ({ account: { id } } as AccountsWorkspaceSnapshot["items"][number])), accountTypes: [], currencies: [], accountCount: ids.length, activeCount: ids.length, archivedCount: 0, updatedAt: "2026-08-03", scope: "all", analysis: { overallScore: null, provisional: true, factors: [], issues: [], relationships: [] }, holdingsEvidence: [], assetsEvidence: [], activity: [], activityError: null, activeAccountScopeId: null, deletionEligibility: [] }
}

describe("account refresh state", () => {
  it("preserves the previous rendered snapshot throughout a pending refresh and on failure", () => { const current = { snapshot: snapshot(["old"]), selectedAccountId: "old" }; expect(preserveAccountRefreshState(current)).toBe(current) })
  it("commits the refreshed snapshot and newly created account selection together", () => { const current = { snapshot: snapshot(["old"]), selectedAccountId: "old" }; const committed = commitAccountRefresh(current, snapshot(["old", "new"]), "new"); expect(committed.snapshot.items.map((item) => item.account.id)).toEqual(["old", "new"]); expect(committed.selectedAccountId).toBe("new") })
  it("does not expose a preferred account missing from the authoritative snapshot", () => { const current = { snapshot: snapshot(["old"]), selectedAccountId: "old" }; expect(commitAccountRefresh(current, snapshot(["old"]), "new").selectedAccountId).toBeNull() })
})
