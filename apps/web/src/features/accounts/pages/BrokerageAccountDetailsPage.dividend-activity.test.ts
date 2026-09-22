import { describe, expect, it } from "vitest"
import page from "./BrokerageAccountDetailsPage.tsx?raw"
describe("Brokerage dividend activity", () => {
  it("derives cash, full, and partial dividend summaries from settlement legs", () => {
    expect(page).toContain('"brokerage_dividend_cash"')
    expect(page).toContain('"brokerage_dividend_reinvestment"')
    expect(page).toContain('"brokerage_dividend_partial_reinvestment"')
    expect(page).toContain('"brokerage_dividend_partial_cash"')
    expect(page).toContain("function dividendActivityValues")
    expect(page).toContain("formatPortfolioAmount(dividend.net, accountCurrency, locale)")
    expect(page).toContain("hasPositive(quantity)")
    expect(page).toContain('t("brokerage.activityReinvested")')
    expect(page).toContain('t("brokerage.activityCash")')
    expect(page).toContain('dividend?.partial && assetEntry?.asset')
  })
})
