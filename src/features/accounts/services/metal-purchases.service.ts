import {
  addDecimals,
  multiplyDecimals,
} from "@/lib/financial-calculations/decimal"
import type { AccountSummary } from "@/lib/supabase/types"
import type { Decimal } from "@/lib/supabase/types"
import { getMetalPricePerGram } from "@/services/metalPriceService"
import {
  metalPurchasesRepository,
  type MetalPurchaseHistoryRow,
} from "../repositories/metal-purchases.repository"
import type {
  AddMetalPurchaseCommand,
  MetalAccountAggregate,
  MetalPurchaseFormValues,
  MetalPurchaseTransaction,
  MetalPurityAggregate,
  ValuedMetalPurchaseTransaction,
} from "../types/metal-purchase"

function addOrThrow(left: string, right: string): string {
  const result = addDecimals(left, right)
  if (result === null) throw new Error("Invalid ledger decimal")
  return result
}

export function buildAddMetalPurchaseCommand(
  accountId: string,
  values: MetalPurchaseFormValues
): AddMetalPurchaseCommand {
  return {
    accountId,
    purity: values.purity.trim(),
    occurredAt: `${values.purchaseDate}T12:00:00.000Z`,
    quantityGrams: values.unitsGrams.trim(),
    costPerUnit: values.costPerUnit.trim(),
    fundingMode: values.paidFromAccount ? "cash_account" : "external",
    fundingAccountId: values.paidFromAccount ? values.fundingAccountId : null,
    fees: "0",
  }
}

export async function addMetalPurchase(
  accountId: string,
  values: MetalPurchaseFormValues
): Promise<void> {
  await metalPurchasesRepository.addPurchase(
    buildAddMetalPurchaseCommand(accountId, values)
  )
}

export function getEligibleMetalFundingAccounts(
  accounts: readonly AccountSummary[]
): AccountSummary[] {
  return accounts.filter(
    (account) =>
      account.is_active &&
      ["cash", "bank", "deposit"].includes(account.account_type_code)
  )
}

export async function getMetalPurchases(
  accountIds: readonly string[]
): Promise<MetalPurchaseTransaction[]> {
  const rows = await metalPurchasesRepository.getPurchaseHistoryRows(accountIds)
  return mapMetalPurchaseHistoryRows(rows)
}

export function mapMetalPurchaseHistoryRows(
  rows: readonly MetalPurchaseHistoryRow[]
): MetalPurchaseTransaction[] {
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    purity: row.purity,
    purchaseDate: row.purchased_at,
    unitsGrams: row.quantity_grams,
    costPerUnit: row.cost_per_unit,
    totalAmount: multiplyOrThrow(row.quantity_grams, row.cost_per_unit),
    currencyCode: "",
    fundingMode: row.funding_mode,
    fundingAccountId: row.funding_account_id,
    createdAt: row.created_at,
  }))
}

function multiplyOrThrow(left: string, right: string): string {
  const result = multiplyDecimals(left, right)
  if (result === null) throw new Error("Invalid metal purchase decimal")
  return result
}

export async function getMetalAccountCurrentPrices(
  accounts: readonly AccountSummary[]
): Promise<Map<string, Decimal | null>> {
  const prices = await Promise.all(
    accounts
      .filter((account) => account.account_type_code === "gold")
      .map(async (account) => {
        const symbol = account.metal_type === "silver" ? "XAG" : "XAU"
        const price = await getMetalPricePerGram(symbol, account.currency_code)
        return [account.id, price === null ? null : String(price)] as const
      })
  )
  return new Map(prices)
}

export function getMetalCurrentValue(
  unitsGrams: Decimal,
  currentPricePerGram: Decimal | null
): Decimal | null {
  if (currentPricePerGram === null) return null
  return multiplyDecimals(unitsGrams, currentPricePerGram)
}

export function valueMetalPurchases(
  purchases: readonly MetalPurchaseTransaction[],
  currentPricePerGram: Decimal | null
): ValuedMetalPurchaseTransaction[] {
  return purchases.map((purchase) => ({
    ...purchase,
    currentValue: getMetalCurrentValue(
      purchase.unitsGrams,
      currentPricePerGram
    ),
  }))
}

export function aggregateMetalPurchases(
  purchases: readonly MetalPurchaseTransaction[]
): Map<string, MetalAccountAggregate> {
  const aggregates = new Map<string, MetalAccountAggregate>()
  for (const purchase of purchases) {
    const current = aggregates.get(purchase.accountId) ?? {
      purchaseCount: 0,
      totalUnitsGrams: "0",
      totalAmount: "0",
    }
    aggregates.set(purchase.accountId, {
      purchaseCount: current.purchaseCount + 1,
      totalUnitsGrams: addOrThrow(current.totalUnitsGrams, purchase.unitsGrams),
      totalAmount: addOrThrow(current.totalAmount, purchase.totalAmount),
    })
  }
  return aggregates
}

export function aggregateMetalPurchasesByPurity(
  purchases: readonly MetalPurchaseTransaction[]
): MetalPurityAggregate[] {
  const aggregates = new Map<string, MetalPurityAggregate>()
  for (const purchase of purchases) {
    const current = aggregates.get(purchase.purity) ?? {
      purity: purchase.purity,
      transactionCount: 0,
      totalUnitsGrams: "0",
      totalAmount: "0",
    }
    aggregates.set(purchase.purity, {
      ...current,
      transactionCount: current.transactionCount + 1,
      totalUnitsGrams: addOrThrow(current.totalUnitsGrams, purchase.unitsGrams),
      totalAmount: addOrThrow(current.totalAmount, purchase.totalAmount),
    })
  }
  return [...aggregates.values()].sort((left, right) =>
    left.purity.localeCompare(right.purity)
  )
}
