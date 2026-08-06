import type { Decimal } from "@/lib/supabase/types"

export type WealthInsightCategory =
  | "allocation"
  | "risk"
  | "diversification"
  | "cash_flow"
  | "goals"
  | "currency"
  | "performance"
  | "opportunities"
  | "warnings"

export type WealthInsightSeverity = "info" | "good" | "warning"

export type WealthInsightAction = {
  label: string
  href: string
}

export type WealthInsight = {
  id: string
  category: WealthInsightCategory
  headline: string
  explanation: string
  severity: WealthInsightSeverity
  priority: number
  action?: WealthInsightAction
}

export type WealthInsightSnapshot = {
  allocation?: {
    cashPercent: Decimal
    preferredCashMaximumPercent: Decimal
  }
  concentration?: {
    holdingName: string
    holdingPercent: Decimal
    warningThresholdPercent: Decimal
  }
  diversification?: {
    sectorName: string
    equityPercent: Decimal
    warningThresholdPercent: Decimal
  }
  cashFlow?: {
    savingsRatePercent: Decimal
    targetSavingsRatePercent: Decimal
  }
  goalProgress?: {
    goalName: string
    monthsAhead: number
  }
  currencyExposure?: {
    currencyCode: string
    exposurePercent: Decimal
    warningThresholdPercent: Decimal
  }
  performance?: {
    benchmarkDifferencePercent: Decimal
  }
  idleCash?: {
    amount: Decimal
    formattedAmount: string
    idleDays: number
    minimumIdleDays: number
  }
  missingData?: {
    missingPriceCount: number
    missingExchangeRateCount: number
  }
}
