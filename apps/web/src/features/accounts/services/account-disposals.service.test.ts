import { describe, expect, it } from "vitest"

import type { AccountSummary } from "@/lib/supabase/types"
import { attributableValuation } from "./account-valuations.service"
import { getEligibleDisposalDestinationAccounts } from "./account-disposals.service"

function account(id: string, type: AccountSummary["account_type_code"], currency: string, active = true) {
  return { id, account_type_code: type, currency_code: currency, is_active: active } as AccountSummary
}

describe("account disposal valuation inputs", () => {
  it("uses the server-derived remaining ownership percentage", () => {
    expect(attributableValuation({ id: "valuation", accountId: "account", valuationAmount: "900", valuedOn: "2026-08-28", valuationMethod: null, notes: null, correctsValuationId: null, createdAt: "2026-08-28T00:00:00Z" }, "40")).toBe("360")
  })

  it("keeps zero ownership distinct from unavailable ownership", () => {
    const valuation = { id: "valuation", accountId: "account", valuationAmount: "900", valuedOn: "2026-08-28", valuationMethod: null, notes: null, correctsValuationId: null, createdAt: "2026-08-28T00:00:00Z" }
    expect(attributableValuation(valuation, "0")).toBe("0")
    expect(attributableValuation(valuation, null)).toBeNull()
  })

  it("allows only active same-currency Cash and Bank destinations", () => {
    const accounts = [account("cash", "cash", "EGP"), account("bank", "bank", "EGP"), account("inactive", "cash", "EGP", false), account("wrong-type", "brokerage", "EGP"), account("wrong-currency", "bank", "SAR")]
    expect(getEligibleDisposalDestinationAccounts(accounts, "EGP").map(({ id }) => id)).toEqual(["cash", "bank"])
  })
})
