import { compareDecimals } from "../../../lib/financial-calculations"
import type {
  HoldingSort,
  HoldingSortKey,
  HoldingView,
} from "../types/holding-view"

function requireDecimalComparison(
  left: string | null,
  right: string | null,
): number {
  const comparison = compareDecimals(left ?? "0", right ?? "0")
  if (comparison === null) {
    throw new TypeError("Holding sort received an invalid decimal value")
  }
  return comparison
}

function compareHoldingViews(
  left: HoldingView,
  right: HoldingView,
  key: HoldingSortKey,
): number {
  if (key === "asset") {
    return left.holding.asset.name.localeCompare(
      right.holding.asset.name,
    )
  }
  if (key === "account") {
    return left.holding.account.name.localeCompare(
      right.holding.account.name,
    )
  }
  if (key === "quantity") {
    return requireDecimalComparison(
      left.financials.quantity,
      right.financials.quantity,
    )
  }
  if (key === "averageCost") {
    return requireDecimalComparison(
      left.financials.averageCost,
      right.financials.averageCost,
    )
  }
  return requireDecimalComparison(
    left.financials.totalCostBasis,
    right.financials.totalCostBasis,
  )
}

export function sortHoldingViews(
  holdings: readonly HoldingView[],
  sort: HoldingSort,
): HoldingView[] {
  return holdings
    .map((view, originalIndex) => ({ view, originalIndex }))
    .sort((left, right) => {
      const comparison = compareHoldingViews(
        left.view,
        right.view,
        sort.key,
      )
      const directedComparison =
        sort.direction === "ascending"
          ? comparison
          : -comparison
      return directedComparison || left.originalIndex - right.originalIndex
    })
    .map(({ view }) => view)
}
