import { multiplyDecimals } from "@/lib/financial-calculations/decimal"

export type MetalPurchaseFormValues = {
  purity: string
  purchaseDate: string
  unitsGrams: string
  costPerUnit: string
  paidFromAccount: boolean
  fundingAccountId: string
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
