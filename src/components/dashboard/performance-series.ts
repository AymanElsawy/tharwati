export type SeriesPerformance = {
  currentValue: number
  difference: number
  percentage: number
  isPositive: boolean
}

/**
 * Presentation-only calculation for the dashboard's static chart series.
 * This is not a ledger-backed financial calculation.
 */
export function calculateSeriesPerformance(
  values: readonly number[],
): SeriesPerformance {
  const firstValue = values[0] ?? 0
  const lastValue = values[values.length - 1] ?? 0
  const difference = lastValue - firstValue
  return {
    currentValue: lastValue,
    difference,
    percentage:
      firstValue > 0 ? (difference / firstValue) * 100 : 0,
    isPositive: difference >= 0,
  }
}
