import type {
  DashboardAggregate,
  DashboardAssetGroup,
} from "@/features/dashboard/services/dashboard-aggregate.service"
import type { Decimal } from "@/lib/supabase/types"
import {
  addDecimals,
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
  normalizeDecimal,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"

import type {
  WealthAnalysisEvidence,
  WealthAssetClass,
} from "../utils/wealth-analysis"

export type WealthTarget = {
  assetClass: DashboardAssetGroup
  percentage: Decimal
}

export type WealthTargetPlan = {
  targets: WealthTarget[]
  tolerancePercentage: Decimal
}

export type WealthTargetInputSummary = {
  total: Decimal
  isValid: boolean
  targets: WealthTarget[] | null
}

export type WealthTargetDriftStatus = "within" | "above" | "below"

export type WealthTargetDriftRow = {
  assetClass: WealthAssetClass
  currentPercentage: Decimal
  targetPercentage: Decimal
  lowerBoundPercentage: Decimal
  upperBoundPercentage: Decimal
  gapPercentage: Decimal
  monetaryGap: Decimal
  status: WealthTargetDriftStatus
}

export type WealthTargetComparison =
  | { status: "not-configured" }
  | {
      status: "unavailable"
      reason:
        | "invalid-targets"
        | "invalid-tolerance"
        | "valuation-incomplete"
        | "participating-value-unavailable"
        | "zero-comparison-base"
    }
  | {
      status: "available"
      comparisonBase: Decimal
      rows: WealthTargetDriftRow[]
      largestDeviation: WealthTargetDriftRow | null
    }

function addOrThrow(left: Decimal, right: Decimal): Decimal {
  const result = addDecimals(left, right)
  if (result === null) throw new Error("Invalid target decimal")
  return result
}

function absoluteDecimal(value: Decimal): Decimal | null {
  const comparison = compareDecimals(value, "0")
  if (comparison === null) return null
  return comparison === -1 ? subtractDecimals("0", value) : value
}

function validPercentage(value: unknown): Decimal | null {
  if (typeof value !== "string") return null
  if (!/^[0-9]+(?:\.[0-9]{1,6})?$/.test(value)) return null
  const normalized = normalizeDecimal(value)
  if (
    normalized === null ||
    compareDecimals(normalized, "0") === -1 ||
    compareDecimals(normalized, "100") === 1
  ) {
    return null
  }
  return normalized
}

export function summarizeWealthToleranceInput(input: string): {
  isValid: boolean
  tolerancePercentage: Decimal | null
} {
  const tolerancePercentage = validPercentage(input === "" ? "0" : input)
  return {
    isValid: tolerancePercentage !== null,
    tolerancePercentage,
  }
}

export function summarizeWealthTargetInputs(
  inputs: Readonly<Record<string, string>>,
  supportedAssetClasses: readonly DashboardAssetGroup[]
): WealthTargetInputSummary {
  let total: Decimal = "0"
  let valid = true
  const targets: WealthTarget[] = []

  for (const assetClass of supportedAssetClasses) {
    const input = inputs[assetClass] ?? ""
    const normalized = validPercentage(input)
    if (normalized === null) {
      valid = false
      continue
    }
    total = addOrThrow(total, normalized)
    targets.push({ assetClass, percentage: normalized })
  }

  const isValid =
    valid &&
    targets.length === supportedAssetClasses.length &&
    compareDecimals(total, "100") === 0

  return { total, isValid, targets: isValid ? targets : null }
}

function targetsAreValid(
  targets: readonly WealthTarget[],
  supportedAssetClasses: readonly DashboardAssetGroup[]
) {
  if (targets.length !== supportedAssetClasses.length) return false
  const inputs = Object.fromEntries(
    targets.map(({ assetClass, percentage }) => [assetClass, percentage])
  )
  return summarizeWealthTargetInputs(inputs, supportedAssetClasses).isValid
}

export function calculateWealthTargetComparison(
  aggregate: DashboardAggregate,
  evidence: WealthAnalysisEvidence,
  targets: readonly WealthTarget[],
  tolerancePercentage: Decimal | null
): WealthTargetComparison {
  if (targets.length === 0) return { status: "not-configured" }
  const supportedAssetClasses = evidence.assetClasses.map(({ group }) => group)
  if (!targetsAreValid(targets, supportedAssetClasses)) {
    return { status: "unavailable", reason: "invalid-targets" }
  }
  const normalizedTolerance = validPercentage(tolerancePercentage ?? "0")
  if (normalizedTolerance === null) {
    return { status: "unavailable", reason: "invalid-tolerance" }
  }
  if (aggregate.status !== "complete") {
    return { status: "unavailable", reason: "valuation-incomplete" }
  }

  const participating = targets.filter(
    ({ percentage }) => compareDecimals(percentage, "0") === 1
  )
  const classesByGroup = new Map(
    evidence.assetClasses.map((assetClass) => [assetClass.group, assetClass])
  )
  const participatingClasses = participating.map((target) => ({
    target,
    assetClass: classesByGroup.get(target.assetClass) ?? null,
  }))
  if (
    participatingClasses.some(
      ({ assetClass }) => assetClass === null || assetClass.value === null
    )
  ) {
    return {
      status: "unavailable",
      reason: "participating-value-unavailable",
    }
  }

  const comparisonBase = participatingClasses.reduce<Decimal>(
    (total, { assetClass }) => addOrThrow(total, assetClass!.value!),
    "0"
  )
  if (compareDecimals(comparisonBase, "0") !== 1) {
    return { status: "unavailable", reason: "zero-comparison-base" }
  }

  const rows = participatingClasses.map<WealthTargetDriftRow>(
    ({ target, assetClass }) => {
      const currentRatio = divideDecimals(
        assetClass!.value!,
        comparisonBase,
        12
      )
      const targetRatio = divideDecimals(target.percentage, "100", 12)
      if (currentRatio === null || targetRatio === null) {
        throw new Error("Unable to calculate target allocation ratio")
      }
      const currentPercentage = multiplyDecimals(currentRatio, "100")
      const targetImpliedValue = multiplyDecimals(comparisonBase, targetRatio)
      if (currentPercentage === null || targetImpliedValue === null) {
        throw new Error("Unable to calculate target allocation values")
      }
      const gapPercentage = subtractDecimals(
        currentPercentage,
        target.percentage
      )
      const monetaryGap = subtractDecimals(
        assetClass!.value!,
        targetImpliedValue
      )
      if (gapPercentage === null || monetaryGap === null) {
        throw new Error("Unable to calculate target allocation gaps")
      }
      const unclampedLower = subtractDecimals(
        target.percentage,
        normalizedTolerance
      )
      const unclampedUpper = addDecimals(target.percentage, normalizedTolerance)
      if (unclampedLower === null || unclampedUpper === null) {
        throw new Error("Unable to calculate target allocation range")
      }
      const lowerBoundPercentage =
        compareDecimals(unclampedLower, "0") === -1 ? "0" : unclampedLower
      const upperBoundPercentage =
        compareDecimals(unclampedUpper, "100") === 1 ? "100" : unclampedUpper
      const belowLower = compareDecimals(
        currentPercentage,
        lowerBoundPercentage
      )
      const aboveUpper = compareDecimals(
        currentPercentage,
        upperBoundPercentage
      )
      if (belowLower === null || aboveUpper === null) {
        throw new Error("Unable to classify target allocation range")
      }
      return {
        assetClass: assetClass!,
        currentPercentage,
        targetPercentage: target.percentage,
        lowerBoundPercentage,
        upperBoundPercentage,
        gapPercentage,
        monetaryGap,
        status:
          belowLower === -1 ? "below" : aboveUpper === 1 ? "above" : "within",
      }
    }
  )

  const largestDeviation = rows
    .filter(({ status }) => status !== "within")
    .reduce<WealthTargetDriftRow | null>((largest, row) => {
      if (!largest) return row
      const currentAbsolute = absoluteDecimal(row.gapPercentage)
      const largestAbsolute = absoluteDecimal(largest.gapPercentage)
      if (currentAbsolute === null || largestAbsolute === null) return largest
      return compareDecimals(currentAbsolute, largestAbsolute) === 1
        ? row
        : largest
    }, null)

  return {
    status: "available",
    comparisonBase,
    rows,
    largestDeviation,
  }
}

export function getExcludedValuedTargetClasses(
  evidence: WealthAnalysisEvidence,
  targets: readonly WealthTarget[]
): WealthAssetClass[] {
  const targetsByClass = new Map(
    targets.map(({ assetClass, percentage }) => [assetClass, percentage])
  )
  return evidence.assetClasses.filter((assetClass) => {
    const target = targetsByClass.get(assetClass.group)
    return (
      target !== undefined &&
      compareDecimals(target, "0") === 0 &&
      assetClass.value !== null &&
      compareDecimals(assetClass.value, "0") === 1
    )
  })
}
