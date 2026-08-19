import { describe, expect, it } from "vitest"

import type { AccountSummary } from "@/lib/supabase/types"
import {
  mapMetalPurchaseHistoryRow,
  type MetalPurchaseHistoryRow,
} from "../repositories/metal-purchases.repository"
import {
  aggregateMetalPurchases,
  aggregateMetalPurchasesByPurity,
  aggregateValuedMetalPurchasesByPurity,
  buildAddMetalPurchaseCommand,
  getEligibleMetalFundingAccounts,
  getMetalCurrentValue,
  mapMetalPurchaseHistoryRows,
  valueMetalPurchases,
} from "./metal-purchases.service"

const ledgerRow = (
  id: string,
  accountId: string,
  units: string,
  costPerUnit: string,
  paymentAccountId: string | null,
  purity = "24k"
): MetalPurchaseHistoryRow => ({
  id,
  user_id: "user",
  account_id: accountId,
  purity,
  purchased_at: "2026-08-18",
  quantity_grams: units,
  cost_per_unit: costPerUnit,
  fees: "0",
  funding_mode: paymentAccountId ? "cash_account" : "external",
  funding_account_id: paymentAccountId,
  created_at: `2026-08-18T12:00:0${id}Z`,
})

describe("metal purchases service", () => {
  it("builds an accountless owner-contribution command by default", () => {
    expect(
      buildAddMetalPurchaseCommand("metal", {
        purity: "24k",
        purchaseDate: "2026-08-18",
        unitsGrams: "10",
        costPerUnit: "100",
        paidFromAccount: false,
        fundingAccountId: "ignored",
      })
    ).toMatchObject({
      accountId: "metal",
      fundingMode: "external",
      fundingAccountId: null,
      quantityGrams: "10",
      costPerUnit: "100",
    })
  })

  it("keeps ledger purchases separate and derives aggregate totals", () => {
    const purchases = mapMetalPurchaseHistoryRows([
      ledgerRow("3", "metal", "5", "80", null, "21k"),
      ledgerRow("2", "metal", "20", "85", null),
      ledgerRow("1", "metal", "10", "100", "cash"),
    ])
    expect(purchases.map((purchase) => purchase.id)).toEqual(["3", "2", "1"])
    expect(aggregateMetalPurchases(purchases).get("metal")).toEqual({
      purchaseCount: 3,
      totalUnitsGrams: "35",
      totalAmount: "3100",
    })
    expect(aggregateMetalPurchasesByPurity(purchases)).toEqual([
      {
        purity: "21k",
        transactionCount: 1,
        totalUnitsGrams: "5",
        totalAmount: "400",
      },
      {
        purity: "24k",
        transactionCount: 2,
        totalUnitsGrams: "30",
        totalAmount: "2700",
      },
    ])
  })

  it("returns only active cash, bank, or deposit funding accounts", () => {
    const account = (id: string, type: string, active = true) =>
      ({
        id,
        account_type_code: type,
        is_active: active,
      }) as AccountSummary
    expect(
      getEligibleMetalFundingAccounts([
        account("cash", "cash"),
        account("bank", "bank"),
        account("deposit", "deposit"),
        account("archived", "cash", false),
        account("other", "other"),
      ]).map((item) => item.id)
    ).toEqual(["cash", "bank", "deposit"])
  })

  it("normalizes numeric database values before aggregating", () => {
    expect(
      mapMetalPurchaseHistoryRow({
        ...ledgerRow("1", "metal", "10", "100", null),
        quantity_grams: 10 as unknown as string,
      }).quantity_grams
    ).toBe("10")
  })

  it("values each purchase from grams and the current price without changing historical cost", () => {
    const purchases = mapMetalPurchaseHistoryRows([
      ledgerRow("1", "metal", "10", "50", null),
    ])

    expect(getMetalCurrentValue("10", "75")).toBe("750")
    expect(valueMetalPurchases(purchases, "75")[0]).toMatchObject({
      costPerUnit: "50",
      totalAmount: "500",
      currentValue: "750",
    })
    expect(valueMetalPurchases(purchases, null)[0]?.currentValue).toBeNull()
  })

  it("derives purity totals from valued purchase transactions", () => {
    const purchases = valueMetalPurchases(
      mapMetalPurchaseHistoryRows([
        ledgerRow("1", "metal", "10", "50", null, "24k"),
        ledgerRow("2", "metal", "10", "50", null, "24k"),
      ]),
      "103.646"
    )

    expect(aggregateValuedMetalPurchasesByPurity(purchases)).toEqual([
      {
        purity: "24k",
        transactionCount: 2,
        totalUnitsGrams: "20",
        totalAmount: "1000",
        currentValue: "2072.92",
      },
    ])
  })
})
