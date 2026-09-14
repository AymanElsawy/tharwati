import type {
  DashboardAggregate,
  DashboardAssetGroup,
} from "@/features/dashboard/services/dashboard-aggregate.service"
import {
  dashboardAssetGroupDefinitions,
  getDashboardBreakdownItems,
} from "@/features/dashboard/utils/assets-breakdown"
import type { TranslationKey } from "@/i18n/en/translations"
import type { Decimal } from "@/lib/supabase/types"
import { compareDecimals } from "@/lib/financial-calculations/decimal"

export type WealthAssetClass = {
  group: DashboardAssetGroup
  labelKey: TranslationKey
  color: string
  value: Decimal | null
  percentage: Decimal | null
  destination: string | null
}

export type WealthAnalysisEvidence = {
  assetClasses: WealthAssetClass[]
  positiveAssetClassCount: number
  largestExposure: WealthAssetClass | null
  cashAndBankExposure: WealthAssetClass | null
}

/**
 * Projects the shared Dashboard valuation into the read-only Wealth Analysis
 * asset-class model. Incomplete snapshots remain fully unavailable; this
 * function never manufactures partial totals or zeroes for missing values.
 */
export function getWealthAssetClasses(
  aggregate: DashboardAggregate,
): WealthAssetClass[] {
  const percentages = new Map(
    getDashboardBreakdownItems(aggregate).map((item) => [
      item.group,
      item.percentage,
    ]),
  )

  return dashboardAssetGroupDefinitions.map((item) => ({
    ...item,
    value:
      aggregate.status === "complete"
        ? aggregate.assetBreakdown[item.group]
        : null,
    percentage: percentages.get(item.group) ?? null,
    destination: item.group === "brokerage" ? "/portfolio" : null,
  }))
}

/** Builds descriptive evidence without introducing scores or thresholds. */
export function getWealthAnalysisEvidence(
  aggregate: DashboardAggregate,
): WealthAnalysisEvidence {
  const assetClasses = getWealthAssetClasses(aggregate)
  const positiveAssetClasses = assetClasses.filter(
    (assetClass) =>
      assetClass.value !== null &&
      compareDecimals(assetClass.value, "0") === 1,
  )
  const largestExposure = positiveAssetClasses.reduce<WealthAssetClass | null>(
    (largest, assetClass) => {
      if (!largest || largest.percentage === null) return assetClass
      if (assetClass.percentage === null) return largest
      return compareDecimals(assetClass.percentage, largest.percentage) === 1
        ? assetClass
        : largest
    },
    null,
  )

  return {
    assetClasses,
    positiveAssetClassCount: positiveAssetClasses.length,
    largestExposure,
    cashAndBankExposure:
      assetClasses.find(({ group }) => group === "cashAndBank") ?? null,
  }
}
