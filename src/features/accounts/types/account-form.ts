import type { Translate } from "../../../i18n/context"
import type { AccountSummary } from "../../../lib/supabase/types"

export const accountTypeOptions = [
  { value: "cash", labelKey: "accountType.cash" },
  { value: "bank", labelKey: "accountType.bank" },
  { value: "brokerage", labelKey: "accountType.brokerage" },
  { value: "retirement", labelKey: "accountType.retirement" },
  { value: "deposit", labelKey: "accountType.deposit" },
  { value: "gold", labelKey: "accountType.gold" },
  { value: "real_estate", labelKey: "accountType.real_estate" },
  { value: "business", labelKey: "accountType.business" },
  { value: "other", labelKey: "accountType.other" },
] as const

export const currencyOptions = [
  { value: "USD", labelKey: "currency.USD" },
  { value: "SAR", labelKey: "currency.SAR" },
  { value: "EGP", labelKey: "currency.EGP" },
  { value: "EUR", labelKey: "currency.EUR" },
  { value: "GBP", labelKey: "currency.GBP" },
] as const

export const accountTypeCodes = accountTypeOptions.map(
  (option) => option.value,
) as [
  (typeof accountTypeOptions)[number]["value"],
  ...(typeof accountTypeOptions)[number]["value"][],
]

export const currencyCodes = currencyOptions.map(
  (option) => option.value,
) as [
  (typeof currencyOptions)[number]["value"],
  ...(typeof currencyOptions)[number]["value"][],
]

export type AccountFormValues = {
  name: string
  accountTypeCode: (typeof accountTypeCodes)[number]
  institutionName: string
  currencyCode: (typeof currencyCodes)[number]
  openingBalance: string
  notes: string
  isActive: boolean
}

export const emptyAccountFormValues: AccountFormValues = {
  name: "",
  accountTypeCode: "cash",
  institutionName: "",
  currencyCode: "USD",
  openingBalance: "0",
  notes: "",
  isActive: true,
}

export function accountToFormValues(
  account: AccountSummary,
): AccountFormValues {
  return {
    name: account.name,
    accountTypeCode:
      account.account_type_code as AccountFormValues["accountTypeCode"],
    institutionName: account.institution_name ?? "",
    currencyCode:
      account.currency_code as AccountFormValues["currencyCode"],
    openingBalance: account.opening_balance,
    notes: account.notes ?? "",
    isActive: account.is_active,
  }
}

export function getAccountTypeLabel(code: string, t: Translate): string {
  const option = accountTypeOptions.find((item) => item.value === code)
  return option ? t(option.labelKey) : code.replaceAll("_", " ")
}
