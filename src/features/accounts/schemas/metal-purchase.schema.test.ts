import { describe, expect, it } from "vitest"

import type { Translate } from "@/i18n/context"
import { createMetalPurchaseSchema } from "./metal-purchase.schema"

const t = ((key: string) => key) as Translate

describe("createMetalPurchaseSchema", () => {
  const base = {
    purchaseDate: "2026-08-17",
    unitsGrams: "10.250",
    costPerUnit: "100.00",
    paidFromAccount: false,
    fundingAccountId: "",
  }

  it("accepts purity values for the selected metal", () => {
    expect(
      createMetalPurchaseSchema("gold", t).safeParse({ ...base, purity: "24k" })
        .success
    ).toBe(true)
    expect(
      createMetalPurchaseSchema("silver", t).safeParse({
        ...base,
        purity: "925",
      }).success
    ).toBe(true)
  })

  it("rejects purity values belonging to the other metal", () => {
    expect(
      createMetalPurchaseSchema("gold", t).safeParse({ ...base, purity: "925" })
        .success
    ).toBe(false)
    expect(
      createMetalPurchaseSchema("silver", t).safeParse({
        ...base,
        purity: "24k",
      }).success
    ).toBe(false)
  })

  it("requires positive grams and cost per unit", () => {
    expect(
      createMetalPurchaseSchema("gold", t).safeParse({
        ...base,
        purity: "24k",
        unitsGrams: "0",
      }).success
    ).toBe(false)
    expect(
      createMetalPurchaseSchema("gold", t).safeParse({
        ...base,
        purity: "24k",
        costPerUnit: "-1",
      }).success
    ).toBe(false)
  })

  it("requires an account only when Paid from is enabled", () => {
    expect(
      createMetalPurchaseSchema("gold", t).safeParse({
        ...base,
        purity: "24k",
        paidFromAccount: true,
      }).success
    ).toBe(false)
    expect(
      createMetalPurchaseSchema("gold", t).safeParse({
        ...base,
        purity: "24k",
        paidFromAccount: true,
        fundingAccountId: "cash-account",
      }).success
    ).toBe(true)
  })
})
