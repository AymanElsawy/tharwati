import { describe, expect, it } from "vitest"

import { resolveAccountListCurrentValue } from "./account-list-current-value"
import type { AccountSummary } from "@/lib/supabase/types"
import inventory from "../components/AccountInventory.tsx?raw"

function account(
  id: string,
  accountTypeCode: AccountSummary["account_type_code"],
  openingBalance = "100"
): AccountSummary {
  return {
    id,
    user_id: "user-1",
    account_type_code: accountTypeCode,
    name: id,
    currency_code: "SAR",
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
  }
}

function resolve(
  currentAccount: AccountSummary,
  values = new Map<string, string | null>(),
  isLoading = false,
  hasResolutionError = false
) {
  return resolveAccountListCurrentValue({
    account: currentAccount,
    values,
    statuses: new Map(),
    isLoading,
    hasResolutionError,
  })
}

describe("resolveAccountListCurrentValue", () => {
  it("renders an updating skeleton before either list layout can render a value", () => {
    expect(inventory).toContain("item.isCurrentValueLoading")
    expect(inventory).toContain("animate-pulse")
  })

  it.each(["cash", "bank", "brokerage"] as const)(
    "%s never renders opening balance while its current value loads",
    (type) => {
      expect(resolve(account(type, type), new Map(), true)).toEqual({
        value: null,
        isLoading: true,
        status: "complete",
      })
    }
  )

  it("shows Gold/Silver as loading until their live value resolves", () => {
    expect(resolve(account("gold", "gold"), new Map(), true)).toMatchObject({
      value: null,
      isLoading: true,
    })
  })

  it("shows an updating state before the first refresh effect starts", () => {
    expect(resolve(account("cash", "cash"))).toMatchObject({
      value: null,
      isLoading: true,
    })
  })

  it("uses the resolved current value for asynchronously valued accounts", () => {
    expect(
      resolve(account("brokerage", "brokerage"), new Map([["brokerage", "123.456"]]))
    ).toEqual({ value: "123.456", isLoading: false, status: "complete" })
  })

  it("keeps a failed current-value resolution unavailable", () => {
    expect(resolve(account("cash", "cash"), new Map(), false, true)).toEqual({
      value: null,
      isLoading: false,
      status: "incomplete",
    })
  })

  it.each(["real_estate", "business"] as const)(
    "%s never renders its legacy opening balance while valuation loads",
    (type) => {
      expect(resolve(account(type, type, "456"), new Map(), true)).toEqual({
        value: null,
        isLoading: true,
        status: "complete",
      })
    }
  )

  it.each(["real_estate", "business"] as const)(
    "%s renders its resolved attributable valuation, including explicit zero",
    (type) => {
      expect(resolve(account(type, type, "456"), new Map([[type, "123.45"]]))).toEqual({
        value: "123.45",
        isLoading: false,
        status: "complete",
      })
      expect(resolve(account(type, type, "456"), new Map([[type, "0"]]))).toEqual({
        value: "0",
        isLoading: false,
        status: "complete",
      })
    }
  )

  it.each(["real_estate", "business"] as const)(
    "%s shows unavailable when the shared valuation read has no effective value",
    (type) => {
      expect(resolve(account(type, type, "456"), new Map([[type, null]]))).toEqual({
        value: null,
        isLoading: false,
        status: "incomplete",
      })
    }
  )

  it("keeps Other as an immediate stored current value", () => {
    expect(resolve(account("other", "other", "456"), new Map(), true)).toEqual({
      value: "456",
      isLoading: false,
      status: "complete",
    })
  })
})
