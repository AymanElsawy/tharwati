import { describe, expect, it } from "vitest"

import dialog from "./AccountValuationDialog.tsx?raw"

describe("AccountValuationDialog", () => {
  it("blocks a future valuation date before invoking the RPC", () => {
    expect(dialog).toContain("valuedOn > today")
    expect(dialog).toContain('t("accounts.validation.valuationDateFuture")')
    expect(dialog).toContain("max={today}")
  })

  it("stores structured methods for Business and keeps Real Estate method-free", () => {
    expect(dialog).toContain("businessValuationMethodOptions.map")
    expect(dialog).toContain('method === "other"')
    expect(dialog).toContain(
      "toStoredBusinessValuationMethod(method, customMethod)"
    )
    expect(dialog).toContain("isBusiness")
    expect(dialog).toContain(": null")
  })
})
