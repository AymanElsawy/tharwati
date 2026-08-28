import type { AccountFormValues } from "@/features/accounts/types/account-form"

export function normalizeAccountForm(
  values: AccountFormValues
): AccountFormValues {
  return {
    ...values,
    name: values.name.trim(),
    currencyCode: values.currencyCode
      .trim()
      .toUpperCase() as AccountFormValues["currencyCode"],
    openingBalance: values.openingBalance.trim(),
    creditCardLimit: values.creditCardLimit.trim(),
    dueDayOfMonth: values.dueDayOfMonth.trim(),
    balanceGrams: values.balanceGrams.trim(),
    ownershipPercentage: values.ownershipPercentage.trim(),
    businessType: values.businessType.trim(),
    businessTypeOther: values.businessTypeOther.trim(),
    industry: values.industry.trim(),
    industryOther: values.industryOther.trim(),
    location: values.location.trim(),
    valuationDate: values.valuationDate.trim(),
    valuationMethod: values.valuationMethod.trim(),
    valuationNotes: values.valuationNotes.trim(),
    purity: values.purity.trim(),
    purchaseDate: values.purchaseDate.trim(),
    costPerUnit: values.costPerUnit.trim(),
    notes: values.notes.trim(),
  }
}
export function mergeWatchedAccountForm(
  values: Partial<AccountFormValues> | undefined,
  defaults: AccountFormValues
): AccountFormValues {
  return { ...defaults, ...values }
}
export function hasMeaningfulAccountChanges(
  current: AccountFormValues,
  initial: AccountFormValues
): boolean {
  return (
    JSON.stringify(normalizeAccountForm(current)) !==
    JSON.stringify(normalizeAccountForm(initial))
  )
}
