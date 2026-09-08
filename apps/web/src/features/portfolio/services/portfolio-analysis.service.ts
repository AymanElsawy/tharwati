import type {
  PortfolioAnalysis,
  PortfolioAnalysisHolding,
  PortfolioAnalyticalSelection,
  PortfolioContributor,
  PortfolioDiversificationDimension,
  PortfolioExposure,
  PortfolioRisk,
} from "@/features/portfolio/types/portfolio-analysis"
import {
  calculateGroupedMarketValueAllocation,
  compareDecimals,
} from "@/lib/financial-calculations"
import {
  addDecimals,
} from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

const allocationColors = [
  "#23705f",
  "#3e6f91",
  "#9a6049",
  "#b08a3f",
  "#6f7d43",
  "#67588c",
  "#71767d",
] as const

function allocation(
  inputs: Array<{
    group: string
    marketValue: Decimal
    currencyCode: string
  }>,
) {
  return inputs.length === 0
    ? null
    : calculateGroupedMarketValueAllocation(inputs)
}

function add(left: Decimal, right: Decimal): Decimal {
  const result = addDecimals(left, right)
  if (result === null) throw new Error("Unable to aggregate analysis values")
  return result
}

function contributorsFor(
  holdings: PortfolioAnalysisHolding[],
  currencyCode: string,
): PortfolioContributor[] {
  const valued = holdings.filter(
    (
      holding,
    ): holding is PortfolioAnalysisHolding & {
      marketValueBase: Decimal
    } => holding.marketValueBase !== null,
  )
  const result = allocation(
    valued.map((holding) => ({
      group: holding.id,
      marketValue: holding.marketValueBase,
      currencyCode,
    })),
  )
  if (!result) return []
  return result.allocations
    .map((item) => {
      const holding = valued.find((candidate) => candidate.id === item.group)
      if (!holding) throw new Error("Unable to resolve analysis contributor")
      return {
        id: holding.id,
        name: holding.name,
        detail: holding.symbol,
        value: item.marketValue,
        percentage: item.allocationPercentage,
      }
    })
    .sort((left, right) => {
      const comparison = compareDecimals(right.value, left.value)
      return comparison ?? left.name.localeCompare(right.name)
    })
}

function exposuresFor(
  holdings: PortfolioAnalysisHolding[],
  currencyCode: string,
  groupBy: (holding: PortfolioAnalysisHolding) => string,
): PortfolioExposure[] {
  const valued = holdings.filter(
    (
      holding,
    ): holding is PortfolioAnalysisHolding & {
      marketValueBase: Decimal
    } => holding.marketValueBase !== null,
  )
  const result = allocation(
    valued.map((holding) => ({
      group: groupBy(holding),
      marketValue: holding.marketValueBase,
      currencyCode,
    })),
  )
  if (!result) return []
  const exposures = result.allocations
    .map((item, index) => {
      const members = valued.filter(
        (holding) => groupBy(holding) === item.group,
      )
      return {
        id: item.group,
        label: item.group,
        value: item.marketValue,
        percentage: item.allocationPercentage,
        offsetPercentage: "0",
        color: allocationColors[index % allocationColors.length],
        contributorIds: members.map((holding) => holding.id),
        contributors: contributorsFor(members, currencyCode),
      }
    })
    .sort((left, right) => {
      const comparison = compareDecimals(right.value, left.value)
      return comparison ?? left.label.localeCompare(right.label)
    })
  let offset: Decimal = "0"
  for (const exposure of exposures) {
    exposure.offsetPercentage = offset
    offset = add(offset, exposure.percentage)
  }
  return exposures
}

function severity(
  value: Decimal,
  warning: Decimal,
  high: Decimal,
): PortfolioRisk["severity"] {
  if (compareDecimals(value, high) === 1) return "high"
  if (compareDecimals(value, warning) === 1) return "warning"
  return "info"
}

function calculateRisks(
  holdings: PortfolioAnalysisHolding[],
  currencyCode: string,
): PortfolioRisk[] {
  const valued = holdings.filter(
    (
      holding,
    ): holding is PortfolioAnalysisHolding & {
      marketValueBase: Decimal
    } => holding.marketValueBase !== null,
  )
  const holdingAllocation = allocation(
    valued.map((holding) => ({
      group: holding.id,
      marketValue: holding.marketValueBase,
      currencyCode,
    })),
  )
  const ordered =
    holdingAllocation?.allocations.sort((left, right) => {
      return (
        compareDecimals(
          right.allocationPercentage,
          left.allocationPercentage,
        ) ?? left.group.localeCompare(right.group)
      )
    }) ?? []
  const largest = ordered[0] ?? null
  const topFive = ordered.slice(0, 5)
  const topFivePercentage = topFive.reduce<Decimal>(
    (total, item) => add(total, item.allocationPercentage),
    "0",
  )
  const currencyExposure = exposuresFor(
    valued,
    currencyCode,
    (holding) => holding.currencyCode,
  )[0]
  const missing = holdings.filter((holding) => holding.missingMarketPrice)

  return [
    {
      id: "largest_holding",
      severity: largest
        ? severity(largest.allocationPercentage, "25", "40")
        : "unavailable",
      percentage: largest?.allocationPercentage ?? null,
      threshold: "25",
      contributorIds: largest ? [largest.group] : [],
      available: largest !== null,
      provisional: missing.length > 0,
    },
    {
      id: "top_five",
      severity:
        topFive.length > 0
          ? severity(topFivePercentage, "60", "80")
          : "unavailable",
      percentage: topFive.length > 0 ? topFivePercentage : null,
      threshold: "60",
      contributorIds: topFive.map((item) => item.group),
      available: topFive.length > 0,
      provisional: missing.length > 0,
    },
    {
      id: "dominant_sector",
      severity: "unavailable",
      percentage: null,
      threshold: null,
      contributorIds: [],
      available: false,
      provisional: false,
    },
    {
      id: "dominant_currency",
      severity: currencyExposure
        ? severity(currencyExposure.percentage, "50", "70")
        : "unavailable",
      percentage: currencyExposure?.percentage ?? null,
      threshold: "50",
      contributorIds: currencyExposure?.contributorIds ?? [],
      available: currencyExposure !== undefined,
      provisional: missing.length > 0,
    },
    {
      id: "unpriced_exposure",
      severity: missing.length > 0 ? "warning" : "info",
      percentage: null,
      threshold: null,
      contributorIds: missing.map((holding) => holding.id),
      available: true,
      provisional: missing.length > 0,
    },
    {
      id: "illiquid_exposure",
      severity: "unavailable",
      percentage: null,
      threshold: null,
      contributorIds: [],
      available: false,
      provisional: false,
    },
  ]
}

export class PortfolioAnalysisService {
  build(input: {
    holdings: PortfolioAnalysisHolding[]
    baseCurrency: string
    cashValue: Decimal
    accountNames: ReadonlyMap<string, string>
    partial: boolean
  }): PortfolioAnalysis {
    const assetClass = exposuresFor(
      input.holdings,
      input.baseCurrency,
      (holding) => holding.assetClass,
    )
    if (compareDecimals(input.cashValue, "0") === 1) {
      const combined = allocation([
        ...assetClass.map((exposure) => ({
          group: exposure.id,
          marketValue: exposure.value,
          currencyCode: input.baseCurrency,
        })),
        {
          group: "cash",
          marketValue: input.cashValue,
          currencyCode: input.baseCurrency,
        },
      ])
      if (combined) {
        for (const exposure of assetClass) {
          const recalculated = combined.allocations.find(
            (item) => item.group === exposure.id,
          )
          if (recalculated) exposure.percentage = recalculated.allocationPercentage
        }
        const cash = combined.allocations.find(
          (item) => item.group === "cash",
        )
        if (cash) {
          assetClass.push({
            id: "cash",
            label: "cash",
            value: cash.marketValue,
            percentage: cash.allocationPercentage,
            offsetPercentage: "0",
            color:
              allocationColors[assetClass.length % allocationColors.length],
            contributorIds: [],
            contributors: [],
          })
        }
      }
    }
    assetClass.sort((left, right) =>
      compareDecimals(right.value, left.value) ?? 0,
    )
    assetClass.forEach((exposure, index) => {
      exposure.color = allocationColors[index % allocationColors.length]
    })
    let assetClassOffset: Decimal = "0"
    for (const exposure of assetClass) {
      exposure.offsetPercentage = assetClassOffset
      assetClassOffset = add(assetClassOffset, exposure.percentage)
    }

    const currency = exposuresFor(
      input.holdings,
      input.baseCurrency,
      (holding) => holding.currencyCode,
    )
    const account = exposuresFor(
      input.holdings,
      input.baseCurrency,
      (holding) => holding.accountId,
    ).map((exposure) => ({
      ...exposure,
      label: input.accountNames.get(exposure.id) ?? exposure.id,
    }))
    const unavailable = (
      id: "sector" | "geography",
    ): PortfolioDiversificationDimension => ({
      id,
      status: "unavailable",
      exposures: [],
      dominantExposureId: null,
      missingClassificationCount: input.holdings.length,
    })
    return {
      allocation: assetClass,
      diversification: [
        {
          id: "asset_class",
          status: input.partial ? "partial" : "available",
          exposures: assetClass,
          dominantExposureId: assetClass[0]?.id ?? null,
          missingClassificationCount: 0,
        },
        unavailable("sector"),
        unavailable("geography"),
        {
          id: "currency",
          status: input.partial ? "partial" : "available",
          exposures: currency,
          dominantExposureId: currency[0]?.id ?? null,
          missingClassificationCount: 0,
        },
        {
          id: "account",
          status: input.partial ? "partial" : "available",
          exposures: account,
          dominantExposureId: account[0]?.id ?? null,
          missingClassificationCount: 0,
        },
      ],
      risks: calculateRisks(input.holdings, input.baseCurrency),
      holdings: input.holdings,
      isPartial: input.partial,
    }
  }

  filteredRisks(
    analysis: PortfolioAnalysis,
    selection: PortfolioAnalyticalSelection,
    baseCurrency: string,
  ): PortfolioRisk[] {
    const dimension = analysis.diversification.find(
      (candidate) => candidate.id === selection.dimension,
    )
    const exposure = dimension?.exposures.find(
      (candidate) => candidate.id === selection.exposureId,
    )
    const contributorIds = exposure
      ? new Set(exposure.contributorIds)
      : null
    const holdings = analysis.holdings.filter(
      (holding) =>
        (!selection.assetClassId ||
          holding.assetClass === selection.assetClassId) &&
        (!contributorIds || contributorIds.has(holding.id)),
    )
    return calculateRisks(holdings, baseCurrency)
  }

  filteredDimension(
    analysis: PortfolioAnalysis,
    selection: PortfolioAnalyticalSelection,
    baseCurrency: string,
  ): PortfolioDiversificationDimension {
    const original =
      analysis.diversification.find(
        (dimension) => dimension.id === selection.dimension,
      ) ?? analysis.diversification[0]
    if (
      !selection.assetClassId ||
      original.id === "asset_class" ||
      original.status === "unavailable"
    ) {
      return original
    }
    const holdings = analysis.holdings.filter(
      (holding) => holding.assetClass === selection.assetClassId,
    )
    const groupBy =
      original.id === "currency"
        ? (holding: PortfolioAnalysisHolding) => holding.currencyCode
        : (holding: PortfolioAnalysisHolding) => holding.accountId
    const labels = new Map(
      original.exposures.map((exposure) => [
        exposure.id,
        exposure.label,
      ]),
    )
    const exposures = exposuresFor(
      holdings,
      baseCurrency,
      groupBy,
    ).map((exposure) => ({
      ...exposure,
      label: labels.get(exposure.id) ?? exposure.label,
    }))
    return {
      ...original,
      exposures,
      dominantExposureId: exposures[0]?.id ?? null,
    }
  }
}

export const portfolioAnalysisService =
  new PortfolioAnalysisService()
