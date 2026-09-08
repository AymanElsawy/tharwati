import { describe, expect, it } from "vitest"
import dialog from "./BrokerageDividendDialog.tsx?raw"

const compactDialog = dialog.replace(/\s+/g, "")

describe("BrokerageDividendDialog", () => {
  it("preserves the Cash Dividend submission, notes, errors, and saving state", () => {
    expect(compactDialog).toContain("addBrokerageCashDividend(input)")
    expect(compactDialog).toContain("p_notes:notes.trim()||null")
    expect(compactDialog).toContain("setSaving(true)")
    expect(compactDialog).toContain('t("brokerage.dividendError")')
    expect(compactDialog).toContain('t("brokerage.netDividend")')
  })

  it("shows DRIP fields and preview only in Reinvest mode", () => {
    expect(compactDialog).toContain('mode!=="cash"?(<label>{t("brokerage.reinvestmentUnitPrice")}')
    expect(compactDialog).toContain("preview.quantityAdded??\"--\"")
    expect(compactDialog).toContain("addBrokerageDividendReinvestment({...input,p_unit_price:unitPrice,})")
  })

  it("shows partial reinvestment fields and uses its dedicated submit path", () => {
    expect(compactDialog).toContain('typeDividendMode="cash"|"full"|"partial"')
    expect(compactDialog).toContain('t("brokerage.partialReinvest")')
    expect(compactDialog).toContain('t("brokerage.reinvestedAmount")')
    expect(compactDialog).toContain('t("brokerage.cashRemainder")')
    expect(compactDialog).toContain("addBrokeragePartialDividendReinvestment({...input,p_reinvested_amount:reinvestedAmount,p_unit_price:unitPrice,})")
    expect(compactDialog).toContain("compareDecimals(reinvestedAmount,preview.net)===-1")
  })

  it("blocks cross-currency assets for both modes", () => {
    expect(compactDialog).toContain("asset&&!same")
    expect(compactDialog).toContain('t("brokerage.dividendCrossCurrencyUnsupported")')
    expect(compactDialog).toContain("!!account&&!!asset&&same")
  })
})
