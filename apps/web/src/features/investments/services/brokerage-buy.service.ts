import { addDecimals, multiplyDecimals } from "@/lib/financial-calculations/decimal"

export function getBrokerageBuyPreview(input: {
  quantity: string
  unitPrice: string
  fees: string
  accountFxRate: string | null
}) {
  const purchaseAmount = multiplyDecimals(input.quantity, input.unitPrice)
  const fees = input.fees.trim() || "0"
  const assetTotal = purchaseAmount ? addDecimals(purchaseAmount, fees) : null
  const accountTotal = assetTotal
    ? input.accountFxRate
      ? multiplyDecimals(assetTotal, input.accountFxRate)
      : assetTotal
    : null

  return { purchaseAmount, fees: input.fees.trim() ? fees : "0", assetTotal, accountTotal }
}
