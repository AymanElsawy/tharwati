import { accountBalancesService } from "@/features/account-balances/services/account-balances.service"
import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import {
  dashboardRepository,
  type DashboardRepositoryContract,
  type DashboardPostedTransaction,
} from "@/features/dashboard/repositories/dashboard.repository"
import type {
  DashboardAllocationGroup,
  DashboardViewModel,
} from "@/features/dashboard/types/dashboard"
import { netWorthService } from "@/features/net-worth/services/net-worth.service"
import type { NetWorthService } from "@/features/net-worth/services/net-worth.service"
import { portfolioValuationRepository } from "@/features/portfolio-valuation/repositories/portfolio-valuation.repository"
import { portfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"
import type {
  PortfolioValuationRepositoryContract,
  PortfolioValuationResult,
} from "@/features/portfolio-valuation/types/portfolio-valuation"
import {
  calculateGroupedMarketValueAllocation,
  compareDecimals,
} from "@/lib/financial-calculations"
import type { TableRow } from "@/lib/supabase/types"
import { exchangeRateService } from "@/services/exchange-rates"
import type { StoredExchangeRate } from "@/services/exchange-rates/repository"

interface AccountBalanceReader {
  getEligibleWealthCashBalances(): Promise<AccountBalance[]>
}

interface PortfolioValuationCalculator {
  calculate(
    source: Awaited<
      ReturnType<PortfolioValuationRepositoryContract["getSource"]>
    >,
  ): Promise<PortfolioValuationResult>
}

interface ExchangeRateReader {
  listRates(): Promise<StoredExchangeRate[]>
}

function allocationGroup(assetType: string): DashboardAllocationGroup {
  if (assetType === "stock") return "stocks"
  if (assetType === "etf") return "etfs"
  return "other"
}

function transactionTitle(transaction: TableRow<"financial_transactions">) {
  const titles: Record<string, string> = {
    buy: "Investment purchased",
    deposit: "Deposit posted",
    withdrawal: "Withdrawal posted",
    fee: "Fee posted",
  }
  return titles[transaction.transaction_type_code] ?? transaction.description
}

export class DashboardService {
  private readonly balances: AccountBalanceReader
  private readonly portfolioRepository: PortfolioValuationRepositoryContract
  private readonly portfolioCalculator: PortfolioValuationCalculator
  private readonly netWorthCalculator: Pick<NetWorthService, "calculate">
  private readonly activities: DashboardRepositoryContract
  private readonly rates: ExchangeRateReader

  constructor(
    balances: AccountBalanceReader = accountBalancesService,
    portfolioRepository: PortfolioValuationRepositoryContract =
      portfolioValuationRepository,
    portfolioCalculator: PortfolioValuationCalculator =
      portfolioValuationService,
    netWorthCalculator: Pick<NetWorthService, "calculate"> =
      netWorthService,
    activities: DashboardRepositoryContract = dashboardRepository,
    rates: ExchangeRateReader = exchangeRateService,
  ) {
    this.balances = balances
    this.portfolioRepository = portfolioRepository
    this.portfolioCalculator = portfolioCalculator
    this.netWorthCalculator = netWorthCalculator
    this.activities = activities
    this.rates = rates
  }

  async load(): Promise<DashboardViewModel> {
    const [cashAccounts, portfolioSource, transactions, rates] =
      await Promise.all([
        this.balances.getEligibleWealthCashBalances(),
        this.portfolioRepository.getSource(),
        this.activities.getRecentPostedTransactions(),
        this.rates.listRates(),
      ])
    const portfolio =
      await this.portfolioCalculator.calculate(portfolioSource)
    const netWorth = await this.netWorthCalculator.calculate({
      baseCurrency: portfolioSource.baseCurrency,
      accounts: cashAccounts.map((account) => ({
        accountId: account.accountId,
        balance: account.currentBalance,
        currencyCode: account.currencyCode,
      })),
      portfolio,
    })
    const allocationInputs = [
      ...(compareDecimals(netWorth.cashAssets, "0") === 1
        ? [
            {
              group: "cash",
              marketValue: netWorth.cashAssets,
              currencyCode: netWorth.baseCurrency,
            },
          ]
        : []),
      ...portfolio.holdings.flatMap((holding) =>
        holding.marketValueBase === null
          ? []
          : [
              {
                group: allocationGroup(holding.assetType),
                marketValue: holding.marketValueBase,
                currencyCode: portfolio.baseCurrency,
              },
            ],
      ),
    ]
    const allocation =
      allocationInputs.length === 0
        ? []
        : calculateGroupedMarketValueAllocation(
            allocationInputs,
          ).allocations.map((item) => ({
            group: item.group as DashboardAllocationGroup,
            marketValue: item.marketValue,
            percentage: item.allocationPercentage,
          }))
    const transactionActivities = transactions.flatMap(
      (transaction: DashboardPostedTransaction) => [
        {
          id: transaction.id,
          kind: "transaction" as const,
          type: transaction.transaction_type_code,
          title: transactionTitle(transaction),
          description: transaction.description,
          occurredAt: transaction.occurred_at,
        },
        ...transaction.transaction_entries
          .filter((entry) => entry.memo === "investment_fee")
          .map((entry) => ({
            id: `fee-${entry.id}`,
            kind: "transaction" as const,
            type: "fee",
            title: "Investment fee",
            description: transaction.description,
            occurredAt: transaction.occurred_at,
          })),
      ],
    )
    const rateActivities = rates.slice(0, 3).map((rate) => ({
      id: `rate-${rate.id}`,
      kind: "exchange_rate" as const,
      type: "exchange_rate",
      title: "Exchange rate updated",
      description: `${rate.base_currency_code}/${rate.quote_currency_code}`,
      occurredAt: rate.updated_at,
    }))
    const activities = [...transactionActivities, ...rateActivities]
      .sort((left, right) =>
        right.occurredAt.localeCompare(left.occurredAt),
      )
      .slice(0, 8)

    return {
      baseCurrency: portfolio.baseCurrency,
      netWorth,
      cash: {
        projectedBalanceBase: netWorth.cashAssets,
        accountCount: cashAccounts.length,
        currencyCode: netWorth.baseCurrency,
        isPartial: netWorth.status === "partial",
      },
      investments: {
        marketValueBase: portfolio.totalMarketValueBase,
        unrealizedGainLossBase:
          portfolio.totalUnrealizedGainLossBase,
        unrealizedReturnPercent:
          portfolio.totalUnrealizedReturnPercent,
        holdingsCount: portfolio.valuedHoldingsCount,
        currencyCode: portfolio.baseCurrency,
      },
      allocation,
      performance: {
        marketValueBase: portfolio.totalMarketValueBase,
        unrealizedGainLossBase:
          portfolio.totalUnrealizedGainLossBase,
        unrealizedReturnPercent:
          portfolio.totalUnrealizedReturnPercent,
        isHistorical: false,
      },
      activities,
      missingData: {
        priceHoldings: portfolio.missingPriceHoldings,
        exchangeRatePairs: [
          ...new Map(
            [
              ...portfolio.missingExchangeRatePairs,
              ...netWorth.missingCurrencyPairs,
            ].map((pair) => [
              `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`,
              pair,
            ]),
          ).values(),
        ],
      },
      isEmpty:
        cashAccounts.length === 0 &&
        portfolio.holdings.length === 0 &&
        transactions.length === 0,
    }
  }
}

export const dashboardService = new DashboardService()
