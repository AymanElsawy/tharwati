import type { Decimal } from "../supabase/types"

export type HoldingCalculationInput = {
  id: string
  quantity: Decimal
  averageCost: Decimal | null
  totalCostBasis: Decimal
  costCurrencyCode: string
}

export type HoldingFinancialValues = {
  holdingId: string
  quantity: Decimal
  averageCost: Decimal | null
  totalCostBasis: Decimal
  costCurrencyCode: string
  isOpen: boolean
}

export type CurrencyCostBasis = {
  currencyCode: string
  totalCostBasis: Decimal
  holdingCount: number
}

export type QuantityValidationOptions = {
  allowZero?: boolean
  allowNegative?: boolean
  maximumScale?: number
}

export type QuantityValidationResult =
  | { valid: true; normalized: Decimal }
  | {
      valid: false
      reason: "invalid_decimal" | "negative" | "zero" | "scale_exceeded"
    }

export class FinancialCalculationError extends Error {
  readonly code:
    | "invalid_quantity"
    | "invalid_cost_basis"
    | "invalid_average_cost"
    | "invalid_currency"
    | "market_price_unavailable"
    | "currency_mismatch"
    | "zero_cost_basis"
    | "empty_portfolio"
    | "zero_market_value"

  constructor(
    code: FinancialCalculationError["code"],
    message: string,
  ) {
    super(message)
    this.name = "FinancialCalculationError"
    this.code = code
  }
}

export type CurrentPriceInput = {
  price: Decimal
  currencyCode: string
  asOf: string
} | null

export type HoldingValuationInput = HoldingCalculationInput & {
  marketPrice: CurrentPriceInput
}

export type HoldingMarketValue = {
  holdingId: string
  currentMarketPrice: Decimal
  marketValue: Decimal
  currencyCode: string
  priceAsOf: string
}

export type HoldingPerformance = HoldingMarketValue & {
  totalCostBasis: Decimal
  unrealizedGainLoss: Decimal
  unrealizedReturnPercentage: Decimal
}

export type PortfolioMarketValue = {
  currencyCode: string
  totalMarketValue: Decimal
  totalCostBasis: Decimal
  holdings: HoldingMarketValue[]
}

export type PortfolioPerformance = PortfolioMarketValue & {
  totalUnrealizedGainLoss: Decimal
  totalReturnPercentage: Decimal
}

export type HoldingAllocation = {
  holdingId: string
  marketValue: Decimal
  allocationPercentage: Decimal
}

export type PortfolioAllocation = {
  currencyCode: string
  totalMarketValue: Decimal
  allocations: HoldingAllocation[]
}
