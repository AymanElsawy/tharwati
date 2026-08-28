import { describe, expect, it } from "vitest"

import { resolveAccountCurrentValues, resolveBrokerageCurrentValue } from "./account-values.service"
import type { AccountSummary } from "@/lib/supabase/types"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import type { HoldingValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"
import inventory from "../components/AccountInventory.tsx?raw"

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
  it("uses Available Cash for Brokerage accounts without positive holdings", () => {
    const values = resolveAccountCurrentValues({
      accounts: [
        account("cash", "cash", "100"),
        account("credit", "bank", "8000", { bank_subtype: "credit", credit_card_limit: "10000" }),
        account("gold", "gold", "0", { metal_type: "gold", balance_grams: "999" }),
        account("brokerage-cash-only", "brokerage", "400"),
        account("brokerage-open-holding", "brokerage", "500"),
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
      brokerageAvailableCash: new Map([
        ["brokerage-cash-only", "11150"],
        ["brokerage-open-holding", "70"],
      ]),
      brokerageAccountsWithPositiveHoldings: new Set(["brokerage-open-holding"]),
    })

    expect(values).toEqual(new Map([
      ["cash", "125"],
      ["credit", "7500"],
      ["gold", "600"],
      ["brokerage-cash-only", "11150"],
      ["brokerage-open-holding", null],
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
      brokerageAvailableCash: new Map(),
      brokerageAccountsWithPositiveHoldings: new Set(),
    })

    expect(values.get("gold")).toBe("1260.00000000000000024")
  })
})

describe("Brokerage incomplete Accounts-list fallback", () => {
  it("keeps incomplete Brokerage values unavailable instead of using opening balance", () => {
    const values = resolveAccountCurrentValues({
      accounts: [account("brokerage", "brokerage", "999")],
      recordBalances: new Map(),
      metalPurchases: [],
      metalCurrentPrices: new Map(),
      brokerageAvailableCash: new Map([["brokerage", "100"]]),
      brokerageAccountsWithPositiveHoldings: new Set(["brokerage"]),
      brokerageCurrentValues: new Map([[
        "brokerage",
        {
          value: null,
          availableCash: "100",
          holdingsMarketValue: null,
          totalCurrentCostBasis: null,
          unrealizedPnl: null,
          unrealizedPnlPercent: null,
          valuations: [],
          status: "incomplete",
          missingMarketPrice: true,
          missingExchangeRate: false,
        },
      ]]),
    })

    expect(values.get("brokerage")).toBeNull()
    expect(inventory).toContain('item.currentValueStatus === "incomplete"')
    expect(inventory).not.toContain("currentValueStatus === \"incomplete\" ? unavailableLabel : item.account.opening_balance")
  })
})

function holding(id: string, quantity: string): HoldingDetails {
  return { id, account_id: "brokerage", asset_id: id, quantity } as HoldingDetails
}

function valuation(holdingId: string, overrides: Partial<HoldingValuationResult> = {}): HoldingValuationResult {
  return {
    holdingId, assetId: holdingId, symbol: "TEST", assetName: "Test", assetType: "stock",
    quantity: "1", averageCost: "1", costBasisNative: "1", costBasisCurrency: "USD",
    marketPrice: "1", marketPriceCurrency: "USD", marketPriceTimestamp: "2026-08-26T00:00:00Z",
    marketPriceSource: "twelve_data", marketValueNative: "1", unrealizedGainLossNative: null,
    unrealizedReturnPercent: null, marketValueBase: "1", costBasisBase: "1", unrealizedGainLossBase: null,
    baseCurrency: "USD", missingMarketPrice: false, missingExchangeRate: [], stalePrice: false, ...overrides,
  }
}

describe("resolveBrokerageCurrentValue", () => {
  it("returns cash only when there are no positive holdings", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("zero", "0")], valuations: [] })).toMatchObject({ value: "100", status: "complete" })
  })

  it("adds one same-currency holding value", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("one", "2")], valuations: [valuation("one", { marketValueBase: "25" })] }).value).toBe("125")
  })

  it("adds multiple holdings without using cost basis", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "10", holdings: [holding("one", "1"), holding("two", "2")], valuations: [valuation("one", { marketValueBase: "12" }), valuation("two", { marketValueBase: "23" })] }).value).toBe("45")
  })

  it("supports cross-currency values when existing FX valuation is available", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("eur", "1")], valuations: [valuation("eur", { marketValueNative: "10", marketValueBase: "37.5", marketPriceCurrency: "EUR" })] }).value).toBe("137.5")
  })

  it("marks a missing market price incomplete instead of treating it as zero", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("missing", "1")], valuations: [valuation("missing", { marketPrice: null, marketValueBase: null, missingMarketPrice: true })] })).toMatchObject({ value: null, status: "incomplete", missingMarketPrice: true })
  })

  it("marks a missing FX rate incomplete", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("fx", "1")], valuations: [valuation("fx", { marketValueBase: null, missingExchangeRate: [{ sourceCurrencyCode: "EUR", destinationCurrencyCode: "USD" }] })] })).toMatchObject({ value: null, status: "incomplete", missingExchangeRate: true })
  })

  it("preserves decimal precision during aggregation", () => {
    expect(resolveBrokerageCurrentValue({ availableCash: "0.0000000001", holdings: [holding("precise", "1")], valuations: [valuation("precise", { marketValueBase: "0.2000000002" })] }).value).toBe("0.2000000003")
  })

  it("aggregates mixed holding gains and losses in account currency", () => {
    const result = resolveBrokerageCurrentValue({
      availableCash: "100",
      holdings: [holding("gain", "1"), holding("loss", "1")],
      valuations: [
        valuation("gain", { unrealizedGainLossBase: "25", costBasisBase: "100" }),
        valuation("loss", { unrealizedGainLossBase: "-10", costBasisBase: "50" }),
      ],
    })
    expect(result).toMatchObject({ unrealizedPnl: "15", totalCurrentCostBasis: "150", unrealizedPnlPercent: "10" })
  })

  it("aggregates total loss and leaves percentage unavailable for zero cost basis", () => {
    const loss = resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("loss", "1")], valuations: [valuation("loss", { unrealizedGainLossBase: "-10", costBasisBase: "50" })] })
    const zeroBasis = resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("zero", "1")], valuations: [valuation("zero", { unrealizedGainLossBase: "10", costBasisBase: "0" })] })
    expect(loss.unrealizedPnl).toBe("-10")
    expect(loss.unrealizedPnlPercent).toBe("-20")
    expect(zeroBasis).toMatchObject({ unrealizedPnl: "10", unrealizedPnlPercent: null })
  })

  it("does not aggregate total P/L when price or FX is missing and preserves precision", () => {
    const missing = resolveBrokerageCurrentValue({ availableCash: "100", holdings: [holding("missing", "1")], valuations: [valuation("missing", { unrealizedGainLossBase: null, costBasisBase: null, marketValueBase: null, missingMarketPrice: true })] })
    const precise = resolveBrokerageCurrentValue({ availableCash: "0.1", holdings: [holding("precise", "1"), holding("precise-2", "1")], valuations: [valuation("precise", { unrealizedGainLossBase: "0.2000000001", costBasisBase: "1.1" }), valuation("precise-2", { unrealizedGainLossBase: "0.3000000002", costBasisBase: "2.2" })] })
    expect(missing).toMatchObject({ unrealizedPnl: null, status: "incomplete" })
    expect(precise).toMatchObject({ unrealizedPnl: "0.5000000003", totalCurrentCostBasis: "3.3", unrealizedPnlPercent: "15.15151516" })
  })
})
