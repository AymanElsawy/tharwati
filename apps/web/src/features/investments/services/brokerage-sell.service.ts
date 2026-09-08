import {
  formatDecimal,
  multiplyDecimals,
  parseDecimal,
  subtractDecimals,
} from "@/lib/financial-calculations/decimal"

const ledgerScale = 10

function roundToLedgerPrecision(value: string): string | null {
  const parsed = parseDecimal(value)
  if (!parsed) return null
  if (parsed.scale <= ledgerScale) return formatDecimal(parsed.coefficient, parsed.scale)

  const divisor = 10n ** BigInt(parsed.scale - ledgerScale)
  const negative = parsed.coefficient < 0n
  const absolute = negative ? -parsed.coefficient : parsed.coefficient
  const quotient = absolute / divisor
  const remainder = absolute % divisor
  const rounded = quotient + (remainder * 2n >= divisor ? 1n : 0n)
  return formatDecimal(negative ? -rounded : rounded, ledgerScale)
}

export function getBrokerageSellPreview(input: {
  quantity: string
  unitSalePrice: string
  fees: string
  accountFxRate: string | null
}) {
  const rawGross = multiplyDecimals(input.quantity, input.unitSalePrice)
  const grossProceeds = rawGross ? roundToLedgerPrecision(rawGross) : null
  const fees = roundToLedgerPrecision(input.fees.trim() || "0")
  const netAssetProceeds = grossProceeds && fees
    ? subtractDecimals(grossProceeds, fees)
    : null
  const grossAccountProceeds = grossProceeds
    ? input.accountFxRate
      ? roundToLedgerPrecision(multiplyDecimals(grossProceeds, input.accountFxRate) ?? "")
      : grossProceeds
    : null
  const feesAccount = fees
    ? input.accountFxRate
      ? roundToLedgerPrecision(multiplyDecimals(fees, input.accountFxRate) ?? "")
      : fees
    : null
  const estimatedNetCashProceeds = grossAccountProceeds && feesAccount
    ? subtractDecimals(grossAccountProceeds, feesAccount)
    : null

  return { grossProceeds, fees, netAssetProceeds, estimatedNetCashProceeds }
}
