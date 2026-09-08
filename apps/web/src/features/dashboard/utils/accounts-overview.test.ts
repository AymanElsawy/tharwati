import { describe, expect, it } from "vitest"

import { buildDashboardAccountsOverview, dashboardAccountsOverviewRoute } from "./accounts-overview"
import type { AccountSummary } from "@/lib/supabase/types"

function account(overrides: Partial<AccountSummary>): AccountSummary {
  return {
    id: "account",
    user_id: "user",
    account_type_code: "cash",
    name: "Account",
    currency_code: "USD",
    opening_balance: "0",
    is_active: true,
    notes: null,
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("Dashboard Accounts Overview", () => {
  it("groups snapshot values in the profile base currency with decimal-safe arithmetic", () => {
    const result = buildDashboardAccountsOverview({
      baseCurrencyCode: "SAR",
      accounts: [
        account({ id: "cash", account_type_code: "cash", currency_code: "SAR" }),
        account({ id: "brokerage", account_type_code: "brokerage", currency_code: "USD" }),
        account({ id: "property", account_type_code: "real_estate", currency_code: "SAR" }),
      ],
      currentValues: new Map([["cash", "1.0000000002"], ["brokerage", "10"], ["property", "200"]]),
      rates: new Map([["USD/SAR", "3.75"]]),
    })
    expect(result).toEqual([
      { group: "cash", accountCount: 1, totalCurrentValueBase: "1.0000000002" },
      { group: "brokerage", accountCount: 1, totalCurrentValueBase: "37.5" },
      { group: "real_estate", accountCount: 1, totalCurrentValueBase: "200" },
    ])
  })

  it("uses snapshot Brokerage and Gold/Silver values while excluding Bank Credit", () => {
    const result = buildDashboardAccountsOverview({
      baseCurrencyCode: "USD",
      accounts: [
        account({ id: "bank-debit", account_type_code: "bank", bank_subtype: "debit" }),
        account({ id: "bank-credit", account_type_code: "bank", bank_subtype: "credit" }),
        account({ id: "gold", account_type_code: "gold", metal_type: "gold" }),
        account({ id: "silver", account_type_code: "gold", metal_type: "silver" }),
      ],
      currentValues: new Map([["bank-debit", "20"], ["bank-credit", "999"], ["gold", "30"], ["silver", "40"]]),
      rates: new Map(),
    })
    expect(result).toEqual([
      { group: "bank", accountCount: 1, totalCurrentValueBase: "20" },
      { group: "gold", accountCount: 1, totalCurrentValueBase: "30" },
      { group: "silver", accountCount: 1, totalCurrentValueBase: "40" },
    ])
  })

  it("marks a whole group unavailable when any required current value or rate is unavailable", () => {
    const result = buildDashboardAccountsOverview({
      baseCurrencyCode: "USD",
      accounts: [
        account({ id: "one", account_type_code: "cash" }),
        account({ id: "two", account_type_code: "cash", currency_code: "EUR" }),
      ],
      currentValues: new Map([["one", "10"], ["two", null]]),
      rates: new Map(),
    })
    expect(result).toEqual([{ group: "cash", accountCount: 2, totalCurrentValueBase: null }])
  })

  it("links every group to its matching Accounts filter while preserving metal filters", () => {
    expect(dashboardAccountsOverviewRoute("cash")).toBe("/accounts?type=cash")
    expect(dashboardAccountsOverviewRoute("bank")).toBe("/accounts?type=bank")
    expect(dashboardAccountsOverviewRoute("brokerage")).toBe("/accounts?type=brokerage")
    expect(dashboardAccountsOverviewRoute("gold")).toBe("/accounts?type=gold&metal=gold")
    expect(dashboardAccountsOverviewRoute("silver")).toBe("/accounts?type=gold&metal=silver")
    expect(dashboardAccountsOverviewRoute("real_estate")).toBe("/accounts?type=real_estate")
    expect(dashboardAccountsOverviewRoute("business")).toBe("/accounts?type=business")
    expect(dashboardAccountsOverviewRoute("other")).toBe("/accounts?type=other")
  })
})
