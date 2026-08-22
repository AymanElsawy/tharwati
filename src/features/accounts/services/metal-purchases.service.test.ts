import { describe, expect, it } from "vitest"

import type { AccountSummary } from "@/lib/supabase/types"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
import metalPurchaseMigration from "../../../../supabase/migrations/20260822130000_restructure_metal_purchases.sql?raw"
import metalPurchaseLifecycleMigration from "../../../../supabase/migrations/20260822140000_add_metal_purchase_lifecycle.sql?raw"
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
  getMetalPurityFactor,
  getPurityAdjustedMetalPricePerGram,
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
  notes: null,
  funding_mode: paymentAccountId ? "cash_account" : "external",
  funding_account_id: paymentAccountId,
  funding_transaction_id: paymentAccountId ? `transaction-${id}` : null,
  created_at: `2026-08-18T12:00:0${id}Z`,
})

describe("metal purchases service", () => {
  it("builds an accountless owner-contribution command by default", () => {
    const command = buildAddMetalPurchaseCommand("metal", {
        purity: "24k",
        purchaseDate: "2026-08-18T14:30",
        unitsGrams: "10",
        costPerUnit: "100",
        fees: "50",
        paidFromAccount: false,
        fundingAccountId: "ignored",
        notes: "  Purchase note  ",
      })
    expect(command).toMatchObject({
      accountId: "metal",
      fundingMode: "external",
      fundingAccountId: null,
      quantityGrams: "10",
      costPerUnit: "100",
      fees: "50",
      notes: "Purchase note",
    })
    expect(command.occurredAt).toBe(
      localDateTimeInputToIso("2026-08-18T14:30")
    )
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

  it("returns only active matching-currency cash and bank funding accounts", () => {
    const account = (id: string, type: string, active = true, currency = "EUR") =>
      ({
        id,
        account_type_code: type,
        is_active: active,
        currency_code: currency,
      }) as AccountSummary
    expect(
      getEligibleMetalFundingAccounts([
        account("cash", "cash"),
        account("bank", "bank"),
        account("deposit", "deposit"),
        account("archived", "cash", false),
        account("usd", "cash", true, "USD"),
        account("other", "other"),
      ], "EUR").map((item) => item.id)
    ).toEqual(["cash", "bank"])
  })

  it("normalizes numeric database values before aggregating", () => {
    expect(
      mapMetalPurchaseHistoryRow({
        ...ledgerRow("1", "metal", "10", "100", null),
        quantity_grams: 10 as unknown as string,
      }).quantity_grams
    ).toBe("10")
  })

  it("applies purity factors to current purchase values without changing historical cost", () => {
    const purchases = mapMetalPurchaseHistoryRows([
      ledgerRow("1", "metal", "10", "50", null),
    ])

    expect(getMetalCurrentValue("10", "75")).toBe("750")
    expect(getMetalPurityFactor("24k")).toBe("1")
    expect(getMetalPurityFactor("22k")).toBe("0.916666666666666667")
    expect(getMetalPurityFactor("18k")).toBe("0.75")
    expect(getMetalPurityFactor("999")).toBe("0.999")
    expect(getMetalPurityFactor("925")).toBe("0.925")
    expect(getMetalPurityFactor("other")).toBeNull()
    expect(getPurityAdjustedMetalPricePerGram("75", "24k")).toBe("75")
    expect(getPurityAdjustedMetalPricePerGram("75", "22k")).toBe("68.750000000000000025")
    expect(getPurityAdjustedMetalPricePerGram("75", "18k")).toBe("56.25")
    expect(getPurityAdjustedMetalPricePerGram("75", "999")).toBe("74.925")
    expect(valueMetalPurchases(purchases, "75")[0]).toMatchObject({
      costPerUnit: "50",
      totalAmount: "500",
      currentPricePerGram: "75",
      currentValue: "750",
    })
    const mixedPurityPurchases = valueMetalPurchases([
      ...purchases,
      { ...purchases[0]!, id: "silver", purity: "925" },
      { ...purchases[0]!, id: "other", purity: "other" },
    ], "75")
    expect(mixedPurityPurchases[1]).toMatchObject({
      id: "silver",
      currentPricePerGram: "69.375",
      currentValue: "693.75",
    })
    expect(mixedPurityPurchases[2]).toMatchObject({
      id: "other",
      currentPricePerGram: null,
      currentValue: null,
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
        currentPricePerGram: "103.646",
        currentValue: "2072.92",
      },
    ])
  })

  it("includes fees in historical total cost and aggregates", () => {
    const purchases = mapMetalPurchaseHistoryRows([
      { ...ledgerRow("1", "metal", "10", "100", null), fees: "50" },
    ])

    expect(purchases[0]).toMatchObject({ fees: "50", totalAmount: "1050" })
    expect(aggregateMetalPurchases(purchases).get("metal")?.totalAmount).toBe("1050")
  })

  it("restores legacy direct funding deductions before removing disposable purchases", () => {
    expect(metalPurchaseMigration).toContain(
      "purchase.quantity_grams * purchase.cost_per_unit + coalesce(purchase.fees, 0::numeric)"
    )
    expect(metalPurchaseMigration).not.toContain("disable trigger")
    expect(metalPurchaseMigration).not.toContain("enable trigger")
  })

  it("posts funded purchases as linked investment ledger movements", () => {
    expect(metalPurchaseMigration).toContain("'investment_purchase'")
    expect(metalPurchaseMigration).toContain("'metal_purchase_funding'")
    expect(metalPurchaseMigration).toContain("funding_transaction_id")
    expect(metalPurchaseMigration).toContain("from public.post_transaction")
  })

  it("keeps metal corrections append-only and reads only effective purchases", () => {
    expect(metalPurchaseLifecycleMigration).toContain(
      "create table public.metal_purchase_lifecycle_events"
    )
    expect(metalPurchaseLifecycleMigration).toContain("'investment_purchase_reversal'")
    expect(metalPurchaseLifecycleMigration).toContain(
      "create function public.reverse_metal_purchase("
    )
    expect(metalPurchaseLifecycleMigration).toContain(
      "create function public.correct_metal_purchase("
    )
    expect(metalPurchaseLifecycleMigration).toContain(
      "create function public.get_effective_metal_purchases("
    )
  })
})
