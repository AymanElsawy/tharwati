import type {
  CurrencyCostBasis,
  HoldingFinancialValues,
} from "../../../lib/financial-calculations"
import {
  calculatePortfolioCostBasisByCurrency,
  getOpenHoldings,
} from "../../../lib/financial-calculations"
import type { HoldingDetails } from "./holding"

export type HoldingView = {
  holding: HoldingDetails
  financials: HoldingFinancialValues
}

function toCalculationInput(holding: HoldingDetails) {
  return {
    id: holding.id,
    quantity: holding.quantity,
    averageCost: holding.average_cost,
    totalCostBasis: holding.total_cost_basis,
    costCurrencyCode: holding.cost_currency_code,
  }
}

export function createOpenHoldingViews(
  holdings: readonly HoldingDetails[],
): HoldingView[] {
  const openFinancials = new Map(
    getOpenHoldings(holdings.map(toCalculationInput)).map(
      (financials) => [financials.holdingId, financials],
    ),
  )
  return holdings.flatMap((holding) => {
    const financials = openFinancials.get(holding.id)
    return financials ? [{ holding, financials }] : []
  })
}

export function createPortfolioCostBasisSummary(
  holdings: readonly HoldingDetails[],
): CurrencyCostBasis[] {
  return calculatePortfolioCostBasisByCurrency(
    holdings.map(toCalculationInput),
  )
}

export type HoldingSortKey =
  | "asset"
  | "account"
  | "quantity"
  | "averageCost"
  | "totalCost"

export type HoldingSort = {
  key: HoldingSortKey
  direction: "ascending" | "descending"
}

