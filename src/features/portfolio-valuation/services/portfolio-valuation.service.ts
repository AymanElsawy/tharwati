import type {
  HoldingValuationResult,
  FxRateMetadata,
  MissingExchangeRatePair,
  PortfolioValuationResult,
  PortfolioValuationSource,
} from "@/features/portfolio-valuation/types/portfolio-valuation"
import {
  calculateHoldingMarketValue,
  calculateHoldingPerformance,
} from "@/lib/financial-calculations"
import {
  addDecimals,
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"
import {
  ExchangeRateError,
  exchangeRateService,
} from "@/services/exchange-rates"
import type { CurrentExchangeRate } from "@/services/exchange-rates/types"
import {
  MarketDataError,
  marketDataService,
} from "@/services/market-data"
import type { CurrentMarketPrice } from "@/services/market-data/types"

interface PriceReader {
  getCurrentPrice(assetId: string): Promise<CurrentMarketPrice>
}

interface RateReader {
  resolveCurrentRate(pair: {
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }): Promise<CurrentExchangeRate>
}

function requireDecimal(value: Decimal | null, message: string): Decimal {
  if (value === null) throw new Error(message)
  return value
}

function pairKey(pair: MissingExchangeRatePair) {
  return `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`
}

export class PortfolioValuationService {
  private readonly prices: PriceReader
  private readonly rates: RateReader
  private readonly now: () => Date

  constructor(options: {
    prices?: PriceReader
    rates?: RateReader
    now?: () => Date
  } = {}) {
    this.prices = options.prices ?? marketDataService
    this.rates = options.rates ?? exchangeRateService
    this.now = options.now ?? (() => new Date())
  }

  async calculate(
    source: PortfolioValuationSource,
  ): Promise<PortfolioValuationResult> {
    const holdings = await Promise.all(
      source.holdings.map((holding) =>
        this.valueHolding(holding, source.baseCurrency),
      ),
    )
    const missingPriceHoldings = holdings
      .filter((holding) => holding.missingMarketPrice)
      .map((holding) => ({
        holdingId: holding.holdingId,
        assetId: holding.assetId,
        assetName: holding.assetName,
        symbol: holding.symbol,
      }))
    const missingPairs = new Map<string, MissingExchangeRatePair>()
    const fxRates = new Map<string, FxRateMetadata>()
    for (const holding of holdings) {
      for (const pair of holding.missingExchangeRate) {
        missingPairs.set(pairKey(pair), pair)
      }
      for (const rate of holding.fxRates ?? []) fxRates.set(pairKey(rate), rate)
    }
    const marketValued = holdings.filter(
      (holding) => holding.marketValueBase !== null,
    )
    const performanceValued = holdings.filter(
      (holding) =>
        holding.marketValueBase !== null &&
        holding.costBasisBase !== null,
    )
    const totalMarketValueBase = this.sumAvailable(
      holdings
        .filter((holding) => holding.marketValueBase !== null)
        .map((holding) => holding.marketValueBase),
    )
    const totalCostBasisBase = this.sumAvailable(
      holdings
        .filter((holding) => holding.costBasisBase !== null)
        .map((holding) => holding.costBasisBase),
    )
    const totalUnrealizedGainLossBase = this.sumAvailable(
      performanceValued.map(
        (holding) => holding.unrealizedGainLossBase,
      ),
    )
    const valuedCostBasis = this.sumAvailable(
      performanceValued.map((holding) => holding.costBasisBase),
    )
    const totalUnrealizedReturnPercent =
      valuedCostBasis !== null &&
      compareDecimals(valuedCostBasis, "0") === 1 &&
      totalUnrealizedGainLossBase !== null
        ? requireDecimal(
            multiplyDecimals(
              requireDecimal(
                divideDecimals(
                  totalUnrealizedGainLossBase,
                  valuedCostBasis,
                ),
                "Unable to calculate portfolio return",
              ),
              "100",
            ),
            "Unable to calculate portfolio return",
          )
        : null

    const hasMissing =
      missingPriceHoldings.length > 0 || missingPairs.size > 0
    return {
      baseCurrency: source.baseCurrency,
      holdings,
      totalMarketValueBase:
        source.holdings.length === 0 ? "0" : totalMarketValueBase,
      totalCostBasisBase:
        source.holdings.length === 0 ? "0" : totalCostBasisBase,
      totalUnrealizedGainLossBase:
        source.holdings.length === 0
          ? "0"
          : totalUnrealizedGainLossBase,
      totalUnrealizedReturnPercent,
      valuedHoldingsCount: marketValued.length,
      missingPriceHoldings,
      missingExchangeRatePairs: [...missingPairs.values()],
      fxRates: [...fxRates.values()],
      completenessStatus: hasMissing
        ? marketValued.length > 0
          ? "partial"
          : "unavailable"
        : "complete",
    }
  }

  private async valueHolding(
    holding: PortfolioValuationSource["holdings"][number],
    baseCurrency: string,
  ): Promise<HoldingValuationResult> {
    const missingExchangeRate: MissingExchangeRatePair[] = []
    const fxRates: FxRateMetadata[] = []
    let price: CurrentMarketPrice | null = null
    try {
      price = await this.prices.getCurrentPrice(holding.asset.id)
    } catch (cause) {
      if (
        cause instanceof MarketDataError &&
        (cause.code === "market_price_unavailable" ||
          cause.code === "unsupported_asset_type")
      ) {
        // Missing and unsupported prices remain explicit null valuation inputs.
      } else {
        throw cause
      }
    }

    const base = {
      id: holding.id,
      quantity: holding.quantity,
      averageCost: holding.average_cost,
      totalCostBasis: holding.total_cost_basis,
      costCurrencyCode: holding.cost_currency_code,
    }
    const costBasisBase = await this.convert(
      holding.total_cost_basis,
      holding.cost_currency_code,
      baseCurrency,
      missingExchangeRate,
      fxRates,
    )
    let marketValueNative: Decimal | null = null
    let gainNative: Decimal | null = null
    let returnPercent: Decimal | null = null
    let marketValueBase: Decimal | null = null
    let gainBase: Decimal | null = null

    if (price) {
      const priceCurrencyValuation = calculateHoldingMarketValue({
        ...base,
        costCurrencyCode: price.currencyCode,
        marketPrice: {
          price: price.price,
          currencyCode: price.currencyCode,
          asOf: price.asOf,
        },
      })
      marketValueBase = await this.convert(
        priceCurrencyValuation.marketValue,
        price.currencyCode,
        baseCurrency,
        missingExchangeRate,
        fxRates,
      )
      const nativeUnitPrice = await this.convert(
        price.price,
        price.currencyCode,
        holding.cost_currency_code,
        missingExchangeRate,
        fxRates,
      )
      if (nativeUnitPrice !== null) {
        const nativeInput = {
          ...base,
          marketPrice: {
            price: nativeUnitPrice,
            currencyCode: holding.cost_currency_code,
            asOf: price.asOf,
          },
        }
        marketValueNative =
          calculateHoldingMarketValue(nativeInput).marketValue
        gainNative = requireDecimal(
          subtractDecimals(
            marketValueNative,
            holding.total_cost_basis,
          ),
          "Unable to calculate holding gain/loss",
        )
        if (compareDecimals(holding.total_cost_basis, "0") === 1) {
          returnPercent =
            calculateHoldingPerformance(
              nativeInput,
            ).unrealizedReturnPercentage
        }
      }
      if (marketValueBase !== null && costBasisBase !== null) {
        gainBase = requireDecimal(
          subtractDecimals(marketValueBase, costBasisBase),
          "Unable to calculate base-currency gain/loss",
        )
      }
    }

    return {
      holdingId: holding.id,
      assetId: holding.asset.id,
      symbol: holding.asset.symbol,
      assetName: holding.asset.name,
      assetType: holding.asset.asset_type_code,
      quantity: holding.quantity,
      averageCost: holding.average_cost,
      costBasisNative: holding.total_cost_basis,
      costBasisCurrency: holding.cost_currency_code,
      marketPrice: price?.price ?? null,
      marketPriceCurrency: price?.currencyCode ?? null,
      marketPriceTimestamp: price?.asOf ?? null,
      marketPriceSource: price?.provider ?? null,
      marketValueNative,
      unrealizedGainLossNative: gainNative,
      unrealizedReturnPercent: returnPercent,
      marketValueBase,
      costBasisBase,
      unrealizedGainLossBase: gainBase,
      baseCurrency,
      missingMarketPrice: price === null,
      missingExchangeRate,
      fxRates,
      stalePrice: price
        ? this.now().getTime() - new Date(price.asOf).getTime() >
          24 * 60 * 60 * 1000
        : null,
    }
  }

  private async convert(
    value: Decimal,
    sourceCurrencyCode: string,
    destinationCurrencyCode: string,
    missing: MissingExchangeRatePair[],
    fxRates: FxRateMetadata[] = [],
  ): Promise<Decimal | null> {
    if (sourceCurrencyCode === destinationCurrencyCode) return value
    const pair = { sourceCurrencyCode, destinationCurrencyCode }
    try {
      const resolved = await this.rates.resolveCurrentRate(pair)
      if (!fxRates.some((item) => pairKey(item) === pairKey(pair))) {
        fxRates.push({
          ...pair,
          provider: resolved.source,
          effectiveAt: resolved.effectiveAt,
          fetchedAt: resolved.fetchedAt ?? null,
          stale: resolved.stale ?? false,
        })
      }
      return requireDecimal(
        multiplyDecimals(value, resolved.rate),
        `Unable to convert ${pairKey(pair)}`,
      )
    } catch (cause) {
      if (
        cause instanceof ExchangeRateError &&
        cause.code === "rate_unavailable"
      ) {
        if (!missing.some((item) => pairKey(item) === pairKey(pair))) {
          missing.push(pair)
        }
        return null
      }
      throw cause
    }
  }

  private sumAvailable(values: Array<Decimal | null>): Decimal | null {
    if (values.length === 0) return null
    return values.reduce<Decimal>(
      (total, value) =>
        requireDecimal(
          addDecimals(total, value ?? "0"),
          "Unable to aggregate portfolio values",
        ),
      "0",
    )
  }
}

export const portfolioValuationService =
  new PortfolioValuationService()
