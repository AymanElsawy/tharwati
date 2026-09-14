import type { DashboardAssetGroup } from "@/features/dashboard/services/dashboard-aggregate.service"
import type { WealthAllocationTargetAssetClass } from "@/lib/supabase/types"
import type { Decimal } from "@/lib/supabase/types"

import type { WealthTargetPlan } from "../domain/wealth-target-allocation"

const assetGroupByStorageClass: Record<
  WealthAllocationTargetAssetClass,
  DashboardAssetGroup
> = {
  cash_and_bank: "cashAndBank",
  brokerage: "brokerage",
  gold_and_silver: "goldAndSilver",
  real_estate: "realEstate",
  business: "business",
  other: "other",
}

type StoredTarget = {
  asset_class: WealthAllocationTargetAssetClass
  target_percentage: unknown
}

type StoredPreference = {
  tolerance_percentage: unknown
} | null

function decimalStringFromPostgrest(
  value: unknown,
  fieldName: string
): Decimal {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  throw new TypeError(`${fieldName} is not a finite decimal value`)
}

/**
 * Normalizes PostgREST's runtime numeric representation before values enter the
 * decimal-string target domain. A missing preference has the product-default
 * zero tolerance.
 */
export function mapStoredWealthTargetPlan(
  rows: readonly StoredTarget[],
  preference: StoredPreference
): WealthTargetPlan {
  return {
    targets: rows.map((row) => ({
      assetClass: assetGroupByStorageClass[row.asset_class],
      percentage: decimalStringFromPostgrest(
        row.target_percentage,
        "target_percentage"
      ),
    })),
    tolerancePercentage:
      preference?.tolerance_percentage == null
        ? "0"
        : decimalStringFromPostgrest(
            preference.tolerance_percentage,
            "tolerance_percentage"
          ),
  }
}
