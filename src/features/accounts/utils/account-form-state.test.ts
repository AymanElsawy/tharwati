import { describe, expect, it } from "vitest"
import {
  emptyAccountFormValues,
  getCreditCardAmountDue,
  toAccountTypeSpecificFields,
} from "@/features/accounts/types/account-form"
import {
  hasMeaningfulAccountChanges,
  mergeWatchedAccountForm,
} from "./account-form-state"

describe("account form state", () => {
  it("treats untouched and reverted normalized values as clean", () => {
    expect(
      hasMeaningfulAccountChanges(
        emptyAccountFormValues,
        emptyAccountFormValues
      )
    ).toBe(false)
    expect(
      hasMeaningfulAccountChanges(
        { ...emptyAccountFormValues, name: "  " },
        emptyAccountFormValues
      )
    ).toBe(false)
  })
  it("preserves exact decimal changes beyond safe integer precision", () => {
    expect(
      hasMeaningfulAccountChanges(
        { ...emptyAccountFormValues, openingBalance: "9007199254740993.01" },
        emptyAccountFormValues
      )
    ).toBe(true)
  })
  it("normalizes the partial watched shape emitted while a successful form unmounts", () => {
    const merged = mergeWatchedAccountForm(
      { name: "Created" },
      emptyAccountFormValues
    )
    expect(() =>
      hasMeaningfulAccountChanges(merged, emptyAccountFormValues)
    ).not.toThrow()
    expect(merged.openingBalance).toBe("0")
  })
  it("derives amount due with decimal-safe subtraction", () => {
    expect(getCreditCardAmountDue("10000", "8000")).toBe("2000")
  })
  it("persists credit fields only for Bank Credit", () => {
    const credit = {
      ...emptyAccountFormValues,
      accountTypeCode: "bank" as const,
      bankSubtype: "credit" as const,
      openingBalance: "8000",
      creditCardLimit: "10000",
      dueDayOfMonth: "15",
    }
    expect(toAccountTypeSpecificFields(credit)).toMatchObject({
      openingBalance: "8000",
      bankSubtype: "credit",
      creditCardLimit: "10000",
      dueDayOfMonth: 15,
    })
    expect(
      toAccountTypeSpecificFields({ ...credit, bankSubtype: "debit" })
    ).toMatchObject({
      bankSubtype: "debit",
      creditCardLimit: null,
      dueDayOfMonth: null,
    })
  })
})
