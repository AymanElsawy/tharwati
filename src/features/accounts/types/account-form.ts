import type { Translate } from "../../../i18n/context"
import type { AccountSummary } from "../../../lib/supabase/types"
import { multiplyDecimals } from "../../../lib/financial-calculations/decimal"

export const accountTypeOptions = [
  { value: "cash", labelKey: "accountType.cash", creationLabelKey: "accounts.type.cash" },
  { value: "bank", labelKey: "accountType.bank", creationLabelKey: "accounts.type.bank" },
  { value: "brokerage", labelKey: "accountType.brokerage", creationLabelKey: "accounts.type.brokerage" },
  { value: "gold", labelKey: "accountType.gold", creationLabelKey: "accounts.type.gold" },
  { value: "real_estate", labelKey: "accountType.real_estate", creationLabelKey: "accounts.type.realEstate" },
  { value: "business", labelKey: "accountType.business", creationLabelKey: "accounts.type.business" },
  { value: "other", labelKey: "accountType.other", creationLabelKey: "accounts.type.other" },
] as const

export const currencyOptions = [
  { value: "USD", labelKey: "currency.USD" },
  { value: "SAR", labelKey: "currency.SAR" },
  { value: "EGP", labelKey: "currency.EGP" },
  { value: "EUR", labelKey: "currency.EUR" },
  { value: "GBP", labelKey: "currency.GBP" },
] as const

export const bankSubtypeOptions = [
  { value: "debit", labelKey: "accounts.form.bankSubtype.debit" },
  { value: "credit", labelKey: "accounts.form.bankSubtype.credit" },
] as const

export const investmentTypeOptions = [
  { value: "stock_etf", labelKey: "accounts.form.investmentType.stockEtf" },
  { value: "crypto", labelKey: "accounts.form.investmentType.crypto" },
  { value: "other", labelKey: "accounts.form.investmentType.other" },
] as const

export const propertyTypeOptions = [
  { value: "apartment", labelKey: "accounts.form.propertyType.apartment" },
  { value: "villa", labelKey: "accounts.form.propertyType.villa" },
  { value: "land", labelKey: "accounts.form.propertyType.land" },
  { value: "office", labelKey: "accounts.form.propertyType.office" },
  { value: "other", labelKey: "accounts.form.propertyType.other" },
] as const

export const metalTypeOptions = [
  { value: "gold", labelKey: "accounts.form.metalType.gold" },
  { value: "silver", labelKey: "accounts.form.metalType.silver" },
] as const

export const goldPurityOptions = [
  { value: "24k", label: "24k" },
  { value: "22k", label: "22k" },
  { value: "21k", label: "21k" },
  { value: "18k", label: "18k" },
  { value: "14k", label: "14k" },
  { value: "10k", label: "10k" },
  { value: "9k", label: "9k" },
] as const

export const silverPurityOptions = [
  { value: "999", label: "999" },
  { value: "958", label: "958" },
  { value: "950", label: "950" },
  { value: "925", label: "925" },
  { value: "900", label: "900" },
  { value: "835", label: "835" },
  { value: "800", label: "800" },
] as const

export const purityOtherOption = { value: "other", labelKey: "accounts.form.purity.other" } as const

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

export const bankSubtypeCodes = bankSubtypeOptions.map(
  (option) => option.value,
) as [
  (typeof bankSubtypeOptions)[number]["value"],
  ...(typeof bankSubtypeOptions)[number]["value"][],
]

export const investmentTypeCodes = investmentTypeOptions.map(
  (option) => option.value,
) as [
  (typeof investmentTypeOptions)[number]["value"],
  ...(typeof investmentTypeOptions)[number]["value"][],
]

export const propertyTypeCodes = propertyTypeOptions.map(
  (option) => option.value,
) as [
  (typeof propertyTypeOptions)[number]["value"],
  ...(typeof propertyTypeOptions)[number]["value"][],
]

export const metalTypeCodes = metalTypeOptions.map(
  (option) => option.value,
) as [
  (typeof metalTypeOptions)[number]["value"],
  ...(typeof metalTypeOptions)[number]["value"][],
]

export const goldPurityCodes = goldPurityOptions.map((option) => option.value)
export const silverPurityCodes = silverPurityOptions.map((option) => option.value)
export const purityCodes = [
  ...goldPurityCodes,
  ...silverPurityCodes,
  purityOtherOption.value,
] as unknown as [string, ...string[]]

export function getPurityOptions(
  metalType: (typeof metalTypeCodes)[number] | "",
): ReadonlyArray<{ value: string; label?: string; labelKey?: string }> {
  if (metalType === "gold") return [...goldPurityOptions, purityOtherOption]
  if (metalType === "silver") return [...silverPurityOptions, purityOtherOption]
  return []
}

export type AccountTypeCode = (typeof accountTypeCodes)[number]

export type AccountFormValues = {
  name: string
  accountTypeCode: AccountTypeCode
  currencyCode: (typeof currencyCodes)[number]
  openingBalance: string
  bankSubtype: (typeof bankSubtypeCodes)[number] | ""
  investmentType: (typeof investmentTypeCodes)[number] | ""
  balanceGrams: string
  propertyType: (typeof propertyTypeCodes)[number] | ""
  ownershipPercentage: string
  businessType: string
  industry: string
  metalType: (typeof metalTypeCodes)[number] | ""
  purity: string
  purchaseDate: string
  costPerUnit: string
  notes: string
  isActive: boolean
}

export const emptyAccountFormValues: AccountFormValues = {
  name: "",
  accountTypeCode: "cash",
  currencyCode: "USD",
  openingBalance: "0",
  bankSubtype: "",
  investmentType: "",
  balanceGrams: "0",
  propertyType: "",
  ownershipPercentage: "100",
  businessType: "",
  industry: "",
  metalType: "",
  purity: "",
  purchaseDate: "",
  costPerUnit: "0",
  notes: "",
  isActive: true,
}

export function accountToFormValues(
  account: AccountSummary,
): AccountFormValues {
  return {
    name: account.name,
    accountTypeCode: account.account_type_code as AccountFormValues["accountTypeCode"],
    currencyCode: account.currency_code as AccountFormValues["currencyCode"],
    openingBalance: account.opening_balance,
    bankSubtype: (account.bank_subtype ?? "") as AccountFormValues["bankSubtype"],
    investmentType: (account.investment_type ?? "") as AccountFormValues["investmentType"],
    balanceGrams: account.balance_grams ?? "0",
    propertyType: (account.property_type ?? "") as AccountFormValues["propertyType"],
    ownershipPercentage: account.ownership_percentage ?? "100",
    businessType: account.business_type ?? "",
    industry: account.industry ?? "",
    metalType: (account.metal_type ?? "") as AccountFormValues["metalType"],
    purity: account.purity ?? "",
    purchaseDate: account.purchase_date ?? "",
    costPerUnit: account.cost_per_unit ?? "0",
    notes: account.notes ?? "",
    isActive: account.is_active,
  }
}

export function getTotalMetalAmount(values: AccountFormValues): string | null {
  return multiplyDecimals(values.costPerUnit.trim() || "0", values.balanceGrams.trim() || "0")
}

export function getBalanceLabelKey(
  code: AccountFormValues["accountTypeCode"],
): "accounts.form.startingBalance" | "accounts.form.startingCashBalance" | "accounts.form.currentValue" {
  if (code === "brokerage") return "accounts.form.startingCashBalance"
  if (code === "real_estate" || code === "business") return "accounts.form.currentValue"
  return "accounts.form.startingBalance"
}

export function getAccountTypeLabel(code: string, t: Translate): string {
  const option = accountTypeOptions.find((item) => item.value === code)
  return option ? t(option.labelKey) : code.replaceAll("_", " ")
}

export type AccountTypeSpecificFields = {
  openingBalance: string | undefined
  bankSubtype: "debit" | "credit" | null
  investmentType: "stock_etf" | "crypto" | "other" | null
  balanceGrams: string | null
  propertyType: "apartment" | "villa" | "land" | "office" | "other" | null
  ownershipPercentage: string | null
  businessType: string | null
  industry: string | null
  metalType: "gold" | "silver" | null
  purity: string | null
  purchaseDate: string | null
  costPerUnit: string | null
}

export function toAccountTypeSpecificFields(
  values: AccountFormValues,
): AccountTypeSpecificFields {
  const fields: AccountTypeSpecificFields = {
    openingBalance: undefined,
    bankSubtype: null,
    investmentType: null,
    balanceGrams: null,
    propertyType: null,
    ownershipPercentage: null,
    businessType: null,
    industry: null,
    metalType: null,
    purity: null,
    purchaseDate: null,
    costPerUnit: null,
  }

  switch (values.accountTypeCode) {
    case "cash":
    case "other":
      fields.openingBalance = values.openingBalance.trim()
      break
    case "bank":
      fields.openingBalance = values.openingBalance.trim()
      fields.bankSubtype = values.bankSubtype || null
      break
    case "brokerage":
      fields.openingBalance = values.openingBalance.trim()
      fields.investmentType = values.investmentType || null
      break
    case "gold":
      fields.openingBalance = getTotalMetalAmount(values) ?? "0"
      fields.balanceGrams = values.balanceGrams.trim()
      fields.metalType = values.metalType || null
      fields.purity = values.purity.trim() || null
      fields.purchaseDate = values.purchaseDate.trim() || null
      fields.costPerUnit = values.costPerUnit.trim()
      break
    case "real_estate":
      fields.openingBalance = values.openingBalance.trim()
      fields.propertyType = values.propertyType || null
      fields.ownershipPercentage = values.ownershipPercentage.trim()
      break
    case "business":
      fields.openingBalance = values.openingBalance.trim()
      fields.businessType = values.businessType.trim() || null
      fields.industry = values.industry.trim() || null
      fields.ownershipPercentage = values.ownershipPercentage.trim()
      break
  }

  return fields
}
