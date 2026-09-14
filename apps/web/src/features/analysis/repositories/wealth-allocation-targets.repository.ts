import type { DashboardAssetGroup } from "@/features/dashboard/services/dashboard-aggregate.service"
import { supabase } from "@/lib/supabase"
import {
  requireAuthenticatedUserId,
  requireQueryData,
} from "@/lib/supabase/repository"
import {
  toRepositoryError,
  type Json,
  type WealthAllocationTargetAssetClass,
} from "@/lib/supabase/types"

import type { WealthTarget } from "../domain/wealth-target-allocation"
import type { WealthTargetPlan } from "../domain/wealth-target-allocation"
import { mapStoredWealthTargetPlan } from "./wealth-allocation-targets.mapper"

const storageClassByAssetGroup: Record<
  Exclude<DashboardAssetGroup, "certificates">,
  WealthAllocationTargetAssetClass
> = {
  cashAndBank: "cash_and_bank",
  brokerage: "brokerage",
  goldAndSilver: "gold_and_silver",
  realEstate: "real_estate",
  business: "business",
  other: "other",
}

function failure(error: unknown, operation: string) {
  if (error) {
    throw toRepositoryError(
      error as Parameters<typeof toRepositoryError>[0],
      operation
    )
  }
}

export const wealthAllocationTargetsRepository = {
  async load(): Promise<WealthTargetPlan> {
    const operation = "wealthAllocationTargets.load"
    const userId = await requireAuthenticatedUserId(supabase, operation)
    const [targetsResult, preferenceResult] = await Promise.all([
      supabase
        .from("wealth_allocation_targets")
        .select("asset_class,target_percentage")
        .eq("user_id", userId)
        .order("asset_class"),
      supabase
        .from("wealth_allocation_target_preferences")
        .select("tolerance_percentage")
        .eq("user_id", userId)
        .maybeSingle(),
    ])
    const rows = requireQueryData(
      targetsResult.data,
      targetsResult.error,
      operation
    )
    failure(preferenceResult.error, operation)
    return mapStoredWealthTargetPlan(rows, preferenceResult.data)
  },

  async replace(
    targets: readonly WealthTarget[],
    tolerancePercentage: string
  ): Promise<void> {
    const operation = "wealthAllocationTargets.replace"
    const storedTargets = Object.fromEntries(
      targets.map(({ assetClass, percentage }) => [
        storageClassByAssetGroup[
          assetClass as Exclude<DashboardAssetGroup, "certificates">
        ],
        percentage,
      ])
    ) as Json
    const { error } = await supabase.rpc("replace_wealth_allocation_plan", {
      p_targets: storedTargets,
      p_tolerance_percentage: tolerancePercentage,
    })
    failure(error, operation)
  },
}
