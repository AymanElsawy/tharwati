import type { Decimal } from "../supabase/types"
import {
  addDecimals,
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
  normalizeDecimal,
  subtractDecimals,
} from "./decimal"
import { calculateHoldingFinancials } from "./holdings"
import type {
  HoldingAllocation,
  HoldingMarketValue,
  HoldingPerformance,
  HoldingValuationInput,
  GroupedMarketValueInput,
  GroupedPortfolioAllocation,
  PortfolioAllocation,
  PortfolioMarketValue,
  PortfolioPerformance,
} from "./types"
import { FinancialCalculationError } from "./types"

const percentageMultiplier = "100"

function requireDecimal(
  value: Decimal | null,
  message: string,
): Decimal {
  if (value === null) {
    throw new FinancialCalculationError(
      "invalid_cost_basis",
      message,
    )
  }
  return value
}

function normalizeCurrency(currencyCode: string): string {
  const currency = currencyCode.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new FinancialCalculationError(
      "invalid_currency",
      `Invalid currency: ${currencyCode}`,
    )
  }
  return currency
}

function requireMarketPrice(input: HoldingValuationInput) {
  if (input.marketPrice === null) {
    throw new FinancialCalculationError(
      "market_price_unavailable",
      `Market price is unavailable for holding ${input.id}`,
    )
  }
  const price = normalizeDecimal(input.marketPrice.price)
  if (!price || compareDecimals(price, "0") !== 1) {
    throw new FinancialCalculationError(
      "market_price_unavailable",
      `Market price is unavailable for holding ${input.id}`,
    )
  }
  return {
    price,
    currencyCode: normalizeCurrency(
      input.marketPrice.currencyCode,
    ),
    asOf: input.marketPrice.asOf,
  }
}

export function calculateHoldingMarketValue(
  input: HoldingValuationInput,
): HoldingMarketValue {
  const holding = calculateHoldingFinancials(input)
  const marketPrice = requireMarketPrice(input)
  if (holding.costCurrencyCode !== marketPrice.currencyCode) {
    throw new FinancialCalculationError(
      "currency_mismatch",
      `Holding ${input.id} cost currency ${holding.costCurrencyCode} does not match market price currency ${marketPrice.currencyCode}`,
    )
  }
  return {
    holdingId: holding.holdingId,
    currentMarketPrice: marketPrice.price,
    marketValue: requireDecimal(
      multiplyDecimals(holding.quantity, marketPrice.price),
      `Unable to calculate market value for holding ${input.id}`,
    ),
    currencyCode: holding.costCurrencyCode,
    priceAsOf: marketPrice.asOf,
  }
}

export function calculateHoldingPerformance(
  input: HoldingValuationInput,
): HoldingPerformance {
  const holding = calculateHoldingFinancials(input)
  const valuation = calculateHoldingMarketValue(input)
  if (compareDecimals(holding.totalCostBasis, "0") === 0) {
    throw new FinancialCalculationError(
      "zero_cost_basis",
      `Holding ${input.id} has zero cost basis`,
    )
  }
  const unrealizedGainLoss = requireDecimal(
    subtractDecimals(
      valuation.marketValue,
      holding.totalCostBasis,
    ),
    `Unable to calculate gain/loss for holding ${input.id}`,
  )
  const returnRatio = requireDecimal(
    divideDecimals(
      unrealizedGainLoss,
      holding.totalCostBasis,
    ),
    `Unable to calculate return for holding ${input.id}`,
  )
  return {
    ...valuation,
    totalCostBasis: holding.totalCostBasis,
    unrealizedGainLoss,
    unrealizedReturnPercentage: requireDecimal(
      multiplyDecimals(returnRatio, percentageMultiplier),
      `Unable to calculate return for holding ${input.id}`,
    ),
  }
}

function requireSingleCurrency(
  values: readonly HoldingMarketValue[],
): string {
  const currencies = new Set(values.map((value) => value.currencyCode))
  if (currencies.size !== 1) {
    throw new FinancialCalculationError(
      "currency_mismatch",
      "Portfolio valuation requires one common currency",
    )
  }
  return values[0]?.currencyCode ?? ""
}

function sumDecimals(values: readonly Decimal[]): Decimal {
  return values.reduce(
    (total, value) =>
      requireDecimal(
        addDecimals(total, value),
        "Unable to aggregate decimal values",
      ),
    "0",
  )
}

export function calculatePortfolioMarketValue(
  inputs: readonly HoldingValuationInput[],
): PortfolioMarketValue {
  const holdings = inputs.map(calculateHoldingMarketValue)
  const currencyCode = requireSingleCurrency(holdings)
  return {
    currencyCode,
    totalMarketValue: sumDecimals(
      holdings.map((holding) => holding.marketValue),
    ),
    totalCostBasis: sumDecimals(
      inputs.map(
        (input) => calculateHoldingFinancials(input).totalCostBasis,
      ),
    ),
    holdings,
  }
}

export function calculatePortfolioPerformance(
  inputs: readonly HoldingValuationInput[],
): PortfolioPerformance {
  const portfolio = calculatePortfolioMarketValue(inputs)
  if (compareDecimals(portfolio.totalCostBasis, "0") === 0) {
    throw new FinancialCalculationError(
      "zero_cost_basis",
      "Portfolio has zero cost basis",
    )
  }
  const totalUnrealizedGainLoss = requireDecimal(
    subtractDecimals(
      portfolio.totalMarketValue,
      portfolio.totalCostBasis,
    ),
    "Unable to calculate portfolio gain/loss",
  )
  const returnRatio = requireDecimal(
    divideDecimals(
      totalUnrealizedGainLoss,
      portfolio.totalCostBasis,
    ),
    "Unable to calculate portfolio return",
  )
  return {
    ...portfolio,
    totalUnrealizedGainLoss,
    totalReturnPercentage: requireDecimal(
      multiplyDecimals(returnRatio, percentageMultiplier),
      "Unable to calculate portfolio return",
    ),
  }
}

export function calculatePortfolioAllocation(
  inputs: readonly HoldingValuationInput[],
): PortfolioAllocation {
  if (inputs.length === 0) {
    throw new FinancialCalculationError(
      "empty_portfolio",
      "Portfolio allocation requires at least one holding",
    )
  }
  const portfolio = calculatePortfolioMarketValue(inputs)
  const totalComparison = compareDecimals(
    portfolio.totalMarketValue,
    "0",
  )
  if (totalComparison === 0) {
    throw new FinancialCalculationError(
      "zero_market_value",
      "Portfolio allocation requires a positive total market value",
    )
  }
  if (totalComparison !== 1) {
    throw new FinancialCalculationError(
      "zero_market_value",
      "Portfolio allocation cannot use a negative market value",
    )
  }

  let residualIndex = -1
  for (let index = portfolio.holdings.length - 1; index >= 0; index -= 1) {
    if (
      compareDecimals(portfolio.holdings[index].marketValue, "0") === 1
    ) {
      residualIndex = index
      break
    }
  }

  let allocatedPercentage: Decimal = "0"
  const allocations: HoldingAllocation[] = portfolio.holdings.map(
    (holding, index) => {
      let allocationPercentage: Decimal = "0"
      if (index !== residualIndex) {
        allocationPercentage = requireDecimal(
          multiplyDecimals(
            requireDecimal(
              divideDecimals(
                holding.marketValue,
                portfolio.totalMarketValue,
              ),
              "Unable to calculate portfolio allocation",
            ),
            percentageMultiplier,
          ),
          "Unable to calculate portfolio allocation",
        )
        allocatedPercentage = requireDecimal(
          addDecimals(allocatedPercentage, allocationPercentage),
          "Unable to calculate portfolio allocation",
        )
      }
      return {
        holdingId: holding.holdingId,
        marketValue: holding.marketValue,
        allocationPercentage,
      }
    },
  )

  allocations[residualIndex].allocationPercentage = requireDecimal(
    subtractDecimals(percentageMultiplier, allocatedPercentage),
    "Unable to calculate portfolio allocation",
  )

  return {
    currencyCode: portfolio.currencyCode,
    totalMarketValue: portfolio.totalMarketValue,
    allocations,
  }
}

export function calculateGroupedMarketValueAllocation(
  inputs: readonly GroupedMarketValueInput[],
): GroupedPortfolioAllocation {
  if (inputs.length === 0) {
    throw new FinancialCalculationError(
      "empty_portfolio",
      "Grouped allocation requires at least one value",
    )
  }
  const currencyCode = normalizeCurrency(inputs[0].currencyCode)
  const grouped = new Map<string, Decimal>()
  for (const input of inputs) {
    if (normalizeCurrency(input.currencyCode) !== currencyCode) {
      throw new FinancialCalculationError(
        "currency_mismatch",
        "Grouped allocation requires one common currency",
      )
    }
    const value = normalizeDecimal(input.marketValue)
    if (!value || compareDecimals(value, "0") === -1) {
      throw new FinancialCalculationError(
        "zero_market_value",
        `Invalid market value for ${input.group}`,
      )
    }
    grouped.set(
      input.group,
      requireDecimal(
        addDecimals(grouped.get(input.group) ?? "0", value),
        "Unable to group market values",
      ),
    )
  }
  const positiveGroups = [...grouped.entries()].filter(
    ([, value]) => compareDecimals(value, "0") === 1,
  )
  if (positiveGroups.length === 0) {
    throw new FinancialCalculationError(
      "zero_market_value",
      "Grouped allocation requires positive market value",
    )
  }
  const totalMarketValue = sumDecimals(
    positiveGroups.map(([, value]) => value),
  )
  let allocated: Decimal = "0"
  const allocations = positiveGroups.map(([group, marketValue], index) => {
    const allocationPercentage =
      index === positiveGroups.length - 1
        ? requireDecimal(
            subtractDecimals("100", allocated),
            "Unable to assign allocation residual",
          )
        : requireDecimal(
            multiplyDecimals(
              requireDecimal(
                divideDecimals(marketValue, totalMarketValue),
                "Unable to calculate grouped allocation",
              ),
              "100",
            ),
            "Unable to calculate grouped allocation",
          )
    allocated = requireDecimal(
      addDecimals(allocated, allocationPercentage),
      "Unable to calculate grouped allocation",
    )
    return { group, marketValue, allocationPercentage }
  })
  return { currencyCode, totalMarketValue, allocations }
}
