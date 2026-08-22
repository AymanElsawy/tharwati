import {
  addDecimals,
  divideDecimals,
  multiplyDecimals,
} from "@/lib/financial-calculations/decimal"
import type { AccountSummary } from "@/lib/supabase/types"
import type { Decimal } from "@/lib/supabase/types"
import { localDateTimeInputToIso } from "@/lib/formatting/local-date-time"
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
  ValuedMetalPurityAggregate,
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
    occurredAt: localDateTimeInputToIso(values.purchaseDate),
    quantityGrams: values.unitsGrams.trim(),
    costPerUnit: values.costPerUnit.trim(),
    fundingMode: values.paidFromAccount ? "cash_account" : "external",
    fundingAccountId: values.paidFromAccount ? values.fundingAccountId : null,
    fees: values.fees.trim() || "0",
    notes: values.notes.trim() || null,
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

export async function reverseMetalPurchase(purchaseId: string): Promise<void> {
  await metalPurchasesRepository.reversePurchase(purchaseId)
}

export async function correctMetalPurchase(
  purchaseId: string,
  accountId: string,
  values: MetalPurchaseFormValues
): Promise<void> {
  await metalPurchasesRepository.correctPurchase(
    purchaseId,
    buildAddMetalPurchaseCommand(accountId, values)
  )
}

export function getEligibleMetalFundingAccounts(
  accounts: readonly AccountSummary[],
  currencyCode?: AccountSummary["currency_code"]
): AccountSummary[] {
  return accounts.filter(
    (account) =>
      account.is_active &&
      ["cash", "bank"].includes(account.account_type_code) &&
      (currencyCode === undefined || account.currency_code === currencyCode)
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
    fees: row.fees,
    totalAmount: addOrThrow(
      multiplyOrThrow(row.quantity_grams, row.cost_per_unit),
      row.fees
    ),
    currencyCode: "",
      fundingMode: row.funding_mode,
      fundingAccountId: row.funding_account_id,
      fundingTransactionId: row.funding_transaction_id,
      notes: row.notes,
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

export function getMetalPurityFactor(purity: string): Decimal | null {
  const goldKarat = /^([0-9]+)k$/.exec(purity)?.[1]
  if (goldKarat && ["24", "22", "21", "18", "14", "10", "9"].includes(goldKarat)) {
    return divideDecimals(goldKarat, "24", 18)
  }

  const silverFactors: Record<string, Decimal> = {
    "999": "0.999",
    "958": "0.958",
    "950": "0.950",
    "925": "0.925",
    "900": "0.900",
    "835": "0.835",
    "800": "0.800",
  }
  return silverFactors[purity] ?? null
}

export function getPurityAdjustedMetalPricePerGram(
  currentPricePerGram: Decimal | null,
  purity: string
): Decimal | null {
  if (currentPricePerGram === null) return null
  const factor = getMetalPurityFactor(purity)
  if (factor === null) return null
  return multiplyDecimals(currentPricePerGram, factor)
}

export function valueMetalPurchases(
  purchases: readonly MetalPurchaseTransaction[],
  currentPricePerGram: Decimal | null
): ValuedMetalPurchaseTransaction[] {
  return purchases.map((purchase) => {
    const adjustedPricePerGram = getPurityAdjustedMetalPricePerGram(
      currentPricePerGram,
      purchase.purity
    )
    return {
      ...purchase,
      currentPricePerGram: adjustedPricePerGram,
      currentValue: getMetalCurrentValue(
        purchase.unitsGrams,
        adjustedPricePerGram
      ),
    }
  })
}

export function getValuedMetalPurchasesCurrentValue(
  purchases: readonly ValuedMetalPurchaseTransaction[]
): Decimal | null {
  let total = "0"
  for (const purchase of purchases) {
    if (purchase.currentValue === null) return null
    total = addOrThrow(total, purchase.currentValue)
  }
  return total
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

export function aggregateValuedMetalPurchasesByPurity(
  purchases: readonly ValuedMetalPurchaseTransaction[]
): ValuedMetalPurityAggregate[] {
  const aggregates = new Map<string, ValuedMetalPurityAggregate>()
  for (const purchase of purchases) {
    const current = aggregates.get(purchase.purity)
    aggregates.set(purchase.purity, {
      purity: purchase.purity,
      transactionCount: (current?.transactionCount ?? 0) + 1,
      totalUnitsGrams: addOrThrow(
        current?.totalUnitsGrams ?? "0",
        purchase.unitsGrams
      ),
      totalAmount: addOrThrow(
        current?.totalAmount ?? "0",
        purchase.totalAmount
      ),
      currentPricePerGram:
        current?.currentPricePerGram === null || purchase.currentPricePerGram === null
          ? null
          : (current?.currentPricePerGram ?? purchase.currentPricePerGram),
      currentValue:
        current?.currentValue === null || purchase.currentValue === null
          ? null
          : addOrThrow(current?.currentValue ?? "0", purchase.currentValue),
    })
  }
  return [...aggregates.values()].sort((left, right) =>
    left.purity.localeCompare(right.purity)
  )
}
