import type { Translate } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/en/translations"

export type ValuationAccountTypeCode = "business" | "real_estate"

export const businessValuationMethodOptions = [
  { value: "owner_estimate", labelKey: "accounts.valuationMethod.ownerEstimate" },
  { value: "professional_appraisal", labelKey: "accounts.valuationMethod.professionalAppraisal" },
  { value: "market_comparison", labelKey: "accounts.valuationMethod.marketComparison" },
  { value: "revenue_multiple", labelKey: "accounts.valuationMethod.revenueMultiple" },
  { value: "ebitda_multiple", labelKey: "accounts.valuationMethod.ebitdaMultiple" },
  { value: "discounted_cash_flow", labelKey: "accounts.valuationMethod.discountedCashFlow" },
  { value: "asset_based", labelKey: "accounts.valuationMethod.assetBased" },
  { value: "recent_transaction", labelKey: "accounts.valuationMethod.recentTransaction" },
  { value: "other", labelKey: "accounts.valuationMethod.other" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: TranslationKey }>

export const realEstateValuationMethodOptions = [
  { value: "owner_estimate", labelKey: "accounts.valuationMethod.ownerEstimate" },
  { value: "professional_appraisal", labelKey: "accounts.valuationMethod.professionalAppraisal" },
  { value: "market_comparison", labelKey: "accounts.valuationMethod.marketComparison" },
  { value: "income_approach", labelKey: "accounts.valuationMethod.incomeApproach" },
  { value: "cost_approach", labelKey: "accounts.valuationMethod.costApproach" },
  { value: "recent_transaction", labelKey: "accounts.valuationMethod.realEstateRecentTransaction" },
  { value: "other", labelKey: "accounts.valuationMethod.other" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: TranslationKey }>

export type BusinessValuationMethodCode =
  (typeof businessValuationMethodOptions)[number]["value"]
export type RealEstateValuationMethodCode =
  (typeof realEstateValuationMethodOptions)[number]["value"]
export type ValuationMethodCode =
  | BusinessValuationMethodCode
  | RealEstateValuationMethodCode

export const businessValuationMethodCodes = businessValuationMethodOptions.map(
  (option) => option.value
) as [BusinessValuationMethodCode, ...BusinessValuationMethodCode[]]

export const realEstateValuationMethodCodes =
  realEstateValuationMethodOptions.map((option) => option.value) as [
    RealEstateValuationMethodCode,
    ...RealEstateValuationMethodCode[],
  ]

export const valuationMethodCodes = [
  ...new Set([
    ...businessValuationMethodCodes,
    ...realEstateValuationMethodCodes,
  ]),
] as [ValuationMethodCode, ...ValuationMethodCode[]]

export const valuationMethodOptionsByAccountType = {
  business: businessValuationMethodOptions,
  real_estate: realEstateValuationMethodOptions,
} as const

const customMethodPrefix = "other:"

export function isValuationMethodAllowed(
  accountTypeCode: ValuationAccountTypeCode,
  method: string
): boolean {
  if (!method) return true
  const codes: readonly string[] =
    accountTypeCode === "business"
      ? businessValuationMethodCodes
      : realEstateValuationMethodCodes
  return codes.includes(method)
}

export function toStoredValuationMethod(
  accountTypeCode: ValuationAccountTypeCode,
  method: string,
  customMethod: string
): string | null {
  if (!method) return null
  if (method !== "other") {
    return isValuationMethodAllowed(accountTypeCode, method) ? method : null
  }
  const normalizedCustomMethod = customMethod.trim()
  return normalizedCustomMethod
    ? `${customMethodPrefix}${normalizedCustomMethod}`
    : null
}

export function getValuationMethodLabel(
  accountTypeCode: ValuationAccountTypeCode,
  storedMethod: string | null,
  t: Translate
): string | null {
  if (storedMethod === null) return null
  if (storedMethod.startsWith(customMethodPrefix)) {
    const customMethod = storedMethod.slice(customMethodPrefix.length).trim()
    return customMethod || storedMethod
  }
  const options: ReadonlyArray<{ value: string; labelKey: TranslationKey }> =
    valuationMethodOptionsByAccountType[accountTypeCode]
  const option = options.find((item) => item.value === storedMethod)
  return option ? t(option.labelKey) : storedMethod
}

export function toStoredBusinessValuationMethod(
  method: string,
  customMethod: string
): string | null {
  return toStoredValuationMethod("business", method, customMethod)
}

export function getBusinessValuationMethodLabel(
  storedMethod: string | null,
  t: Translate
): string | null {
  return getValuationMethodLabel("business", storedMethod, t)
}
