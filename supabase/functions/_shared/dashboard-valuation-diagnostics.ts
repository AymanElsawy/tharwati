export const dashboardValuationStages = [
  "initialization",
  "snapshot_lookup",
  "accounts_query",
  "account_balances",
  "holdings_query",
  "metal_purchases",
  "market_prices_request",
  "build_account_values",
  "build_brokerage_values",
  "build_metal_values",
  "fx_conversion",
  "build_snapshot_payload",
  "snapshot_persistence",
  "response_serialization",
  "unexpected_runtime",
] as const

export type DashboardValuationStage = (typeof dashboardValuationStages)[number]

export function dashboardValuationReason(stage: unknown): DashboardValuationStage {
  return dashboardValuationStages.includes(stage as DashboardValuationStage)
    ? stage as DashboardValuationStage
    : "unexpected_runtime"
}
