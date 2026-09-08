import {
  addDecimals,
  multiplyDecimals,
} from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

export type MetalType = "gold" | "silver"
export type MetalPurchaseFundingMode = "external" | "cash_account"

export type MetalPurchaseFormValues = {
  purity: string
  purchaseDate: string
  unitsGrams: string
  costPerUnit: string
  fees: string
  paidFromAccount: boolean
  fundingAccountId: string
  notes: string
}

export type AddMetalPurchaseCommand = {
  accountId: string
  purity: string
  occurredAt: string
  quantityGrams: Decimal
  costPerUnit: Decimal
  fundingMode: MetalPurchaseFundingMode
  fundingAccountId: string | null
  fees: Decimal
  notes: string | null
}

export type MetalPurchaseTransaction = {
  id: string
  accountId: string
  purity: string
  purchaseDate: string
  unitsGrams: Decimal
  costPerUnit: Decimal
  fees: Decimal
  totalAmount: Decimal
  currencyCode: string
  fundingMode: MetalPurchaseFundingMode
  fundingAccountId: string | null
  fundingTransactionId: string | null
  notes: string | null
  createdAt: string
}

export type ValuedMetalPurchaseTransaction = MetalPurchaseTransaction & {
  currentPricePerGram: Decimal | null
  currentValue: Decimal | null
}

export type MetalAccountAggregate = {
  purchaseCount: number
  totalUnitsGrams: Decimal
  totalAmount: Decimal
}

export type MetalPurityAggregate = {
  purity: string
  transactionCount: number
  totalUnitsGrams: Decimal
  totalAmount: Decimal
}

export type ValuedMetalPurityAggregate = MetalPurityAggregate & {
  currentPricePerGram: Decimal | null
  currentValue: Decimal | null
}

export const emptyMetalPurchaseFormValues: MetalPurchaseFormValues = {
  purity: "",
  purchaseDate: "",
  unitsGrams: "",
  costPerUnit: "",
  fees: "0",
  paidFromAccount: false,
  fundingAccountId: "",
  notes: "",
}

export function getMetalPurchaseSubtotal(
  values: Pick<MetalPurchaseFormValues, "unitsGrams" | "costPerUnit">
): string | null {
  return multiplyDecimals(
    values.unitsGrams.trim() || "0",
    values.costPerUnit.trim() || "0"
  )
}

export function getMetalPurchaseTotal(
  values: MetalPurchaseFormValues
): string | null {
  const subtotal = getMetalPurchaseSubtotal(values)
  return subtotal === null
    ? null
    : addDecimals(subtotal, values.fees.trim() || "0")
}
