import { describe, expect, it } from "vitest"
import {
  accountToFormValues,
  emptyAccountFormValues,
  getBusinessTypeLabel,
  getCreditCardAmountDue,
  getIndustryLabel,
  getPropertyTypeLabel,
  toAccountTypeSpecificFields,
} from "@/features/accounts/types/account-form"
import type { AccountSummary } from "@/lib/supabase/types"
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

  it("stores stable Business classification codes and preserves Other custom values", () => {
    expect(toAccountTypeSpecificFields({
      ...emptyAccountFormValues,
      accountTypeCode: "business",
      businessType: "llc",
      industry: "technology",
    })).toMatchObject({ businessType: "llc", industry: "technology" })

    expect(toAccountTypeSpecificFields({
      ...emptyAccountFormValues,
      accountTypeCode: "business",
      businessType: "other",
      businessTypeOther: "Community cooperative",
      industry: "other",
      industryOther: "Clean energy",
    })).toMatchObject({
      businessType: "other:Community cooperative",
      industry: "other:Clean energy",
    })
  })

  it("restores stored standard and custom Business values for edit mode", () => {
    const standard = accountToFormValues(account({ business_type: "partnership", industry: "retail" }))
    expect(standard).toMatchObject({ businessType: "partnership", businessTypeOther: "", industry: "retail", industryOther: "" })

    const custom = accountToFormValues(account({ business_type: "other:Family office", industry: "other:Media" }))
    expect(custom).toMatchObject({ businessType: "other", businessTypeOther: "Family office", industry: "other", industryOther: "Media" })
  })

  it("uses localized labels for stored standard codes and clean text for custom values", () => {
    const t = (key: string) => `label:${key}`
    expect(getBusinessTypeLabel("llc", t)).toBe("label:accounts.form.businessType.llc")
    expect(getIndustryLabel("technology", t)).toBe("label:accounts.form.industry.technology")
    expect(getIndustryLabel("other:Creative services", t)).toBe("Creative services")
    expect(getPropertyTypeLabel("villa", t)).toBe("label:accounts.form.propertyType.villa")
  })
})

function account(overrides: Partial<AccountSummary>): AccountSummary {
  return {
    id: "business-1", user_id: "user-1", account_type_code: "business", name: "Business",
    currency_code: "SAR", opening_balance: "0", notes: null, is_active: true,
    bank_subtype: null, credit_card_limit: null, due_day_of_month: null, investment_type: null,
    balance_grams: null, property_type: null, ownership_percentage: "100",
    initial_ownership_percentage: "100", closed_on: null, closed_reason: null,
    business_type: null, industry: null, location: null, metal_type: null, purity: null,
    purchase_date: null, cost_per_unit: null, created_at: "2026-08-28T00:00:00Z",
    updated_at: "2026-08-28T00:00:00Z", ...overrides,
  }
}
