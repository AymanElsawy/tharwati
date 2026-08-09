import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import type { DashboardPostedTransaction } from "@/features/dashboard/repositories/dashboard.repository"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import { getHoldingUnit } from "@/features/holdings/types/holding"
import type { HoldingValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"
import type {
  PortfolioActivityFilters,
  PortfolioActivityItem,
  PortfolioCustodyAccount,
  PortfolioHoldingEvidence,
  PortfolioHoldingFilters,
} from "@/features/portfolio/types/portfolio-evidence"
import {
  calculateGroupedMarketValueAllocation,
  compareDecimals,
} from "@/lib/financial-calculations"
import { addDecimals } from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

function add(left: Decimal, right: Decimal): Decimal {
  const result = addDecimals(left, right)
  if (result === null) throw new Error("Unable to aggregate portfolio evidence")
  return result
}

export class PortfolioEvidenceService {
  buildHoldings(
    source: HoldingDetails[],
    valuations: HoldingValuationResult[]
  ): PortfolioHoldingEvidence[] {
    return source.map((holding) => {
      const valuation = valuations.find((item) => item.holdingId === holding.id)
      if (!valuation)
        throw new Error(`Missing valuation for holding ${holding.id}`)
      const dataQuality = valuation.missingMarketPrice
        ? "missing_price"
        : valuation.missingExchangeRate.length > 0
          ? "missing_fx"
          : "complete"
      return {
        id: holding.id,
        assetId: holding.asset.id,
        assetName: holding.asset.name,
        symbol: holding.asset.symbol,
        assetClass: holding.asset.asset_type_code,
        accountId: holding.account.id,
        accountName: holding.account.name,
        quantity: holding.quantity,
        unit: getHoldingUnit(holding),
        averageCost: holding.average_cost,
        totalCostBasis: holding.total_cost_basis,
        costCurrency: holding.cost_currency_code,
        currentPrice: valuation.marketPrice,
        priceCurrency: valuation.marketPriceCurrency,
        priceTimestamp: valuation.marketPriceTimestamp,
        priceSource: valuation.marketPriceSource,
        priceType: valuation.marketPriceType ?? null,
        priceFetchedAt: valuation.marketPriceFetchedAt ?? null,
        marketValueBase: valuation.marketValueBase,
        unrealizedGainLossBase: valuation.unrealizedGainLossBase,
        returnPercent: valuation.unrealizedReturnPercent,
        dataQuality,
      }
    })
  }

  buildActivity(
    transactions: DashboardPostedTransaction[]
  ): PortfolioActivityItem[] {
    return transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.transaction_type_code,
      description: transaction.description,
      occurredAt: transaction.occurred_at,
      postedAt: transaction.posted_at ?? transaction.updated_at,
      currency: transaction.transaction_currency_code,
      // A balanced ledger contains offsetting sides; summing both would
      // double-count the economic event. The transaction's first persisted
      // entry is used only as its original-currency display amount.
      amount: transaction.transaction_entries[0]?.transaction_amount ?? "0",
      accountIds: [
        ...new Set(
          transaction.transaction_entries.map((entry) => entry.account_id)
        ),
      ],
      assetIds: [
        ...new Set(
          transaction.transaction_entries.flatMap((entry) =>
            entry.asset_id ? [entry.asset_id] : []
          )
        ),
      ],
      entries: transaction.transaction_entries.map((entry) => ({
        id: entry.id,
        accountId: entry.account_id,
        assetId: entry.asset_id,
        side: entry.entry_side,
        amount: entry.transaction_amount,
        accountAmount: entry.account_amount,
        quantityDelta: entry.quantity_delta,
        memo: entry.memo,
      })),
    }))
  }

  buildCustody(input: {
    holdings: PortfolioHoldingEvidence[]
    balances: AccountBalance[]
    cashBase: ReadonlyMap<string, Decimal | null>
    baseCurrency: string
  }): PortfolioCustodyAccount[] {
    const accounts = new Map<string, PortfolioCustodyAccount>()
    for (const holding of input.holdings) {
      const current = accounts.get(holding.accountId)
      accounts.set(holding.accountId, {
        accountId: holding.accountId,
        accountName: holding.accountName,
        accountType:
          input.balances.find((item) => item.accountId === holding.accountId)
            ?.accountTypeCode ?? "investment",
        accountCurrency:
          input.balances.find((item) => item.accountId === holding.accountId)
            ?.currencyCode ?? holding.costCurrency,
        investmentValueBase: add(
          current?.investmentValueBase ?? "0",
          holding.marketValueBase ?? "0"
        ),
        projectedCashOriginal:
          input.balances.find((item) => item.accountId === holding.accountId)
            ?.currentBalance ?? "0",
        projectedCashBase: input.cashBase.get(holding.accountId) ?? null,
        totalContributionBase: null,
        holdingCount: (current?.holdingCount ?? 0) + 1,
        percentage: null,
        dataQuality:
          holding.marketValueBase === null ? holding.dataQuality : "complete",
      })
    }
    const rows = [...accounts.values()].map((account) => ({
      ...account,
      totalContributionBase:
        account.projectedCashBase === null
          ? null
          : add(account.investmentValueBase, account.projectedCashBase),
      dataQuality:
        account.projectedCashBase === null
          ? ("missing_fx" as const)
          : account.dataQuality,
    }))
    const valued = rows.filter(
      (row): row is typeof row & { totalContributionBase: Decimal } =>
        row.totalContributionBase !== null &&
        compareDecimals(row.totalContributionBase, "0") !== -1
    )
    const allocation =
      valued.length === 0
        ? null
        : calculateGroupedMarketValueAllocation(
            valued.map((row) => ({
              group: row.accountId,
              marketValue: row.totalContributionBase,
              currencyCode: input.baseCurrency,
            }))
          )
    return rows.map((row) => ({
      ...row,
      percentage:
        allocation?.allocations.find((item) => item.group === row.accountId)
          ?.allocationPercentage ?? null,
    }))
  }

  filterHoldings(
    holdings: PortfolioHoldingEvidence[],
    filters: PortfolioHoldingFilters
  ): PortfolioHoldingEvidence[] {
    const query = filters.search.trim().toLocaleLowerCase()
    const filtered = holdings.filter(
      (holding) =>
        (!query ||
          holding.assetName.toLocaleLowerCase().includes(query) ||
          holding.symbol?.toLocaleLowerCase().includes(query)) &&
        (!filters.accountId || holding.accountId === filters.accountId) &&
        (!filters.assetClass || holding.assetClass === filters.assetClass) &&
        (!filters.contributorIds || filters.contributorIds.has(holding.id))
    )
    return filtered
      .map((holding, index) => ({ holding, index }))
      .sort((left, right) => {
        const { sort } = filters
        const text =
          sort === "asset"
            ? left.holding.assetName.localeCompare(right.holding.assetName)
            : sort === "account"
              ? left.holding.accountName.localeCompare(
                  right.holding.accountName
                )
              : null
        const numeric =
          sort === "quantity"
            ? compareDecimals(left.holding.quantity, right.holding.quantity)
            : sort === "average_cost"
              ? this.compareNullable(
                  left.holding.averageCost,
                  right.holding.averageCost
                )
              : sort === "cost_basis"
                ? compareDecimals(
                    left.holding.totalCostBasis,
                    right.holding.totalCostBasis
                  )
                : sort === "current_price"
                  ? this.compareNullable(
                      left.holding.currentPrice,
                      right.holding.currentPrice
                    )
                  : sort === "market_value"
                    ? this.compareNullable(
                        left.holding.marketValueBase,
                        right.holding.marketValueBase
                      )
                    : sort === "gain_loss"
                      ? this.compareNullable(
                          left.holding.unrealizedGainLossBase,
                          right.holding.unrealizedGainLossBase
                        )
                      : sort === "return"
                        ? this.compareNullable(
                            left.holding.returnPercent,
                            right.holding.returnPercent
                          )
                        : null
        const result = text ?? numeric ?? 0
        return result === 0
          ? left.index - right.index
          : filters.direction === "asc"
            ? result
            : -result
      })
      .map(({ holding }) => holding)
  }

  filterActivity(
    activity: PortfolioActivityItem[],
    filters: PortfolioActivityFilters
  ): PortfolioActivityItem[] {
    return activity.filter(
      (item) =>
        (!filters.type || item.type === filters.type) &&
        (!filters.accountId || item.accountIds.includes(filters.accountId)) &&
        (!filters.assetIds ||
          item.assetIds.some((assetId) => filters.assetIds?.has(assetId)))
    )
  }

  private compareNullable(left: Decimal | null, right: Decimal | null): number {
    if (left === right) return 0
    if (left === null) return 1
    if (right === null) return -1
    return compareDecimals(left, right) ?? 0
  }
}

export const portfolioEvidenceService = new PortfolioEvidenceService()
