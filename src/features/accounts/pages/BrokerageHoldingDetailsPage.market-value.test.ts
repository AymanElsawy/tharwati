import { describe, expect, it } from "vitest"

import page from "./BrokerageHoldingDetailsPage.tsx?raw"

describe("Brokerage holding market value contract", () => {
  it("uses portfolio valuation and decimal-safe asset-currency values", () => {
    expect(page).toContain("portfolioValuationService.calculate")
    expect(page).toContain("multiplyDecimals(holding.quantity, valuation.marketPrice)")
    expect(page).toContain('t("brokerage.currentPrice")')
    expect(page).toContain('t("brokerage.marketValue")')
  })

  it("discloses unavailable and cross-currency valuation states", () => {
    expect(page).toContain('t("brokerage.marketValueUnavailable")')
    expect(page).toContain('t("brokerage.marketValueStale")')
    expect(page).toContain('t("brokerage.accountCurrencyMarketValueUnavailable")')
    expect(page).toContain("valuation.marketValueBase")
  })
})