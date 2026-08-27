import { describe, expect, it } from "vitest"
import dialog from "./BrokerageDividendDialog.tsx?raw"

describe("BrokerageDividendDialog", () => {
  it("preserves the Cash Dividend submission, notes, errors, and saving state", () => {
    expect(dialog).toContain("addBrokerageCashDividend(input)")
    expect(dialog).toContain("p_notes:notes.trim()||null")
    expect(dialog).toContain("setSaving(true)")
    expect(dialog).toContain('t("brokerage.dividendError")')
    expect(dialog).toContain('t("brokerage.netDividend")')
  })

  it("shows DRIP fields and preview only in Reinvest mode", () => {
    expect(dialog).toContain("reinvest?<label>{t(\"brokerage.reinvestmentUnitPrice\")}")
    expect(dialog).toContain("preview.quantityAdded??\"--\"")
    expect(dialog).toContain("addBrokerageDividendReinvestment({...input,p_unit_price:unitPrice})")
  })

  it("blocks cross-currency assets for both modes", () => {
    expect(dialog).toContain("asset&&!same")
    expect(dialog).toContain('t("brokerage.dividendCrossCurrencyUnsupported")')
    expect(dialog).toContain("!!account&&!!asset&&same")
  })
})
