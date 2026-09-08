import { describe, expect, it } from "vitest"

import {
  businessValuationMethodCodes,
  getBusinessValuationMethodLabel,
  toStoredBusinessValuationMethod,
} from "./business-valuation-method"

const t = (key: string) => `translated:${key}`

describe("Business valuation methods", () => {
  it("exposes only approved stable codes", () => {
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
  })

  it("accepts approved codes and rejects localized labels", () => {
    expect(toStoredBusinessValuationMethod("owner_estimate", "")).toBe(
      "owner_estimate"
    )
    expect(toStoredBusinessValuationMethod("Owner estimate", "")).toBeNull()
  })

  it("stores meaningful trimmed Other text", () => {
    expect(toStoredBusinessValuationMethod("other", "  Custom method  ")).toBe(
      "other:Custom method"
    )
  })

  it.each([
    ["ordinary spaces", "   "],
    ["tabs", "\t\t"],
    ["newlines", "\n\r\n"],
    ["mixed ASCII and Unicode whitespace", " \t\n\u00a0\u2003\u3000"],
  ])("rejects %s in Other text", (_label, customMethod) => {
    expect(toStoredBusinessValuationMethod("other", customMethod)).toBeNull()
  })

  it("localizes codes, cleans Other, and preserves legacy text", () => {
    expect(getBusinessValuationMethodLabel("owner_estimate", t)).toBe(
      "translated:accounts.valuationMethod.ownerEstimate"
    )
    expect(getBusinessValuationMethodLabel("other:Custom model", t)).toBe(
      "Custom model"
    )
    expect(getBusinessValuationMethodLabel("Legacy free text", t)).toBe(
      "Legacy free text"
    )
    expect(getBusinessValuationMethodLabel(null, t)).toBeNull()
  })
})
