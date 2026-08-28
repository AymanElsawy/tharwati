import { describe, expect, it } from "vitest"

import { attributableValuation } from "./account-valuations.service"

describe("account disposal valuation inputs", () => {
  it("uses the server-derived remaining ownership percentage", () => {
    expect(attributableValuation({ id: "valuation", accountId: "account", valuationAmount: "900", valuedOn: "2026-08-28", valuationMethod: null, notes: null, correctsValuationId: null, createdAt: "2026-08-28T00:00:00Z" }, "40")).toBe("360")
  })

  it("keeps zero ownership distinct from unavailable ownership", () => {
    const valuation = { id: "valuation", accountId: "account", valuationAmount: "900", valuedOn: "2026-08-28", valuationMethod: null, notes: null, correctsValuationId: null, createdAt: "2026-08-28T00:00:00Z" }
    expect(attributableValuation(valuation, "0")).toBe("0")
    expect(attributableValuation(valuation, null)).toBeNull()
  })
})
