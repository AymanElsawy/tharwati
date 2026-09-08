import { addDecimals, multiplyDecimals } from "@/lib/financial-calculations/decimal"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"

export const dashboardAccountsOverviewGroups = [
  "cash",
  "bank",
  "brokerage",
  "gold",
  "silver",
  "real_estate",
  "business",
  "other",
] as const

export type DashboardAccountsOverviewGroup = (typeof dashboardAccountsOverviewGroups)[number]

export type DashboardAccountsOverviewItem = {
  group: DashboardAccountsOverviewGroup
  accountCount: number
  totalCurrentValueBase: Decimal | null
}

export function dashboardAccountsOverviewRoute(group: DashboardAccountsOverviewGroup) {
  if (group === "gold" || group === "silver") return `/accounts?type=gold&metal=${group}`
  return `/accounts?type=${group}`
}

function groupForAccount(account: AccountSummary): DashboardAccountsOverviewGroup | null {
  if (account.account_type_code === "bank" && account.bank_subtype === "credit") return null
  if (account.account_type_code === "gold") return account.metal_type === "silver" ? "silver" : "gold"
  if (dashboardAccountsOverviewGroups.includes(account.account_type_code as DashboardAccountsOverviewGroup)) {
    return account.account_type_code as DashboardAccountsOverviewGroup
  }
  return null
}

export function buildDashboardAccountsOverview(input: {
  accounts: readonly AccountSummary[]
  baseCurrencyCode: string
  currentValues: ReadonlyMap<string, Decimal | null>
  rates: ReadonlyMap<string, Decimal | null>
}): DashboardAccountsOverviewItem[] {
  const grouped = new Map<DashboardAccountsOverviewGroup, { count: number; total: Decimal; unavailable: boolean }>()

  for (const account of input.accounts) {
    if (!account.is_active) continue
    const group = groupForAccount(account)
    if (group === null) continue
    const entry = grouped.get(group) ?? { count: 0, total: "0", unavailable: false }
    entry.count += 1
    const currentValue = input.currentValues.get(account.id)
    const rate = account.currency_code === input.baseCurrencyCode
      ? "1"
      : input.rates.get(`${account.currency_code}/${input.baseCurrencyCode}`)
    const valueBase = currentValue === null || currentValue === undefined || rate === null || rate === undefined
      ? null
      : multiplyDecimals(currentValue, rate)
    if (valueBase === null) entry.unavailable = true
    else {
      const next = addDecimals(entry.total, valueBase)
      if (next === null) entry.unavailable = true
      else entry.total = next
    }
    grouped.set(group, entry)
  }

  return dashboardAccountsOverviewGroups.flatMap((group) => {
    const entry = grouped.get(group)
    if (!entry) return []
    return [{
      group,
      accountCount: entry.count,
      totalCurrentValueBase: entry.unavailable ? null : entry.total,
    }]
  })
}
