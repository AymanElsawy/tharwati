import type { AccountFormValues } from "@/features/accounts/types/account-form"

export function normalizeAccountForm(values: AccountFormValues): AccountFormValues { return { ...values, name: values.name.trim(), currencyCode: values.currencyCode.trim().toUpperCase() as AccountFormValues["currencyCode"], openingBalance: values.openingBalance.trim(), notes: values.notes.trim() } }
export function mergeWatchedAccountForm(values: Partial<AccountFormValues> | undefined, defaults: AccountFormValues): AccountFormValues { return { ...defaults, ...values } }
export function hasMeaningfulAccountChanges(current: AccountFormValues, initial: AccountFormValues): boolean { return JSON.stringify(normalizeAccountForm(current)) !== JSON.stringify(normalizeAccountForm(initial)) }
