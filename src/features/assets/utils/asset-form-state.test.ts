import { describe, expect, it } from "vitest"

import type { AssetFormValues } from "@/features/assets/types/asset-form"
import { hasMeaningfulAssetChanges, normalizeAssetForm } from "./asset-form-state"

const initial: AssetFormValues = { assetTypeCode: "stock", name: "NVIDIA", symbol: "NVDA", currencyCode: "USD", exchange: "XNAS", isActive: true }

describe("asset form state", () => {
  it("ignores business-field whitespace in dirty comparisons", () => {
    expect(hasMeaningfulAssetChanges({ ...initial, name: " NVIDIA " }, initial)).toBe(false)
  })

  it("becomes clean again when meaningful values are reverted", () => {
    expect(hasMeaningfulAssetChanges({ ...initial, symbol: "NVDA2" }, initial)).toBe(true)
    expect(hasMeaningfulAssetChanges(initial, initial)).toBe(false)
  })

  it("normalizes business fields without changing financial values", () => {
    expect(normalizeAssetForm({ ...initial, exchange: " XNAS " })).toEqual(initial)
  })

  it("preserves sequential multi-character input as meaningful form state", () => {
    const values = ["N", "NV", "NVD", "NVDA"].map((name) => ({ ...initial, name }))
    expect(values.map((value) => value.name)).toEqual(["N", "NV", "NVD", "NVDA"])
    expect(values.every((value) => hasMeaningfulAssetChanges(value, initial))).toBe(true)
  })
})
