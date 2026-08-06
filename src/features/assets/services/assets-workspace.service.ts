import { assetsRepository } from "@/features/assets/repositories/assets.repository"
import type {
  AssetActivityEvidence,
  AssetClassOption,
  AssetDataStatus,
  AssetDetailViewModel,
  AssetEvidenceFilters,
  AssetHealthAnalysis,
  AssetHealthFactor,
  AssetInventoryItem,
  AssetRelationshipEvidence,
  AssetQualityIssue,
  AssetQualityIssueId,
  AssetWorkspaceFilters,
  AssetWorkspaceSnapshot,
} from "@/features/assets/types/asset-workspace"
import { portfolioValuationRepository } from "@/features/portfolio-valuation/repositories/portfolio-valuation.repository"
import { portfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"
import type {
  PortfolioValuationRepositoryContract,
  PortfolioValuationResult,
  PortfolioValuationSource,
} from "@/features/portfolio-valuation/types/portfolio-valuation"
import type { AccountSummary, AssetSummary } from "@/lib/supabase/types"
import type { AssetReferenceCount } from "@/features/assets/repositories/assets.repository"
import { isMarketPriceSupportedAssetType } from "@/services/market-data/repository"
import {
  dashboardRepository,
  type DashboardPostedTransaction,
  type DashboardRepositoryContract,
} from "@/features/dashboard/repositories/dashboard.repository"
import { accountsRepository } from "@/features/accounts/repositories/accounts.repository"
import { getHoldingUnit } from "@/features/holdings/types/holding"

interface AssetCatalogReader {
  getAssets(): Promise<AssetSummary[]>
  getAssetReferenceCounts(assetIds: string[]): Promise<AssetReferenceCount[]>
}

interface PortfolioValuationCalculator {
  calculate(source: PortfolioValuationSource): Promise<PortfolioValuationResult>
}

interface AccountReader {
  getAccounts(): Promise<AccountSummary[]>
}

function dataStatus(
  valuations: PortfolioValuationResult["holdings"],
  valuationSupported: boolean,
  classificationComplete: boolean
): AssetDataStatus {
  if (valuations.length === 0) return "not_applicable"
  if (!classificationComplete) return "missing_classification"
  if (!valuationSupported) return "unsupported"
  if (valuations.some((item) => item.missingMarketPrice)) return "missing_price"
  if (valuations.some((item) => item.missingExchangeRate.length > 0)) {
    return "missing_fx"
  }
  if (valuations.some((item) => item.stalePrice)) return "stale"
  if (
    valuations.some(
      (item) => item.marketPrice !== null && !item.marketPriceTimestamp
    )
  ) {
    return "missing_valuation_date"
  }
  return "complete"
}

function factor(
  id: AssetHealthFactor["id"],
  numerator: number,
  denominator: number,
  assetIds: string[],
  affectedAssetIds: string[]
): AssetHealthFactor {
  if (denominator === 0) {
    return {
      id,
      status: "unavailable",
      score: null,
      numerator,
      denominator,
      assetIds,
      affectedAssetIds,
    }
  }
  const score = Math.round((numerator / denominator) * 100)
  return {
    id,
    status: affectedAssetIds.length === 0 ? "complete" : "attention",
    score,
    numerator,
    denominator,
    assetIds,
    affectedAssetIds,
  }
}

const issueOrder: AssetQualityIssueId[] = [
  "missing_price",
  "missing_fx",
  "missing_classification",
  "missing_valuation_date",
  "unsupported_valuation",
  "archived_reference",
  "stale_market_price",
]

export class AssetsWorkspaceService {
  private readonly catalog: AssetCatalogReader
  private readonly portfolio: PortfolioValuationRepositoryContract
  private readonly valuation: PortfolioValuationCalculator
  private readonly activities: DashboardRepositoryContract
  private readonly accounts: AccountReader

  constructor(
    catalog: AssetCatalogReader = assetsRepository,
    portfolio: PortfolioValuationRepositoryContract = portfolioValuationRepository,
    valuation: PortfolioValuationCalculator = portfolioValuationService,
    activities: DashboardRepositoryContract = dashboardRepository,
    accounts: AccountReader = accountsRepository
  ) {
    this.catalog = catalog
    this.portfolio = portfolio
    this.valuation = valuation
    this.activities = activities
    this.accounts = accounts
  }

  async load(activeScopeId: string | null): Promise<AssetWorkspaceSnapshot> {
    const [assets, source, activityResult, accounts] = await Promise.all([
      this.catalog.getAssets(),
      this.portfolio.getSource(),
      this.activities.getRecentPostedTransactions(40).then(
        (transactions) => ({ transactions, error: null }),
        (cause: unknown) => ({
          transactions: [],
          error:
            cause instanceof Error
              ? cause.message
              : "Asset activity data is malformed",
        })
      ),
      this.accounts.getAccounts(),
    ])
    const postedTransactions = activityResult.transactions
    const [valuation, references] = await Promise.all([
      this.valuation.calculate(source),
      this.catalog.getAssetReferenceCounts(assets.map((asset) => asset.id)),
    ])
    const referencesByAsset = new Map(
      references.map((reference) => [reference.assetId, reference])
    )
    const scopeOptions = [
      ...new Map(
        source.holdings.map((holding) => [
          holding.account.id,
          {
            id: holding.account.id,
            name: holding.account.name,
          },
        ])
      ).values(),
    ].sort((left, right) => left.name.localeCompare(right.name))
    const scopedHoldingIds = new Set(
      source.holdings
        .filter(
          (holding) =>
            activeScopeId === null || holding.account.id === activeScopeId
        )
        .map((holding) => holding.id)
    )
    const scopedAssets = activeScopeId
      ? assets.filter((asset) =>
          source.holdings.some(
            (holding) =>
              holding.asset.id === asset.id && scopedHoldingIds.has(holding.id)
          )
        )
      : assets
    const items = scopedAssets.map((asset): AssetInventoryItem => {
      const holdings = source.holdings.filter(
        (holding) =>
          holding.asset.id === asset.id && scopedHoldingIds.has(holding.id)
      )
      const valuations = valuation.holdings.filter((holding) =>
        holdings.some((candidate) => candidate.id === holding.holdingId)
      )
      const accounts = [
        ...new Map(
          holdings.map((holding) => [
            holding.account.id,
            {
              id: holding.account.id,
              name: holding.account.name,
            },
          ])
        ).values(),
      ]
      const firstPrice = valuations.find((item) => item.marketPrice !== null)
      const classificationComplete = Boolean(asset.asset_type_code)
      const valuationSupported = isMarketPriceSupportedAssetType(
        asset.asset_type_code
      )
      const missingExchangeRatePairs = valuations
        .flatMap((item) => item.missingExchangeRate)
        .filter(
          (pair, index, pairs) =>
            pairs.findIndex(
              (candidate) =>
                candidate.sourceCurrencyCode === pair.sourceCurrencyCode &&
                candidate.destinationCurrencyCode ===
                  pair.destinationCurrencyCode
            ) === index
        )
      const fxRequired = valuations.some(
        (item) =>
          item.costBasisCurrency !== source.baseCurrency ||
          (item.marketPriceCurrency !== null &&
            item.marketPriceCurrency !== source.baseCurrency)
      )
      const fxCovered = fxRequired && missingExchangeRatePairs.length === 0
      const valuationReady =
        valuations.length > 0 &&
        valuationSupported &&
        valuations.every(
          (item) =>
            item.marketValueBase !== null &&
            item.marketPrice !== null &&
            item.marketPriceTimestamp !== null &&
            item.missingExchangeRate.length === 0
        )
      const reference = referencesByAsset.get(asset.id)
      const referenceCount =
        (reference?.holdingCount ?? 0) + (reference?.transactionEntryCount ?? 0)
      return {
        asset,
        ownership: holdings.length > 0 ? "owned" : "record_only",
        lifecycle: asset.is_active ? "active" : "archived",
        origin: asset.is_custom ? "custom" : "global",
        accounts,
        holdingCount: holdings.length,
        currentPrice: firstPrice?.marketPrice ?? null,
        priceCurrency: firstPrice?.marketPriceCurrency ?? null,
        priceTimestamp: firstPrice?.marketPriceTimestamp ?? null,
        dataStatus: dataStatus(
          valuations,
          valuationSupported,
          classificationComplete
        ),
        classificationComplete,
        valuationSupported,
        valuationReady,
        fxRequired,
        fxCovered,
        missingExchangeRatePairs,
        referenceCount,
      }
    })
    const classCounts = new Map<string, number>()
    for (const item of items) {
      classCounts.set(
        item.asset.asset_type_code,
        (classCounts.get(item.asset.asset_type_code) ?? 0) + 1
      )
    }
    const assetClasses: AssetClassOption[] = [...classCounts]
      .map(([id, count]) => ({ id, count }))
      .sort((left, right) => left.id.localeCompare(right.id))
    const analysis = this.analyze(items)
    const accountNames = new Map(
      accounts.map((account) => [account.id, account])
    )
    const activity = this.buildActivity(
      postedTransactions,
      assets,
      accountNames
    ).filter(
      (item) =>
        (!activeScopeId || item.accountIds.includes(activeScopeId)) &&
        item.assetIds.some((assetId) =>
          scopedAssets.some((asset) => asset.id === assetId)
        )
    )
    const relationships: AssetRelationshipEvidence[] = source.holdings
      .filter((holding) => scopedHoldingIds.has(holding.id))
      .map((holding) => {
        const item = items.find(
          (candidate) => candidate.asset.id === holding.asset.id
        )
        const holdingValuation = valuation.holdings.find(
          (candidate) => candidate.holdingId === holding.id
        )
        if (!item || !holdingValuation) {
          throw new Error(`Unable to resolve asset relationship ${holding.id}`)
        }
        return {
          holdingId: holding.id,
          assetId: holding.asset.id,
          accountId: holding.account.id,
          accountName: holding.account.name,
          quantity: holding.quantity,
          unit: getHoldingUnit(holding),
          averageCost: holding.average_cost,
          totalCostBasis: holding.total_cost_basis,
          costCurrency: holding.cost_currency_code,
          marketValueBase: holdingValuation.marketValueBase,
          baseCurrency: source.baseCurrency,
          dataStatus: dataStatus(
            [holdingValuation],
            item.valuationSupported,
            item.classificationComplete
          ),
          relatedActivityCount: activity.filter((transaction) =>
            transaction.entries.some(
              (entry) =>
                entry.assetId === holding.asset.id &&
                entry.accountId === holding.account.id
            )
          ).length,
        }
      })
    return {
      items,
      scopeOptions,
      assetClasses,
      recordCount: items.length,
      ownedCount: items.filter((item) => item.ownership === "owned").length,
      issueCount: new Set(
        analysis.issues.flatMap((issue) => issue.affectedAssetIds)
      ).size,
      updatedAt: new Date().toISOString(),
      activeScopeId,
      analysis,
      relationships,
      activity,
      activityError: activityResult.error,
    }
  }

  buildActivity(
    transactions: DashboardPostedTransaction[],
    assets: AssetSummary[],
    accounts: ReadonlyMap<string, AccountSummary>
  ): AssetActivityEvidence[] {
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
    return transactions.flatMap((transaction) => {
      if (transaction.status !== "posted") return []
      const entries = transaction.transaction_entries.flatMap((entry) => {
        if (!entry.asset_id) return []
        const asset = assetsById.get(entry.asset_id)
        if (!asset) return []
        return [
          {
            id: entry.id,
            accountId: entry.account_id,
            accountName:
              accounts.get(entry.account_id)?.name ?? entry.account_id,
            assetId: entry.asset_id,
            assetName: asset.name,
            side: entry.entry_side,
            transactionAmount: entry.transaction_amount,
            accountAmount: entry.account_amount,
            quantityDelta: entry.quantity_delta,
            memo: entry.memo,
          },
        ]
      })
      if (entries.length === 0) return []
      return [
        {
          id: transaction.id,
          type: transaction.transaction_type_code,
          description: transaction.description,
          occurredAt: transaction.occurred_at,
          postedAt: transaction.posted_at ?? transaction.updated_at,
          originalCurrency: transaction.transaction_currency_code,
          originalAmount: entries[0].transactionAmount,
          assetIds: [...new Set(entries.map((entry) => entry.assetId))],
          accountIds: [...new Set(entries.map((entry) => entry.accountId))],
          entries,
        },
      ]
    })
  }

  filterRelationships(
    relationships: AssetRelationshipEvidence[],
    visibleAssetIds: ReadonlySet<string>,
    selectedAssetId: string | null,
    accountId: string | null
  ): AssetRelationshipEvidence[] {
    return relationships.filter(
      (relationship) =>
        visibleAssetIds.has(relationship.assetId) &&
        (!selectedAssetId || relationship.assetId === selectedAssetId) &&
        (!accountId || relationship.accountId === accountId)
    )
  }

  filterActivity(
    activity: AssetActivityEvidence[],
    visibleAssetIds: ReadonlySet<string>,
    selectedAssetId: string | null,
    filters: AssetEvidenceFilters
  ): AssetActivityEvidence[] {
    return activity.filter(
      (transaction) =>
        transaction.assetIds.some((assetId) => visibleAssetIds.has(assetId)) &&
        (!selectedAssetId || transaction.assetIds.includes(selectedAssetId)) &&
        (!filters.activityAccountId ||
          transaction.accountIds.includes(filters.activityAccountId)) &&
        (!filters.activityType || transaction.type === filters.activityType)
    )
  }

  detailFor(
    snapshot: AssetWorkspaceSnapshot,
    assetId: string
  ): AssetDetailViewModel | null {
    const item = snapshot.items.find(
      (candidate) => candidate.asset.id === assetId
    )
    if (!item) return null
    return {
      item,
      relationships: snapshot.relationships.filter(
        (relationship) => relationship.assetId === assetId
      ),
      activity: snapshot.activity.filter((transaction) =>
        transaction.assetIds.includes(assetId)
      ),
    }
  }

  analyze(items: AssetInventoryItem[]): AssetHealthAnalysis {
    const owned = items.filter((item) => item.ownership === "owned")
    const priceEligible = owned.filter((item) => item.valuationSupported)
    const fxRequired = owned.filter((item) => item.fxRequired)
    const archived = items.filter((item) => item.lifecycle === "archived")
    const priceMissing = priceEligible.filter(
      (item) => item.currentPrice === null
    )
    const fxMissing = fxRequired.filter((item) => !item.fxCovered)
    const classificationMissing = items.filter(
      (item) => !item.classificationComplete
    )
    const valuationNotReady = owned.filter((item) => !item.valuationReady)
    const archivedReferenced = archived.filter(
      (item) => item.referenceCount > 0
    )
    const factors = [
      factor(
        "price_coverage",
        priceEligible.length - priceMissing.length,
        priceEligible.length,
        priceEligible.map((item) => item.asset.id),
        priceMissing.map((item) => item.asset.id)
      ),
      factor(
        "fx_coverage",
        fxRequired.length - fxMissing.length,
        fxRequired.length,
        fxRequired.map((item) => item.asset.id),
        fxMissing.map((item) => item.asset.id)
      ),
      factor(
        "classification_completeness",
        items.length - classificationMissing.length,
        items.length,
        items.map((item) => item.asset.id),
        classificationMissing.map((item) => item.asset.id)
      ),
      factor(
        "valuation_readiness",
        owned.length - valuationNotReady.length,
        owned.length,
        owned.map((item) => item.asset.id),
        valuationNotReady.map((item) => item.asset.id)
      ),
      factor(
        "archived_references",
        archived.length - archivedReferenced.length,
        archived.length,
        archived.map((item) => item.asset.id),
        archivedReferenced.map((item) => item.asset.id)
      ),
    ]
    const issueAssets: Record<AssetQualityIssueId, string[]> = {
      missing_price: owned
        .filter((item) => item.valuationSupported && item.currentPrice === null)
        .map((item) => item.asset.id),
      missing_fx: owned
        .filter((item) => item.fxRequired && !item.fxCovered)
        .map((item) => item.asset.id),
      missing_classification: classificationMissing.map(
        (item) => item.asset.id
      ),
      missing_valuation_date: owned
        .filter(
          (item) => item.currentPrice !== null && item.priceTimestamp === null
        )
        .map((item) => item.asset.id),
      unsupported_valuation: owned
        .filter((item) => !item.valuationSupported)
        .map((item) => item.asset.id),
      archived_reference: archivedReferenced.map((item) => item.asset.id),
      stale_market_price: owned
        .filter((item) => item.dataStatus === "stale")
        .map((item) => item.asset.id),
    }
    const issues: AssetQualityIssue[] = issueOrder
      .map((id) => ({
        id,
        affectedAssetIds: issueAssets[id],
        count: issueAssets[id].length,
      }))
      .filter((issue) => issue.count > 0)
    const availableScores = factors.flatMap((item) =>
      item.score === null ? [] : [item.score]
    )
    return {
      score:
        availableScores.length === 0
          ? null
          : Math.round(
              availableScores.reduce((total, score) => total + score, 0) /
                availableScores.length
            ),
      provisional:
        factors.some((item) => item.status === "unavailable") ||
        issues.length > 0,
      factors,
      issues,
    }
  }

  filterByAnalysis(
    items: AssetInventoryItem[],
    analysis: AssetHealthAnalysis,
    factorId: AssetHealthFactor["id"] | null,
    issueId: AssetQualityIssueId | null
  ): AssetInventoryItem[] {
    const affected = issueId
      ? analysis.issues.find((issue) => issue.id === issueId)?.affectedAssetIds
      : factorId
        ? (() => {
            const selected = analysis.factors.find(
              (item) => item.id === factorId
            )
            return selected?.affectedAssetIds.length
              ? selected.affectedAssetIds
              : selected?.assetIds
          })()
        : null
    if (!affected) return items
    const ids = new Set(affected)
    return items.filter((item) => ids.has(item.asset.id))
  }

  issueForFactor(
    factorId: AssetHealthFactor["id"],
    analysis: AssetHealthAnalysis
  ): AssetQualityIssueId | null {
    const candidates: Record<AssetHealthFactor["id"], AssetQualityIssueId[]> = {
      price_coverage: [
        "missing_price",
        "missing_valuation_date",
        "stale_market_price",
      ],
      fx_coverage: ["missing_fx"],
      classification_completeness: ["missing_classification"],
      valuation_readiness: [
        "missing_price",
        "missing_fx",
        "missing_valuation_date",
        "unsupported_valuation",
        "stale_market_price",
      ],
      archived_references: ["archived_reference"],
    }
    return (
      candidates[factorId].find((id) =>
        analysis.issues.some((issue) => issue.id === id)
      ) ?? null
    )
  }

  factorForIssue(issueId: AssetQualityIssueId): AssetHealthFactor["id"] {
    if (issueId === "missing_fx") return "fx_coverage"
    if (issueId === "missing_classification") {
      return "classification_completeness"
    }
    if (issueId === "archived_reference") return "archived_references"
    if (
      issueId === "missing_price" ||
      issueId === "missing_valuation_date" ||
      issueId === "stale_market_price"
    ) {
      return "price_coverage"
    }
    return "valuation_readiness"
  }

  filterAndSort(
    items: AssetInventoryItem[],
    assetClassId: string | null,
    filters: AssetWorkspaceFilters
  ): AssetInventoryItem[] {
    const search = filters.search.trim().toLocaleLowerCase()
    return items
      .filter(
        (item) =>
          (!assetClassId || item.asset.asset_type_code === assetClassId) &&
          (!search ||
            item.asset.name.toLocaleLowerCase().includes(search) ||
            item.asset.symbol?.toLocaleLowerCase().includes(search) ||
            item.asset.exchange?.toLocaleLowerCase().includes(search) ||
            item.accounts.some(
              (account) => account.name.toLocaleLowerCase().includes(search)
            )) &&
          (filters.ownership === "all" ||
            item.ownership === filters.ownership) &&
          (!filters.accountId ||
            item.accounts.some(
              (account) => account.id === filters.accountId
            )) &&
          (!filters.currency ||
            item.asset.currency_code === filters.currency) &&
          (filters.lifecycle === "all" ||
            item.lifecycle === filters.lifecycle) &&
          (filters.origin === "all" || item.origin === filters.origin)
      )
      .map((item, index) => ({ item, index }))
      .sort((left, right) => {
        const compare =
          filters.sort === "name"
            ? left.item.asset.name.localeCompare(right.item.asset.name)
            : filters.sort === "ownership"
              ? left.item.ownership.localeCompare(right.item.ownership)
              : filters.sort === "asset_class"
                ? left.item.asset.asset_type_code.localeCompare(
                    right.item.asset.asset_type_code
                  )
                : filters.sort === "currency"
                  ? left.item.asset.currency_code.localeCompare(
                      right.item.asset.currency_code
                    )
                  : filters.sort === "price_date"
                    ? (left.item.priceTimestamp ?? "\uffff").localeCompare(
                        right.item.priceTimestamp ?? "\uffff"
                      )
                    : left.item.dataStatus.localeCompare(right.item.dataStatus)
        return compare === 0
          ? left.index - right.index
          : filters.direction === "asc"
            ? compare
            : -compare
      })
      .map(({ item }) => item)
  }
}

export const assetsWorkspaceService = new AssetsWorkspaceService()
