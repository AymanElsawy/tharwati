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

  it("still requires names for non-metal accounts", () => {
    expect(
      createAccountSchema(t).safeParse({ ...emptyAccountFormValues, name: "" })
        .success
    ).toBe(false)
  })
})
