import { describe, expect, it } from "vitest"
import page from "./BrokerageAccountDetailsPage.tsx?raw"
describe("Brokerage dividend activity", () => {
  it("uses the net cash entry, not the zero quantity asset entry, for the row amount", () => {
    expect(page).toContain('sumEntries(item.entries, "brokerage_dividend_cash", "account_amount")')
    expect(page).toContain("formatAmount(dividendNet, accountCurrency, locale)")
  })
})
