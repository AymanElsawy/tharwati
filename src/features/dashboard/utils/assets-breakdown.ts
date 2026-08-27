import type { TranslationKey } from "@/i18n/en/translations"
import type { DashboardAggregate, DashboardAssetGroup } from "@/features/dashboard/services/dashboard-aggregate.service"
import { addDecimals, compareDecimals, divideDecimals, multiplyDecimals, subtractDecimals } from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

const groups: Array<{ group: DashboardAssetGroup; labelKey: TranslationKey; color: string }> = [
  { group: "cashAndBank", labelKey: "dashboard.assetsBreakdown.cashAndBank", color: "#0ea5e9" },
  { group: "brokerage", labelKey: "dashboard.assetsBreakdown.brokerage", color: "#8b5cf6" },
  { group: "goldAndSilver", labelKey: "dashboard.assetsBreakdown.goldAndSilver", color: "#d97706" },
  { group: "realEstate", labelKey: "dashboard.assetsBreakdown.realEstate", color: "#16a34a" },
  { group: "business", labelKey: "dashboard.assetsBreakdown.business", color: "#ec4899" },
  { group: "other", labelKey: "dashboard.assetsBreakdown.other", color: "#64748b" },
]

export type DashboardBreakdownItem = {
  group: DashboardAssetGroup
  value: Decimal
  percentage: Decimal
  color: string
  labelKey: TranslationKey
}

export function getDashboardBreakdownItems(aggregate: DashboardAggregate): DashboardBreakdownItem[] {
  const totalAssets = aggregate.totalAssets
  if (aggregate.status !== "complete" || totalAssets === null || compareDecimals(totalAssets, "0") !== 1) return []
  const positive = groups.flatMap((item) => {
    const value = aggregate.assetBreakdown[item.group]
    return value !== null && compareDecimals(value, "0") === 1 ? [{ ...item, value }] : []
  })
  return positive.map((item, index) => {
    if (index === positive.length - 1) {
      const priorPercentages = positive.slice(0, -1).reduce<Decimal>((total, prior) => {
        const ratio = divideDecimals(prior.value, totalAssets, 6)
        return addDecimals(total, multiplyDecimals(ratio ?? "0", "100") ?? "0") ?? total
      }, "0")
      return { ...item, percentage: subtractDecimals("100", priorPercentages) ?? "0" }
    }
    const ratio = divideDecimals(item.value, totalAssets, 6)
    return { ...item, percentage: multiplyDecimals(ratio ?? "0", "100") ?? "0" }
  })
}
