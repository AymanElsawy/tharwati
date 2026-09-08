import { describe, expect, it } from "vitest"

import { ar } from "@/i18n/ar/translations"
import { en } from "@/i18n/en/translations"
import type { Translate } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/en/translations"
import type { AccountSummary } from "@/lib/supabase/types"

import {
  getAccountDisplayLabel,
  getAccountPickerOptions,
} from "./account-display-label"

const account = (bankSubtype: "debit" | "credit"): AccountSummary =>
  ({
    id: bankSubtype,
    name: "Misr",
    account_type_code: "bank",
    bank_subtype: bankSubtype,
    currency_code: "EGP",
  }) as AccountSummary

const translate = (dictionary: Record<TranslationKey, string>): Translate =>
  ((key) => dictionary[key]) as Translate

describe("getAccountDisplayLabel", () => {
  it("distinguishes Bank Debit and Bank Credit while identity remains external", () => {
    expect(getAccountDisplayLabel(account("debit"), translate(en))).toBe(
      "Misr — Bank Debit — EGP"
    )
    expect(getAccountDisplayLabel(account("credit"), translate(en))).toBe(
      "Misr — Bank Credit — EGP"
    )
  })

  it("uses localized Arabic account-type labels", () => {
    const debit = getAccountDisplayLabel(account("debit"), translate(ar))
    const credit = getAccountDisplayLabel(account("credit"), translate(ar))

    expect(debit).toContain(ar["accounts.form.bankSubtype.debit"])
    expect(credit).toContain(ar["accounts.form.bankSubtype.credit"])
    expect(debit).not.toBe(credit)
  })

  it("provides distinct UUID-backed option data for same-name Bank Debit and Credit accounts", () => {
    const options = getAccountPickerOptions(
      [account("debit"), account("credit")],
      translate(en)
    )

    expect(options).toEqual([
      { value: "debit", label: "Misr — Bank Debit — EGP" },
      { value: "credit", label: "Misr — Bank Credit — EGP" },
    ])
  })
})
