export type DashboardValuationMetalPurchaseRuntime = {
  account_id: string
  purity: string
  quantity_grams: string | number
}

export type DashboardValuationMetalPurchase = Omit<DashboardValuationMetalPurchaseRuntime, "quantity_grams"> & {
  quantity_grams: string
}

export function normalizeDashboardValuationMetalPurchase(
  purchase: DashboardValuationMetalPurchaseRuntime,
): DashboardValuationMetalPurchase {
  return { ...purchase, quantity_grams: String(purchase.quantity_grams) }
}
