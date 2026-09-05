import type { Translate } from "@/i18n/context"
import type { AccountSummary } from "@/lib/supabase/types"

import {
  bankSubtypeOptions,
  getAccountTypeLabel,
  metalTypeOptions,
} from "../types/account-form"

export function getAccountDisplayTypeLabel(
  account: AccountSummary,
  t: Translate
): string {
  if (account.account_type_code === "gold" && account.metal_type) {
    const metalType = metalTypeOptions.find(
      (option) => option.value === account.metal_type
    )
    if (metalType) return t(metalType.labelKey)
  }

  const accountType = getAccountTypeLabel(account.account_type_code, t)
  if (account.account_type_code !== "bank" || !account.bank_subtype) {
    return accountType
  }

  const bankSubtype = bankSubtypeOptions.find(
    (option) => option.value === account.bank_subtype
  )
  return bankSubtype ? `${accountType} ${t(bankSubtype.labelKey)}` : accountType
}

export function getAccountDisplayLabel(
  account: AccountSummary,
  t: Translate
): string {
  return `${account.name} — ${getAccountDisplayTypeLabel(account, t)} — ${account.currency_code}`
}

export type AccountPickerOption = {
  value: AccountSummary["id"]
  label: string
}

/** Builds native-select option data while keeping the submitted account UUID separate from its label. */
export function getAccountPickerOptions(
  accounts: readonly AccountSummary[],
  t: Translate
): AccountPickerOption[] {
  return accounts.map((account) => ({
    value: account.id,
    label: getAccountDisplayLabel(account, t),
  }))
}
