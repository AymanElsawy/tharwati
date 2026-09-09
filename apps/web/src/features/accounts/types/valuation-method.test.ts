import { describe, expect, it } from "vitest"

import {
  businessValuationMethodCodes,
  getBusinessValuationMethodLabel,
  getValuationMethodLabel,
  realEstateValuationMethodCodes,
  toStoredBusinessValuationMethod,
  toStoredValuationMethod,
} from "./valuation-method"

const t = (key: string) => `translated:${key}`

describe("account valuation methods", () => {
  it("keeps the approved Business set and behavior unchanged", () => {
    expect(businessValuationMethodCodes).toEqual([
      "owner_estimate",
      "professional_appraisal",
      "market_comparison",
      "revenue_multiple",
      "ebitda_multiple",
      "discounted_cash_flow",
      "asset_based",
      "recent_transaction",
      "other",
    ])
    expect(toStoredBusinessValuationMethod("owner_estimate", "")).toBe("owner_estimate")
    expect(toStoredBusinessValuationMethod("Owner estimate", "")).toBeNull()
    expect(
      toStoredBusinessValuationMethod("other", "  Custom method  ")
    ).toBe("other:Custom method")
    expect(getBusinessValuationMethodLabel("owner_estimate", t)).toBe(
      "translated:accounts.valuationMethod.ownerEstimate"
    )
  })

  it("exposes only the approved Real Estate set", () => {
    expect(realEstateValuationMethodCodes).toEqual([
      "owner_estimate",
      "professional_appraisal",
      "market_comparison",
      "income_approach",
      "cost_approach",
      "recent_transaction",
      "other",
    ])
  })

  it("keeps the allowed sets account-type-aware", () => {
    expect(toStoredValuationMethod("real_estate", "income_approach", "")).toBe("income_approach")
    expect(toStoredValuationMethod("business", "income_approach", "")).toBeNull()
    expect(toStoredValuationMethod("business", "revenue_multiple", "")).toBe("revenue_multiple")
    expect(toStoredValuationMethod("real_estate", "revenue_multiple", "")).toBeNull()
    expect(toStoredValuationMethod("real_estate", "Owner estimate", "")).toBeNull()
  })

  it("stores meaningful trimmed Other text", () => {
    expect(toStoredValuationMethod("real_estate", "other", "  Custom method  ")).toBe("other:Custom method")
  })

  it.each([
    ["ordinary spaces", "   "],
    ["tabs", "\t\t"],
    ["newlines", "\n\r\n"],
    ["mixed ASCII and Unicode whitespace", " \t\n\u00a0\u2003\u3000"],
  ])("rejects %s in Other text", (_label, customMethod) => {
    expect(toStoredValuationMethod("real_estate", "other", customMethod)).toBeNull()
    expect(toStoredBusinessValuationMethod("other", customMethod)).toBeNull()
  })

  it("uses account-aware labels and preserves legacy text", () => {
    expect(getValuationMethodLabel("real_estate", "income_approach", t)).toBe(
      "translated:accounts.valuationMethod.incomeApproach"
    )
    expect(getValuationMethodLabel("business", "income_approach", t)).toBe("income_approach")
    expect(getValuationMethodLabel("real_estate", "other:Custom model", t)).toBe("Custom model")
    expect(getValuationMethodLabel("real_estate", "Legacy free text", t)).toBe("Legacy free text")
    expect(getValuationMethodLabel("real_estate", null, t)).toBeNull()
  })
})
