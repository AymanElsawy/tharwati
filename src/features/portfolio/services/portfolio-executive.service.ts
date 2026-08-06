import { accountBalancesService } from "@/features/account-balances/services/account-balances.service"
import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import { generateWealthInsights } from "@/features/insights/engine/wealth-insight.engine"
import type { WealthInsightSnapshot } from "@/features/insights/types/wealth-insight"
import { netWorthService } from "@/features/net-worth/services/net-worth.service"
import { portfolioValuationRepository } from "@/features/portfolio-valuation/repositories/portfolio-valuation.repository"
import { portfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"
import { portfolioAnalysisService } from "@/features/portfolio/services/portfolio-analysis.service"
import { portfolioEvidenceService } from "@/features/portfolio/services/portfolio-evidence.service"
import {
  dashboardRepository,
  type DashboardRepositoryContract,
} from "@/features/dashboard/repositories/dashboard.repository"
import type {
  HoldingValuationResult,
  PortfolioValuationRepositoryContract,
  PortfolioValuationResult,
  PortfolioValuationSource,
} from "@/features/portfolio-valuation/types/portfolio-valuation"
import type {
  PortfolioExecutiveViewModel,
  PortfolioHealthFactor,
  PortfolioHealthStatus,
  PortfolioScopeOption,
} from "@/features/portfolio/types/portfolio-executive"
import {
  calculateGroupedMarketValueAllocation,
  compareDecimals,
} from "@/lib/financial-calculations"
import type { GroupedMarketValueAllocation } from "@/lib/financial-calculations/types"
import type { Decimal } from "@/lib/supabase/types"

interface AccountBalanceReader {
  getEligibleWealthCashBalances(): Promise<AccountBalance[]>
}

interface PortfolioCalculator {
  calculate(source: PortfolioValuationSource): Promise<PortfolioValuationResult>
}

interface NetWorthCalculator {
  calculate(source: {
    baseCurrency: string
    accounts: Array<{
      accountId: string
      balance: Decimal
      currencyCode: string
    }>
    portfolio: PortfolioValuationResult
  }): Promise<{
    cashAssets: Decimal
    missingCurrencyPairs?: Array<{
      sourceCurrencyCode: string
      destinationCurrencyCode: string
    }>
  }>
}

type Allocation = {
  allocations: GroupedMarketValueAllocation[]
}

function findAllocation(allocation: Allocation | null, group: string): Decimal {
  return (
    allocation?.allocations.find((item) => item.group === group)
      ?.allocationPercentage ?? "0"
  )
}

function largestAllocation(
  allocation: Allocation | null
): GroupedMarketValueAllocation | null {
  if (!allocation || allocation.allocations.length === 0) return null
  return allocation.allocations.reduce((largest, current) =>
    compareDecimals(
      current.allocationPercentage,
      largest.allocationPercentage
    ) === 1
      ? current
      : largest
  )
}

function allocationFor(
  inputs: Array<{
    group: string
    marketValue: Decimal
    currencyCode: string
  }>
): Allocation | null {
  return inputs.length === 0
    ? null
    : calculateGroupedMarketValueAllocation(inputs)
}

function scoreStatus(score: number): PortfolioHealthFactor["status"] {
  if (score >= 80) return "good"
  if (score >= 60) return "info"
  return "warning"
}

function thresholdScore(
  value: Decimal,
  healthyMaximum: Decimal,
  warningMaximum: Decimal
): number {
  if (compareDecimals(value, healthyMaximum) !== 1) return 90
  if (compareDecimals(value, warningMaximum) !== 1) return 65
  return 40
}

function overallHealthStatus(score: number): PortfolioHealthStatus {
  if (score >= 85) return "strong"
  if (score >= 70) return "healthy"
  if (score >= 50) return "needs_attention"
  return "at_risk"
}

function uniqueScopes(
  source: PortfolioValuationSource
): PortfolioScopeOption[] {
  const scopes = new Map<string, PortfolioScopeOption>()
  for (const holding of source.holdings) {
    scopes.set(holding.account.id, {
      id: holding.account.id,
      name: holding.account.name,
    })
  }
  return [...scopes.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

function latestTimestamp(holdings: HoldingValuationResult[]): string {
  return (
    holdings
      .flatMap((holding) =>
        holding.marketPriceTimestamp ? [holding.marketPriceTimestamp] : []
      )
      .sort((left, right) => right.localeCompare(left))[0] ??
    new Date().toISOString()
  )
}

export class PortfolioExecutiveService {
  private readonly portfolioRepository: PortfolioValuationRepositoryContract
  private readonly portfolioCalculator: PortfolioCalculator
  private readonly balances: AccountBalanceReader
  private readonly netWorthCalculator: NetWorthCalculator
  private readonly activities: DashboardRepositoryContract

  constructor(
    portfolioRepository: PortfolioValuationRepositoryContract = portfolioValuationRepository,
    portfolioCalculator: PortfolioCalculator = portfolioValuationService,
    balances: AccountBalanceReader = accountBalancesService,
    netWorthCalculator: NetWorthCalculator = netWorthService,
    activities: DashboardRepositoryContract = dashboardRepository
  ) {
    this.portfolioRepository = portfolioRepository
    this.portfolioCalculator = portfolioCalculator
    this.balances = balances
    this.netWorthCalculator = netWorthCalculator
    this.activities = activities
  }

  async load(
    activeScopeId: string | null = null
  ): Promise<PortfolioExecutiveViewModel> {
    const [source, allBalances, recentActivity] = await Promise.all([
      this.portfolioRepository.getSource(),
      this.balances.getEligibleWealthCashBalances(),
      this.activities.getRecentPostedTransactions(40),
    ])
    const scopeOptions = uniqueScopes(source)
    const scopedHoldings = activeScopeId
      ? source.holdings.filter(
          (holding) => holding.account.id === activeScopeId
        )
      : source.holdings
    const scopedBalances = activeScopeId
      ? allBalances.filter((balance) => balance.accountId === activeScopeId)
      : allBalances
    const valuation = await this.portfolioCalculator.calculate({
      baseCurrency: source.baseCurrency,
      holdings: scopedHoldings,
    })
    const netWorth = await this.netWorthCalculator.calculate({
      baseCurrency: source.baseCurrency,
      accounts: scopedBalances.map((account) => ({
        accountId: account.accountId,
        balance: account.currentBalance,
        currencyCode: account.currencyCode,
      })),
      portfolio: valuation,
    })
    const perAccountCash = await Promise.all(
      scopedBalances.map(async (account) => {
        const result = await this.netWorthCalculator.calculate({
          baseCurrency: source.baseCurrency,
          accounts: [
            {
              accountId: account.accountId,
              balance: account.currentBalance,
              currencyCode: account.currencyCode,
            },
          ],
          portfolio: {
            baseCurrency: source.baseCurrency,
            holdings: [],
            totalMarketValueBase: "0",
            totalCostBasisBase: "0",
            totalUnrealizedGainLossBase: "0",
            totalUnrealizedReturnPercent: null,
            valuedHoldingsCount: 0,
            missingPriceHoldings: [],
            missingExchangeRatePairs: [],
            completenessStatus: "complete",
          },
        })
        return [
          account.accountId,
          (result.missingCurrencyPairs?.length ?? 0) > 0
            ? null
            : result.cashAssets,
        ] as const
      })
    )

    const valuedHoldings = valuation.holdings.filter(
      (
        holding
      ): holding is HoldingValuationResult & {
        marketValueBase: Decimal
      } => holding.marketValueBase !== null
    )
    const categoryAllocation = allocationFor([
      ...(compareDecimals(netWorth.cashAssets, "0") === 1
        ? [
            {
              group: "cash",
              marketValue: netWorth.cashAssets,
              currencyCode: source.baseCurrency,
            },
          ]
        : []),
      ...valuedHoldings.map((holding) => ({
        group: holding.assetType,
        marketValue: holding.marketValueBase,
        currencyCode: source.baseCurrency,
      })),
    ])
    const holdingAllocation = allocationFor(
      valuedHoldings.map((holding) => ({
        group: holding.holdingId,
        marketValue: holding.marketValueBase,
        currencyCode: source.baseCurrency,
      }))
    )
    const currencyAllocation = allocationFor(
      valuedHoldings.map((holding) => ({
        group:
          holding.marketPriceCurrency?.toUpperCase() ??
          holding.costBasisCurrency.toUpperCase(),
        marketValue: holding.marketValueBase,
        currencyCode: source.baseCurrency,
      }))
    )
    const largestHolding = largestAllocation(holdingAllocation)
    const largestCategory = largestAllocation(categoryAllocation)
    const largestCurrency = largestAllocation(currencyAllocation)
    const largestHoldingDetails = largestHolding
      ? valuation.holdings.find(
          (holding) => holding.holdingId === largestHolding.group
        )
      : null
    const cashPercent = findAllocation(categoryAllocation, "cash")
    const categoryCount =
      categoryAllocation?.allocations.filter(
        (allocation) => allocation.group !== "cash"
      ).length ?? 0
    const diversificationScore =
      categoryCount >= 4
        ? 90
        : categoryCount === 3
          ? 80
          : categoryCount === 2
            ? 60
            : 35
    const concentrationScore = largestHolding
      ? thresholdScore(largestHolding.allocationPercentage, "25", "40")
      : 0
    const allocationScore = largestCategory
      ? thresholdScore(largestCategory.allocationPercentage, "45", "65")
      : 0
    const cashScore =
      compareDecimals(netWorth.cashAssets, "0") === -1
        ? 30
        : compareDecimals(cashPercent, "40") === 1
          ? 45
          : compareDecimals(cashPercent, "30") === 1
            ? 65
            : 90
    const currencyScore = largestCurrency
      ? thresholdScore(largestCurrency.allocationPercentage, "50", "70")
      : 0
    const missingDataScore =
      valuation.completenessStatus === "complete"
        ? 100
        : valuation.completenessStatus === "partial"
          ? 45
          : 10
    const factorScores = [
      ["diversification", diversificationScore],
      ["concentration", concentrationScore],
      ["allocation", allocationScore],
      ["cash", cashScore],
      ["currency", currencyScore],
      ["missing_data", missingDataScore],
    ] as const
    const factors: PortfolioHealthFactor[] = factorScores.map(
      ([id, score]) => ({
        id,
        score,
        status: scoreStatus(score),
      })
    )
    const healthScore =
      scopedHoldings.length === 0
        ? null
        : Math.round(
            factors.reduce((total, factor) => total + factor.score, 0) /
              factors.length
          )

    const insightSnapshot: WealthInsightSnapshot = {
      allocation: {
        cashPercent,
        preferredCashMaximumPercent: "30",
      },
      ...(largestHolding && largestHoldingDetails
        ? {
            concentration: {
              holdingName: largestHoldingDetails.assetName,
              holdingPercent: largestHolding.allocationPercentage,
              warningThresholdPercent: "25",
            },
          }
        : {}),
      ...(largestCurrency
        ? {
            currencyExposure: {
              currencyCode: largestCurrency.group,
              exposurePercent: largestCurrency.allocationPercentage,
              warningThresholdPercent: "60",
            },
          }
        : {}),
      missingData: {
        missingPriceCount: valuation.missingPriceHoldings.length,
        missingExchangeRateCount: valuation.missingExchangeRatePairs.length,
      },
    }
    const analysisHoldings = valuation.holdings.map((holding) => {
      const sourceHolding = scopedHoldings.find(
        (candidate) => candidate.id === holding.holdingId
      )
      if (!sourceHolding) {
        throw new Error("Unable to resolve portfolio analysis holding")
      }
      return {
        id: holding.holdingId,
        assetClass: holding.assetType,
        accountId: sourceHolding.account.id,
        currencyCode:
          holding.marketPriceCurrency?.toUpperCase() ??
          holding.costBasisCurrency.toUpperCase(),
        marketValueBase: holding.marketValueBase,
        name: holding.assetName,
        symbol: holding.symbol,
        missingMarketPrice: holding.missingMarketPrice,
      }
    })
    const accountNames = new Map(
      scopedHoldings.map((holding) => [
        holding.account.id,
        holding.account.name,
      ])
    )
    const evidenceHoldings = portfolioEvidenceService.buildHoldings(
      scopedHoldings,
      valuation.holdings
    )

    return {
      baseCurrency: source.baseCurrency,
      scopeOptions,
      activeScopeId,
      updatedAt: latestTimestamp(valuation.holdings),
      completenessStatus: valuation.completenessStatus,
      isEmpty: scopedHoldings.length === 0,
      value: {
        marketValue: valuation.totalMarketValueBase,
        costBasis: valuation.totalCostBasisBase,
        unrealizedGainLoss: valuation.totalUnrealizedGainLossBase,
        unrealizedReturnPercent: valuation.totalUnrealizedReturnPercent,
        performanceDirection:
          valuation.totalUnrealizedGainLossBase === null
            ? "unavailable"
            : compareDecimals(valuation.totalUnrealizedGainLossBase, "0") === 1
              ? "positive"
              : compareDecimals(valuation.totalUnrealizedGainLossBase, "0") ===
                  -1
                ? "negative"
                : "neutral",
        openHoldingsCount: scopedHoldings.length,
        valuedHoldingsCount: valuation.valuedHoldingsCount,
      },
      health: {
        score: healthScore,
        status:
          healthScore === null
            ? "unavailable"
            : overallHealthStatus(healthScore),
        factors,
      },
      insights: generateWealthInsights(insightSnapshot),
      missingData: {
        priceCount: valuation.missingPriceHoldings.length,
        exchangeRateCount: valuation.missingExchangeRatePairs.length,
      },
      analysis: portfolioAnalysisService.build({
        holdings: analysisHoldings,
        baseCurrency: source.baseCurrency,
        cashValue: netWorth.cashAssets,
        accountNames,
        partial: valuation.completenessStatus !== "complete",
      }),
      evidence: {
        holdings: evidenceHoldings,
        custody: portfolioEvidenceService.buildCustody({
          holdings: evidenceHoldings,
          balances: scopedBalances,
          cashBase: new Map(perAccountCash),
          baseCurrency: source.baseCurrency,
        }),
        activity: portfolioEvidenceService
          .buildActivity(recentActivity)
          .filter(
            (item) => !activeScopeId || item.accountIds.includes(activeScopeId)
          ),
      },
    }
  }
}

export const portfolioExecutiveService = new PortfolioExecutiveService()
