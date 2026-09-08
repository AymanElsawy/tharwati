import { describe, expect, it } from "vitest"

import { createAccountSchema } from "./account.schema"
import { emptyAccountFormValues } from "../types/account-form"
import type { Translate } from "@/i18n/context"

const translate = ((key: string) => key) as Translate

describe("Business account classification validation", () => {
  it("accepts selected Business Type and Industry codes for create", () => {
    const result = createAccountSchema(translate).safeParse({
      ...emptyAccountFormValues,
      accountTypeCode: "business",
      name: "Studio",
      openingBalance: "100",
      businessType: "llc",
      industry: "technology",
    })
    expect(result.success).toBe(true)
  })

  it("requires custom values only when Other is selected", () => {
    const missingCustom = createAccountSchema(translate).safeParse({
      ...emptyAccountFormValues,
      accountTypeCode: "business",
      name: "Studio",
      openingBalance: "100",
      businessType: "other",
      industry: "other",
    })
    expect(missingCustom.success).toBe(false)

    const custom = createAccountSchema(translate).safeParse({
      ...emptyAccountFormValues,
      accountTypeCode: "business",
      name: "Studio",
      openingBalance: "100",
      businessType: "other",
      businessTypeOther: "Collective",
      industry: "other",
      industryOther: "Creative services",
    })
    expect(custom.success).toBe(true)
  })

  it.each(["real_estate", "business"] as const)(
    "rejects a future initial valuation date for %s",
    (accountTypeCode) => {
      const result = createAccountSchema(translate).safeParse({
        ...emptyAccountFormValues,
        accountTypeCode,
        name: "Valued account",
        openingBalance: "100",
        valuationDate: "2999-01-01",
        propertyType: accountTypeCode === "real_estate" ? "villa" : "",
        businessType: accountTypeCode === "business" ? "llc" : "",
        industry: accountTypeCode === "business" ? "technology" : "",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues).toEqual(expect.arrayContaining([
          expect.objectContaining({
            path: ["valuationDate"],
            message: "accounts.validation.valuationDateFuture",
          }),
        ]))
      }
    },
  )
})
