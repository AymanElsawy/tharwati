export type DashboardValuationHoldingRuntime = {
  account_id: string
  asset_id: string
  quantity: string | number
  asset: { currency_code: string; asset_type_code: string } | null
}

export type DashboardValuationHolding = Omit<DashboardValuationHoldingRuntime, "quantity"> & {
  quantity: string
}

export function normalizeDashboardValuationHolding(
  holding: DashboardValuationHoldingRuntime,
): DashboardValuationHolding {
  return { ...holding, quantity: String(holding.quantity) }
}
