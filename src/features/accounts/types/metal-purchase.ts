import { multiplyDecimals } from "@/lib/financial-calculations/decimal"
import type { Decimal } from "@/lib/supabase/types"

export type MetalType = "gold" | "silver"
export type MetalPurchaseFundingMode = "external" | "cash_account"

export type MetalPurchaseFormValues = {
  purity: string
  purchaseDate: string
  unitsGrams: string
  costPerUnit: string
  paidFromAccount: boolean
  fundingAccountId: string
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
}

export type MetalPurchaseTransaction = {
  id: string
  accountId: string
  purity: string
  purchaseDate: string
  unitsGrams: Decimal
  costPerUnit: Decimal
  totalAmount: Decimal
  currencyCode: string
  fundingMode: MetalPurchaseFundingMode
  fundingAccountId: string | null
  createdAt: string
}

export type ValuedMetalPurchaseTransaction = MetalPurchaseTransaction & {
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
  currentValue: Decimal | null
}

export const emptyMetalPurchaseFormValues: MetalPurchaseFormValues = {
  purity: "",
  purchaseDate: "",
  unitsGrams: "",
  costPerUnit: "",
  paidFromAccount: false,
  fundingAccountId: "",
}

export function getMetalPurchaseTotal(
  values: MetalPurchaseFormValues
): string | null {
  return multiplyDecimals(
    values.unitsGrams.trim() || "0",
    values.costPerUnit.trim() || "0"
  )
}
