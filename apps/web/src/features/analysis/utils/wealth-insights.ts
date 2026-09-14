import type { DashboardAggregate } from "@/features/dashboard/services/dashboard-aggregate.service"
import type { Decimal } from "@/lib/supabase/types"
import {
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
} from "@/lib/financial-calculations/decimal"

import type {
  WealthAnalysisEvidence,
  WealthAssetClass,
} from "./wealth-analysis"

export type WealthInsight =
  | {
      id: "valuation-confidence"
      kind: "valuation-confidence"
      state: "complete-current" | "incomplete" | "stale" | "unavailable"
      unresolvedCount: number
    }
  | {
      id: "concentration"
      kind: "concentration"
      assetClass: WealthAssetClass
      percentage: Decimal
    }
  | {
      id: "liabilities"
      kind: "liabilities"
      percentage: Decimal | null
    }
  | {
      id: "liquidity"
      kind: "liquidity"
      percentage: Decimal
    }
  | {
      id: "breadth"
      kind: "breadth"
      assetClassCount: number
    }

function percentageOf(
  numerator: Decimal,
  denominator: Decimal | null,
): Decimal | null {
  if (denominator === null || compareDecimals(denominator, "0") !== 1) {
    return null
  }
  const ratio = divideDecimals(numerator, denominator, 8)
  return ratio === null ? null : multiplyDecimals(ratio, "100")
}

function valuationConfidenceInsight(
  aggregate: DashboardAggregate,
): Extract<WealthInsight, { kind: "valuation-confidence" }> {
  const unresolvedCount = new Set(aggregate.unavailableSources).size
  if (aggregate.status === "incomplete") {
    return {
      id: "valuation-confidence",
      kind: "valuation-confidence",
      state: "incomplete",
      unresolvedCount,
    }
  }
  if (aggregate.freshness === "stale") {
    return {
      id: "valuation-confidence",
      kind: "valuation-confidence",
      state: "stale",
      unresolvedCount,
    }
  }
  if (aggregate.freshness !== "fresh") {
    return {
      id: "valuation-confidence",
      kind: "valuation-confidence",
      state: "unavailable",
      unresolvedCount,
    }
  }
  return {
    id: "valuation-confidence",
    kind: "valuation-confidence",
    state: "complete-current",
    unresolvedCount,
  }
}

/**
 * Selects up to four descriptive cross-asset observations from the existing
 * valuation evidence. It does not recalculate wealth or infer advice.
 */
export function getWealthInsights(
  aggregate: DashboardAggregate,
  evidence: WealthAnalysisEvidence,
): WealthInsight[] {
  const confidence = valuationConfidenceInsight(aggregate)
  const insights: WealthInsight[] =
    confidence.state === "complete-current" ? [] : [confidence]

  const largest = evidence.largestExposure
  const concentrationComparison = largest?.percentage
    ? compareDecimals(largest.percentage, "50")
    : null
  if (
    aggregate.status === "complete" &&
    largest?.percentage !== null &&
    largest?.percentage !== undefined &&
    concentrationComparison !== null &&
    concentrationComparison >= 0
  ) {
    insights.push({
      id: "concentration",
      kind: "concentration",
      assetClass: largest,
      percentage: largest.percentage,
    })
  }

  if (
    aggregate.totalLiabilities !== null &&
    compareDecimals(aggregate.totalLiabilities, "0") === 1
  ) {
    insights.push({
      id: "liabilities",
      kind: "liabilities",
      percentage:
        aggregate.status === "complete"
          ? percentageOf(aggregate.totalLiabilities, aggregate.totalAssets)
          : null,
    })
  }

  const cash = evidence.cashAndBankExposure
  if (
    aggregate.status === "complete" &&
    aggregate.totalAssets !== null &&
    compareDecimals(aggregate.totalAssets, "0") === 1 &&
    cash !== null &&
    cash.value !== null
  ) {
    const cashPercentage =
      cash.percentage ??
      (compareDecimals(cash.value, "0") === 0 ? "0" : null)
    if (cashPercentage !== null) {
      insights.push({
        id: "liquidity",
        kind: "liquidity",
        percentage: cashPercentage,
      })
    }
  }

  if (aggregate.status === "complete") {
    insights.push({
      id: "breadth",
      kind: "breadth",
      assetClassCount: evidence.positiveAssetClassCount,
    })
  }

  if (confidence.state === "complete-current") {
    insights.push(confidence)
  }

  return insights.slice(0, 4)
}
