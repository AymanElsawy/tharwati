import {
  compareDecimals,
} from "@/lib/financial-calculations"
import { subtractDecimals } from "@/lib/financial-calculations/decimal"
import type {
  WealthInsight,
  WealthInsightSnapshot,
} from "@/features/insights/types/wealth-insight"

type InsightRule = (snapshot: WealthInsightSnapshot) => WealthInsight | null

function isGreaterThan(left: string, right: string) {
  return compareDecimals(left, right) === 1
}

function isLessThan(left: string, right: string) {
  return compareDecimals(left, right) === -1
}

function formatPercent(value: string) {
  const normalized = value.includes(".")
    ? value.replace(/0+$/, "").replace(/\.$/, "")
    : value
  return `${normalized}%`
}

const allocationRule: InsightRule = (snapshot) => {
  const allocation = snapshot.allocation
  if (
    !allocation ||
    !isGreaterThan(
      allocation.cashPercent,
      allocation.preferredCashMaximumPercent,
    )
  ) {
    return null
  }

  const difference = subtractDecimals(
    allocation.cashPercent,
    allocation.preferredCashMaximumPercent,
  )
  if (!difference) return null

  return {
    id: "allocation:cash-above-range",
    category: "allocation",
    headline: "Cash allocation is above your preferred range.",
    explanation: `Your cash allocation is ${formatPercent(difference)} above your current upper target.`,
    severity: "warning",
    priority: 80,
    action: { label: "Review Allocation", href: "/portfolio" },
  }
}

const concentrationRule: InsightRule = (snapshot) => {
  const concentration = snapshot.concentration
  if (
    !concentration ||
    !isGreaterThan(
      concentration.holdingPercent,
      concentration.warningThresholdPercent,
    )
  ) {
    return null
  }

  return {
    id: `risk:holding-concentration:${concentration.holdingName}`,
    category: "risk",
    headline: `${concentration.holdingName} is a concentrated position.`,
    explanation: `One holding represents ${formatPercent(concentration.holdingPercent)} of your equity portfolio.`,
    severity: "warning",
    priority: 100,
    action: { label: "Review Concentration", href: "/holdings" },
  }
}

const diversificationRule: InsightRule = (snapshot) => {
  const diversification = snapshot.diversification
  if (
    !diversification ||
    !isGreaterThan(
      diversification.equityPercent,
      diversification.warningThresholdPercent,
    )
  ) {
    return null
  }

  return {
    id: `diversification:sector:${diversification.sectorName}`,
    category: "diversification",
    headline: `${diversification.sectorName} exposure is elevated.`,
    explanation: `${diversification.sectorName} represents ${formatPercent(diversification.equityPercent)} of your equity portfolio.`,
    severity: "info",
    priority: 72,
    action: { label: "See Holdings", href: "/holdings" },
  }
}

const cashFlowRule: InsightRule = (snapshot) => {
  const cashFlow = snapshot.cashFlow
  if (
    !cashFlow ||
    !isGreaterThan(
      cashFlow.savingsRatePercent,
      cashFlow.targetSavingsRatePercent,
    )
  ) {
    return null
  }

  return {
    id: "cash-flow:savings-rate-above-target",
    category: "cash_flow",
    headline: "Your savings pace is ahead of target.",
    explanation: `You are currently saving ${formatPercent(cashFlow.savingsRatePercent)} of tracked cash flow.`,
    severity: "good",
    priority: 52,
  }
}

const goalsRule: InsightRule = (snapshot) => {
  const goal = snapshot.goalProgress
  if (!goal || goal.monthsAhead <= 0) return null

  return {
    id: `goals:ahead:${goal.goalName}`,
    category: "goals",
    headline: `${goal.goalName} is ahead of schedule.`,
    explanation: `At your current contribution rate, you may reach this goal ${goal.monthsAhead} months earlier.`,
    severity: "good",
    priority: 58,
    action: { label: "Open Goal", href: "/goals" },
  }
}

const currencyRule: InsightRule = (snapshot) => {
  const exposure = snapshot.currencyExposure
  if (
    !exposure ||
    !isGreaterThan(
      exposure.exposurePercent,
      exposure.warningThresholdPercent,
    )
  ) {
    return null
  }

  return {
    id: `currency:exposure:${exposure.currencyCode}`,
    category: "currency",
    headline: `${exposure.currencyCode} is your dominant currency exposure.`,
    explanation: `${formatPercent(exposure.exposurePercent)} of your tracked wealth is exposed to ${exposure.currencyCode}.`,
    severity: "info",
    priority: 88,
    action: { label: "View Currency Exposure", href: "/portfolio" },
  }
}

const performanceRule: InsightRule = (snapshot) => {
  const performance = snapshot.performance
  if (
    !performance ||
    !isGreaterThan(performance.benchmarkDifferencePercent, "0")
  ) {
    return null
  }

  return {
    id: "performance:benchmark-outperformance",
    category: "performance",
    headline: "Your portfolio is ahead of its benchmark.",
    explanation: `Your portfolio outperformed its benchmark by ${formatPercent(performance.benchmarkDifferencePercent)} this year.`,
    severity: "good",
    priority: 62,
    action: { label: "See Performance", href: "/portfolio" },
  }
}

const opportunityRule: InsightRule = (snapshot) => {
  const idleCash = snapshot.idleCash
  if (
    !idleCash ||
    !isGreaterThan(idleCash.amount, "0") ||
    idleCash.idleDays < idleCash.minimumIdleDays
  ) {
    return null
  }

  return {
    id: "opportunities:idle-cash",
    category: "opportunities",
    headline: "A meaningful cash balance has remained idle.",
    explanation: `${idleCash.formattedAmount} has been uninvested for more than ${idleCash.minimumIdleDays} days.`,
    severity: "info",
    priority: 84,
    action: { label: "Invest Cash", href: "/portfolio" },
  }
}

const missingDataRule: InsightRule = (snapshot) => {
  const missingData = snapshot.missingData
  if (!missingData) return null
  const missingTotal =
    missingData.missingPriceCount + missingData.missingExchangeRateCount
  if (missingTotal === 0) return null

  return {
    id: "warnings:incomplete-valuation-data",
    category: "warnings",
    headline: "Some wealth data needs your attention.",
    explanation: `${missingTotal} required market price or exchange rate ${missingTotal === 1 ? "is" : "are"} missing from your valuation.`,
    severity: "warning",
    priority: 110,
    action: { label: "Review Missing Data", href: "/dashboard" },
  }
}

const negativePerformanceRule: InsightRule = (snapshot) => {
  const performance = snapshot.performance
  if (
    !performance ||
    !isLessThan(performance.benchmarkDifferencePercent, "0")
  ) {
    return null
  }

  return {
    id: "performance:benchmark-underperformance",
    category: "performance",
    headline: "Your portfolio is trailing its benchmark.",
    explanation: `Your portfolio is ${formatPercent(
      performance.benchmarkDifferencePercent.replace("-", ""),
    )} behind its benchmark this year.`,
    severity: "info",
    priority: 64,
    action: { label: "See Performance", href: "/portfolio" },
  }
}

const insightRules: InsightRule[] = [
  missingDataRule,
  concentrationRule,
  currencyRule,
  opportunityRule,
  allocationRule,
  diversificationRule,
  negativePerformanceRule,
  performanceRule,
  goalsRule,
  cashFlowRule,
]

export function generateWealthInsights(
  snapshot: WealthInsightSnapshot,
  maximumVisible = 3,
): WealthInsight[] {
  if (maximumVisible <= 0) return []

  const candidates = insightRules
    .map((rule) => rule(snapshot))
    .filter((insight): insight is WealthInsight => insight !== null)
    .sort(
      (left, right) =>
        right.priority - left.priority || left.id.localeCompare(right.id),
    )

  const seenIds = new Set<string>()
  const seenCategories = new Set<string>()
  const uniqueInsights: WealthInsight[] = []

  for (const insight of candidates) {
    if (seenIds.has(insight.id) || seenCategories.has(insight.category)) {
      continue
    }
    seenIds.add(insight.id)
    seenCategories.add(insight.category)
    uniqueInsights.push(insight)
    if (uniqueInsights.length === maximumVisible) break
  }

  return uniqueInsights
}
