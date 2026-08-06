import {
  accountBalancesService,
  supportsProjectedWealthCash,
} from "@/features/account-balances/services/account-balances.service"
import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import type {
  AccountActivityEvidence,
  AccountActivityFilters,
  AccountAnalyticalSnapshot,
  AccountAssetEvidence,
  AccountDetailEvidence,
  AccountHealthFactor,
  AccountHealthFactorId,
  AccountHoldingEvidence,
  AccountInventoryItem,
  AccountQualityIssue,
  AccountQualityIssueId,
  AccountRelationshipItem,
  AccountsWorkspaceSnapshot,
  AccountWorkspaceFilters,
  AccountWorkspaceScope,
} from "@/features/accounts/types/account-workspace"
import {
  dashboardRepository,
  type DashboardPostedTransaction,
} from "@/features/dashboard/repositories/dashboard.repository"
import { holdingsRepository } from "@/features/holdings/repositories/holdings.repository"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import { compareDecimals } from "@/lib/financial-calculations/decimal"
import type { AccountSummary } from "@/lib/supabase/types"
import type { AccountFormValues } from "@/features/accounts/types/account-form"
import type {
  CreateAccountInput,
  UpdateAccountInput,
} from "@/features/accounts/repositories/accounts.repository"

interface AccountsReader {
  getAccounts(): Promise<AccountSummary[]>
  createAccount?(input: CreateAccountInput): Promise<AccountSummary>
  updateAccount?(id: string, input: UpdateAccountInput): Promise<AccountSummary>
  archiveAccount?(id: string): Promise<AccountSummary>
  deleteAccount?(id: string): Promise<void>
}
interface EligibilityReader {
  getAccountDeletionEligibility(
    accountIds: string[]
  ): Promise<
    Array<{
      accountId: string
      canDelete: boolean
      hasFinancialHistory: boolean
    }>
  >
}
interface BalancesReader {
  getAccountBalances(accountIds?: readonly string[]): Promise<AccountBalance[]>
}
interface HoldingsReader {
  getHoldings(): Promise<HoldingDetails[]>
}
interface ActivityReader {
  getRecentPostedTransactions(
    limit?: number
  ): Promise<DashboardPostedTransaction[]>
}

export class AccountsWorkspaceService {
  private readonly accounts: AccountsReader
  private readonly balances: BalancesReader
  private readonly holdings: HoldingsReader
  private readonly activity: ActivityReader
  private readonly eligibility: EligibilityReader

  constructor(
    accounts: AccountsReader = accountsRepository,
    balances: BalancesReader = accountBalancesService,
    holdings: HoldingsReader = holdingsRepository,
    activity: ActivityReader = dashboardRepository,
    eligibility: EligibilityReader = accountsRepository
  ) {
    this.accounts = accounts
    this.balances = balances
    this.holdings = holdings
    this.activity = activity
    this.eligibility = eligibility
  }

  async load(
    scope: AccountWorkspaceScope,
    accountScopeId: string | null = null
  ): Promise<AccountsWorkspaceSnapshot> {
    const accounts = await this.accounts.getAccounts()
    const [balances, holdings, transactions, eligibility] = await Promise.all([
      this.balances.getAccountBalances(),
      this.holdings.getHoldings(),
      this.activity.getRecentPostedTransactions(100),
      this.eligibility.getAccountDeletionEligibility(
        accounts.map((account) => account.id)
      ),
    ])
    const balancesByAccount = new Map(
      balances.map((balance) => [balance.accountId, balance])
    )
    const holdingCounts = new Map<string, number>()
    const holdingAssetIds = new Map<string, Set<string>>()
    for (const holding of holdings) {
      holdingCounts.set(
        holding.account_id,
        (holdingCounts.get(holding.account_id) ?? 0) + 1
      )
      const assets =
        holdingAssetIds.get(holding.account_id) ?? new Set<string>()
      assets.add(holding.asset_id)
      holdingAssetIds.set(holding.account_id, assets)
    }
    const lastActivity = new Map<string, string>()
    for (const transaction of transactions) {
      for (const entry of transaction.transaction_entries) {
        const current = lastActivity.get(entry.account_id)
        if (!current || transaction.occurred_at > current)
          lastActivity.set(entry.account_id, transaction.occurred_at)
      }
    }
    const allItems = accounts.map((account): AccountInventoryItem => {
      const balance = balancesByAccount.get(account.id)
      const supportsCash = supportsProjectedWealthCash(
        account.account_type_code
      )
      return {
        account,
        currentBalance: balance?.currentBalance ?? null,
        projectedCash: supportsCash ? (balance?.currentBalance ?? null) : null,
        balanceAuthoritative: Boolean(balance),
        linkedHoldingsCount: holdingCounts.get(account.id) ?? 0,
        lastActivityAt: lastActivity.get(account.id) ?? null,
        ownership: "user_owned",
      }
    })
    const scopedByType =
      scope === "wealth_cash"
        ? allItems.filter((item) =>
            supportsProjectedWealthCash(item.account.account_type_code)
          )
        : allItems
    const items = accountScopeId
      ? scopedByType.filter((item) => item.account.id === accountScopeId)
      : scopedByType
    const scopedIds = new Set(items.map((item) => item.account.id))
    const scopedHoldings = holdings.filter((holding) =>
      scopedIds.has(holding.account_id)
    )
    const eligibilityByAccount = new Map(
      eligibility.map((entry) => [entry.accountId, entry])
    )
    const typeCounts = new Map<string, number>()
    for (const item of items)
      typeCounts.set(
        item.account.account_type_code,
        (typeCounts.get(item.account.account_type_code) ?? 0) + 1
      )
    const holdingsEvidence: AccountHoldingEvidence[] = scopedHoldings.map(
      (holding) => ({
        holdingId: holding.id,
        accountId: holding.account_id,
        assetId: holding.asset_id,
        assetName: holding.asset.name,
        assetSymbol: holding.asset.symbol,
        quantity: holding.quantity,
        averageCost: holding.average_cost,
        totalCostBasis: holding.total_cost_basis,
        costCurrency: holding.cost_currency_code,
      })
    )
    const assetGroups = new Map<string, AccountAssetEvidence>()
    for (const holding of holdingsEvidence) {
      const current = assetGroups.get(holding.assetId)
      assetGroups.set(
        holding.assetId,
        current
          ? {
              ...current,
              holdingIds: [...current.holdingIds, holding.holdingId],
            }
          : {
              assetId: holding.assetId,
              name: holding.assetName,
              symbol: holding.assetSymbol,
              holdingIds: [holding.holdingId],
            }
      )
    }
    const assetsEvidence = [...assetGroups.values()]
    const assetNames = new Map(
      assetsEvidence.map((asset) => [asset.assetId, asset.name])
    )
    const accountCurrencies = new Map(
      items.map((item) => [item.account.id, item.account.currency_code])
    )
    const activity: AccountActivityEvidence[] = transactions.flatMap(
      (transaction) => {
        if (transaction.status !== "posted") return []
        const entries = transaction.transaction_entries
          .filter((entry) => scopedIds.has(entry.account_id))
          .map((entry) => ({
            entryId: entry.id,
            accountId: entry.account_id,
            accountCurrency:
              accountCurrencies.get(entry.account_id) ??
              transaction.transaction_currency_code,
            assetId: entry.asset_id,
            assetName: entry.asset_id
              ? (assetNames.get(entry.asset_id) ?? null)
              : null,
            side: entry.entry_side,
            transactionAmount: entry.transaction_amount,
            accountAmount: entry.account_amount,
            memo: entry.memo,
          }))
        return entries.length
          ? [
              {
                transactionId: transaction.id,
                type: transaction.transaction_type_code,
                description: transaction.description,
                postedAt: transaction.posted_at ?? transaction.occurred_at,
                occurredAt: transaction.occurred_at,
                originalCurrency: transaction.transaction_currency_code,
                status: "posted" as const,
                entries,
                accountIds: [
                  ...new Set(entries.map((entry) => entry.accountId)),
                ],
                assetIds: [
                  ...new Set(
                    entries.flatMap((entry) =>
                      entry.assetId ? [entry.assetId] : []
                    )
                  ),
                ],
              },
            ]
          : []
      }
    )
    return {
      items,
      accountTypes: [...typeCounts]
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      currencies: [
        ...new Set(items.map((item) => item.account.currency_code)),
      ].sort(),
      accountCount: items.length,
      activeCount: items.filter((item) => item.account.is_active).length,
      archivedCount: items.filter((item) => !item.account.is_active).length,
      updatedAt: new Date().toISOString(),
      scope,
      analysis: this.buildAnalysis(
        items,
        scopedHoldings,
        holdingAssetIds,
        eligibilityByAccount
      ),
      holdingsEvidence,
      assetsEvidence,
      activity,
      activityError: null,
      activeAccountScopeId: accountScopeId,
      deletionEligibility: eligibility.filter((entry) =>
        scopedIds.has(entry.accountId)
      ),
    }
  }

  private accountWriter() {
    if (
      !this.accounts.createAccount ||
      !this.accounts.updateAccount ||
      !this.accounts.archiveAccount ||
      !this.accounts.deleteAccount
    )
      throw new Error("Account mutations are unavailable")
    return this.accounts as Required<
      Pick<
        AccountsReader,
        "createAccount" | "updateAccount" | "archiveAccount" | "deleteAccount"
      >
    >
  }
  private formInput(values: AccountFormValues): CreateAccountInput {
    return {
      accountTypeCode: values.accountTypeCode,
      name: values.name.trim(),
      currencyCode: values.currencyCode,
      openingBalance: values.openingBalance.trim(),
      notes: values.notes.trim() || null,
    }
  }
  async createAccount(values: AccountFormValues) {
    const writer = this.accountWriter()
    const created = await writer.createAccount(this.formInput(values))
    return values.isActive
      ? created
      : writer.updateAccount(created.id, { isActive: false })
  }
  async updateAccount(id: string, values: AccountFormValues) {
    return this.accountWriter().updateAccount(id, {
      ...this.formInput(values),
      isActive: values.isActive,
    })
  }
  async archiveAccount(id: string) {
    return this.accountWriter().archiveAccount(id)
  }
  async deleteAccount(id: string) {
    return this.accountWriter().deleteAccount(id)
  }

  getAccountDetail(
    snapshot: AccountsWorkspaceSnapshot,
    accountId: string
  ): AccountDetailEvidence | null {
    const item = snapshot.items.find((entry) => entry.account.id === accountId)
    if (!item) return null
    return {
      item,
      holdings: snapshot.holdingsEvidence.filter(
        (entry) => entry.accountId === accountId
      ),
      assets: snapshot.assetsEvidence.filter((asset) =>
        asset.holdingIds.some((id) =>
          snapshot.holdingsEvidence.some(
            (holding) =>
              holding.holdingId === id && holding.accountId === accountId
          )
        )
      ),
      activity: snapshot.activity.filter((entry) =>
        entry.accountIds.includes(accountId)
      ),
      investmentMarketValue: null,
      investmentMarketValueCurrency: null,
      limitations: [
        "investment_value_unavailable",
        "reconciliation_unavailable",
        "goals_unavailable",
      ],
    }
  }

  filterActivity(
    activity: AccountActivityEvidence[],
    accountId: string | null,
    filters: AccountActivityFilters
  ): AccountActivityEvidence[] {
    return activity.filter(
      (entry) =>
        (!accountId || entry.accountIds.includes(accountId)) &&
        (!filters.transactionType || entry.type === filters.transactionType)
    )
  }

  buildAnalysis(
    items: AccountInventoryItem[],
    holdings: HoldingDetails[],
    holdingAssetIds: Map<string, Set<string>>,
    eligibility: Map<
      string,
      { canDelete: boolean; hasFinancialHistory: boolean }
    >
  ): AccountAnalyticalSnapshot {
    const ids = items.map((item) => item.account.id)
    const factor = (
      id: AccountHealthFactorId,
      denominator: number,
      passing: string[],
      affected: string[],
      explanation: string,
      available = true
    ): AccountHealthFactor => {
      const measurable = available && denominator > 0
      return {
        id,
        availability: measurable ? "available" : "unavailable",
        score: measurable
          ? Math.round((passing.length / denominator) * 100)
          : null,
        numerator: measurable ? passing.length : 0,
        denominator: measurable ? denominator : 0,
        affectedAccountIds: affected,
        explanation,
      }
    }
    const balancePassing = items
      .filter((item) => item.balanceAuthoritative)
      .map((item) => item.account.id)
    const currencyPassing = items
      .filter((item) => item.account.currency_code.trim().length > 0)
      .map((item) => item.account.id)
    const archived = items.filter((item) => !item.account.is_active)
    const archivedAffected = archived
      .filter((item) => !(eligibility.get(item.account.id)?.canDelete ?? true))
      .map((item) => item.account.id)
    const factors: AccountHealthFactor[] = [
      factor(
        "balance_availability",
        items.length,
        balancePassing,
        ids.filter((id) => !balancePassing.includes(id)),
        "Authoritative projected balance coverage for accounts in scope."
      ),
      factor(
        "currency_completeness",
        items.length,
        currencyPassing,
        ids.filter((id) => !currencyPassing.includes(id)),
        "Stored original account currency coverage."
      ),
      factor(
        "reconciliation_readiness",
        0,
        [],
        ids,
        "Reconciliation is not represented by the current authoritative data model.",
        false
      ),
      factor(
        "archived_account_handling",
        archived.length,
        archived
          .filter((item) => !archivedAffected.includes(item.account.id))
          .map((item) => item.account.id),
        archivedAffected,
        "Archived accounts that retain authoritative financial dependencies.",
        archived.length > 0
      ),
    ]
    const issue = (
      id: AccountQualityIssueId,
      affectedAccountIds: string[],
      evidenceIds = affectedAccountIds
    ): AccountQualityIssue => ({
      id,
      count: affectedAccountIds.length,
      affectedAccountIds,
      evidenceIds,
    })
    const issues = [
      issue(
        "missing_balance",
        ids.filter((id) => !balancePassing.includes(id))
      ),
      issue(
        "missing_currency",
        ids.filter((id) => !currencyPassing.includes(id))
      ),
      issue("unsupported_reconciliation", ids),
      issue(
        "archived_dependency",
        archivedAffected,
        archivedAffected.flatMap((id) =>
          eligibility.get(id)?.hasFinancialHistory
            ? [`account-history:${id}`]
            : [`account-reference:${id}`]
        )
      ),
    ].filter((entry) => entry.count > 0)
    const relationships: AccountRelationshipItem[] = []
    const addDistribution = (
      kind: "account_type",
      values: Map<string, string[]>
    ) => {
      for (const [label, accountIds] of [...values].sort(([a], [b]) =>
        a.localeCompare(b)
      ))
        relationships.push({
          id: `${kind}:${label}`,
          kind,
          label,
          count: accountIds.length,
          accountIds,
          evidenceIds: accountIds,
          availability: "available",
        })
    }
    const types = new Map<string, string[]>()
    for (const item of items) {
      types.set(item.account.account_type_code, [
        ...(types.get(item.account.account_type_code) ?? []),
        item.account.id,
      ])
    }
    addDistribution("account_type", types)
    const holdingAccounts = [
      ...new Set(holdings.map((holding) => holding.account_id)),
    ]
    relationships.push({
      id: "linked_holdings",
      kind: "linked_holdings",
      label: "linked_holdings",
      count: holdings.length,
      accountIds: holdingAccounts,
      evidenceIds: holdings.map((holding) => holding.id),
      availability: "available",
    })
    relationships.push({
      id: "linked_assets",
      kind: "linked_assets",
      label: "linked_assets",
      count: new Set(holdings.map((holding) => holding.asset_id)).size,
      accountIds: [...holdingAssetIds]
        .filter(([id]) => ids.includes(id))
        .map(([id]) => id),
      evidenceIds: [...new Set(holdings.map((holding) => holding.asset_id))],
      availability: "available",
    })
    relationships.push({
      id: "linked_goals",
      kind: "linked_goals",
      label: "linked_goals",
      count: 0,
      accountIds: [],
      evidenceIds: [],
      availability: "unavailable",
    })
    const scores = factors.flatMap((entry) =>
      entry.score === null ? [] : [entry.score]
    )
    return {
      overallScore: scores.length
        ? Math.round(
            scores.reduce((sum, score) => sum + score, 0) / scores.length
          )
        : null,
      provisional: factors.some(
        (entry) => entry.availability === "unavailable"
      ),
      factors,
      issues,
      relationships,
    }
  }

  filterByAnalysis(
    items: AccountInventoryItem[],
    factorId: AccountHealthFactorId | null,
    issueId: AccountQualityIssueId | null,
    relationshipId: string | null,
    analysis: AccountAnalyticalSnapshot
  ): AccountInventoryItem[] {
    const sets = [
      factorId
        ? analysis.factors.find((entry) => entry.id === factorId)
            ?.affectedAccountIds
        : null,
      issueId
        ? analysis.issues.find((entry) => entry.id === issueId)
            ?.affectedAccountIds
        : null,
      relationshipId
        ? analysis.relationships.find((entry) => entry.id === relationshipId)
            ?.accountIds
        : null,
    ].filter(
      (value): value is string[] => value !== null && value !== undefined
    )
    return sets.length
      ? items.filter((item) =>
          sets.every((ids) => ids.includes(item.account.id))
        )
      : items
  }

  filterAndSort(
    items: AccountInventoryItem[],
    accountType: string | null,
    filters: AccountWorkspaceFilters
  ): AccountInventoryItem[] {
    const search = filters.search.trim().toLocaleLowerCase()
    return items
      .filter(
        (item) =>
          (!accountType || item.account.account_type_code === accountType) &&
          (!search || item.account.name.toLocaleLowerCase().includes(search)) &&
          (!filters.currency ||
            item.account.currency_code === filters.currency) &&
          (filters.lifecycle === "all" ||
            (filters.lifecycle === "active"
              ? item.account.is_active
              : !item.account.is_active))
      )
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        let comparison: number
        if (filters.sort === "balance")
          comparison =
            left.item.currentBalance === null
              ? right.item.currentBalance === null
                ? 0
                : 1
              : right.item.currentBalance === null
                ? -1
                : (compareDecimals(
                    left.item.currentBalance,
                    right.item.currentBalance
                  ) ?? 0)
        else {
          const leftValue =
            filters.sort === "name"
              ? left.item.account.name
              : filters.sort === "type"
                ? left.item.account.account_type_code
                : filters.sort === "currency"
                  ? left.item.account.currency_code
                  : filters.sort === "status"
                    ? String(left.item.account.is_active)
                    : (left.item.lastActivityAt ?? "")
          const rightValue =
            filters.sort === "name"
              ? right.item.account.name
              : filters.sort === "type"
                ? right.item.account.account_type_code
                : filters.sort === "currency"
                  ? right.item.account.currency_code
                  : filters.sort === "status"
                    ? String(right.item.account.is_active)
                    : (right.item.lastActivityAt ?? "")
          comparison = leftValue.localeCompare(rightValue)
        }
        return comparison === 0
          ? left.index - right.index
          : filters.direction === "asc"
            ? comparison
            : -comparison
      })
      .map(({ item }) => item)
  }
}

export const accountsWorkspaceService = new AccountsWorkspaceService()
