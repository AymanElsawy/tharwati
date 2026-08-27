import { describe, expect, it } from "vitest"
import page from "./BrokerageAccountDetailsPage.tsx?raw"
describe("Brokerage dividend activity", () => {
  it("uses the net cash entry, not the zero quantity asset entry, for the row amount", () => {
    expect(page).toContain('"brokerage_dividend_cash"')
    expect(page).toContain("formatAmount(dividendNet, accountCurrency, locale)")
  })
})
