import { describe, expect, it } from "vitest"

import { calculateDashboardAggregate } from "./dashboard-aggregate.service"
import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import type { AccountSummary } from "@/lib/supabase/types"

function account(
  id: string,
  accountTypeCode: AccountSummary["account_type_code"],
  currencyCode = "USD",
  extra: Partial<AccountSummary> = {},
): AccountSummary {
  return {
    id,
    user_id: "user-1",
    account_type_code: accountTypeCode,
    name: id,
    currency_code: currencyCode,
    opening_balance: "0",
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
    created_at: "2026-08-27T00:00:00Z",
    updated_at: "2026-08-27T00:00:00Z",
    ...extra,
  }
}

function balance(accountId: string, currentBalance: string): AccountBalance {
  return {
    accountId,
    accountTypeCode: "bank",
    accountName: accountId,
    currencyCode: "USD",
    isActive: true,
    openingBalance: currentBalance,
    ledgerEffect: "0",
    currentBalance,
  }
}

const rates = (rate = "1") => ({
  resolveCurrentRate: async () => ({ rate }),
})

describe("calculateDashboardAggregate", () => {
  it("uses ledger-projected Cash and Bank values", async () => {
    const result = await calculateDashboardAggregate({
      baseCurrencyCode: "USD",
      accounts: [account("cash", "cash"), account("bank", "bank")],
      currentValues: new Map([["cash", "100.10"], ["bank", "200.20"]]),
      accountBalances: [],
      rates: rates(),
    })
    expect(result).toMatchObject({ status: "complete", totalAssets: "300.3", netWorth: "300.3" })
    expect(result.assetBreakdown.cashAndBank).toBe("300.3")
  })

  it("includes the existing Brokerage Current Value and live metal value", async () => {
    const result = await calculateDashboardAggregate({
      baseCurrencyCode: "USD",
      accounts: [account("brokerage", "brokerage"), account("gold", "gold")],
      currentValues: new Map([["brokerage", "150.25"], ["gold", "49.75"]]),
      accountBalances: [],
      rates: rates(),
    })
    expect(result).toMatchObject({ status: "complete", totalAssets: "200", netWorth: "200" })
    expect(result.assetBreakdown).toMatchObject({ brokerage: "150.25", goldAndSilver: "49.75" })
  })

  it("deducts Bank Credit amount due and never adds available credit as cash", async () => {
    const credit = account("credit", "bank", "USD", {
      bank_subtype: "credit",
      credit_card_limit: "1000",
    })
    const result = await calculateDashboardAggregate({
      baseCurrencyCode: "USD",
      accounts: [account("cash", "cash"), credit],
      currentValues: new Map([["cash", "400"], ["credit", "800"]]),
      accountBalances: [balance("credit", "800")],
      rates: rates(),
    })
    expect(result).toMatchObject({
      status: "complete",
      totalAssets: "400",
      totalLiabilities: "200",
      netWorth: "200",
    })
    expect(result.assetBreakdown.cashAndBank).toBe("400")
  })

  it("converts asset and liability values with the shared FX resolver", async () => {
    const credit = account("credit", "bank", "EUR", {
      bank_subtype: "credit",
      credit_card_limit: "100",
    })
    const result = await calculateDashboardAggregate({
      baseCurrencyCode: "USD",
      accounts: [account("cash", "cash", "EUR"), credit],
      currentValues: new Map([["cash", "50"], ["credit", "80"]]),
      accountBalances: [balance("credit", "80")],
      rates: rates("1.5"),
    })
    expect(result).toMatchObject({ totalAssets: "75", totalLiabilities: "30", netWorth: "45" })
  })

  it("is incomplete when Bank Credit liability inputs are missing", async () => {
    const credit = account("credit", "bank", "USD", { bank_subtype: "credit" })
    const result = await calculateDashboardAggregate({
      baseCurrencyCode: "USD",
      accounts: [credit],
      currentValues: new Map([["credit", "900"]]),
      accountBalances: [balance("credit", "900")],
      rates: rates(),
    })
    expect(result).toMatchObject({ status: "incomplete", totalAssets: null, totalLiabilities: null, netWorth: null })
    expect(result.unavailableSources).toEqual(["credit"])
  })

  it("preserves decimal precision through assets and liability subtraction", async () => {
    const credit = account("credit", "bank", "USD", {
      bank_subtype: "credit",
      credit_card_limit: "1.0000000003",
    })
    const result = await calculateDashboardAggregate({
      baseCurrencyCode: "USD",
      accounts: [account("cash", "cash"), credit],
      currentValues: new Map([["cash", "1.0000000002"], ["credit", "0.0000000001"]]),
      accountBalances: [balance("credit", "0.0000000001")],
      rates: rates(),
    })
    expect(result).toMatchObject({ totalAssets: "1.0000000002", totalLiabilities: "1.0000000002", netWorth: "0" })
  })
})
