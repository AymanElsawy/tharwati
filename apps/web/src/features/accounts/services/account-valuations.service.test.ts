import { describe, expect, it } from "vitest"

import { attributableValuation } from "./account-valuations.service"
import type { AccountValuation } from "../types/account-valuation"

const valuation: AccountValuation = { id: "v", accountId: "property", valuationAmount: "100.01", valuedOn: "2026-08-28", valuationMethod: null, notes: null, correctsValuationId: null, createdAt: "2026-08-28T00:00:00Z" }

describe("attributableValuation", () => {
  it("uses decimal-safe full valuation times ownership percentage", () => {
    expect(attributableValuation(valuation, "33.33")).toBe("33.333333")
  })
  it("keeps an explicit zero valuation distinct from unavailable", () => {
    expect(attributableValuation({ ...valuation, valuationAmount: "0" }, "100")).toBe("0")
    expect(attributableValuation(null, "100")).toBeNull()
  })
  it("does not use legacy opening balance when valuation is missing", () => {
    expect(attributableValuation(null, "100")).not.toBe("999")
  })
})
