import { describe, expect, it } from "vitest"

import {
  summarizeWealthTargetInputs,
  summarizeWealthToleranceInput,
} from "../domain/wealth-target-allocation"
import { mapStoredWealthTargetPlan } from "./wealth-allocation-targets.mapper"

const storedTargets = [
  { asset_class: "cash_and_bank" as const, target_percentage: 20 },
  { asset_class: "brokerage" as const, target_percentage: 30 },
  { asset_class: "gold_and_silver" as const, target_percentage: 10 },
  { asset_class: "real_estate" as const, target_percentage: 20 },
  { asset_class: "business" as const, target_percentage: 10 },
  { asset_class: "other" as const, target_percentage: 10 },
]

describe("wealth allocation target PostgREST mapping", () => {
  it("normalizes persisted numeric targets and tolerance to decimal strings", () => {
    const plan = mapStoredWealthTargetPlan(storedTargets, {
      tolerance_percentage: 5.25,
    })

    expect(plan.targets.map(({ percentage }) => percentage)).toEqual([
      "20",
      "30",
      "10",
      "20",
      "10",
      "10",
    ])
    expect(plan.tolerancePercentage).toBe("5.25")

    const inputs = Object.fromEntries(
      plan.targets.map(({ assetClass, percentage }) => [assetClass, percentage])
    )
    expect(() =>
      summarizeWealthTargetInputs(
        inputs,
        plan.targets.map(({ assetClass }) => assetClass)
      )
    ).not.toThrow()
    expect(
      summarizeWealthTargetInputs(
        inputs,
        plan.targets.map(({ assetClass }) => assetClass)
      ).isValid
    ).toBe(true)
    expect(summarizeWealthToleranceInput(plan.tolerancePercentage)).toEqual({
      isValid: true,
      tolerancePercentage: "5.25",
    })
  })

  it("uses zero tolerance for persisted targets without a preference row", () => {
    const plan = mapStoredWealthTargetPlan(
      storedTargets.map((target) => ({
        ...target,
        target_percentage: String(target.target_percentage),
      })),
      null
    )

    expect(plan.targets[0]?.percentage).toBe("20")
    expect(plan.tolerancePercentage).toBe("0")
  })

  it("does not make an inexact saved total valid", () => {
    const plan = mapStoredWealthTargetPlan(
      storedTargets.map((target, index) => ({
        ...target,
        target_percentage: index === 0 ? 19.999999 : target.target_percentage,
      })),
      { tolerance_percentage: 5 }
    )
    const inputs = Object.fromEntries(
      plan.targets.map(({ assetClass, percentage }) => [assetClass, percentage])
    )

    expect(
      summarizeWealthTargetInputs(
        inputs,
        plan.targets.map(({ assetClass }) => assetClass)
      ).isValid
    ).toBe(false)
  })
})
