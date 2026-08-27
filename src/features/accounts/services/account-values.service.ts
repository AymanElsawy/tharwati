import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { getAccountRecordBalances, getRecordAccounts } from "./account-records.service"
import {
  getMetalAccountCurrentPrices,
  getMetalPurchases,
  getValuedMetalPurchasesCurrentValue,
  valueMetalPurchases,
} from "./metal-purchases.service"
import type { MetalPurchaseTransaction } from "../types/metal-purchase"
import { accountBalancesRepository } from "@/features/account-balances/repositories/account-balances.repository"
import { holdingsRepository } from "@/features/holdings/repositories/holdings.repository"
import { portfolioValuationService } from "@/features/portfolio-valuation/services/portfolio-valuation.service"
import type { HoldingDetails } from "@/features/holdings/types/holding"
import type { HoldingValuationResult } from "@/features/portfolio-valuation/types/portfolio-valuation"
import {
  addDecimals,
  compareDecimals,
  divideDecimals,
  multiplyDecimals,
} from "@/lib/financial-calculations/decimal"

function requireDecimal(value: Decimal | null, message: string): Decimal {
  if (value === null) throw new Error(message)
  return value
}

export type AccountCurrentValueStatus = "complete" | "incomplete"

export type BrokerageCurrentValue = {
  value: Decimal | null
  availableCash: Decimal
  holdingsMarketValue: Decimal | null
  totalCurrentCostBasis: Decimal | null
  unrealizedPnl: Decimal | null
  unrealizedPnlPercent: Decimal | null
  valuations: readonly HoldingValuationResult[]
  status: AccountCurrentValueStatus
  missingMarketPrice: boolean
  missingExchangeRate: boolean
}

export async function calculateBrokerageCurrentValue(input: {
  availableCash: Decimal
  accountCurrencyCode: string
  holdings: readonly HoldingDetails[]
}): Promise<BrokerageCurrentValue> {
  const valuation = await portfolioValuationService.calculate({
    baseCurrency: input.accountCurrencyCode,
    holdings: [...input.holdings],
  })
  const resolved = resolveBrokerageCurrentValue({
    availableCash: input.availableCash,
    holdings: input.holdings,
    valuations: valuation.holdings,
  })
  return {
    ...resolved,
    availableCash: input.availableCash,
    holdingsMarketValue: resolved.holdingsMarketValue,
    valuations: valuation.holdings,
  }
}

export function resolveBrokerageCurrentValue(input: {
  availableCash: Decimal
  holdings: readonly HoldingDetails[]
  valuations: readonly HoldingValuationResult[]
}): BrokerageCurrentValue {
  const positiveHoldings = input.holdings.filter(
    (holding) => compareDecimals(holding.quantity, "0") === 1,
  )
  if (positiveHoldings.length === 0) {
    return {
      value: input.availableCash,
      availableCash: input.availableCash,
      holdingsMarketValue: "0",
      totalCurrentCostBasis: "0",
      unrealizedPnl: "0",
      unrealizedPnlPercent: null,
      valuations: [],
      status: "complete",
      missingMarketPrice: false,
      missingExchangeRate: false,
    }
  }

  const valuationByHoldingId = new Map(
    input.valuations.map((valuation) => [valuation.holdingId, valuation]),
  )
  const positiveValuations = positiveHoldings.map((holding) =>
    valuationByHoldingId.get(holding.id),
  )
  const missingMarketPrice = positiveValuations.some(
    (valuation) => !valuation || valuation.missingMarketPrice,
  )
  const missingExchangeRate = positiveValuations.some(
    (valuation) => !valuation || valuation.missingExchangeRate.length > 0,
  )
  const hasUnvaluedHolding = positiveValuations.some(
    (valuation) => !valuation || valuation.marketValueBase === null,
  )
  if (missingMarketPrice || missingExchangeRate || hasUnvaluedHolding) {
    return {
      value: null,
      availableCash: input.availableCash,
      holdingsMarketValue: null,
      totalCurrentCostBasis: null,
      unrealizedPnl: null,
      unrealizedPnlPercent: null,
      valuations: input.valuations,
      status: "incomplete",
      missingMarketPrice,
      missingExchangeRate,
    }
  }

  const holdingsValue = positiveValuations.reduce<Decimal>((total, valuation) => {
    const marketValue = valuation?.marketValueBase
    if (marketValue === null || marketValue === undefined) return total
    return requireDecimal(
      addDecimals(total, marketValue),
      "Unable to aggregate Brokerage holding market values",
    )
  }, "0")
  const totalCurrentCostBasis = positiveValuations.reduce<Decimal>((total, valuation) => {
    const costBasis = valuation?.costBasisBase
    if (costBasis === null || costBasis === undefined) return total
    return requireDecimal(
      addDecimals(total, costBasis),
      "Unable to aggregate Brokerage holding cost basis",
    )
  }, "0")
  const unrealizedPnl = positiveValuations.reduce<Decimal>((total, valuation) => {
    const pnl = valuation?.unrealizedGainLossBase
    if (pnl === null || pnl === undefined) return total
    return requireDecimal(
      addDecimals(total, pnl),
      "Unable to aggregate Brokerage unrealized P/L",
    )
  }, "0")
  const unrealizedPnlPercent = compareDecimals(totalCurrentCostBasis, "0") === 1
    ? requireDecimal(
        multiplyDecimals(
          requireDecimal(
            divideDecimals(unrealizedPnl, totalCurrentCostBasis),
            "Unable to calculate Brokerage unrealized P/L percentage",
          ),
          "100",
        ),
        "Unable to calculate Brokerage unrealized P/L percentage",
      )
    : null
  return {
    value: addDecimals(input.availableCash, holdingsValue),
    availableCash: input.availableCash,
    holdingsMarketValue: holdingsValue,
    totalCurrentCostBasis,
    unrealizedPnl,
    unrealizedPnlPercent,
    valuations: input.valuations,
    status: "complete",
    missingMarketPrice: false,
    missingExchangeRate: false,
  }
}

export type AccountCurrentValuesInput = {
  accounts: readonly AccountSummary[]
  recordBalances: ReadonlyMap<string, Decimal>
  metalPurchases: readonly MetalPurchaseTransaction[]
  metalCurrentPrices: ReadonlyMap<string, Decimal | null>
  brokerageAvailableCash: ReadonlyMap<string, Decimal>
  brokerageAccountsWithPositiveHoldings: ReadonlySet<string>
  brokerageCurrentValues?: ReadonlyMap<string, BrokerageCurrentValue>
}

/** Selects the exact value source already used by the Accounts list for each account type. */
export function resolveAccountCurrentValues({
  accounts,
  recordBalances,
  metalPurchases,
  metalCurrentPrices,
  brokerageAvailableCash,
  brokerageAccountsWithPositiveHoldings,
  brokerageCurrentValues,
}: AccountCurrentValuesInput): Map<string, Decimal | null> {
  return new Map(accounts.map((account) => {
    if (account.account_type_code === "gold") {
      const currentPricePerGram = metalCurrentPrices.get(account.id) ?? null
      return [
        account.id,
        currentPricePerGram === null
          ? null
          : getValuedMetalPurchasesCurrentValue(
              valueMetalPurchases(
                metalPurchases.filter((purchase) => purchase.accountId === account.id),
                currentPricePerGram
              )
            ),
      ] as const
    }
    if (account.account_type_code === "brokerage") {
      const brokerageValue = brokerageCurrentValues?.get(account.id)
      return [
        account.id,
        brokerageValue
          ? brokerageValue.value
          : !brokerageAccountsWithPositiveHoldings.has(account.id)
            ? brokerageAvailableCash.get(account.id) ?? account.opening_balance
            : null,
      ] as const
    }
    return [account.id, recordBalances.get(account.id) ?? account.opening_balance] as const
  }))
}

export async function getAccountCurrentValues(
  accounts: readonly AccountSummary[],
  onBrokerageValues?: (values: ReadonlyMap<string, BrokerageCurrentValue>) => void,
): Promise<Map<string, Decimal | null>> {
  const metalAccounts = accounts.filter((account) => account.account_type_code === "gold")
  const recordAccounts = getRecordAccounts(accounts)
  const brokerageAccounts = accounts.filter((account) =>
    account.is_active && account.account_type_code === "brokerage"
  )
  const [recordBalances, metalPurchases, metalCurrentPrices, brokerageBalances, holdings] = await Promise.all([
    getAccountRecordBalances(recordAccounts.map((account) => account.id)),
    getMetalPurchases(metalAccounts.map((account) => account.id)),
    getMetalAccountCurrentPrices(metalAccounts),
    accountBalancesRepository.getAccountBalances(brokerageAccounts.map((account) => account.id)),
    holdingsRepository.getHoldings(),
  ])

  const brokerageCurrentValues = new Map<string, BrokerageCurrentValue>()
  await Promise.all(brokerageAccounts.map(async (account) => {
    const accountHoldings = holdings.filter((holding) => holding.account_id === account.id)
    const balance = brokerageBalances.find((item) => item.accountId === account.id)
    if (!balance) return
    try {
      brokerageCurrentValues.set(account.id, await calculateBrokerageCurrentValue({
        availableCash: balance.currentBalance,
        accountCurrencyCode: account.currency_code,
        holdings: accountHoldings,
      }))
    } catch {
      brokerageCurrentValues.set(account.id, {
        value: null,
        availableCash: balance.currentBalance,
        holdingsMarketValue: null,
        totalCurrentCostBasis: null,
        unrealizedPnl: null,
        unrealizedPnlPercent: null,
        valuations: [],
        status: "incomplete",
        missingMarketPrice: true,
        missingExchangeRate: true,
      })
    }
  }))
  onBrokerageValues?.(brokerageCurrentValues)

  return resolveAccountCurrentValues({
    accounts,
    recordBalances,
    metalPurchases,
    metalCurrentPrices,
    brokerageAvailableCash: new Map(
      brokerageBalances.map((balance) => [balance.accountId, balance.currentBalance] as const)
    ),
    brokerageAccountsWithPositiveHoldings: new Set(
      holdings.map((holding) => holding.account_id).filter((accountId): accountId is string => accountId !== null)
    ),
    brokerageCurrentValues,
  })
}
