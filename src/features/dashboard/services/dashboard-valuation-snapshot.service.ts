import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import { supabase } from "@/lib/supabase/client"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { ExchangeRateError } from "@/services/exchange-rates"

export type DashboardValuationSnapshot = {
  asOf: string
  expiresAt: string
  freshness: "fresh" | "stale" | "unavailable"
  currentValues: ReadonlyMap<string, Decimal | null>
  accountBalances: ReadonlyMap<string, Decimal>
  rates: ReadonlyMap<string, Decimal | null>
  unavailableSources: readonly string[]
}

type SnapshotResponse = {
  asOf?: unknown
  expiresAt?: unknown
  freshness?: unknown
  currentValues?: unknown
  accountBalances?: unknown
  rates?: unknown
  unavailableSources?: unknown
}

function decimal(value: unknown): Decimal | null {
  return typeof value === "string" && /^[+-]?\d+(?:\.\d+)?$/.test(value) ? value : null
}

function decimalMap(value: unknown, nullable: boolean): Map<string, Decimal | null> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const result = new Map<string, Decimal | null>()
  for (const [key, item] of Object.entries(value)) {
    const parsed = item === null && nullable ? null : decimal(item)
    if (parsed === null && !(nullable && item === null)) return null
    result.set(key, parsed)
  }
  return result
}

export function parseDashboardValuationSnapshot(value: unknown): DashboardValuationSnapshot {
  const response = value as SnapshotResponse
  const currentValues = decimalMap(response.currentValues, true)
  const accountBalances = decimalMap(response.accountBalances, false)
  const rates = decimalMap(response.rates, true)
  if (
    typeof response.asOf !== "string" || Number.isNaN(Date.parse(response.asOf)) ||
    typeof response.expiresAt !== "string" || Number.isNaN(Date.parse(response.expiresAt)) ||
    !["fresh", "stale", "unavailable"].includes(String(response.freshness)) ||
    !currentValues || !accountBalances || !rates || !Array.isArray(response.unavailableSources) ||
    !response.unavailableSources.every((source) => typeof source === "string")
  ) throw new Error("Dashboard valuation snapshot is invalid")
  return {
    asOf: response.asOf,
    expiresAt: response.expiresAt,
    freshness: response.freshness as DashboardValuationSnapshot["freshness"],
    currentValues,
    accountBalances: accountBalances as Map<string, Decimal>,
    rates,
    unavailableSources: response.unavailableSources,
  }
}

export async function getDashboardValuationSnapshot(): Promise<DashboardValuationSnapshot> {
  const { data, error } = await supabase.functions.invoke("dashboard-valuation")
  if (error) throw error
  return parseDashboardValuationSnapshot(data)
}

export function snapshotAccountBalances(
  snapshot: DashboardValuationSnapshot,
  accounts: readonly AccountSummary[],
): AccountBalance[] {
  return accounts.flatMap((account) => {
    const currentBalance = snapshot.accountBalances.get(account.id)
    return currentBalance === undefined ? [] : [{
      accountId: account.id,
      accountTypeCode: account.account_type_code,
      accountName: account.name,
      currencyCode: account.currency_code,
      isActive: account.is_active,
      openingBalance: account.opening_balance,
      ledgerEffect: "0",
      currentBalance,
    }]
  })
}

export function snapshotRateResolver(snapshot: DashboardValuationSnapshot) {
  return {
    async resolveCurrentRate(pair: { sourceCurrencyCode: string; destinationCurrencyCode: string }) {
      const key = `${pair.sourceCurrencyCode}/${pair.destinationCurrencyCode}`
      const rate = pair.sourceCurrencyCode === pair.destinationCurrencyCode ? "1" : snapshot.rates.get(key)
      if (rate) return { rate }
      throw new ExchangeRateError({
        code: "rate_unavailable",
        message: `Dashboard snapshot has no rate for ${key}`,
        pair,
      })
    },
  }
}
