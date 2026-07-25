import {
  addDecimals,
  compareDecimals,
  multiplyDecimals,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"
import {
  ExchangeRateError,
  exchangeRateService,
} from "@/services/exchange-rates"
import type {
  MissingCurrencyPair,
  NetWorthResult,
  NetWorthSourceData,
} from "@/features/net-worth/types/net-worth"

interface CurrentRateResolver {
  resolveCurrentRate(pair: {
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }): Promise<{ rate: Decimal }>
}

function requireDecimal(value: Decimal | null, message: string): Decimal {
  if (value === null) throw new Error(message)
  return value
}

export class NetWorthService {
  private readonly rates: CurrentRateResolver

  constructor(rates: CurrentRateResolver = exchangeRateService) {
    this.rates = rates
  }

  async calculate(source: NetWorthSourceData): Promise<NetWorthResult> {
    if (source.accounts.length === 0) {
      const portfolioValue =
        source.portfolio?.totalMarketValueBase ?? "0"
      const hasInvestments =
        (source.portfolio?.holdings.length ?? 0) > 0
      const hasMissingPortfolioData =
        source.portfolio !== undefined &&
        source.portfolio.completenessStatus !== "complete"
      return {
        status: hasMissingPortfolioData
          ? "partial"
          : hasInvestments
            ? "success"
            : "empty",
        totalAssets: portfolioValue,
        cashAssets: "0",
        investmentAssets: portfolioValue,
        totalLiabilities: "0",
        netWorth: portfolioValue,
        accountCount: 0,
        investmentHoldingCount:
          source.portfolio?.valuedHoldingsCount ?? 0,
        baseCurrency: source.baseCurrency,
        missingCurrencyPairs:
          source.portfolio?.missingExchangeRatePairs ?? [],
        missingPriceHoldings:
          source.portfolio?.missingPriceHoldings ?? [],
      }
    }

    const missingCurrencyPairs: MissingCurrencyPair[] = []
    const convertedBalances = await Promise.all(
      source.accounts.map(async (account) => {
        const balanceComparison = compareDecimals(account.balance, "0")
        if (balanceComparison === null) {
          throw new Error(`Cash account ${account.accountId} has an invalid balance`)
        }

        if (account.currencyCode === source.baseCurrency) {
          return account.balance
        }

        try {
          const resolved = await this.rates.resolveCurrentRate({
            sourceCurrencyCode: account.currencyCode,
            destinationCurrencyCode: source.baseCurrency,
          })
          return requireDecimal(
            multiplyDecimals(account.balance, resolved.rate),
            `Cash account ${account.accountId} could not be converted`,
          )
        } catch (error) {
          if (error instanceof ExchangeRateError && error.code === "rate_unavailable") {
            missingCurrencyPairs.push({
              sourceCurrencyCode: account.currencyCode,
              destinationCurrencyCode: source.baseCurrency,
            })
            return null
          }
          throw error
        }
      }),
    )

    const totalCash = convertedBalances.reduce<Decimal>(
      (total, balance) =>
        requireDecimal(
          addDecimals(total, balance ?? "0"),
          "Cash balances could not be aggregated",
        ),
      "0",
    )
    const portfolioValue =
      source.portfolio?.totalMarketValueBase ?? "0"
    const totalAssets = requireDecimal(
      addDecimals(totalCash, portfolioValue),
      "Cash and investment values could not be aggregated",
    )
    const totalLiabilities: Decimal = "0"
    const netWorth = requireDecimal(
      subtractDecimals(totalAssets, totalLiabilities),
      "Net worth could not be calculated",
    )

    const portfolioMissingPairs =
      source.portfolio?.missingExchangeRatePairs ?? []
    const allMissingPairs = [
      ...missingCurrencyPairs,
      ...portfolioMissingPairs,
    ].filter(
      (pair, index, pairs) =>
        pairs.findIndex(
          (candidate) =>
            candidate.sourceCurrencyCode === pair.sourceCurrencyCode &&
            candidate.destinationCurrencyCode ===
              pair.destinationCurrencyCode,
        ) === index,
    )
    const missingPriceHoldings =
      source.portfolio?.missingPriceHoldings ?? []
    const isPartial =
      allMissingPairs.length > 0 || missingPriceHoldings.length > 0

    return {
      status: isPartial ? "partial" : "success",
      totalAssets,
      cashAssets: totalCash,
      investmentAssets: portfolioValue,
      totalLiabilities,
      netWorth,
      accountCount: source.accounts.length,
      investmentHoldingCount:
        source.portfolio?.valuedHoldingsCount ?? 0,
      baseCurrency: source.baseCurrency,
      missingCurrencyPairs: allMissingPairs,
      missingPriceHoldings,
    }
  }
}

export const netWorthService = new NetWorthService()
