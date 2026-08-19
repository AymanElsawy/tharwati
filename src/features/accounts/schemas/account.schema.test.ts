import { describe, expect, it } from "vitest"

import type { Translate } from "@/i18n/context"
import { emptyAccountFormValues } from "../types/account-form"
import { createAccountSchema } from "./account.schema"

const t = ((key: string) => key) as Translate

describe("createAccountSchema metal accounts", () => {
  it("requires only metal type and currency-specific base form data", () => {
    const result = createAccountSchema(t).safeParse({
      ...emptyAccountFormValues,
      accountTypeCode: "gold",
      metalType: "gold",
      name: "",
      purity: "",
      purchaseDate: "",
      balanceGrams: "",
      costPerUnit: "",
    })

    expect(result.success).toBe(true)
  })

  it("accepts Debit without credit-only fields", () => {
    expect(
      createAccountSchema(t).safeParse({
        ...emptyAccountFormValues,
        accountTypeCode: "bank",
        name: "Debit bank",
        bankSubtype: "debit",
        openingBalance: "500",
      }).success
    ).toBe(true)
  })

  it("validates Credit limit, optional due day, and available balance", () => {
    const schema = createAccountSchema(t)
    const valid = {
      ...emptyAccountFormValues,
      accountTypeCode: "bank" as const,
      name: "Credit bank",
      bankSubtype: "credit" as const,
      creditCardLimit: "10000",
      dueDayOfMonth: "15",
      openingBalance: "8000",
    }

    expect(schema.safeParse(valid).success).toBe(true)
    expect(schema.safeParse({ ...valid, dueDayOfMonth: "" }).success).toBe(true)
    expect(schema.safeParse({ ...valid, creditCardLimit: "0" }).success).toBe(
      false
    )
    expect(
      schema.safeParse({ ...valid, openingBalance: "10001" }).success
    ).toBe(false)
    expect(schema.safeParse({ ...valid, dueDayOfMonth: "32" }).success).toBe(
      false
    )
  })

  it("still requires names for non-metal accounts", () => {
    expect(
      createAccountSchema(t).safeParse({ ...emptyAccountFormValues, name: "" })
        .success
    ).toBe(false)
  })
})
