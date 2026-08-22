import { describe, expect, it } from "vitest"

import { resolveAccountCurrentValues } from "./account-values.service"
import type { AccountSummary } from "@/lib/supabase/types"

function account(id: string, type: AccountSummary["account_type_code"], openingBalance: string, extras: Partial<AccountSummary> = {}): AccountSummary {
  return {
    id,
    user_id: "user-1",
    account_type_code: type,
    name: id,
    currency_code: "EGP",
    opening_balance: openingBalance,
    notes: null,
    is_active: true,
    bank_subtype: null,
    credit_card_limit: null,
    due_day_of_month: null,
    investment_type: null,
    balance_grams: null,
    property_type: null,
    ownership_percentage: null,
    business_type: null,
    industry: null,
    metal_type: null,
    purity: null,
    purchase_date: null,
    cost_per_unit: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...extras,
  }
}

describe("resolveAccountCurrentValues", () => {
  it("uses ledger balances for Cash/Bank, live transaction-derived value for metals, and stored values otherwise", () => {
    const values = resolveAccountCurrentValues({
      accounts: [
        account("cash", "cash", "100"),
        account("credit", "bank", "8000", { bank_subtype: "credit", credit_card_limit: "10000" }),
        account("gold", "gold", "0", { metal_type: "gold", balance_grams: "999" }),
        account("brokerage", "brokerage", "400"),
        account("property", "real_estate", "500"),
        account("business", "business", "600"),
        account("other", "other", "700"),
      ],
      recordBalances: new Map([["cash", "125"], ["credit", "7500"]]),
      metalPurchases: [{
        id: "purchase-1",
        accountId: "gold",
        purity: "24k",
        purchaseDate: "2026-08-01",
        unitsGrams: "10",
        costPerUnit: "50",
        fees: "0",
        totalAmount: "500",
        currencyCode: "EGP",
        fundingMode: "external",
        fundingAccountId: null,
        fundingTransactionId: null,
        notes: null,
        createdAt: "2026-08-01T00:00:00Z",
      }],
      metalCurrentPrices: new Map([["gold", "60"]]),
    })

    expect(values).toEqual(new Map([
      ["cash", "125"],
      ["credit", "7500"],
      ["gold", "600"],
      ["brokerage", "400"],
      ["property", "500"],
      ["business", "600"],
      ["other", "700"],
    ]))
  })

  it("uses each metal purchase purity when resolving an account value", () => {
    const values = resolveAccountCurrentValues({
      accounts: [account("gold", "gold", "0", { metal_type: "gold" })],
      recordBalances: new Map(),
      metalPurchases: [
        {
          id: "24k",
          accountId: "gold",
          purity: "24k",
          purchaseDate: "2026-08-01",
          unitsGrams: "10",
          costPerUnit: "50",
          fees: "0",
          totalAmount: "500",
          currencyCode: "EGP",
          fundingMode: "external",
          fundingAccountId: null,
          fundingTransactionId: null,
          notes: null,
          createdAt: "2026-08-01T00:00:00Z",
        },
        {
          id: "22k",
          accountId: "gold",
          purity: "22k",
          purchaseDate: "2026-08-01",
          unitsGrams: "12",
          costPerUnit: "50",
          fees: "0",
          totalAmount: "600",
          currencyCode: "EGP",
          fundingMode: "external",
          fundingAccountId: null,
          fundingTransactionId: null,
          notes: null,
          createdAt: "2026-08-01T00:00:00Z",
        },
      ],
      metalCurrentPrices: new Map([["gold", "60"]]),
    })

    expect(values.get("gold")).toBe("1260.00000000000000024")
  })
})
