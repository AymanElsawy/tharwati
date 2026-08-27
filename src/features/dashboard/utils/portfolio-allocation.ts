import { calculateGroupedMarketValueAllocation, compareDecimals } from "@/lib/financial-calculations"
import type { Decimal } from "@/lib/supabase/types"
import type { TranslationKey } from "@/i18n/en/translations"
import type { DashboardPortfolioAllocation } from "@/features/dashboard/services/dashboard-valuation-snapshot.service"

const groups = [
  { id: "stocks", assetTypes: ["stock"], labelKey: "dashboard.portfolioAllocation.stocks", color: "#0ea5e9" },
  { id: "etfs", assetTypes: ["etf"], labelKey: "dashboard.portfolioAllocation.etfs", color: "#8b5cf6" },
  { id: "bonds", assetTypes: ["bond"], labelKey: "dashboard.portfolioAllocation.bonds", color: "#16a34a" },
  { id: "mutualFunds", assetTypes: ["mutual_fund"], labelKey: "dashboard.portfolioAllocation.mutualFunds", color: "#d97706" },
  { id: "cryptocurrency", assetTypes: ["cryptocurrency"], labelKey: "dashboard.portfolioAllocation.cryptocurrency", color: "#ec4899" },
  { id: "other", assetTypes: [], labelKey: "dashboard.portfolioAllocation.other", color: "#64748b" },
] as const

export type DashboardPortfolioAllocationItem = {
  group: (typeof groups)[number]["id"]
  value: Decimal
  percentage: Decimal
  color: string
  labelKey: TranslationKey
}

function groupFor(assetTypeCode: string): DashboardPortfolioAllocationItem["group"] {
  return groups.find((group) => group.assetTypes.includes(assetTypeCode as never))?.id ?? "other"
}

export function getDashboardPortfolioAllocationItems(
  allocation: DashboardPortfolioAllocation | null,
  baseCurrencyCode: string,
): DashboardPortfolioAllocationItem[] {
  if (!allocation || allocation.status !== "complete") return []
  const inputs = groups.flatMap((group) => allocation.holdings
    .filter((holding) => groupFor(holding.assetTypeCode) === group.id && compareDecimals(holding.marketValueBaseCurrency, "0") === 1)
    .map((holding) => ({ group: group.id, marketValue: holding.marketValueBaseCurrency, currencyCode: baseCurrencyCode })))
  if (inputs.length === 0) return []
  const grouped = calculateGroupedMarketValueAllocation(inputs)
  return grouped.allocations.map((item) => {
    const group = groups.find((candidate) => candidate.id === item.group)
    if (!group) throw new Error("Unknown dashboard portfolio allocation group")
    return { group: group.id, value: item.marketValue, percentage: item.allocationPercentage, color: group.color, labelKey: group.labelKey }
  })
}
