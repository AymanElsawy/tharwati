import { describe, expect, it } from "vitest"

import dialog from "./AccountValuationDialog.tsx?raw"

describe("AccountValuationDialog", () => {
  it("blocks a future valuation date before invoking the RPC", () => {
    expect(dialog).toContain("valuedOn > today")
    expect(dialog).toContain('t("accounts.validation.valuationDateFuture")')
    expect(dialog).toContain("max={today}")
  })

  it("stores account-aware structured methods for Business and Real Estate", () => {
    expect(dialog).toContain("valuationMethodOptionsByAccountType")
    expect(dialog).toContain("valuationMethodOptions.map")
    expect(dialog).toContain('method === "other"')
    expect(dialog).toContain("toStoredValuationMethod(")
    expect(dialog).toContain('account.account_type_code === "real_estate"')
    expect(dialog).toContain("valuationAccountType")
    expect(dialog).toContain(": null")
  })
})
