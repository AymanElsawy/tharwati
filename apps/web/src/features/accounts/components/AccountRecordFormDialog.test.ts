import { describe, expect, it } from "vitest"

import dialog from "./AccountRecordFormDialog.tsx?raw"

describe("AccountRecordFormDialog amount direction", () => {
  it("isolates amount value and currency suffix from RTL layout", () => {
    expect(dialog).toContain('<div className="relative" dir="ltr">')
    expect(dialog).toContain("className={`${field} pe-16`}")
    expect(dialog).toContain('inputMode="decimal"')
    expect(dialog).toContain(
      "pointer-events-none absolute inset-y-0 end-3 flex items-center"
    )
  })

  it("renders distinct localized account labels while submitting account UUIDs", () => {
    expect(dialog).toContain("getAccountPickerOptions(accounts, t)")
    expect(dialog).toContain("key={option.value} value={option.value}")
  })
})
