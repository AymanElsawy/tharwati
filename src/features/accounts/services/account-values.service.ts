import type { AccountSummary, Decimal } from "@/lib/supabase/types"
import { getAccountRecordBalances, getRecordAccounts } from "./account-records.service"
import {
  getMetalAccountCurrentPrices,
  getMetalPurchases,
  getValuedMetalPurchasesCurrentValue,
  valueMetalPurchases,
} from "./metal-purchases.service"
import type { MetalPurchaseTransaction } from "../types/metal-purchase"

export type AccountCurrentValuesInput = {
  accounts: readonly AccountSummary[]
  recordBalances: ReadonlyMap<string, Decimal>
  metalPurchases: readonly MetalPurchaseTransaction[]
  metalCurrentPrices: ReadonlyMap<string, Decimal | null>
}

/** Selects the exact value source already used by the Accounts list for each account type. */
export function resolveAccountCurrentValues({
  accounts,
  recordBalances,
  metalPurchases,
  metalCurrentPrices,
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
    return [account.id, recordBalances.get(account.id) ?? account.opening_balance] as const
  }))
}

export async function getAccountCurrentValues(
  accounts: readonly AccountSummary[]
): Promise<Map<string, Decimal | null>> {
  const metalAccounts = accounts.filter((account) => account.account_type_code === "gold")
  const recordAccounts = getRecordAccounts(accounts)
  const [recordBalances, metalPurchases, metalCurrentPrices] = await Promise.all([
    getAccountRecordBalances(recordAccounts.map((account) => account.id)),
    getMetalPurchases(metalAccounts.map((account) => account.id)),
    getMetalAccountCurrentPrices(metalAccounts),
  ])

  return resolveAccountCurrentValues({
    accounts,
    recordBalances,
    metalPurchases,
    metalCurrentPrices,
  })
}
