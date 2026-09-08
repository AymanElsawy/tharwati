import type { Translate } from "@/i18n/context"
import type { TranslationKey } from "@/i18n/en/translations"

export const businessValuationMethodOptions = [
  {
    value: "owner_estimate",
    labelKey: "accounts.valuationMethod.ownerEstimate",
  },
  {
    value: "professional_appraisal",
    labelKey: "accounts.valuationMethod.professionalAppraisal",
  },
  {
    value: "market_comparison",
    labelKey: "accounts.valuationMethod.marketComparison",
  },
  {
    value: "revenue_multiple",
    labelKey: "accounts.valuationMethod.revenueMultiple",
  },
  {
    value: "ebitda_multiple",
    labelKey: "accounts.valuationMethod.ebitdaMultiple",
  },
  {
    value: "discounted_cash_flow",
    labelKey: "accounts.valuationMethod.discountedCashFlow",
  },
  { value: "asset_based", labelKey: "accounts.valuationMethod.assetBased" },
  {
    value: "recent_transaction",
    labelKey: "accounts.valuationMethod.recentTransaction",
  },
  { value: "other", labelKey: "accounts.valuationMethod.other" },
] as const satisfies ReadonlyArray<{ value: string; labelKey: TranslationKey }>

export type BusinessValuationMethodCode =
  (typeof businessValuationMethodOptions)[number]["value"]

export const businessValuationMethodCodes = businessValuationMethodOptions.map(
  (option) => option.value
) as [BusinessValuationMethodCode, ...BusinessValuationMethodCode[]]

const customMethodPrefix = "other:"

export function toStoredBusinessValuationMethod(
  method: string,
  customMethod: string
): string | null {
  if (!method) return null
  if (method !== "other") {
    return businessValuationMethodCodes.includes(
      method as BusinessValuationMethodCode
    )
      ? method
      : null
  }
  const normalizedCustomMethod = customMethod.trim()
  return normalizedCustomMethod
    ? `${customMethodPrefix}${normalizedCustomMethod}`
    : null
}

export function getBusinessValuationMethodLabel(
  storedMethod: string | null,
  t: Translate
): string | null {
  if (storedMethod === null) return null
  if (storedMethod.startsWith(customMethodPrefix)) {
    const customMethod = storedMethod.slice(customMethodPrefix.length).trim()
    return customMethod || storedMethod
  }
  const option = businessValuationMethodOptions.find(
    (item) => item.value === storedMethod
  )
  return option ? t(option.labelKey) : storedMethod
}
