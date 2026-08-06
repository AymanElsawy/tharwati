import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import type { AccountDeletionEligibility } from "@/features/accounts/repositories/accounts.repository"

export type AccountWorkspaceScope = "all" | "wealth_cash"
export type AccountLifecycleFilter = "all" | "active" | "archived"
export type AccountInventorySort = "name" | "type" | "currency" | "balance" | "status" | "activity"
export type AccountHealthFactorId = "balance_availability" | "currency_completeness" | "reconciliation_readiness" | "archived_account_handling"
export type AccountQualityIssueId = "missing_balance" | "missing_currency" | "unsupported_reconciliation" | "archived_dependency"

export interface AccountHealthFactor {
  id: AccountHealthFactorId
  availability: "available" | "unavailable"
  score: number | null
  numerator: number
  denominator: number
  affectedAccountIds: string[]
  explanation: string
}

export interface AccountQualityIssue {
  id: AccountQualityIssueId
  count: number
  affectedAccountIds: string[]
  evidenceIds: string[]
}

export type AccountRelationshipKind = "account_type" | "linked_holdings" | "linked_assets" | "linked_goals"
export interface AccountRelationshipItem {
  id: string
  kind: AccountRelationshipKind
  label: string
  count: number
  accountIds: string[]
  evidenceIds: string[]
  availability: "available" | "unavailable"
}

export interface AccountAnalyticalSnapshot {
  overallScore: number | null
  provisional: boolean
  factors: AccountHealthFactor[]
  issues: AccountQualityIssue[]
  relationships: AccountRelationshipItem[]
}

export interface AccountHoldingEvidence {
  holdingId: string
  accountId: string
  assetId: string
  assetName: string
  assetSymbol: string | null
  quantity: Decimal
  averageCost: Decimal | null
  totalCostBasis: Decimal
  costCurrency: string
}

export interface AccountAssetEvidence { assetId: string; name: string; symbol: string | null; holdingIds: string[] }
export interface AccountActivityEntryEvidence { entryId: string; accountId: string; accountCurrency: string; assetId: string | null; assetName: string | null; side: "debit" | "credit"; transactionAmount: Decimal; accountAmount: Decimal; memo: string | null }
export interface AccountActivityEvidence { transactionId: string; type: string; description: string; postedAt: string; occurredAt: string; originalCurrency: string; status: "posted"; entries: AccountActivityEntryEvidence[]; accountIds: string[]; assetIds: string[] }
export interface AccountDetailEvidence {
  item: AccountInventoryItem
  holdings: AccountHoldingEvidence[]
  assets: AccountAssetEvidence[]
  activity: AccountActivityEvidence[]
  investmentMarketValue: Decimal | null
  investmentMarketValueCurrency: string | null
  limitations: Array<"investment_value_unavailable" | "reconciliation_unavailable" | "goals_unavailable">
}
export interface AccountActivityFilters { transactionType: string | null }

export interface AccountInventoryItem {
  account: AccountSummary
  currentBalance: Decimal | null
  projectedCash: Decimal | null
  balanceAuthoritative: boolean
  linkedHoldingsCount: number
  lastActivityAt: string | null
  ownership: "user_owned"
}

export interface AccountTypeOption {
  id: string
  count: number
}

export interface AccountsWorkspaceSnapshot {
  items: AccountInventoryItem[]
  accountTypes: AccountTypeOption[]
  currencies: string[]
  accountCount: number
  activeCount: number
  archivedCount: number
  updatedAt: string
  scope: AccountWorkspaceScope
  analysis: AccountAnalyticalSnapshot
  holdingsEvidence: AccountHoldingEvidence[]
  assetsEvidence: AccountAssetEvidence[]
  activity: AccountActivityEvidence[]
  activityError: string | null
  activeAccountScopeId: string | null
  deletionEligibility: AccountDeletionEligibility[]
}

export interface AccountWorkspaceFilters {
  search: string
  currency: string | null
  lifecycle: AccountLifecycleFilter
  sort: AccountInventorySort
  direction: "asc" | "desc"
}
