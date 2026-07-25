import type { Decimal } from "../supabase/types"
import { addDecimals, compareDecimals, normalizeDecimal } from "./decimal"
import { isOpenQuantity, requireValidQuantity } from "./quantities"
import type {
  CurrencyCostBasis,
  HoldingCalculationInput,
  HoldingFinancialValues,
} from "./types"
import { FinancialCalculationError } from "./types"

function requireNonNegativeDecimal(
  value: Decimal,
  code: "invalid_cost_basis" | "invalid_average_cost",
): Decimal {
  const normalized = normalizeDecimal(value)
  if (!normalized || compareDecimals(normalized, "0") === -1) {
    throw new FinancialCalculationError(code, `Invalid decimal: ${value}`)
  }
  return normalized
}

export function calculateHoldingFinancials(
  holding: HoldingCalculationInput,
): HoldingFinancialValues {
  const quantity = requireValidQuantity(holding.quantity, {
    allowZero: true,
  })
  const totalCostBasis = requireNonNegativeDecimal(
    holding.totalCostBasis,
    "invalid_cost_basis",
  )
  const averageCost =
    holding.averageCost === null
      ? null
      : requireNonNegativeDecimal(
          holding.averageCost,
          "invalid_average_cost",
        )
  const currency = holding.costCurrencyCode.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new FinancialCalculationError(
      "invalid_currency",
      `Invalid cost currency: ${holding.costCurrencyCode}`,
    )
  }

  return {
    holdingId: holding.id,
    quantity,
    averageCost,
    totalCostBasis,
    costCurrencyCode: currency,
    isOpen: isOpenQuantity(quantity),
  }
}

export function getOpenHoldings(
  holdings: readonly HoldingCalculationInput[],
): HoldingFinancialValues[] {
  return holdings
    .map(calculateHoldingFinancials)
    .filter((holding) => holding.isOpen)
}

export function calculatePortfolioCostBasisByCurrency(
  holdings: readonly HoldingCalculationInput[],
): CurrencyCostBasis[] {
  const totals = new Map<
    string,
    { totalCostBasis: Decimal; holdingCount: number }
  >()

  for (const holding of getOpenHoldings(holdings)) {
    const current = totals.get(holding.costCurrencyCode)
    const totalCostBasis = addDecimals(
      current?.totalCostBasis ?? "0",
      holding.totalCostBasis,
    )
    if (totalCostBasis === null) {
      throw new FinancialCalculationError(
        "invalid_cost_basis",
        `Invalid cost basis for holding ${holding.holdingId}`,
      )
    }
    totals.set(holding.costCurrencyCode, {
      totalCostBasis,
      holdingCount: (current?.holdingCount ?? 0) + 1,
    })
  }

  return [...totals.entries()]
    .map(([currencyCode, value]) => ({ currencyCode, ...value }))
    .sort((left, right) =>
      left.currencyCode.localeCompare(right.currencyCode),
    )
}

