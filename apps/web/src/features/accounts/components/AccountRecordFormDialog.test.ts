import { describe, expect, it } from "vitest"

import dialog from "./AccountRecordFormDialog.tsx?raw"
import moneyInput from "@/components/MoneyInput.tsx?raw"

describe("AccountRecordFormDialog amount direction", () => {
  it("isolates amount value and currency suffix from RTL layout", () => {
    expect(dialog).toContain('<div className="relative" dir="ltr">')
    expect(dialog).toContain("className={`${field} pe-16`}")
    expect(dialog).toContain("<MoneyInput")
    expect(moneyInput).toContain('inputMode="decimal"')
    expect(dialog).toContain(
      "pointer-events-none absolute inset-y-0 end-3 flex items-center"
    )
  })

  it("renders distinct localized account labels while submitting account UUIDs", () => {
    expect(dialog).toContain("getAccountPickerOptions(accounts, t)")
    expect(dialog).toContain("key={option.value} value={option.value}")
  })

  it("clears derived FX on sent-amount edits and blocks invalid Transfer submission", () => {
    expect(dialog).toContain("onAmountChange={invalidateFxPreview}")
    expect(dialog).toContain('setValue("receivedAmount", "")')
    expect(dialog).toContain('clearErrors("receivedAmount")')
    expect(dialog).toContain('(recordType === "transfer" && !validSentAmount)')
    expect(dialog).toContain("requestTransferFxPreview({")
  })

  it("suppresses an empty amount error until blur or another submit", () => {
    expect(dialog).toContain("visibleMoneyInputError(")
    expect(dialog).toContain('setSuppressedAtSubmitCount(value === "" ? submitCount : null)')
    expect(dialog).toContain("submitCount <= suppressedAtSubmitCount")
    expect(dialog).toContain("void trigger(name)")
  })

  it("does not render a dependent received-amount error for an invalid sent amount", () => {
    expect(dialog).toContain("validSentAmount ? errors.receivedAmount?.message : undefined")
    expect(dialog).toContain("disabled={!validSentAmount}")
  })
})
