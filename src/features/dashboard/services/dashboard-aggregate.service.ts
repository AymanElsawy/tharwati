import type { AccountBalance } from "@/features/account-balances/types/account-balance"
import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import {
  addDecimals,
  compareDecimals,
  multiplyDecimals,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"
import { ExchangeRateError } from "@/services/exchange-rates"

export const dashboardAssetGroups = [
  "cashAndBank",
  "brokerage",
  "goldAndSilver",
  "realEstate",
  "business",
  "certificates",
  "other",
] as const

export type DashboardAssetGroup = (typeof dashboardAssetGroups)[number]

export type DashboardAggregate = {
  baseCurrencyCode: string
  status: "complete" | "incomplete"
  totalAssets: Decimal | null
  totalLiabilities: Decimal | null
  netWorth: Decimal | null
  assetBreakdown: Record<DashboardAssetGroup, Decimal | null>
  accountCount: number
  unavailablePairs: string[]
  unavailableSources: string[]
}

type CurrentRateResolver = {
  resolveCurrentRate(pair: {
    sourceCurrencyCode: string
    destinationCurrencyCode: string
  }): Promise<{ rate: Decimal }>
}

function emptyBreakdown(): Record<DashboardAssetGroup, Decimal> {
  return {
    cashAndBank: "0",
    brokerage: "0",
    goldAndSilver: "0",
    realEstate: "0",
    business: "0",
    certificates: "0",
    other: "0",
  }
}

function assetGroup(account: AccountSummary): DashboardAssetGroup | null {
  switch (account.account_type_code) {
    case "cash":
      return "cashAndBank"
    case "bank":
      return account.bank_subtype === "credit" ? null : "cashAndBank"
    case "brokerage":
      return "brokerage"
    case "gold":
      return "goldAndSilver"
    case "real_estate":
      return "realEstate"
    case "business":
      return "business"
    case "other":
      return "other"
    default:
      return "other"
  }
}

function requireDecimal(value: Decimal | null, message: string): Decimal {
  if (value === null) throw new Error(message)
  return value
}

export async function calculateDashboardAggregate(input: {
  baseCurrencyCode: string
  accounts: readonly AccountSummary[]
  currentValues: ReadonlyMap<string, Decimal | null>
  accountBalances: readonly AccountBalance[]
  rates: CurrentRateResolver
}): Promise<DashboardAggregate> {
  const activeAccounts = input.accounts.filter((account) => account.is_active)
  const balancesByAccountId = new Map(
    input.accountBalances.map((balance) => [balance.accountId, balance]),
  )
  const breakdown = emptyBreakdown()
  const unavailablePairs = new Set<string>()
  const unavailableSources: string[] = []

  const convert = async (amount: Decimal, currencyCode: string, source: string) => {
    if (currencyCode === input.baseCurrencyCode) return amount
    try {
      const rate = await input.rates.resolveCurrentRate({
        sourceCurrencyCode: currencyCode,
        destinationCurrencyCode: input.baseCurrencyCode,
      })
      return requireDecimal(
        multiplyDecimals(amount, rate.rate),
        `${source} could not be converted`,
      )
    } catch (error) {
      if (error instanceof ExchangeRateError && error.code === "rate_unavailable") {
        unavailablePairs.add(`${currencyCode}/${input.baseCurrencyCode}`)
        unavailableSources.push(source)
        return null
      }
      throw error
    }
  }

  for (const account of activeAccounts) {
    const group = assetGroup(account)
    if (group === null) continue
    const value = input.currentValues.get(account.id)
    if (value === null || value === undefined) {
      unavailableSources.push(account.name)
      continue
    }
    const converted = await convert(value, account.currency_code, account.name)
    if (converted === null) continue
    breakdown[group] = requireDecimal(
      addDecimals(breakdown[group], converted),
      `Unable to aggregate ${group}`,
    )
  }

  let totalLiabilities: Decimal = "0"
  for (const account of activeAccounts) {
    if (account.account_type_code !== "bank" || account.bank_subtype !== "credit") continue
    const balance = balancesByAccountId.get(account.id)
    if (!account.credit_card_limit || !balance) {
      unavailableSources.push(account.name)
      continue
    }
    const amountDue = subtractDecimals(account.credit_card_limit, balance.currentBalance)
    if (amountDue === null || compareDecimals(amountDue, "0") === -1) {
      unavailableSources.push(account.name)
      continue
    }
    const converted = await convert(amountDue, account.currency_code, account.name)
    if (converted === null) continue
    totalLiabilities = requireDecimal(
      addDecimals(totalLiabilities, converted),
      "Unable to aggregate liabilities",
    )
  }

  if (unavailableSources.length > 0) {
    return {
      baseCurrencyCode: input.baseCurrencyCode,
      status: "incomplete",
      totalAssets: null,
      totalLiabilities: null,
      netWorth: null,
      assetBreakdown: Object.fromEntries(
        dashboardAssetGroups.map((group) => [group, null]),
      ) as Record<DashboardAssetGroup, Decimal | null>,
      accountCount: activeAccounts.length,
      unavailablePairs: [...unavailablePairs],
      unavailableSources,
    }
  }

  const totalAssets = dashboardAssetGroups.reduce<Decimal>(
    (total, group) => requireDecimal(addDecimals(total, breakdown[group]), "Unable to aggregate assets"),
    "0",
  )
  return {
    baseCurrencyCode: input.baseCurrencyCode,
    status: "complete",
    totalAssets,
    totalLiabilities,
    netWorth: requireDecimal(subtractDecimals(totalAssets, totalLiabilities), "Unable to calculate net worth"),
    assetBreakdown: breakdown,
    accountCount: activeAccounts.length,
    unavailablePairs: [],
    unavailableSources: [],
  }
}
