import { describe, expect, it, vi } from "vitest"

import { AccountsWorkspaceService } from "./accounts-workspace.service"
import type { AccountSummary } from "@/lib/supabase/types"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import type { DashboardPostedTransaction } from "@/features/dashboard/repositories/dashboard.repository"
import { emptyAccountFormValues } from "@/features/accounts/types/account-form"

function account(id: string, currency: string, type = "brokerage", active = true): AccountSummary {
  return { id, user_id: "user-a", account_type_code: type, name: id, currency_code: currency, opening_balance: "100", notes: null, is_active: active, created_at: "2026-01-01", updated_at: "2026-01-01" }
}

describe("AccountsWorkspaceService", () => {
  it("maps authoritative projected balances without aggregating currencies", async () => {
    const accounts = [account("a", "USD"), account("b", "SAR", "real_estate")]
    const service = new AccountsWorkspaceService(
      { getAccounts: async () => accounts },
      { getAccountBalances: async () => accounts.map((item) => ({ accountId: item.id, accountTypeCode: item.account_type_code, accountName: item.name, currencyCode: item.currency_code, isActive: item.is_active, openingBalance: "100", ledgerEffect: item.id === "a" ? "-20.1" : "0", currentBalance: item.id === "a" ? "79.9" : "100" })) },
      { getHoldings: async () => [] },
      { getRecentPostedTransactions: async () => [] },
      { getAccountDeletionEligibility: async () => accounts.map((item) => ({ accountId: item.id, canDelete: true, hasFinancialHistory: false })) },
    )
    const result = await service.load("all")
    expect(result.items.map((item) => [item.account.currency_code, item.currentBalance, item.projectedCash])).toEqual([["USD", "79.9", "79.9"], ["SAR", "100", null]])
    expect(result.currencies).toEqual(["SAR", "USD"])
  })

  it("scores only available factors and exposes authoritative evidence", async () => {
    const rows = [account("a", "USD"), account("b", "SAR", "bank", false)]
    const service = new AccountsWorkspaceService(
      { getAccounts: async () => rows },
      { getAccountBalances: async () => [{ accountId: "a", accountTypeCode: "brokerage", accountName: "a", currencyCode: "USD", isActive: true, openingBalance: "100", ledgerEffect: "0", currentBalance: "100" }] },
      { getHoldings: async () => [] },
      { getRecentPostedTransactions: async () => [] },
      { getAccountDeletionEligibility: async () => [{ accountId: "a", canDelete: true, hasFinancialHistory: false }, { accountId: "b", canDelete: false, hasFinancialHistory: true }] },
    )
    const result = await service.load("all")
    expect(result.analysis.factors.find((item) => item.id === "reconciliation_readiness")?.score).toBeNull()
    expect(result.analysis.overallScore).toBe(50)
    expect(result.analysis.issues.map((item) => item.id)).toEqual(["missing_balance", "unsupported_reconciliation", "archived_dependency"])
    expect(result.analysis.issues.find((item) => item.id === "archived_dependency")?.evidenceIds).toEqual(["account-history:b"])
    expect(result.analysis.relationships.find((item) => item.id === "linked_goals")?.availability).toBe("unavailable")
  })

  it("intersects synchronized analytical filters without changing workspace filters", async () => {
    const service = new AccountsWorkspaceService()
    const items = [account("a", "USD"), account("b", "USD")].map((row) => ({ account: row, currentBalance: "1", projectedCash: "1", balanceAuthoritative: true, linkedHoldingsCount: 0, lastActivityAt: null, ownership: "user_owned" as const }))
    const analysis = { overallScore: 50, provisional: false, factors: [{ id: "balance_availability" as const, availability: "available" as const, score: 50, numerator: 1, denominator: 2, affectedAccountIds: ["b"], explanation: "" }], issues: [{ id: "missing_balance" as const, count: 1, affectedAccountIds: ["b"], evidenceIds: ["b"] }], relationships: [{ id: "account_type:brokerage", kind: "account_type" as const, label: "brokerage", count: 2, accountIds: ["a", "b"], evidenceIds: ["a", "b"], availability: "available" as const }] }
    expect(service.filterByAnalysis(items, "balance_availability", "missing_balance", "account_type:brokerage", analysis).map((item) => item.account.id)).toEqual(["b"])
  })

  it("maps explicit holding, asset, and posted activity evidence without changing decimal strings", async () => {
    const rows = [account("a", "SAR")]
    const holding = { id: "holding-a", account_id: "a", asset_id: "asset-a", quantity: "9007199254740993.0000000001", average_cost: "10.25", total_cost_basis: "9223372036854775808.25", cost_currency_code: "SAR", asset: { id: "asset-a", name: "Asset A", symbol: "AAA", asset_type_code: "stock", currency_code: "USD", canonical_quantity_unit: "shares" }, account: { id: "a", name: "a", currency_code: "SAR" } } as unknown as HoldingDetails
    const posted = { id: "transaction-a", status: "posted", transaction_type_code: "buy", transaction_currency_code: "USD", description: "Buy Asset A", occurred_at: "2026-02-01T00:00:00Z", posted_at: "2026-02-01T00:01:00Z", transaction_entries: [{ id: "entry-a", account_id: "a", asset_id: "asset-a", entry_side: "credit", transaction_amount: "9007199254740993.01", account_amount: "33776997205278723.7875", quantity_delta: "1", memo: null }] } as unknown as DashboardPostedTransaction
    const draft = { ...posted, id: "draft-a", status: "draft" } as unknown as DashboardPostedTransaction
    const unrelated = { ...posted, id: "transaction-b", transaction_entries: [{ ...posted.transaction_entries[0], id: "entry-b", account_id: "other" }] } as unknown as DashboardPostedTransaction
    const service = new AccountsWorkspaceService({ getAccounts: async () => rows }, { getAccountBalances: async () => [] }, { getHoldings: async () => [holding] }, { getRecentPostedTransactions: async () => [posted, draft, unrelated] }, { getAccountDeletionEligibility: async () => [{ accountId: "a", canDelete: false, hasFinancialHistory: true }] })
    const result = await service.load("all")
    expect(result.holdingsEvidence[0].quantity).toBe("9007199254740993.0000000001")
    expect(result.holdingsEvidence[0].totalCostBasis).toBe("9223372036854775808.25")
    expect(result.assetsEvidence[0].assetId).toBe("asset-a")
    expect(result.activity).toHaveLength(1)
    expect(result.activity[0].originalCurrency).toBe("USD")
    expect(result.activity[0].entries[0].accountAmount).toBe("33776997205278723.7875")
    expect(service.getAccountDetail(result, "a")?.investmentMarketValue).toBeNull()
  })

  it("applies a true account scope to the coordinated snapshot", async () => {
    const rows = [account("a", "USD"), account("b", "SAR")]
    const service = new AccountsWorkspaceService({ getAccounts: async () => rows }, { getAccountBalances: async () => [] }, { getHoldings: async () => [] }, { getRecentPostedTransactions: async () => [] }, { getAccountDeletionEligibility: async () => [] })
    const result = await service.load("all", "b")
    expect(result.activeAccountScopeId).toBe("b")
    expect(result.items.map((item) => item.account.id)).toEqual(["b"])
    expect(result.analysis.issues.find((item) => item.id === "missing_balance")?.affectedAccountIds).toEqual(["b"])
  })

  it("delegates exact account workflow values without financial calculations", async () => {
    const created = account("created", "USD", "cash")
    const createAccount = vi.fn().mockResolvedValue(created)
    const updateAccount = vi.fn().mockResolvedValue({ ...created, name: "Custom" })
    const archiveAccount = vi.fn().mockResolvedValue({ ...created, is_active: false })
    const deleteAccount = vi.fn().mockResolvedValue(undefined)
    const service = new AccountsWorkspaceService({ getAccounts: async () => [], createAccount, updateAccount, archiveAccount, deleteAccount }, { getAccountBalances: async () => [] }, { getHoldings: async () => [] }, { getRecentPostedTransactions: async () => [] }, { getAccountDeletionEligibility: async () => [] })
    await service.createAccount({ ...emptyAccountFormValues, openingBalance: "9007199254740993.01" })
    expect(createAccount).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: "9007199254740993.01", currencyCode: "USD" }))
    await service.updateAccount("created", { ...emptyAccountFormValues, name: " Custom ", notes: " note " })
    expect(updateAccount).toHaveBeenCalledWith("created", expect.objectContaining({ name: "Custom", notes: "note", openingBalance: "0" }))
    await service.archiveAccount("created"); await service.deleteAccount("created")
    expect(archiveAccount).toHaveBeenCalledWith("created"); expect(deleteAccount).toHaveBeenCalledWith("created")
  })

  it("filters locally and sorts exact decimal balances", () => {
    const service = new AccountsWorkspaceService()
    const items = [account("a", "USD"), account("b", "USD")].map((row, index) => ({ account: row, currentBalance: index ? "9007199254740993.0001" : "9007199254740993", projectedCash: null, balanceAuthoritative: true, linkedHoldingsCount: 0, lastActivityAt: null, ownership: "user_owned" as const }))
    const result = service.filterAndSort(items, null, { search: "", currency: "USD", lifecycle: "active", sort: "balance", direction: "asc" })
    expect(result.map((item) => item.account.id)).toEqual(["a", "b"])
  })
})
