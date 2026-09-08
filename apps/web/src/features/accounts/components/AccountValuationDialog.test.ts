import { describe, expect, it } from "vitest"

import dialog from "./AccountValuationDialog.tsx?raw"

describe("AccountValuationDialog", () => {
  it("blocks a future valuation date before invoking the RPC", () => {
    expect(dialog).toContain("valuedOn > today")
    expect(dialog).toContain('t("accounts.validation.valuationDateFuture")')
    expect(dialog).toContain("max={today}")
  })
})
