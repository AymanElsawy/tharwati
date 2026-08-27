import { describe, expect, it } from "vitest"

import { getBankCreditSummary } from "./bank-credit-summary"
import recordsPage from "../pages/AccountRecordsPage.tsx?raw"

describe("getBankCreditSummary", () => {
  it("exposes credit limit, ledger-projected available credit, and decimal-safe amount due", () => {
    expect(getBankCreditSummary({ creditCardLimit: "1000.25", currentBalance: "700.10", dueDayOfMonth: 15 })).toEqual({
      creditLimit: "1000.25", availableCredit: "700.10", amountDue: "300.15", dueDayOfMonth: 15,
    })
  })

  it("keeps a zero amount due", () => {
    expect(getBankCreditSummary({ creditCardLimit: "1000", currentBalance: "1000", dueDayOfMonth: null })).toMatchObject({ amountDue: "0", dueDayOfMonth: null })
  })

  it("returns unavailable for missing or invalid credit inputs", () => {
    expect(getBankCreditSummary({ creditCardLimit: null, currentBalance: "500", dueDayOfMonth: null })).toBeNull()
    expect(getBankCreditSummary({ creditCardLimit: "1000", currentBalance: null, dueDayOfMonth: null })).toBeNull()
    expect(getBankCreditSummary({ creditCardLimit: "0", currentBalance: "0", dueDayOfMonth: null })).toBeNull()
    expect(getBankCreditSummary({ creditCardLimit: "100", currentBalance: "101", dueDayOfMonth: null })).toBeNull()
  })

  it("keeps non-credit Bank headers on the existing AccountValue presentation", () => {
    expect(recordsPage).toContain('const isBankCredit = account.account_type_code === "bank" && account.bank_subtype === "credit"')
    expect(recordsPage).toContain('isBankCredit ? <BankCreditSummary')
    expect(recordsPage).toContain(': <AccountValue value={resolvedAccountValue}')
  })
})
