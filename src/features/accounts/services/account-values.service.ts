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

export type AccountCurrentValuesInput = {
  accounts: readonly AccountSummary[]
  recordBalances: ReadonlyMap<string, Decimal>
  metalPurchases: readonly MetalPurchaseTransaction[]
  metalCurrentPrices: ReadonlyMap<string, Decimal | null>
  brokerageAvailableCash: ReadonlyMap<string, Decimal>
  brokerageAccountsWithPositiveHoldings: ReadonlySet<string>
}

/** Selects the exact value source already used by the Accounts list for each account type. */
export function resolveAccountCurrentValues({
  accounts,
  recordBalances,
  metalPurchases,
  metalCurrentPrices,
  brokerageAvailableCash,
  brokerageAccountsWithPositiveHoldings,
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
    if (
      account.account_type_code === "brokerage" &&
      !brokerageAccountsWithPositiveHoldings.has(account.id)
    ) {
      return [
        account.id,
        brokerageAvailableCash.get(account.id) ?? account.opening_balance,
      ] as const
    }
    return [account.id, recordBalances.get(account.id) ?? account.opening_balance] as const
  }))
}

export async function getAccountCurrentValues(
  accounts: readonly AccountSummary[]
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
  })
}
